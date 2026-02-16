"""认证模块 - 邮箱验证码登录。"""

import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

import aiosmtplib
from email.mime.text import MIMEText
from jose import jwt

from app.config import (
    JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS,
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
)
from app.database import get_db


def generate_code() -> str:
    """生成 6 位数字验证码。"""
    return ''.join(random.choices(string.digits, k=6))


def create_token(user_id: int, email: str) -> str:
    """创建 JWT token。

    Args:
        user_id: 用户 ID
        email: 用户邮箱

    Returns:
        JWT token 字符串
    """
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    """验证 JWT token。

    Args:
        token: JWT token 字符串

    Returns:
        解码后的 payload，验证失败返回 None
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except Exception:
        return None


async def send_verify_code(email: str, code: str) -> bool:
    """发送验证码邮件。

    Args:
        email: 目标邮箱
        code: 验证码

    Returns:
        是否发送成功
    """
    msg = MIMEText(
        f"您的试卷工厂验证码是：{code}\n\n有效期 10 分钟，请勿泄露。",
        "plain",
        "utf-8",
    )
    msg["Subject"] = f"【试卷工厂】验证码：{code}"
    msg["From"] = SMTP_USER
    msg["To"] = email

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASS,
            use_tls=True,
        )
        return True
    except Exception as e:
        print(f"邮件发送失败: {e}")
        return False


async def save_code(email: str, code: str) -> None:
    """保存验证码到数据库。"""
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO verify_codes (email, code) VALUES (?, ?)",
            (email, code),
        )
        await db.commit()
    finally:
        await db.close()


async def check_code(email: str, code: str) -> bool:
    """检查验证码是否有效（10 分钟内未使用）。"""
    db = await get_db()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
        cursor = await db.execute(
            """SELECT id FROM verify_codes
               WHERE email = ? AND code = ? AND used = 0
               AND created_at > ?
               ORDER BY created_at DESC LIMIT 1""",
            (email, code, cutoff.isoformat()),
        )
        row = await cursor.fetchone()
        if row:
            await db.execute(
                "UPDATE verify_codes SET used = 1 WHERE id = ?",
                (row[0],),
            )
            await db.commit()
            return True
        return False
    finally:
        await db.close()


async def get_or_create_user(email: str) -> int:
    """获取或创建用户，返回用户 ID。"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM users WHERE email = ?", (email,)
        )
        row = await cursor.fetchone()
        if row:
            return row[0]

        cursor = await db.execute(
            "INSERT INTO users (email) VALUES (?)", (email,)
        )
        await db.commit()
        return cursor.lastrowid
    finally:
        await db.close()
