"""
Application settings and model availability API.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

from dotenv import set_key
from fastapi import APIRouter, HTTPException

from config import DEFAULT_MODEL, DEFAULT_PROVIDER, get_settings
from runtime import ensure_user_data_dir
from schemas.settings import (
    ProviderInfo,
    ProviderKeyUpdateRequest,
    ProviderKeyUpdateResponse,
    ProviderStatusResponse,
    ProviderTestRequest,
    ProviderTestResponse,
)
from services.ai_client import AIClient
from utils import get_api_key
from utils.logger import get_logger


logger = get_logger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


PROVIDER_REGISTRY = {
    "deepseek": {
        "label": "DeepSeek",
        "description": "高性价比，中文能力强",
        "models": ["deepseek-v4-flash", "deepseek-v4-pro"],
        "api_key_env": "DEEPSEEK_API_KEY",
    },
    "openai": {
        "label": "OpenAI",
        "description": "GPT 系列模型",
        "models": ["gpt-5.5"],
        "api_key_env": "OPENAI_API_KEY",
    },
    "gemini": {
        "label": "Google Gemini",
        "description": "Google AI 模型",
        "models": ["gemini-3.1-pro", "gemini-3-flash", "gemini-3.1-flash-lite"],
        "api_key_env": "GEMINI_API_KEY",
    },
    "claude": {
        "label": "Anthropic Claude",
        "description": "安全可靠的 AI 助手",
        "models": ["claude-opus-4.7"],
        "api_key_env": "CLAUDE_API_KEY",
    },
    "mock": {
        "label": "Mock",
        "description": "离线演示和功能测试",
        "models": ["mock"],
        "api_key_env": None,
    },
}


def _validate_provider(provider: str) -> dict:
    meta = PROVIDER_REGISTRY.get(provider)
    if not meta:
        raise HTTPException(status_code=400, detail="不支持的 AI 服务提供商")
    return meta


def _provider_configured(provider: str) -> bool:
    if provider == "mock":
        return True
    try:
        return bool(get_api_key(provider))
    except Exception:
        return False


def _settings_env_file() -> Path:
    override = os.getenv("AIGUMENT_SETTINGS_ENV_FILE")
    if override:
        return Path(override)
    return ensure_user_data_dir() / ".env"


def _reload_settings_cache() -> None:
    get_settings.cache_clear()


@router.get("/providers", response_model=ProviderStatusResponse)
def get_provider_status():
    settings = get_settings()
    providers = []
    for provider, meta in PROVIDER_REGISTRY.items():
        models = list(meta["models"])
        providers.append(
            ProviderInfo(
                id=provider,
                label=meta["label"],
                description=meta["description"],
                models=models,
                default_model=models[0],
                configured=_provider_configured(provider),
                api_key_env=meta["api_key_env"],
                can_manage_key=provider != "mock",
            )
        )

    return ProviderStatusResponse(
        providers=providers,
        default_provider=settings.default_provider or DEFAULT_PROVIDER,
        default_model=settings.default_model or DEFAULT_MODEL,
    )


@router.put("/providers/{provider}/key", response_model=ProviderKeyUpdateResponse)
def update_provider_key(provider: str, request: ProviderKeyUpdateRequest):
    meta = _validate_provider(provider)
    env_name = meta.get("api_key_env")
    if not env_name:
        raise HTTPException(status_code=400, detail="该 provider 不需要 API Key")

    env_file = _settings_env_file()
    env_file.parent.mkdir(parents=True, exist_ok=True)
    if not env_file.exists():
        env_file.write_text("", encoding="utf-8")

    api_key = request.api_key.strip()
    # Keep an empty override when clearing, otherwise a lower-priority .env
    # can silently reactivate an old key after the settings cache is reloaded.
    set_key(str(env_file), env_name, api_key, quote_mode="always")
    os.environ[env_name] = api_key

    _reload_settings_cache()
    configured = _provider_configured(provider)
    return ProviderKeyUpdateResponse(
        provider=provider,
        configured=configured,
        saved_to=str(env_file),
    )


@router.post("/providers/test", response_model=ProviderTestResponse)
async def test_provider(request: ProviderTestRequest):
    _validate_provider(request.provider)
    model = request.model.strip()
    if not model:
        raise HTTPException(status_code=400, detail="模型名称不能为空")

    started_at = time.perf_counter()
    try:
        api_key = request.api_key.strip() if request.api_key else None
        if api_key is None:
            api_key = get_api_key(request.provider)

        client = AIClient(provider=request.provider, model=model, api_key=api_key, retry_attempts=1)
        response = await client.get_completion(
            [{"role": "user", "content": "请用不超过12个字回复：连接测试成功"}],
            temperature=0,
            max_tokens=32,
        )
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        message = response.strip() or "连接测试成功"
        return ProviderTestResponse(
            provider=request.provider,
            model=model,
            ok=True,
            message=message[:120],
            latency_ms=latency_ms,
        )
    except Exception as exc:
        logger.warning("provider test failed for %s/%s: %s", request.provider, model, exc)
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        return ProviderTestResponse(
            provider=request.provider,
            model=model,
            ok=False,
            message=str(exc),
            latency_ms=latency_ms,
        )
