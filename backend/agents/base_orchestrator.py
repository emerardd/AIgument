"""
Shared helpers for debate-style orchestrators.
"""

from typing import Any, Dict, Optional


class BaseOrchestrator:
    """Common runtime state for orchestrators."""

    def __init__(self, ai_client):
        self.ai_client = ai_client
        self.topic: str = ""
        self.total_rounds: int = 0
        self.current_round: int = 0
        self.run_config: Dict[str, Any] = {}

    def configure_run(
        self,
        *,
        topic: str,
        total_rounds: int,
        provider: str,
        model: str,
        temperature: Optional[float],
        seed: Optional[int],
        **extra: Any,
    ) -> Dict[str, Any]:
        self.topic = topic
        self.total_rounds = total_rounds
        self.run_config = {
            "provider": provider,
            "model": model,
            "temperature": temperature,
            "seed": seed,
            "max_rounds": total_rounds,
            **extra,
        }
        return self.run_config
