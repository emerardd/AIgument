# AIgument

AIgument 是一个 AI 辩论与对话应用，支持浏览器运行和 Windows 桌面打包。

- **多 Agent 辩论**：正反方可使用不同模型，实时展示策略分析、发言、评分和裁决，保存辩论记录并查看论点图谱。
- **双角色对话**：选择两个角色，围绕主题展开多轮讨论。
- **苏格拉底问答**：通过提问引导思考，支持结构化回答和后续追问。
- **历史记录**：查看会话并导出内容；同时保留普通对话和问答入口。

支持 DeepSeek、OpenAI、Gemini、Claude，以及用于本地测试的 mock Provider。

## 快速启动

以下命令在 Windows PowerShell 中执行。需要 Python 3.12+、Node.js 22.12+ 和 pnpm。

```powershell
git clone https://github.com/emerardd/AIgument.git
cd AIgument

python -m venv backend\venv
.\backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
pnpm --dir frontend install --frozen-lockfile
npm install

npm run dev
```

访问 [应用页面](http://localhost:3000)，在设置页配置供应商 API Key 和模型。也可以复制 `backend/.env.example` 为 `backend/.env`，填写所使用供应商的配置。

API 文档位于 [Swagger UI](http://localhost:5000/docs)。开发服务可用 `Ctrl+C` 停止。

## 开发验证

在项目根目录运行：

```powershell
npm run verify
```

包含前端 lint、交互契约与 SSE 测试、TypeScript 检查、生产构建和后端 pytest。也可单独执行：

```powershell
npm run lint:frontend
npm run test:frontend
npm run build:frontend
npm run test:backend
```

## Windows 桌面打包

完成依赖安装后，在项目根目录运行：

```powershell
.\backend\venv\Scripts\python.exe -m pip install pyinstaller
npm run package:win
```

打包流程为前端构建 → PyInstaller 后端打包 → Electron 安装包。

| 内容 | 默认位置 |
| --- | --- |
| 安装包 | `release\` |
| 后端可执行文件 | `dist\backend\AIgumentBackend\AIgumentBackend.exe` |
| 桌面版数据库与用户配置 | `%LOCALAPPDATA%\AIgument\`（`aigument.db`、`.env`） |
| 桌面版后端日志 | `%APPDATA%\AIgument\logs\backend.log` |

桌面版启动失败时，先查看后端日志。

## 项目结构

前端使用 React、TypeScript、Vite 和 Zustand；后端使用 FastAPI、SQLAlchemy 和 SQLite；桌面壳使用 Electron。

```text
backend/
  routers/        HTTP 接口
  services/       应用流程与 AI 客户端
  agents/         辩论角色与协调器
  memory/         共享记忆与论点图谱
  repositories/   数据库事务
  models/         数据库模型
  schemas/        请求与事件模型
  tests/          后端测试
frontend/src/     页面、组件、状态与 API 调用
desktop/          Electron 入口
scripts/          开发、测试和打包脚本
```

架构设计与后续改进见 [架构审查与重构](docs/architecture-review.md)。

## 许可证

[Apache License 2.0](LICENSE)
