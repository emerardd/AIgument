# AIgument

"AIgument" 是一个基于大语言模型的智能对话平台，支持多种交互模式，包括 **Multi-Agent 辩论**、**双角色对话**、**苏格拉底式问答** 等。该平台旨在通过 AI 模型间的互动，探索并展示人工智能在不同场景下的推理与表达能力。

## ✨ 功能特点

### 🎯 核心交互模式

| 模式 | 描述 | 路由 |
|------|------|------|
| **Multi-Agent 辩论** | 具备思考过程的智能辩论，支持实时评分和裁决 | `/agent-debate` |
| **双角色对话** | 两个 AI 角色（6种人格）围绕主题自然对话 | `/dual-chat` |
| **苏格拉底问答** | 引导式学习，通过提问帮助用户思考 | `/socratic-qa` |
| **普通对话** (Legacy) | 与 AI 助手的传统对话 | `/chat` |
| **传统问答** (Legacy) | 多风格问答 | `/qa` |

### 🧠 Multi-Agent 架构

- **ReAct 推理模式**：Agent 先思考（Reason）再行动（Act）
- **辩论者 Agent**：正反双方各有独立的策略分析能力
- **评审 Agent**：4 维度评分（逻辑性、论据质量、表达技巧、反驳能力）
- **协调器**：管理辩论流程和状态机
- **共享记忆**：存储辩论历史和比分
- **论点图谱**：分析论点关系（支持/反驳/补充）+ Mermaid 可视化
- **Agent 通信协议**：标准化的消息传递机制（已集成 MessageBus）
- **辩论公平性**：经过优化的公平评审机制，避免后发言者优势

### 🗣️ 双角色对话

6 种预设角色：
- 🌞 乐观主义者（小阳）
- 📊 现实主义者（老陈）
- ❓ 怀疑论者（阿疑）
- 💡 创意者（小创）
- 🔧 实践者（老王）
- 📚 哲学家（孔思）

### 🤔 苏格拉底问答

3 种模式：
- **苏格拉底式**：只提问不给答案，引导思考
- **结构化**：返回知识卡片（要点、例子、延伸）
- **混合模式**：先引导后给出结构化答案

### 🔌 多模型支持

- DeepSeek (deepseek-chat, deepseek-reasoner)
- OpenAI (gpt-5.2, gpt-5-mini, gpt-5-nano, gpt-5.2-pro, gpt-5, gpt-4.1)
- Google Gemini (gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash-preview, gemini-3.1-pro-preview)
- Anthropic Claude (claude-opus-4.6, claude-sonnet-4.6)



### 📺 实时显示

- 流式输出技术（SSE）实时显示生成内容
- Markdown 格式支持（粗体、列表、代码块等）
- 思考过程可视化（可折叠面板）
- 实时评分和比分更新

## 🛠️ 技术栈

### 后端
- **FastAPI** - 高性能异步 Web 框架
- **SQLAlchemy** - ORM 数据库操作
- **Pydantic** - 数据验证和序列化
- **Uvicorn** - ASGI 服务器

### 前端
- **React 19** - 用户界面库
- **TypeScript** - 类型安全
- **Vite** - 快速构建工具
- **Tailwind CSS** - 原子化 CSS 框架
- **Zustand** - 轻量级状态管理
- **Lucide React** - 图标库
- **Mermaid** - 图谱可视化

### AI 模型集成
- OpenAI SDK
- Google GenAI SDK
- Anthropic SDK

## 📁 项目结构

```
aigument/
├── backend/
│   ├── main.py              # 应用入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── routers/             # API 路由
│   │   ├── debate.py        # 辩论 API（含 Multi-Agent）
│   │   ├── chat.py          # 对话 API（含双角色对话）
│   │   ├── qa.py            # 问答 API（含苏格拉底）
│   │   └── history.py       # 历史记录 API
│   ├── agents/              # 🆕 Multi-Agent 框架
│   │   ├── base_agent.py    # Agent 基类（ReAct 模式）
│   │   ├── debater_agent.py # 辩论者 Agent
│   │   ├── jury_agent.py    # 评审 Agent
│   │   ├── orchestrator.py  # 辩论协调器
│   │   └── protocol.py      # Agent 通信协议
│   ├── memory/              # 🆕 共享记忆
│   │   ├── shared_memory.py # 通用共享记忆
│   │   └── argument_graph.py# 论点图谱
│   ├── services/
│   │   ├── ai_client.py     # 统一 AI 客户端
│   │   ├── dual_chat.py     # 🆕 双角色对话服务
│   │   └── socratic_qa.py   # 🆕 苏格拉底问答服务
│   ├── models/              # 数据库模型
│   └── schemas/             # Pydantic 数据模型
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AgentDebate.tsx  # 🆕 Multi-Agent 辩论
│   │   │   ├── DualChat.tsx     # 🆕 双角色对话
│   │   │   ├── SocraticQA.tsx   # 🆕 苏格拉底问答
│   │   │   ├── Chat.tsx         # Legacy 对话
│   │   │   ├── QA.tsx           # Legacy 问答
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── debate/
│   │   │   │   ├── AgentDebateView.tsx   # 🆕 Agent 辩论视图
│   │   │   │   ├── ThinkingBubble.tsx    # 🆕 思考过程展示
│   │   │   │   ├── ScorePanel.tsx        # 🆕 评分面板
│   │   │   │   └── ArgumentGraphView.tsx # 🆕 论点图谱视图
│   │   │   ├── chat/
│   │   │   │   ├── DualChatView.tsx      # 🆕 双角色对话
│   │   │   │   └── ChatView.tsx          # Legacy 对话
│   │   │   └── qa/
│   │   │       ├── SocraticQAView.tsx    # 🆕 苏格拉底问答
│   │   │       └── QAView.tsx            # Legacy 问答
│   │   └── stores/
│   │       └── agentDebateStore.ts       # 🆕 Agent 辩论状态
│   └── package.json
└── README.md
```

## 🚀 安装和运行

### 1. 克隆仓库

```bash
git clone https://github.com/yourusername/aigument.git
cd aigument
```

### 2. 后端配置

```bash
# 创建虚拟环境
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 安装依赖
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
```

### 3. 前端配置

```bash
cd frontend
pnpm install
# 或
npm install
```

### 4. 启动应用

**启动后端**（端口 5000）：
```bash
cd backend
python main.py
```

**启动前端**（端口 3000）：
```bash
cd frontend
pnpm dev --host
```

### 5. 访问应用

- **前端界面**：http://localhost:3000
- **API 文档**：http://localhost:5000/docs

## 📦 打包成 Windows 可执行软件

项目已经接入了桌面打包链路，方案是：

- 前端先构建为静态资源
- FastAPI 后端用 PyInstaller 打包成 `AIgumentBackend.exe`
- Electron 启动本地后端，再加载本地页面
- 最终通过 `electron-builder` 产出安装包

### 打包前提

需要先准备：

- Node.js（建议 20+，并确保 `node`、`npm` 可在终端直接使用）
- Python 3.12+（项目内可直接使用 `backend\\venv\\Scripts\\python.exe`）
- 前端依赖已安装：`frontend\\node_modules`
- 根目录桌面依赖已安装：执行 `npm install`
- 后端打包依赖已安装：`backend\\venv\\Scripts\\python.exe -m pip install pyinstaller`

### 一键打包

在项目根目录执行：

```powershell
npm run package:win
```

它会依次执行：

```powershell
npm run build:frontend
npm run build:backend
npm run build:desktop
```

### 产物位置

- 后端 exe：`dist\\backend\\AIgumentBackend.exe`
- Windows 安装包：`release\\`

### 配置文件和数据位置

桌面版运行后，用户数据会默认写入：

```text
%LOCALAPPDATA%\\AIgument
```

其中包括：

- 数据库：`%LOCALAPPDATA%\\AIgument\\aigument.db`
- 用户配置：`%LOCALAPPDATA%\\AIgument\\.env`

应用会优先读取这个用户目录下的 `.env`；如果没有，再回退到打包时带入的配置。

### 单独构建后端 exe

如果你只想先验证后端打包，可以执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\\build-backend.ps1
```

### 启动失败排查

如果桌面版弹出“Timed out waiting for the local AIgument service to start.”，通常说明内置后端没有成功启动。

新版本会把后端日志写到：

```text
%APPDATA%\\AIgument\\logs\\backend.log
```

常见原因包括：

- 杀毒软件或系统策略拦截了后端进程
- 使用了 PyInstaller 单文件模式后，临时解压目录无权限
- `.env` 缺失或配置有误

当前项目已经改成更稳定的目录模式打包后端，重新执行完整打包即可：

```powershell
npm run package:win
```

## 📡 API 端点

### Multi-Agent 辩论
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/debate/agent-stream` | GET | 流式 Multi-Agent 辩论 |
| `/api/debate/{session_id}/graph` | GET | 获取论点图谱 |
| `/api/debate/{session_id}/analysis` | GET | 获取辩论分析 |

### 双角色对话
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/chat/roles` | GET | 获取可用角色列表 |
| `/api/chat/dual-stream` | GET | 流式双角色对话 |

### 苏格拉底问答
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/qa/modes` | GET | 获取问答模式列表 |
| `/api/qa/socratic-stream` | GET | 流式苏格拉底问答 |
| `/api/qa/follow-up` | POST | 跟进回复 |

### Legacy API
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/chat/stream` | GET | 普通对话流 |
| `/api/qa/stream` | GET | 传统问答流 |
| `/api/debate/stream` | GET | 简单辩论流 |

## 🎮 使用说明

### Multi-Agent 辩论

1. 进入 "Agent辩论" 页面
2. 输入辩论主题
3. 设置轮次和模型
4. 点击"开始辩论"
5. 观看 Agent 的思考过程和论点生成
6. 查看实时评分和最终裁决

### 双角色对话

1. 进入 "角色对话" 页面
2. 输入对话主题（如"远程办公的利弊"）
3. 选择两个角色（如"乐观主义者" vs "现实主义者"）
4. 设置对话轮次
5. 点击"开始对话"观看两个 AI 角色的对话

### 苏格拉底问答

1. 进入 "思考问答" 页面
2. 选择模式（苏格拉底/结构化/混合）
3. 输入问题
4. AI 会引导你思考而不是直接给答案
5. 可以继续回复进行多轮互动

## 🗺️ 后续开发计划

- [x] 论点图谱可视化（Mermaid 图表）
- [x] Agent 通信协议集成到辩论流程
- [x] 辩论公平性优化（解决后发言者优势问题）
- [x] 前端页面风格统一化（统一 Header、Badge、动画效果）
- [ ] 多语言支持
- [ ] 用户账户系统
- [ ] 更多预设角色模板

## 📄 许可证

本项目采用 Apache 2.0 许可证。详情请参阅 [LICENSE](LICENSE) 文件。
