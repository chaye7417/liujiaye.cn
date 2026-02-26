"""认证路由 + 用户依赖。"""

from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import JSONResponse

from app.auth import (
    generate_code, send_verify_code, save_code, check_code,
    get_or_create_user, create_token, verify_token, login_by_password,
)

router = APIRouter(tags=["auth"])


async def get_current_user(request: Request) -> dict:
    """从请求中获取当前用户，未登录抛出 401。"""
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="未登录")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="登录已过期")
    return payload


@router.post("/api/auth/send-code")
async def api_send_code(email: str = Form(...)):
    """发送验证码。"""
    code = generate_code()
    await save_code(email, code)
    success = await send_verify_code(email, code)
    if not success:
        raise HTTPException(status_code=500, detail="验证码发送失败")
    return {"message": "验证码已发送"}


@router.post("/api/auth/login")
async def api_login(email: str = Form(...), code: str = Form(...)):
    """验证码登录。"""
    valid = await check_code(email, code)
    if not valid:
        raise HTTPException(status_code=400, detail="验证码错误或已过期")
    user = await get_or_create_user(email)
    token = create_token(user["id"], email)
    response = JSONResponse({"message": "登录成功", "email": email, "nickname": user["nickname"]})
    response.set_cookie(key="token", value=token, httponly=True, max_age=86400, samesite="lax")
    return response


@router.post("/api/auth/login-password")
async def api_login_password(nickname: str = Form(...), password: str = Form(...)):
    """用户名 + 密码登录。"""
    user = await login_by_password(nickname, password)
    if not user:
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    token = create_token(user["id"], user["email"])
    response = JSONResponse({"message": "登录成功", "email": user["email"], "nickname": user["nickname"]})
    response.set_cookie(key="token", value=token, httponly=True, max_age=86400, samesite="lax")
    return response


@router.post("/api/auth/logout")
async def api_logout():
    """退出登录。"""
    response = JSONResponse({"message": "已退出"})
    response.delete_cookie("token")
    return response
