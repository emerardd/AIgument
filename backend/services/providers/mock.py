"""
Mock Provider

用于测试，生成可复现的确定性响应。
逻辑从原 AIClient 迁移过来，保持行为不变。
"""
import hashlib
import json
import random
from typing import AsyncGenerator, Dict, Optional

from .base import BaseProvider


class MockProvider(BaseProvider):
    """Mock Provider，生成可复现的测试响应"""

    def __init__(self, model: str = "mock", seed: Optional[int] = None):
        self.model = model
        self.seed = seed

    def _derive_seed(self, messages: list[dict], temperature: float) -> int:
        payload = json.dumps(messages, ensure_ascii=False, sort_keys=True)
        seed_base = self.seed if self.seed is not None else 0
        raw = f"{seed_base}|{temperature}|{self.model}|{payload}"
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        return int(digest[:8], 16)

    def _mock_response(self, messages: list[dict], temperature: float = 0.7) -> str:
        seed = self._derive_seed(messages, temperature)
        rng = random.Random(seed)
        prompt = messages[-1].get("content", "") if messages else ""
        prompt_str = prompt if isinstance(prompt, str) else json.dumps(prompt, ensure_ascii=False)

        if "pro_score" in prompt_str and "con_score" in prompt_str:
            return json.dumps(self._mock_round_evaluation(rng), ensure_ascii=False)
        if "opening_strategy" in prompt_str and "key_arguments" in prompt_str:
            return json.dumps(self._mock_opening_analysis(rng), ensure_ascii=False)
        if "selected_strategy" in prompt_str and "counter_points" in prompt_str:
            return json.dumps(self._mock_counter_analysis(rng), ensure_ascii=False)
        if "key_turning_points" in prompt_str and "winner" in prompt_str:
            return json.dumps(self._mock_final_verdict(rng), ensure_ascii=False)
        return self._mock_argument_text(rng)

    def _mock_opening_analysis(self, rng: random.Random) -> Dict:
        return {
            "topic_analysis": "辩题涉及社会与技术变迁的边界，需要区分岗位替代与能力增强。",
            "core_stance": "技术将改变岗位形态而非完全替代人类价值。",
            "opening_strategy": "强调历史类比与人机协作的现实案例。",
            "key_arguments": ["技术替代的是任务而非整体职业", "协作模式会创造新岗位需求", "制度与教育会同步调整"],
            "anticipated_opposition": ["自动化会导致大规模失业", "AI 成本低于人力"],
            "confidence": round(rng.uniform(0.6, 0.85), 2),
        }

    def _mock_counter_analysis(self, rng: random.Random) -> Dict:
        return {
            "opponent_main_points": ["对方强调成本优势与效率提升"],
            "opponent_weaknesses": ["忽视再就业与产业结构调整的时间窗"],
            "selected_strategy": rng.choice(["direct_refute", "reframe", "counter_example"]),
            "strategy_reason": "选择可直接削弱对方核心假设的策略。",
            "counter_points": ["效率提升不等同于岗位消失", "历史上技术升级带来新需求"],
            "new_arguments": ["政策与教育可缓冲冲击"],
            "confidence": round(rng.uniform(0.55, 0.8), 2),
        }

    def _mock_round_evaluation(self, rng: random.Random) -> Dict:
        def score():
            return {"logic": rng.randint(5, 9), "evidence": rng.randint(5, 9), "rhetoric": rng.randint(5, 9), "rebuttal": rng.randint(5, 9)}

        pro_score = score()
        con_score = score()
        pro_total = sum(pro_score.values())
        con_total = sum(con_score.values())
        winner = "pro" if pro_total > con_total else ("con" if con_total > pro_total else "tie")
        return {
            "pro_score": pro_score,
            "con_score": con_score,
            "round_winner": winner,
            "commentary": "双方论点清晰，正方在结构性分析上略胜一筹。",
            "highlights": ["结构化论证", "反驳切中要点"],
            "suggestions": {"pro": ["补充更多现实案例支撑论点"], "con": ["加强对反例的处理"]},
        }

    def _mock_final_verdict(self, rng: random.Random) -> Dict:
        winner = rng.choice(["pro", "con", "tie"])
        return {
            "winner": winner,
            "pro_total_score": rng.randint(60, 75),
            "con_total_score": rng.randint(58, 74),
            "margin": rng.choice(["decisive", "close", "marginal"]),
            "summary": "整体而言，双方论证充分，胜负取决于对关键假设的把握。",
            "pro_strengths": ["逻辑连贯", "结构完整"],
            "con_strengths": ["反驳直接", "案例贴近现实"],
            "key_turning_points": ["第二轮反驳质量差异", "总结陈词的结构性优势"],
        }

    def _mock_argument_text(self, rng: random.Random) -> str:
        templates = [
            "我们需要区分任务替代与职业替代。技术会提升效率，但更重要的是重构分工。",
            "历史上每次技术革命都会淘汰部分岗位，但也会催生新的价值链。",
            "关键不在于是否替代，而在于社会如何调整制度与教育以吸收冲击。",
        ]
        rng.shuffle(templates)
        return " ".join(templates)

    async def get_completion(self, messages, temperature=0.7, max_tokens=2000, **kwargs) -> str:
        return self._mock_response(messages, temperature=temperature)

    async def chat_stream(self, messages, temperature=0.7, max_tokens=2000, **kwargs) -> AsyncGenerator[str, None]:
        content = self._mock_response(messages, temperature=temperature)
        chunk_size = 24
        for i in range(0, len(content), chunk_size):
            yield content[i : i + chunk_size]
