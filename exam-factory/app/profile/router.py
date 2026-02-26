"""用户资料补全模块路由。"""

from fastapi import APIRouter, Form, HTTPException, Request, Depends

from app.auth import verify_token, hash_password
from app.database import db_session
from app.profile.avatars import PRESET_AVATARS, get_avatar_by_id

router = APIRouter(prefix="/api/profile", tags=["profile"])


async def require_login(request: Request) -> dict:
    """从 cookie 中验证登录状态，返回 JWT payload。

    Args:
        request: FastAPI 请求对象

    Returns:
        JWT payload 字典

    Raises:
        HTTPException: 未登录或 token 过期
    """
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="未登录")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="登录已过期")
    return payload


@router.get("/avatars")
async def api_avatars() -> list[dict]:
    """返回预设头像列表（无需登录）。"""
    return PRESET_AVATARS


@router.post("/setup")
async def api_setup(
    nickname: str = Form(...),
    avatar_id: int = Form(...),
    password: str = Form(...),
    user: dict = Depends(require_login),
) -> dict:
    """首次设置用户名、头像和密码。

    Args:
        nickname: 用户名（2-16 字符）
        avatar_id: 预设头像 ID
        password: 登录密码（6 位以上）
        user: 当前登录用户 payload

    Returns:
        成功消息
    """
    # 验证用户名长度
    nickname = nickname.strip()
    if len(nickname) < 2 or len(nickname) > 16:
        raise HTTPException(status_code=400, detail="用户名需要 2-16 个字符")

    # 验证密码长度
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 个字符")

    # 验证头像 ID
    avatar = get_avatar_by_id(avatar_id)
    if not avatar:
        raise HTTPException(status_code=400, detail="无效的头像 ID")

    # 检查用户名是否已被占用
    user_id = int(user["sub"])
    avatar_url = f"preset:{avatar_id}"
    password_hashed = hash_password(password)

    async with db_session() as db:
        cursor = await db.execute(
            "SELECT id FROM users WHERE nickname = ? AND id != ?",
            (nickname, user_id),
        )
        if await cursor.fetchone():
            raise HTTPException(status_code=400, detail="用户名已被占用")

        await db.execute(
            "UPDATE users SET nickname = ?, avatar_url = ?, password_hash = ?, profile_completed = 1 WHERE id = ?",
            (nickname, avatar_url, password_hashed, user_id),
        )
        await db.commit()

    return {"message": "资料设置成功"}


@router.get("")
async def api_get_profile(user: dict = Depends(require_login)) -> dict:
    """获取当前用户完整资料。

    Args:
        user: 当前登录用户 payload

    Returns:
        用户资料字典
    """
    user_id = int(user["sub"])

    async with db_session() as db:
        # 确保 profile_completed 列存在
        cursor_pragma = await db.execute("PRAGMA table_info(users)")
        columns = {row[1] for row in await cursor_pragma.fetchall()}
        if "profile_completed" not in columns:
            await db.execute(
                "ALTER TABLE users ADD COLUMN profile_completed INTEGER DEFAULT 0"
            )
            await db.commit()

        cursor = await db.execute(
            "SELECT id, email, nickname, avatar_url, login_method, profile_completed "
            "FROM users WHERE id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")

    return {
        "id": row["id"],
        "email": row["email"],
        "nickname": row["nickname"],
        "avatar_url": row["avatar_url"],
        "login_method": row["login_method"],
        "profile_completed": row["profile_completed"] or 0,
    }


@router.put("")
async def api_update_profile(
    nickname: str = Form(...),
    avatar_id: int = Form(...),
    user: dict = Depends(require_login),
) -> dict:
    """更新用户名和头像（不检查 profile_completed）。

    Args:
        nickname: 用户名（2-16 字符）
        avatar_id: 预设头像 ID
        user: 当前登录用户 payload

    Returns:
        成功消息
    """
    # 验证用户名长度
    nickname = nickname.strip()
    if len(nickname) < 2 or len(nickname) > 16:
        raise HTTPException(status_code=400, detail="用户名需要 2-16 个字符")

    # 验证头像 ID
    avatar = get_avatar_by_id(avatar_id)
    if not avatar:
        raise HTTPException(status_code=400, detail="无效的头像 ID")

    user_id = int(user["sub"])
    avatar_url = f"preset:{avatar_id}"

    async with db_session() as db:
        await db.execute(
            "UPDATE users SET nickname = ?, avatar_url = ? WHERE id = ?",
            (nickname, avatar_url, user_id),
        )
        await db.commit()

    return {"message": "资料更新成功"}
