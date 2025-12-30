"""
辩论路由聚合模块

将所有辩论相关路由聚合到一个 router
"""
from fastapi import APIRouter

from .legacy import router as legacy_router
from .agent import router as agent_router
from .graph import router as graph_router

# 创建主路由器
router = APIRouter(prefix="/api", tags=["debate"])

# 注册子路由
router.include_router(legacy_router)
router.include_router(agent_router)
router.include_router(graph_router)
