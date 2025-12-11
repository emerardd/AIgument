"""
FastAPI 应用主入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import sys

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import get_settings
from database import init_db
from routers import debate, chat, qa, history

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化数据库
    print("正在初始化数据库...")
    init_db()
    print("数据库初始化完成")
    yield
    # 关闭时的清理操作（如果需要）
    print("应用关闭")


# 创建FastAPI应用
app = FastAPI(
    title="AIgument API",
    description="AI辩论、对话、问答系统API",
    version="2.0.0",
    lifespan=lifespan
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(debate.router)
app.include_router(chat.router)
app.include_router(qa.router)
app.include_router(history.router)


@app.get("/")
async def root():
    """根路由"""
    return {
        "message": "Welcome to AIgument API",
        "version": "2.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


# 静态文件服务（如果有前端构建产物）
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "static", "dist")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        reload=True
    )
