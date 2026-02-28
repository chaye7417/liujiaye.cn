"""页面路由 - HTML 页面渲染。"""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.config import TEMPLATE_DIR
from app.database import db_session
from app.auth import verify_token

router = APIRouter(tags=["pages"])

templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


@router.get("/", response_class=HTMLResponse)
async def page_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/login", response_class=HTMLResponse)
async def page_login(request: Request):
    """登录页：已登录用户重定向到工作台。"""
    token = request.cookies.get("token")
    if token and verify_token(token):
        return RedirectResponse("/workspace", status_code=302)
    return templates.TemplateResponse("login.html", {"request": request})


@router.get("/workspace", response_class=HTMLResponse)
async def page_workspace(request: Request):
    """工作台：未登录重定向登录页，未完善资料重定向资料页。"""
    token = request.cookies.get("token")
    if not token or not verify_token(token):
        return RedirectResponse("/login", status_code=302)
    payload = verify_token(token)
    user_id = int(payload["sub"])
    async with db_session() as db:
        cursor = await db.execute(
            "SELECT profile_completed FROM users WHERE id = ?", (user_id,)
        )
        row = await cursor.fetchone()
    if not row or not row["profile_completed"]:
        return RedirectResponse("/profile/setup", status_code=302)
    return templates.TemplateResponse("workspace.html", {"request": request})


@router.get("/jianpu", response_class=HTMLResponse)
async def page_jianpu(request: Request):
    """MusicXML 转简谱页：公开页面，无需登录。"""
    return templates.TemplateResponse("jianpu.html", {"request": request})


@router.get("/profile/setup", response_class=HTMLResponse)
async def page_profile_setup(request: Request):
    """资料补全页：未登录重定向登录页，已补全重定向工作台。"""
    token = request.cookies.get("token")
    if not token or not verify_token(token):
        return RedirectResponse("/login", status_code=302)
    payload = verify_token(token)
    user_id = int(payload["sub"])
    async with db_session() as db:
        cursor = await db.execute(
            "SELECT profile_completed FROM users WHERE id = ?", (user_id,)
        )
        row = await cursor.fetchone()
    if row and row["profile_completed"]:
        return RedirectResponse("/workspace", status_code=302)
    return templates.TemplateResponse("profile_setup.html", {"request": request})



