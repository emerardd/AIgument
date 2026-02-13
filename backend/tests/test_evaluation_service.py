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
