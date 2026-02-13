"""
评测服务

提供辩论 Trace 的评测与对比能力。
"""
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


def _infer_from_text(turns: List[Dict[str, Any]]) -> ScoreBreakdown:
    text = " ".join(t.get("result", "") for t in turns)
    length = max(len(text), 1)
    logic = _clamp(len([w for w in ["因此", "所以", "因为", "从而"] if w in text]) * 2)
    evidence = _clamp(len([w for w in ["数据", "研究", "案例", "统计"] if w in text]) * 2)
    rebuttal = _clamp(len([w for w in ["反驳", "然而", "但是", "并非"] if w in text]) * 2)
    clarity = _clamp(10 - (length / 2000) * 2)
    total = round((logic + evidence + rebuttal + clarity) / 4, 2)
    return ScoreBreakdown(
        logic=round(logic, 2),
        evidence=round(evidence, 2),
        rebuttal=round(rebuttal, 2),
        clarity=round(clarity, 2),
        total=total
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
    else:
        score = _infer_from_text(turns)
        logic = score.logic
        evidence = score.evidence
        rebuttal = score.rebuttal
        clarity = score.clarity
        total = score.total
        consistency = 0.0
        notes.append("评测基于启发式文本统计")

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
