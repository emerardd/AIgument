"""
Settings and provider availability schemas.
"""
from pydantic import BaseModel, Field, field_validator


class ProviderInfo(BaseModel):
    id: str
    label: str
    description: str
    models: list[str]
    default_model: str
    configured: bool
    api_key_env: str | None = None
    can_manage_key: bool = True


class ProviderStatusResponse(BaseModel):
    providers: list[ProviderInfo]
    default_provider: str
    default_model: str


class ProviderKeyUpdateRequest(BaseModel):
    api_key: str = Field(default="", description="New API key. Empty value clears the saved key.")

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, value: str) -> str:
        if any(character in value for character in ("\r", "\n", "\0")):
            raise ValueError("API key must be a single line without null characters")
        return value.strip()


class ProviderKeyUpdateResponse(BaseModel):
    provider: str
    configured: bool
    saved_to: str


class ProviderTestRequest(BaseModel):
    provider: str
    model: str
    api_key: str | None = Field(default=None, description="Optional one-time API key for this test only.")


class ProviderTestResponse(BaseModel):
    provider: str
    model: str
    ok: bool
    message: str
    latency_ms: int | None = None
