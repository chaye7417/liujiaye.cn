"""管理员认证模块。"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Request, HTTPException
from jose import jwt

from app.config import ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET, JWT_ALGORITHM


def verify_admin_login(username: str, password: str) -> bool:
    """验证管理员凭据。

    Args:
        username: 管理员用户名
        password: 管理员密码

    Returns:
        凭据是否正确
    """
    return username == ADMIN_USERNAME and password == ADMIN_PASSWORD


def create_admin_token() -> str:
    """创建管理员 JWT token。

    Returns:
        JWT token 字符串，有效期 12 小时
    """
    expire = datetime.now(timezone.utc) + timedelta(hours=12)
    payload = {"sub": "admin", "role": "admin", "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_admin_token(token: str) -> Optional[dict]:
    """验证管理员 token。

    Args:
        token: JWT token 字符串

    Returns:
        解码后的 payload，验证失败返回 None
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "admin":
            return None
        return payload
    except Exception:
        return None


async def require_admin(request: Request) -> dict:
    """管理员认证依赖。

    Args:
        request: FastAPI 请求对象

    Returns:
        验证通过的 payload

    Raises:
        HTTPException: 未登录或 token 过期时抛出 401
    """
    token = request.cookies.get("admin_token")
    if not token:
        raise HTTPException(status_code=401, detail="需要管理员登录")
    payload = verify_admin_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="管理员登录已过期")
    return payload
