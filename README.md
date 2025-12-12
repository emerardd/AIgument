# AIgument

"AIgument" 是一个基于大语言模型的智能对话平台，支持多种交互模式，包括辩论模式、对话模式和问答模式。该平台旨在通过AI模型间的互动，探索并展示人工智能在不同场景下的推理与表达能力。

## 功能特点

- **多模式交互**：
  - **辩论模式**：两个AI模型分别扮演正反方，就同一主题进行多轮辩论
  - **对话模式**：两个不同角色的AI进行对话，展示不同视角的观点交流
  - **问答模式**：提供详细、简洁或苏格拉底式的回答风格选择

- **多模型支持**：
  - DeepSeek (deepseek-chat, deepseek-coder)
  - OpenAI (gpt-5.2, gpt-5-mini, gpt-5-nano, gpt-5.2-pro, gpt-5, gpt-4.1)
  - Google Gemini (gemini-2.5-flash, gemini-2.5-pro, gemini-3-pro-preview)
  - Anthropic Claude (claude-opus-4.5, claude-sonnet-4.5)

- **实时显示**：
  - 流式输出技术（SSE）实时显示生成内容
  - 非流式模式下支持逐步显示和打字机效果，提升用户体验

- **丰富表现形式**：
  - Markdown格式支持，包括粗体、列表、引用、代码块等格式化展示
  - 代码高亮显示
  - 打字机动画效果

- **自定义选项**：
  - 辩论轮次选择（1-5轮）
  - 对话角色选择（科学家、哲学家、作家等）
  - 问答风格选择（详细分析、简洁直接、苏格拉底式）
  - 模型和服务提供商选择

- **现代化UI**：
  - 响应式设计，适配桌面和移动设备
  - 动画效果增强用户体验
  - 清晰的视觉层次和交互反馈
  - 深色/浅色模式切换

## 技术栈

- **后端**：
  - FastAPI - 高性能异步 Web 框架
  - SQLAlchemy - ORM 数据库操作
  - Pydantic - 数据验证和序列化
  - Uvicorn - ASGI 服务器

- **前端**：
  - React 18 - 用户界面库
  - TypeScript - 类型安全
  - Vite - 快速构建工具
  - Tailwind CSS - 原子化 CSS 框架
  - Zustand - 轻量级状态管理
  - React Router - 客户端路由

- **AI 模型集成**：
  - OpenAI SDK
  - Google GenAI SDK
  - Anthropic SDK

- **流媒体技术**：Server-Sent Events (SSE)

## 项目结构

```
aigument/
├── backend/                 # FastAPI 后端
│   ├── main.py              # 应用入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── utils.py             # 工具函数
│   ├── .env                 # 环境变量（需自行创建）
│   ├── requirements.txt     # Python 依赖
│   ├── routers/             # API 路由
│   │   ├── debate.py        # 辩论 API
│   │   ├── chat.py          # 对话 API
│   │   ├── qa.py            # 问答 API
│   │   └── history.py       # 历史记录 API
│   ├── services/            # 业务逻辑
│   │   └── ai_client.py     # 统一 AI 客户端
│   ├── models/              # 数据库模型
│   └── schemas/             # Pydantic 数据模型
├── frontend/                # React 前端
│   ├── src/
│   │   ├── App.tsx          # 应用根组件
│   │   ├── main.tsx         # 入口文件
│   │   ├── index.css        # 全局样式
│   │   ├── pages/           # 页面组件
│   │   │   ├── Debate.tsx   # 辩论页面
│   │   │   ├── Chat.tsx     # 对话页面
│   │   │   ├── QA.tsx       # 问答页面
│   │   │   ├── History.tsx  # 历史记录页面
│   │   │   └── Settings.tsx # 设置页面
│   │   ├── stores/          # Zustand 状态管理
│   │   ├── components/      # 可复用组件
│   │   └── services/        # API 服务
│   ├── package.json         # npm 依赖
│   └── vite.config.ts       # Vite 配置
├── instance/                # SQLite 数据库目录
├── requirements.txt         # 根目录依赖（可选）
├── README.md                # 项目说明文档
└── LICENSE                  # Apache 2.0 许可证
```

## 安装和运行

### 1. 克隆仓库

```bash
git clone https://github.com/yourusername/aigument.git
cd aigument
```

### 2. 后端配置

```bash
# 创建并激活虚拟环境（推荐）
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 安装后端依赖
cd backend
pip install -r requirements.txt
```

配置环境变量，创建 `backend/.env` 文件：

```env
# 必填：至少配置一个 API Key
DEEPSEEK_API_KEY=your_deepseek_api_key
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
CLAUDE_API_KEY=your_claude_api_key

# 可选：API Base URL（如使用代理）
DEEPSEEK_API_BASE=https://api.deepseek.com/v1
OPENAI_API_BASE=https://api.openai.com/v1
```

### 3. 前端配置

```bash
cd frontend

# 使用 pnpm（推荐）
pnpm install

# 或使用 npm
npm install
```

### 4. 启动应用

**启动后端**（端口 5000）：
```bash
cd backend
python main.py
```

**启动前端**（端口 5173）：
```bash
cd frontend
pnpm dev
# 或
npm run dev
```

### 5. 访问应用

- **前端界面**：http://localhost:5173
- **后端 API 文档**：http://localhost:5000/docs（Swagger UI）
- **后端 ReDoc**：http://localhost:5000/redoc

## API 文档

后端使用 FastAPI，自动生成交互式 API 文档。启动后端后访问 `/docs` 即可查看和测试所有 API。

### 主要 API 端点

| 模块 | 端点 | 方法 | 说明 |
|-----|------|------|------|
| 辩论 | `/api/debate/init` | POST | 初始化辩论会话 |
| 辩论 | `/api/debate/stream` | GET | 流式辩论 |
| 辩论 | `/api/debate/single` | POST | 单轮辩论 |
| 对话 | `/api/chat/init` | POST | 初始化对话会话 |
| 对话 | `/api/chat/stream` | GET | 流式对话 |
| 问答 | `/api/qa/ask` | POST | 提问 |
| 问答 | `/api/qa/stream` | GET | 流式问答 |
| 历史 | `/api/history` | GET | 获取历史列表 |
| 历史 | `/api/history/{session_id}` | GET | 获取会话详情 |
| 历史 | `/api/history/{session_id}` | DELETE | 删除会话 |
| 历史 | `/api/history/{session_id}/export` | GET | 导出会话 |

## 使用说明

### 辩论模式

1. 选择"辩论模式"
2. 输入辩论主题，如"人工智能是否会超越人类智能"
3. 设置辩论轮次（1-5轮）
4. 选择是否开启流式输出
5. 在设置页面选择模型提供商和具体模型
6. 点击"开始辩论"
7. 系统将生成正反双方的辩论内容

### 对话模式

1. 选择"AI对话模式"
2. 输入对话主题
3. 选择两个角色（如科学家和哲学家）
4. 设置对话轮次
5. 点击"开始对话"
6. 系统将生成两个角色间的对话内容

### 问答模式

1. 选择"问答模式"
2. 输入您的问题
3. 选择回答风格（详细分析、简洁直接或苏格拉底式）
4. 点击"提交问题"
5. 系统将根据选择的风格生成回答

## 后续开发计划

1. **功能扩展**：
   - 多语言支持
   - 语音输入和输出
   - 更多自定义角色和模板

2. **技术提升**：
   - 改进流式输出性能
   - 添加更多数据可视化功能
   - WebSocket 实时通信

3. **用户体验**：
   - 用户账户系统
   - 云端同步设置
   - 增加更多主题样式

## 贡献指南

我们欢迎各种形式的贡献，包括但不限于：

1. 提交Bug报告
2. 提出新功能建议
3. 添加或改进文档
4. 提交代码改进和新功能

**贡献步骤**：

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交Pull Request

## 许可证

本项目采用Apache 2.0许可证。详情请参阅[LICENSE](LICENSE)文件。