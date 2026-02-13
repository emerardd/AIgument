"""
成本估算工具

基于简单规则估算 token 数量与成本，适用于粗略展示。
"""
from typing import Iterable, Dict, Any
import math


def estimate_tokens(text: str) -> int:
    """估算 token 数量（粗略）"""
    if not text:
        return 0
    return max(1, int(math.ceil(len(text) / 4)))


def estimate_cost(texts: Iterable[str], pricing: Dict[str, float]) -> Dict[str, Any]:
    """估算成本

    Args:
        texts: 输出文本列表
        pricing: {"prompt": price_per_1k, "completion": price_per_1k}
    """
    completion_tokens = sum(estimate_tokens(text) for text in texts)
    prompt_tokens = int(completion_tokens * 1.2)
    total_tokens = prompt_tokens + completion_tokens

    prompt_price = pricing.get("prompt", 0.0)
    completion_price = pricing.get("completion", 0.0)
    estimated_usd = (prompt_tokens / 1000) * prompt_price + (completion_tokens / 1000) * completion_price

    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "estimated_usd": round(estimated_usd, 6),
        "price_per_1k_prompt": prompt_price,
        "price_per_1k_completion": completion_price
    }
