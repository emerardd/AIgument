"""
FastAPI 应用主入口
"""
from contextlib import asynccontextmanager
import os
import sys
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import get_settings
from database import init_db
from routers.debate import router as debate_router
from routers import chat, qa, history, evaluation
from routers import dialectic
from routers import analysis
from exceptions import AIgumentException
from runtime import get_frontend_dist_dir, is_frozen
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
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={
            "error": "INTERNAL_ERROR",
            "message": "Internal server error",
            "details": {}
        }
    )


# 请求日志中间件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """记录请求日志并添加追踪 ID"""
    from utils.logger import generate_request_id, set_request_id
    
    # 生成并设置请求追踪 ID
    request_id = generate_request_id()
    set_request_id(request_id)
    
    start_time = time.time()
    response = await call_next(request)
    duration = (time.time() - start_time) * 1000
    
    # 添加追踪 ID 到响应头
    response.headers["X-Request-ID"] = request_id
    
    logger.info(f"{request.method} {request.url.path} - {response.status_code} ({duration:.2f}ms)")
    return response


# 注册路由
app.include_router(debate_router)
app.include_router(chat.router)
app.include_router(qa.router)
app.include_router(history.router)
app.include_router(evaluation.router)
app.include_router(dialectic.router, prefix="/api", tags=["dialectic"])
app.include_router(analysis.router)


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


frontend_dist_dir = get_frontend_dist_dir()
frontend_index_file = frontend_dist_dir / "index.html"
frontend_assets_dir = frontend_dist_dir / "assets"
frontend_dist_root = frontend_dist_dir.resolve()


def resolve_frontend_asset(full_path: str):
    """Resolve a frontend asset path without allowing directory traversal."""
    if not full_path:
        return None

    candidate = (frontend_dist_root / full_path).resolve()
    try:
        candidate.relative_to(frontend_dist_root)
    except ValueError:
        return None

    if candidate.exists() and candidate.is_file():
        return candidate
    return None


@app.get("/")
async def root():
    """根路由"""
    if frontend_index_file.exists():
        return FileResponse(frontend_index_file)
    return {
        "message": "Welcome to AIgument API",
        "version": "2.1.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


if frontend_assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=frontend_assets_dir), name="assets")


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    """Serve built frontend files and fall back to index.html for SPA routes."""
    if full_path.startswith(("api/", "docs", "redoc", "openapi.json", "health")):
        return JSONResponse(
            status_code=404,
            content={"error": "NOT_FOUND", "message": "Not found", "details": {}}
        )

    candidate = resolve_frontend_asset(full_path)
    if candidate is not None:
        return FileResponse(candidate)

    if frontend_index_file.exists():
        return FileResponse(frontend_index_file)

    return JSONResponse(
        status_code=404,
        content={"error": "FRONTEND_NOT_BUILT", "message": "Frontend build not found", "details": {}}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=os.getenv("AIGUMENT_HOST", "127.0.0.1"),
        port=int(os.getenv("AIGUMENT_PORT", "5000")),
        reload=not is_frozen() and os.getenv("AIGUMENT_RELOAD", "0") == "1"
    )

