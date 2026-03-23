"""
Dual chat service tests.
"""

import os
import sys
from unittest.mock import AsyncMock, MagicMock

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.dual_chat import ChatRole, DualChatService, ROLE_TEMPLATES, create_dual_chat


class TestChatRole:
    def test_create_role(self):
        role = ChatRole(
            name="测试角色",
            persona="这是一个测试角色",
            speaking_style="正式",
            position="支持",
        )
        assert role.name == "测试角色"
        assert role.persona == "这是一个测试角色"
        assert role.speaking_style == "正式"
        assert role.position == "支持"


class TestDualChatService:
    @pytest.fixture
    def mock_ai_client(self):
        client = MagicMock()
        client.get_completion = AsyncMock(return_value="模拟回复")
        client.chat_stream = AsyncMock()
        return client

    @pytest.fixture
    def roles(self):
        role_a = ChatRole(name="乐观主义者", persona="积极", speaking_style="热情", position="支持")
        role_b = ChatRole(name="现实主义者", persona="理性", speaking_style="冷静", position="中立")
        return role_a, role_b

    def test_init(self, mock_ai_client, roles):
        role_a, role_b = roles
        service = DualChatService(ai_client=mock_ai_client, role_a=role_a, role_b=role_b, topic="AI 的未来")
        assert service.ai_client is mock_ai_client
        assert service.role_a.name == "乐观主义者"
        assert service.role_b.name == "现实主义者"

    def test_build_role_prompt(self, mock_ai_client, roles):
        role_a, role_b = roles
        service = DualChatService(ai_client=mock_ai_client, role_a=role_a, role_b=role_b, topic="AI 的未来")
        prompt = service._build_role_prompt(role_a)
        assert isinstance(prompt, str)
        assert "AI 的未来" in prompt

    def test_build_response_prompt(self, mock_ai_client, roles):
        role_a, role_b = roles
        service = DualChatService(ai_client=mock_ai_client, role_a=role_a, role_b=role_b, topic="AI 的未来")
        prompt = service._build_response_prompt(role_b, last_message="我认为 AI 很强", speaker_name="乐观主义者")
        assert isinstance(prompt, str)
        assert "我认为 AI 很强" in prompt


class TestCreateDualChat:
    def test_create_with_defaults(self):
        service = create_dual_chat(ai_client=MagicMock(), topic="测试主题")
        assert isinstance(service, DualChatService)
        assert hasattr(service, "role_a")
        assert hasattr(service, "role_b")

    def test_create_with_custom_templates(self):
        service = create_dual_chat(
            ai_client=MagicMock(),
            topic="测试主题",
            role_a_template="乐观主义者",
            role_b_template="现实主义者",
        )
        assert isinstance(service, DualChatService)

    def test_role_templates_exported(self):
        assert "乐观主义者" in ROLE_TEMPLATES
