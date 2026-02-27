"""
DualChatService 测试

覆盖角色对话服务初始化和对话构建
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.dual_chat import DualChatService, ChatRole, create_dual_chat
from unittest.mock import MagicMock, AsyncMock


class TestChatRole:
    """测试 ChatRole 数据类"""

    def test_create_role(self):
        role = ChatRole(
            name="测试角色",
            persona="这是一个测试角色",
            speaking_style="正式",
            position="支持"
        )
        assert role.name == "测试角色"
        assert role.persona == "这是一个测试角色"
        assert role.speaking_style == "正式"
        assert role.position == "支持"


class TestDualChatService:
    """DualChatService 初始化和构建"""

    @pytest.fixture
    def mock_ai_client(self):
        client = MagicMock()
        client.chat = AsyncMock(return_value="模拟回复")
        return client

    @pytest.fixture
    def roles(self):
        role_a = ChatRole(
            name="乐观主义者",
            persona="总是看到事物积极的一面",
            speaking_style="热情、鼓舞",
            position="支持"
        )
        role_b = ChatRole(
            name="现实主义者",
            persona="理性分析利弊",
            speaking_style="冷静、客观",
            position="中立"
        )
        return role_a, role_b

    def test_init(self, mock_ai_client, roles):
        role_a, role_b = roles
        service = DualChatService(
            ai_client=mock_ai_client,
            role_a=role_a,
            role_b=role_b,
            topic="AI的未来"
        )
        assert service.ai_client is mock_ai_client
        assert service.role_a.name == "乐观主义者"
        assert service.role_b.name == "现实主义者"

    def test_build_role_prompt(self, mock_ai_client, roles):
        role_a, role_b = roles
        service = DualChatService(
            ai_client=mock_ai_client,
            role_a=role_a,
            role_b=role_b,
            topic="AI的未来"
        )
        prompt = service._build_role_prompt(role_a, is_initiator=True)
        assert isinstance(prompt, str)
        assert len(prompt) > 0

    def test_build_response_prompt(self, mock_ai_client, roles):
        role_a, role_b = roles
        service = DualChatService(
            ai_client=mock_ai_client,
            role_a=role_a,
            role_b=role_b,
            topic="AI的未来"
        )
        prompt = service._build_response_prompt(
            role_b, last_message="我认为AI很棒", speaker_name="乐观主义者"
        )
        assert isinstance(prompt, str)
        assert len(prompt) > 0


class TestCreateDualChat:
    """工厂函数测试"""

    def test_create_with_defaults(self):
        mock_client = MagicMock()
        service = create_dual_chat(
            ai_client=mock_client,
            topic="测试主题"
        )
        assert isinstance(service, DualChatService)
        # 默认角色名由 create_dual_chat 内部定义
        assert hasattr(service, 'role_a')
        assert hasattr(service, 'role_b')

    def test_create_with_custom_templates(self):
        mock_client = MagicMock()
        service = create_dual_chat(
            ai_client=mock_client,
            topic="测试主题",
            role_a_template="乐观主义者",
            role_b_template="现实主义者"
        )
        assert isinstance(service, DualChatService)
