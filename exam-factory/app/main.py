"""试卷工厂 - FastAPI 主应用入口。"""

import asyncio
import logging
import shutil
import time

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import BASE_DIR, UPLOAD_DIR, OUTPUT_DIR, DATA_RETENTION_DAYS, CLEANUP_INTERVAL_HOURS
from app.database import init_db
from app.routers.auth import router as auth_router
from app.routers.tasks import router as tasks_router
from app.routers.download import router as download_router
from app.routers.pages import router as pages_router
from app.profile.router import router as profile_router
from app.admin.router import router as admin_router
from app.routers.tools import router as tools_router

logger = logging.getLogger(__name__)

app = FastAPI(title="试卷工厂", version="2.0.0")

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(download_router)
app.include_router(pages_router)
app.include_router(profile_router)
app.include_router(admin_router)
app.include_router(tools_router)


async def _cleanup_old_data() -> None:
    """删除超过保留天数的 outputs 和 uploads 子目录。"""
    cutoff = time.time() - DATA_RETENTION_DAYS * 86400
    removed = 0
    for parent in (OUTPUT_DIR, UPLOAD_DIR):
        if not parent.exists():
            continue
        for child in parent.iterdir():
            if not child.is_dir():
                continue
            if child.stat().st_mtime < cutoff:
                shutil.rmtree(child, ignore_errors=True)
                removed += 1
    if removed:
        logger.info("自动清理: 删除 %d 个超过 %d 天的数据目录", removed, DATA_RETENTION_DAYS)


async def _periodic_cleanup() -> None:
    """后台定时清理任务。"""
    while True:
        try:
            await _cleanup_old_data()
        except Exception as e:
            logger.error("自动清理失败: %s", e)
        await asyncio.sleep(CLEANUP_INTERVAL_HOURS * 3600)


@app.on_event("startup")
async def startup():
    """应用启动时初始化数据库并启动后台清理。"""
    await init_db()
    asyncio.create_task(_periodic_cleanup())
