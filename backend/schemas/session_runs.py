"""Request models for the dialectic, dual-chat and Socratic QA runs."""
import json
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from config import DEFAULT_MODEL, DEFAULT_PROVIDER

Provider = Literal["deepseek", "openai", "gemini", "claude", "mock"]
Preset = Literal["basic", "quality", "budget"]
QAMode = Literal["socratic", "structured", "hybrid"]


class DialecticRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    rounds: int = Field(5, ge=1, le=10)
    provider: Provider = DEFAULT_PROVIDER
    model: str = Field(DEFAULT_MODEL, min_length=1)
    temperature: Optional[float] = Field(None, ge=0, le=1)
    seed: Optional[int] = None
    preset: Optional[Preset] = None


class DualChatRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    role_a: str = "乐观主义者"
    role_b: str = "现实主义者"
    turns: int = Field(3, ge=1, le=20)
    provider: Provider = DEFAULT_PROVIDER
    model: str = Field(DEFAULT_MODEL, min_length=1)


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = ""


class SocraticQARequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=4000)
    mode: QAMode = "hybrid"
    history: list[HistoryMessage] = Field(default_factory=list)
    provider: Provider = DEFAULT_PROVIDER
    model: str = Field(DEFAULT_MODEL, min_length=1)
    session_id: Optional[int] = None

    @field_validator("history", mode="before")
    @classmethod
    def parse_history(cls, value):
        """GET streams pass history as a JSON string."""
        if value is None or value == "":
            return []
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError(f"history must be valid JSON: {exc}") from exc
        if not isinstance(value, list):
            raise ValueError("history must be a JSON array")
        return value
