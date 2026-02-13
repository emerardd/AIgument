"""Prompt helper with graceful fallback when prompt-vcs is unavailable."""

from typing import Callable

PromptResolver = Callable[[str, str], str]

_resolver: PromptResolver | None = None

try:
    from prompt_vcs import p as _prompt_vcs_resolver

    _resolver = _prompt_vcs_resolver
except Exception:
    _resolver = None


def resolve_prompt(prompt_id: str, default_prompt: str) -> str:
    """Resolve prompt by id; return default prompt when resolver is unavailable."""
    if _resolver is None:
        return default_prompt
    try:
        return _resolver(prompt_id, default_prompt)
    except Exception:
        return default_prompt
