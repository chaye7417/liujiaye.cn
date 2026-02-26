"""试卷工厂 - FastAPI 主应用入口。"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import BASE_DIR
from app.database import init_db
from app.routers.auth import router as auth_router
from app.routers.tasks import router as tasks_router
from app.routers.download import router as download_router
from app.routers.pages import router as pages_router
from app.profile.router import router as profile_router
from app.admin.router import router as admin_router

app = FastAPI(title="试卷工厂", version="2.0.0")

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(download_router)
app.include_router(pages_router)
app.include_router(profile_router)
app.include_router(admin_router)


@app.on_event("startup")
async def startup():
    """应用启动时初始化数据库。"""
    await init_db()
