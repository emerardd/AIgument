"""
Evaluation service tests.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.evaluation import evaluate_trace, compare_traces


def _build_trace(overall_bias: int = 0):
    evaluations = [
        {
            "round": 1,
            "pro_score": {"logic": 7 + overall_bias, "evidence": 6, "rebuttal": 5, "rhetoric": 7},
            "con_score": {"logic": 6, "evidence": 5, "rebuttal": 6, "rhetoric": 6},
            "round_winner": "pro",
            "commentary": "ok"
        },
        {
            "round": 2,
            "pro_score": {"logic": 6 + overall_bias, "evidence": 6, "rebuttal": 6, "rhetoric": 6},
            "con_score": {"logic": 5, "evidence": 5, "rebuttal": 5, "rhetoric": 5},
            "round_winner": "pro",
            "commentary": "ok"
        }
    ]
    turns = [
        {"result": "We argue technology changes tasks, not entire jobs."},
        {"result": "The opposing view ignores social adjustment mechanisms."}
    ]
    return {"trace_id": "trace-1", "evaluations": evaluations, "turns": turns}


def test_evaluate_trace_with_evaluations():
    trace = _build_trace()
    result = evaluate_trace(trace)
    assert result.trace_id == "trace-1"
    assert result.overall > 0
    assert result.winner in {"pro", "con", "tie", None}
    assert result.dimensions.total == result.overall


def test_compare_traces_winner():
    left = _build_trace(overall_bias=0)
    right = _build_trace(overall_bias=2)
    result = compare_traces(left, right)
    assert result.winner == "right"
    assert result.delta["overall"] > 0


def test_evaluate_trace_structured_fallback_without_jury_scores():
    trace = {
        "trace_id": "fallback-1",
        "evaluations": [],
        "turns": [
            {
                "round": 1,
                "side": "pro",
                "result": "首先，因为已有研究和数据支持这个观点，所以结论具备现实基础。",
            },
            {
                "round": 1,
                "side": "con",
                "result": "然而，对方忽视了反例和执行成本，这一点需要反驳。",
            },
        ],
    }

    result = evaluate_trace(trace)

    assert result.overall > 0
    assert result.consistency > 0
    assert result.pro_average is not None
    assert result.con_average is not None
    assert result.winner in {"pro", "con", "tie"}
    assert result.notes == ["评测基于结构化规则兜底，未使用评审 Agent 分数"]


def test_evaluate_trace_prefers_embedded_turn_scores_before_rule_fallback():
    trace = {
        "trace_id": "turn-score-1",
        "evaluations": [],
        "turns": [
            {
                "round": 1,
                "side": "pro",
                "result": "正方发言",
                "score": {"logic": 8, "evidence": 7, "rebuttal": 6, "clarity": 8},
            },
            {
                "round": 1,
                "side": "con",
                "result": "反方发言",
                "score": {"logic": 5, "evidence": 5, "rebuttal": 5, "clarity": 6},
            },
        ],
    }

    result = evaluate_trace(trace)

    assert result.dimensions.logic == 6.5
    assert result.pro_average is not None
    assert result.con_average is not None
    assert result.winner == "pro"
    assert result.notes == ["评测基于 Trace 内嵌回合评分聚合"]


def test_embedded_scores_ignore_numeric_metadata_and_alias_duplicates():
    result = evaluate_trace({"turns": [
        {"side": "pro", "score": {"logic": 5, "evidence": 5, "rebuttal": 5, "clarity": 5,
                                    "rhetoric": 10, "total": 100, "latency": 1000}},
        {"side": "con", "score": {"logic": 6, "evidence": 6, "rebuttal": 6, "rhetoric": 6}},
    ]})
    assert result.pro_average == 20
    assert result.con_average == 24
    assert result.winner == "con"


def test_incomplete_embedded_scores_do_not_suppress_text_fallback():
    for score in ({}, {"total": 30}, {"logic": True}, {"logic": float("nan")}):
        result = evaluate_trace({"turns": [{"result": "Because the study provides evidence.", "score": score}]})
        assert result.overall > 0
        assert "Agent" in result.notes[0]


def test_empty_trace_has_no_invented_quality_or_consistency():
    result = evaluate_trace({"turns": [{"result": "   ", "score": {}}]})
    assert result.overall == 0
    assert result.consistency == 0
    assert result.winner is None
