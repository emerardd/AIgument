"""
FastAPI 应用主入口
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os
import sys
import time

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import get_settings
from database import init_db
from routers.debate import router as debate_router
from routers import chat, qa, history
from exceptions import AIgumentException
from utils.logger import get_logger

settings = get_settings()
logger = get_logger("aigument.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("正在初始化数据库...")
    init_db()
    logger.info("数据库初始化完成")
    yield
    logger.info("应用关闭")


# 创建FastAPI应用
app = FastAPI(
    title="AIgument API",
    description="AI辩论、对话、问答系统API",
    version="2.1.0",
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


# 全局异常处理
@app.exception_handler(AIgumentException)
async def aigument_exception_handler(request: Request, exc: AIgumentException):
    """处理 AIgument 自定义异常"""
    logger.error(f"AIgumentException: {exc.code} - {exc.message}")
    return JSONResponse(
        status_code=400,
        content=exc.to_dict()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """处理通用异常"""
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "INTERNAL_ERROR",
            "message": str(exc),
            "details": {}
        }
    )


# 请求日志中间件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """记录请求日志"""
    start_time = time.time()
    response = await call_next(request)
    duration = (time.time() - start_time) * 1000
    logger.info(f"{request.method} {request.url.path} - {response.status_code} ({duration:.2f}ms)")
    return response


# 注册路由
app.include_router(debate_router)
app.include_router(chat.router)
app.include_router(qa.router)
app.include_router(history.router)


@app.get("/")
async def root():
    """根路由"""
    return {
        "message": "Welcome to AIgument API",
        "version": "2.1.0",
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
