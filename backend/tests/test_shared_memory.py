"""
SharedMemory / DebateMemory 测试

覆盖核心方法：add_argument, add_evaluation, get_current_standings, export_transcript
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from memory.shared_memory import SharedMemory, DebateMemory


class TestSharedMemory:
    """共享记忆基本功能"""

    def test_set_and_get(self):
        mem = SharedMemory()
        mem.set("key1", "value1")
        assert mem.get("key1") == "value1"

    def test_get_default(self):
        mem = SharedMemory()
        assert mem.get("missing", "default") == "default"

    def test_overwrite(self):
        mem = SharedMemory()
        mem.set("key1", "original")
        mem.set("key1", "updated")
        assert mem.get("key1") == "updated"


class TestDebateMemory:
    """辩论记忆核心功能"""

    @pytest.fixture
    def memory(self):
        return DebateMemory(topic="AI是否会取代人类", total_rounds=3)

    def test_init(self, memory):
        assert memory.topic == "AI是否会取代人类"
        assert memory.total_rounds == 3
        assert memory.current_round == 0

    def test_start_debate(self, memory):
        memory.start_debate()
        state = memory.get_full_state()
        assert state["status"] == "in_progress"

    def test_add_argument(self, memory):
        memory.start_debate()
        memory.start_round(1)
        memory.add_argument(
            side="pro",
            agent_name="正方",
            content="AI提高了生产力",
            thinking={"analysis": "从经济角度"}
        )
        assert len(memory.arguments) == 1
        assert memory.arguments[0].side == "pro"
        assert memory.arguments[0].content == "AI提高了生产力"

    def test_add_evaluation(self, memory):
        memory.start_debate()
        memory.start_round(1)
        eval_data = {
            "round": 1,
            "pro_score": {"logic": 8, "evidence": 7, "rhetoric": 6, "rebuttal": 5},
            "con_score": {"logic": 7, "evidence": 8, "rhetoric": 7, "rebuttal": 6},
            "round_winner": "con",
            "commentary": "test commentary",
        }
        memory.add_evaluation(eval_data)
        assert len(memory.evaluations) == 1
        assert memory.evaluations[0]["round_winner"] == "con"

    def test_get_current_standings(self, memory):
        memory.start_debate()
        standings = memory.get_current_standings()
        assert standings["status"] == "in_progress"
        assert standings["pro_total_score"] == 0
        assert standings["con_total_score"] == 0

    def test_standings_with_evaluations(self, memory):
        memory.start_debate()
        memory.start_round(1)
        memory.add_evaluation({
            "round": 1,
            "pro_score": {"logic": 8, "evidence": 7, "rhetoric": 6, "rebuttal": 5},
            "con_score": {"logic": 7, "evidence": 6, "rhetoric": 7, "rebuttal": 6},
            "round_winner": "pro",
        })
        standings = memory.get_current_standings()
        assert standings["pro_total_score"] == 26  # 8+7+6+5
        assert standings["con_total_score"] == 26  # 7+6+7+6
        assert standings["pro_round_wins"] == 1

    def test_export_transcript(self, memory):
        memory.start_debate()
        memory.start_round(1)
        memory.add_argument("pro", "正方", "论点一")
        memory.add_argument("con", "反方", "反驳一")
        transcript = memory.export_transcript()
        assert "正方" in transcript
        assert "论点一" in transcript

    def test_run_config(self, memory):
        config = {"provider": "deepseek", "model": "deepseek-chat"}
        memory.set_run_config(config)
        assert memory.get("run_config") == config

    def test_complete_debate(self, memory):
        memory.start_debate()
        verdict = {"winner": "pro", "summary": "正方胜出"}
        memory.complete_debate(verdict)
        state = memory.get_full_state()
        assert state["status"] == "completed"

    def test_get_full_state(self, memory):
        memory.start_debate()
        state = memory.get_full_state()
        assert "topic" in state
        assert "status" in state
        assert "arguments" in state
        assert "evaluations" in state
