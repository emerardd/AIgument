"""
评测服务

提供辩论 Trace 的评测与对比能力。
"""
import re
import math
from typing import Dict, Any, List
import statistics

from schemas.evaluation import EvaluationResult, ScoreBreakdown, EvaluationCompareResult


def _avg(values: List[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


def _clamp(value: float, min_value: float = 0.0, max_value: float = 10.0) -> float:
    return max(min_value, min(max_value, value))


def _extract_dimension_scores(evaluations: List[Dict[str, Any]], key: str) -> List[float]:
    values = []
    for e in evaluations:
        pro_score = e.get("pro_score", {}) if isinstance(e.get("pro_score"), dict) else {}
        con_score = e.get("con_score", {}) if isinstance(e.get("con_score"), dict) else {}
        pro_val = pro_score.get(key, 0)
        con_val = con_score.get(key, 0)
        values.append((pro_val + con_val) / 2)
    return values


def _extract_turn_score(turns: List[Dict[str, Any]]) -> tuple[ScoreBreakdown, float, float | None, float | None, str | None] | None:
    scored_turns = []
    for turn in turns:
        score = turn.get("score")
        if not isinstance(score, dict):
            continue
        normalized = {}
        for key in ("logic", "evidence", "rebuttal", "clarity"):
            value = score.get(key, score.get("rhetoric") if key == "clarity" else None)
            if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
                normalized[key] = _clamp(float(value))
        if len(normalized) == 4:
            scored_turns.append((turn, normalized))

    if not scored_turns:
        return None

    def dimension(key: str, fallback_key: str | None = None) -> float:
        values = []
        for _, score in scored_turns:
            raw = score.get(key)
            if raw is None and fallback_key:
                raw = score.get(fallback_key)
            if isinstance(raw, (int, float)):
                values.append(float(raw))
        return _avg(values)

    logic = dimension("logic")
    evidence = dimension("evidence")
    rebuttal = dimension("rebuttal")
    clarity = dimension("clarity", "rhetoric")
    total = _avg([logic, evidence, rebuttal, clarity])

    turn_totals = []
    side_totals: dict[str, list[float]] = {"pro": [], "con": []}
    for turn, score in scored_turns:
        values = [float(value) for value in score.values() if isinstance(value, (int, float))]
        if not values:
            continue
        turn_total = sum(values)
        turn_totals.append(turn_total)
        side = str(turn.get("side", "")).lower()
        if side in side_totals:
            side_totals[side].append(turn_total)

    if len(turn_totals) < 2:
        consistency = 0.0
    else:
        consistency = round(_clamp(10 - statistics.pstdev(turn_totals) / 2), 2)

    pro_average = _avg(side_totals["pro"]) if side_totals["pro"] else None
    con_average = _avg(side_totals["con"]) if side_totals["con"] else None
    winner = None
    if pro_average is not None and con_average is not None:
        winner = "pro" if pro_average > con_average else ("con" if con_average > pro_average else "tie")

    return (
        ScoreBreakdown(
            logic=logic,
            evidence=evidence,
            rebuttal=rebuttal,
            clarity=clarity,
            total=round(total, 2),
        ),
        consistency,
        pro_average,
        con_average,
        winner,
    )


def _compute_consistency(evaluations: List[Dict[str, Any]]) -> float:
    pro_totals = []
    con_totals = []
    for e in evaluations:
        pro_score = e.get("pro_score", {}) if isinstance(e.get("pro_score"), dict) else {}
        con_score = e.get("con_score", {}) if isinstance(e.get("con_score"), dict) else {}
        pro_totals.append(sum(pro_score.values()) if pro_score else 0)
        con_totals.append(sum(con_score.values()) if con_score else 0)
    totals = pro_totals + con_totals
    if len(totals) < 2:
        return 0.0
    deviation = statistics.pstdev(totals)
    return round(_clamp(10 - deviation / 2), 2)


def _extract_turn_text(turn: Dict[str, Any]) -> str:
    value = turn.get("result") or turn.get("content") or ""
    return value if isinstance(value, str) else str(value)


def _count_markers(text: str, markers: List[str]) -> int:
    lowered = text.lower()
    return sum(lowered.count(marker.lower()) for marker in markers)


def _sentence_count(text: str) -> int:
    parts = [part.strip() for part in re.split(r"[。！？.!?\n]+", text) if part.strip()]
    return max(1, len(parts))


def _score_marker_density(text: str, markers: List[str], *, weight: float = 1.0) -> float:
    total = _count_markers(text, markers)
    diversity = sum(1 for marker in markers if marker.lower() in text.lower())
    return _clamp((total * 1.15 + diversity * 0.65) * weight)


def _side_texts(turns: List[Dict[str, Any]]) -> dict[str, str]:
    sides: dict[str, list[str]] = {"pro": [], "con": []}
    for turn in turns:
        side = str(turn.get("side", "")).lower()
        text = _extract_turn_text(turn)
        if side in sides:
            sides[side].append(text)
    return {side: " ".join(texts) for side, texts in sides.items()}


def _side_quality(text: str) -> float:
    if not text.strip():
        return 0.0
    logic_markers = ["因为", "因此", "所以", "首先", "其次", "结论", "前提", "therefore", "because"]
    evidence_markers = ["数据", "研究", "案例", "统计", "报告", "证据", "example", "study", "data"]
    rebuttal_markers = ["但是", "然而", "反驳", "并非", "忽视", "相反", "counter", "however"]
    return round(_clamp(
        2.0
        + _score_marker_density(text, logic_markers, weight=0.35)
        + _score_marker_density(text, evidence_markers, weight=0.3)
        + _score_marker_density(text, rebuttal_markers, weight=0.25)
        + min(2.0, len(text) / 700),
    ), 2)


def _infer_from_text(turns: List[Dict[str, Any]]) -> tuple[ScoreBreakdown, float, float | None, float | None, str | None]:
    texts = [_extract_turn_text(t) for t in turns if _extract_turn_text(t).strip()]
    if not texts:
        return ScoreBreakdown(), 0.0, None, None, None
    text = " ".join(texts)
    length = max(len(text), 1)
    round_count = len({t.get("round") for t in turns if t.get("round") is not None})

    logic_markers = ["因为", "因此", "所以", "从而", "首先", "其次", "最后", "前提", "结论", "逻辑", "therefore", "because", "if", "then"]
    evidence_markers = ["数据", "研究", "案例", "统计", "报告", "事实", "证据", "样本", "调查", "example", "study", "data", "evidence"]
    rebuttal_markers = ["反驳", "然而", "但是", "并非", "忽视", "相反", "漏洞", "质疑", "counter", "however", "but", "flaw"]

    structure_bonus = min(2.0, round_count * 0.45 + len(texts) * 0.18)
    logic = _clamp(1.5 + structure_bonus + _score_marker_density(text, logic_markers, weight=0.75))
    evidence = _clamp(1.0 + min(2.0, len(texts) * 0.2) + _score_marker_density(text, evidence_markers, weight=0.9))
    rebuttal = _clamp(1.0 + min(2.0, max(0, len(texts) - 1) * 0.25) + _score_marker_density(text, rebuttal_markers, weight=0.9))

    sentence_count = _sentence_count(text)
    avg_sentence_length = length / sentence_count
    length_penalty = max(0.0, (avg_sentence_length - 110) / 45)
    too_short_penalty = 1.5 if length < 120 else 0.0
    clarity = _clamp(8.6 - length_penalty - too_short_penalty + min(0.9, sentence_count * 0.04))

    sides = _side_texts(turns)
    pro_average = _side_quality(sides["pro"]) if sides["pro"].strip() else None
    con_average = _side_quality(sides["con"]) if sides["con"].strip() else None
    winner = None
    if pro_average is not None and con_average is not None:
        delta = pro_average - con_average
        winner = "pro" if delta > 0.35 else ("con" if delta < -0.35 else "tie")

    side_lengths = [len(value) for value in sides.values() if value.strip()]
    if len(side_lengths) >= 2 and max(side_lengths) > 0:
        balance = min(side_lengths) / max(side_lengths)
        consistency = round(_clamp(5.0 + balance * 5.0), 2)
    else:
        consistency = round(_clamp(4.0 + min(4.0, len(texts) * 0.7)), 2)

    total = round((logic + evidence + rebuttal + clarity) / 4, 2)
    return (
        ScoreBreakdown(
            logic=round(logic, 2),
            evidence=round(evidence, 2),
            rebuttal=round(rebuttal, 2),
            clarity=round(clarity, 2),
            total=total
        ),
        consistency,
        pro_average,
        con_average,
        winner,
    )


def evaluate_trace(trace: Dict[str, Any]) -> EvaluationResult:
    evaluations = trace.get("evaluations") or []
    turns = trace.get("turns") or []
    notes = []

    if evaluations:
        logic_scores = _extract_dimension_scores(evaluations, "logic")
        evidence_scores = _extract_dimension_scores(evaluations, "evidence")
        rebuttal_scores = _extract_dimension_scores(evaluations, "rebuttal")
        clarity_scores = _extract_dimension_scores(evaluations, "rhetoric")

        logic = _avg(logic_scores)
        evidence = _avg(evidence_scores)
        rebuttal = _avg(rebuttal_scores)
        clarity = _avg(clarity_scores)

        total = _avg([logic, evidence, rebuttal, clarity])
        consistency = _compute_consistency(evaluations)
        notes.append("评测基于评审分数聚合")
    elif turn_score_result := _extract_turn_score(turns):
        score, turn_consistency, turn_pro_avg, turn_con_avg, turn_winner = turn_score_result
        logic = score.logic
        evidence = score.evidence
        rebuttal = score.rebuttal
        clarity = score.clarity
        total = score.total
        consistency = turn_consistency
        notes.append("评测基于 Trace 内嵌回合评分聚合")
    else:
        score, fallback_consistency, fallback_pro_avg, fallback_con_avg, fallback_winner = _infer_from_text(turns)
        logic = score.logic
        evidence = score.evidence
        rebuttal = score.rebuttal
        clarity = score.clarity
        total = score.total
        consistency = fallback_consistency
        notes.append("评测基于结构化规则兜底，未使用评审 Agent 分数")

    pro_totals = []
    con_totals = []
    for e in evaluations:
        pro_score = e.get("pro_score", {}) if isinstance(e.get("pro_score"), dict) else {}
        con_score = e.get("con_score", {}) if isinstance(e.get("con_score"), dict) else {}
        pro_totals.append(sum(pro_score.values()) if pro_score else 0)
        con_totals.append(sum(con_score.values()) if con_score else 0)

    pro_avg = _avg(pro_totals) if pro_totals else None
    con_avg = _avg(con_totals) if con_totals else None
    winner = None
    if pro_totals or con_totals:
        pro_total = sum(pro_totals)
        con_total = sum(con_totals)
        winner = "pro" if pro_total > con_total else ("con" if con_total > pro_total else "tie")
    elif "turn_pro_avg" in locals() or "turn_con_avg" in locals():
        pro_avg = turn_pro_avg
        con_avg = turn_con_avg
        winner = turn_winner
    elif "fallback_pro_avg" in locals() or "fallback_con_avg" in locals():
        pro_avg = fallback_pro_avg
        con_avg = fallback_con_avg
        winner = fallback_winner

    return EvaluationResult(
        trace_id=trace.get("trace_id"),
        overall=round(total, 2),
        dimensions=ScoreBreakdown(
            logic=logic,
            evidence=evidence,
            rebuttal=rebuttal,
            clarity=clarity,
            total=round(total, 2)
        ),
        consistency=consistency,
        pro_average=pro_avg,
        con_average=con_avg,
        winner=winner,
        notes=notes
    )


def compare_traces(left: Dict[str, Any], right: Dict[str, Any]) -> EvaluationCompareResult:
    left_result = evaluate_trace(left)
    right_result = evaluate_trace(right)

    delta = {
        "overall": round(right_result.overall - left_result.overall, 2),
        "consistency": round(right_result.consistency - left_result.consistency, 2),
        "logic": round(right_result.dimensions.logic - left_result.dimensions.logic, 2),
        "evidence": round(right_result.dimensions.evidence - left_result.dimensions.evidence, 2),
        "rebuttal": round(right_result.dimensions.rebuttal - left_result.dimensions.rebuttal, 2),
        "clarity": round(right_result.dimensions.clarity - left_result.dimensions.clarity, 2),
    }

    winner = "tie"
    if right_result.overall > left_result.overall:
        winner = "right"
    elif left_result.overall > right_result.overall:
        winner = "left"

    return EvaluationCompareResult(
        left=left_result,
        right=right_result,
        delta=delta,
        winner=winner
    )
