"""管理后台路由模块。"""

from typing import Optional

from fastapi import APIRouter, Depends, Form, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.config import TEMPLATE_DIR
from app.database import get_db
from app.admin.auth import (
    verify_admin_login,
    create_admin_token,
    verify_admin_token,
    require_admin,
)

router = APIRouter()
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


# ============================================================
# 页面路由
# ============================================================


@router.get("/admin", response_class=HTMLResponse)
async def admin_index(request: Request) -> RedirectResponse:
    """管理后台入口，根据登录状态重定向。"""
    token = request.cookies.get("admin_token")
    if token and verify_admin_token(token):
        return RedirectResponse(url="/admin/dashboard", status_code=302)
    return RedirectResponse(url="/admin/login", status_code=302)


@router.get("/admin/login", response_class=HTMLResponse)
async def admin_login_page(request: Request):
    """管理员登录页面。"""
    token = request.cookies.get("admin_token")
    if token and verify_admin_token(token):
        return RedirectResponse(url="/admin/dashboard", status_code=302)
    return templates.TemplateResponse("admin/login.html", {"request": request})


@router.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard_page(request: Request):
    """管理后台仪表盘页面。"""
    token = request.cookies.get("admin_token")
    if not token or not verify_admin_token(token):
        return RedirectResponse(url="/admin/login", status_code=302)
    return templates.TemplateResponse("admin/dashboard.html", {"request": request})


# ============================================================
# 认证 API
# ============================================================


@router.post("/api/admin/login")
async def api_admin_login(
    username: str = Form(...),
    password: str = Form(...),
) -> JSONResponse:
    """管理员登录。

    Args:
        username: 管理员用户名
        password: 管理员密码

    Returns:
        登录成功的 JSON 响应，设置 admin_token cookie
    """
    if not verify_admin_login(username, password):
        return JSONResponse(
            status_code=401,
            content={"detail": "用户名或密码错误"},
        )
    token = create_admin_token()
    response = JSONResponse(content={"message": "登录成功"})
    response.set_cookie(
        key="admin_token",
        value=token,
        httponly=True,
        max_age=43200,
        samesite="lax",
    )
    return response


@router.post("/api/admin/logout")
async def api_admin_logout() -> JSONResponse:
    """管理员退出登录。"""
    response = JSONResponse(content={"message": "已退出"})
    response.delete_cookie("admin_token")
    return response


# ============================================================
# 数据概览
# ============================================================


@router.get("/api/admin/stats")
async def api_admin_stats(
    _admin: dict = Depends(require_admin),
) -> JSONResponse:
    """获取数据概览统计。

    Returns:
        包含用户数、任务数、活跃数等统计信息
    """
    db = await get_db()
    try:
        cursor = await db.execute("SELECT COUNT(*) FROM users")
        total_users = (await cursor.fetchone())[0]

        cursor = await db.execute(
            "SELECT COUNT(*) FROM users WHERE DATE(created_at) = DATE('now')"
        )
        today_new_users = (await cursor.fetchone())[0]

        cursor = await db.execute(
            "SELECT COUNT(*) FROM tasks WHERE DATE(created_at) = DATE('now')"
        )
        today_tasks = (await cursor.fetchone())[0]

        cursor = await db.execute("SELECT COUNT(*) FROM tasks")
        total_tasks = (await cursor.fetchone())[0]

        cursor = await db.execute(
            "SELECT COUNT(DISTINCT user_id) FROM usage_log "
            "WHERE DATE(created_at) = DATE('now')"
        )
        today_active = (await cursor.fetchone())[0]

        return JSONResponse(content={
            "total_users": total_users,
            "today_new_users": today_new_users,
            "today_tasks": today_tasks,
            "total_tasks": total_tasks,
            "today_active": today_active,
        })
    finally:
        await db.close()


# ============================================================
# 用户管理
# ============================================================


@router.get("/api/admin/users")
async def api_admin_users(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    _admin: dict = Depends(require_admin),
) -> JSONResponse:
    """分页查询用户列表。

    Args:
        page: 页码，从 1 开始
        per_page: 每页数量
        search: 按邮箱模糊搜索

    Returns:
        包含用户列表、总数、分页信息的 JSON
    """
    db = await get_db()
    try:
        offset = (page - 1) * per_page
        where_clause = ""
        params: list = []

        if search:
            where_clause = "WHERE email LIKE ?"
            params.append(f"%{search}%")

        # 总数
        cursor = await db.execute(
            f"SELECT COUNT(*) FROM users {where_clause}", params
        )
        total = (await cursor.fetchone())[0]

        # 分页数据
        cursor = await db.execute(
            f"SELECT id, email, nickname, login_method, created_at, "
            f"COALESCE(status, 'active') as status "
            f"FROM users {where_clause} "
            f"ORDER BY id DESC LIMIT ? OFFSET ?",
            params + [per_page, offset],
        )
        rows = await cursor.fetchall()
        users = [
            {
                "id": row[0],
                "email": row[1],
                "nickname": row[2],
                "login_method": row[3],
                "created_at": row[4],
                "status": row[5],
            }
            for row in rows
        ]

        return JSONResponse(content={
            "users": users,
            "total": total,
            "page": page,
            "per_page": per_page,
        })
    finally:
        await db.close()


@router.put("/api/admin/users/{user_id}/status")
async def api_admin_update_user_status(
    user_id: int,
    status: str = Form(...),
    _admin: dict = Depends(require_admin),
) -> JSONResponse:
    """更新用户状态。

    Args:
        user_id: 用户 ID
        status: 新状态，active 或 disabled

    Returns:
        操作结果
    """
    if status not in ("active", "disabled"):
        return JSONResponse(
            status_code=400,
            content={"detail": "状态只能是 active 或 disabled"},
        )
    db = await get_db()
    try:
        await db.execute(
            "UPDATE users SET status = ? WHERE id = ?",
            (status, user_id),
        )
        await db.commit()
        return JSONResponse(content={"message": "状态已更新"})
    finally:
        await db.close()


@router.delete("/api/admin/users/{user_id}")
async def api_admin_delete_user(
    user_id: int,
    _admin: dict = Depends(require_admin),
) -> JSONResponse:
    """删除用户及其关联数据。

    Args:
        user_id: 用户 ID

    Returns:
        操作结果
    """
    db = await get_db()
    try:
        await db.execute("DELETE FROM usage_log WHERE user_id = ?", (user_id,))
        await db.execute("DELETE FROM tasks WHERE user_id = ?", (user_id,))
        await db.execute("DELETE FROM users WHERE id = ?", (user_id,))
        await db.commit()
        return JSONResponse(content={"message": "用户已删除"})
    finally:
        await db.close()


# ============================================================
# 任务记录
# ============================================================


@router.get("/api/admin/tasks")
async def api_admin_tasks(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    mode: Optional[str] = Query(default=None),
    user_id: Optional[int] = Query(default=None),
    _admin: dict = Depends(require_admin),
) -> JSONResponse:
    """分页查询任务记录。

    Args:
        page: 页码
        per_page: 每页数量
        status: 按状态筛选
        mode: 按模式筛选
        user_id: 按用户筛选

    Returns:
        包含任务列表和总数的 JSON
    """
    db = await get_db()
    try:
        offset = (page - 1) * per_page
        conditions: list[str] = []
        params: list = []

        if status:
            conditions.append("t.status = ?")
            params.append(status)
        if mode:
            conditions.append("t.mode = ?")
            params.append(mode)
        if user_id:
            conditions.append("t.user_id = ?")
            params.append(user_id)

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        # 总数
        cursor = await db.execute(
            f"SELECT COUNT(*) FROM tasks t {where_clause}", params
        )
        total = (await cursor.fetchone())[0]

        # 分页数据（JOIN users 获取邮箱）
        cursor = await db.execute(
            f"SELECT t.id, u.email, t.title, t.mode, t.status, t.created_at "
            f"FROM tasks t LEFT JOIN users u ON t.user_id = u.id "
            f"{where_clause} "
            f"ORDER BY t.id DESC LIMIT ? OFFSET ?",
            params + [per_page, offset],
        )
        rows = await cursor.fetchall()
        tasks = [
            {
                "id": row[0],
                "user_email": row[1],
                "title": row[2],
                "mode": row[3],
                "status": row[4],
                "created_at": row[5],
            }
            for row in rows
        ]

        return JSONResponse(content={
            "tasks": tasks,
            "total": total,
            "page": page,
            "per_page": per_page,
        })
    finally:
        await db.close()


# ============================================================
# 系统配置
# ============================================================


@router.get("/api/admin/settings")
async def api_admin_get_settings(
    _admin: dict = Depends(require_admin),
) -> JSONResponse:
    """获取所有系统配置。

    Returns:
        key-value 形式的配置字典
    """
    db = await get_db()
    try:
        # 确保 settings 表存在
        await db.execute(
            "CREATE TABLE IF NOT EXISTS settings "
            "(key TEXT PRIMARY KEY, value TEXT)"
        )
        await db.commit()

        cursor = await db.execute("SELECT key, value FROM settings")
        rows = await cursor.fetchall()
        settings = {row[0]: row[1] for row in rows}
        return JSONResponse(content=settings)
    finally:
        await db.close()


@router.put("/api/admin/settings")
async def api_admin_update_settings(
    request: Request,
    _admin: dict = Depends(require_admin),
) -> JSONResponse:
    """更新系统配置。

    接收 JSON body（key-value dict），逐个写入 settings 表。

    Returns:
        操作结果
    """
    db = await get_db()
    try:
        # 确保 settings 表存在
        await db.execute(
            "CREATE TABLE IF NOT EXISTS settings "
            "(key TEXT PRIMARY KEY, value TEXT)"
        )

        body = await request.json()
        for key, value in body.items():
            await db.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                (str(key), str(value)),
            )
        await db.commit()
        return JSONResponse(content={"message": "配置已保存"})
    finally:
        await db.close()
