"""
Settings and provider availability API tests.
"""
import os
import pytest


def test_provider_status_includes_configurable_providers(client):
    response = client.get("/api/settings/providers")

    assert response.status_code == 200
    data = response.json()
    providers = {item["id"]: item for item in data["providers"]}

    assert {"deepseek", "openai", "gemini", "claude", "mock"}.issubset(providers)
    assert providers["mock"]["configured"] is True
    assert providers["mock"]["can_manage_key"] is False
    assert providers["deepseek"]["api_key_env"] == "DEEPSEEK_API_KEY"
    assert data["default_provider"]
    assert data["default_model"]


def test_provider_test_works_with_mock(client):
    response = client.post(
        "/api/settings/providers/test",
        json={"provider": "mock", "model": "mock"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["provider"] == "mock"
    assert data["latency_ms"] is not None


def test_provider_test_rejects_unknown_provider(client):
    response = client.post(
        "/api/settings/providers/test",
        json={"provider": "unknown", "model": "anything"},
    )

    assert response.status_code == 400


def test_provider_key_can_be_saved_and_cleared(client, monkeypatch, tmp_path):
    env_file = tmp_path / "settings.env"
    monkeypatch.setenv("AIGUMENT_SETTINGS_ENV_FILE", str(env_file))
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    try:
        save_response = client.put(
            "/api/settings/providers/openai/key",
            json={"api_key": "test-openai-key"},
        )

        assert save_response.status_code == 200
        save_data = save_response.json()
        assert save_data["configured"] is True
        assert save_data["saved_to"] == str(env_file)
        assert os.environ["OPENAI_API_KEY"] == "test-openai-key"
        assert "OPENAI_API_KEY='test-openai-key'" in env_file.read_text(encoding="utf-8")

        clear_response = client.put(
            "/api/settings/providers/openai/key",
            json={"api_key": ""},
        )

        assert clear_response.status_code == 200
        assert clear_response.json()["provider"] == "openai"
        assert os.environ["OPENAI_API_KEY"] == ""
        assert clear_response.json()["configured"] is False
        assert "OPENAI_API_KEY=''" in env_file.read_text(encoding="utf-8")
    finally:
        if env_file.exists():
            env_file.unlink()


@pytest.mark.parametrize("key", ["abc\nDEFAULT_PROVIDER=mock", "abc\rxyz", "abc\0xyz"])
def test_provider_key_rejects_config_injection(client, monkeypatch, tmp_path, key):
    env_file = tmp_path / "settings.env"
    monkeypatch.setenv("AIGUMENT_SETTINGS_ENV_FILE", str(env_file))
    response = client.put("/api/settings/providers/openai/key", json={"api_key": key})
    assert response.status_code == 422
    assert not env_file.exists()


def test_cleared_key_masks_lower_priority_env_file(client, monkeypatch, tmp_path):
    from config import Settings, get_settings
    from routers import settings as settings_router

    saved_file = tmp_path / "saved.env"
    fallback_file = tmp_path / "fallback.env"
    fallback_file.write_text("OPENAI_API_KEY=old-key\n", encoding="utf-8")
    monkeypatch.setenv("AIGUMENT_SETTINGS_ENV_FILE", str(saved_file))
    monkeypatch.setenv("OPENAI_API_KEY", "old-key")
    monkeypatch.setattr(settings_router, "_provider_configured", lambda provider: bool(
        Settings(_env_file=fallback_file).openai_api_key
    ))
    try:
        response = client.put("/api/settings/providers/openai/key", json={"api_key": ""})
        assert response.status_code == 200
        assert response.json()["configured"] is False
    finally:
        get_settings.cache_clear()
