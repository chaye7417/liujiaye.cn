"""认证模块 - 邮箱验证码登录 + 用户名密码登录。"""

import hashlib
import logging
import os
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
from app.database import db_session

logger = logging.getLogger(__name__)

PBKDF2_ITERATIONS = 100_000


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
        logger.error("邮件发送失败: %s", e)
        return False


async def save_code(email: str, code: str) -> None:
    """保存验证码到数据库。"""
    async with db_session() as db:
        await db.execute(
            "INSERT INTO verify_codes (email, code) VALUES (?, ?)",
            (email, code),
        )
        await db.commit()


async def check_code(email: str, code: str) -> bool:
    """检查验证码是否有效（10 分钟内未使用）。"""
    async with db_session() as db:
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")
        cursor = await db.execute(
            """SELECT id FROM verify_codes
               WHERE email = ? AND code = ? AND used = 0
               AND created_at > ?
               ORDER BY created_at DESC LIMIT 1""",
            (email, code, cutoff),
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


def hash_password(password: str) -> str:
    """使用 PBKDF2 哈希密码。

    Args:
        password: 明文密码

    Returns:
        salt:hash 格式的哈希字符串
    """
    salt = os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS).hex()
    return f"{salt}:{h}"


def verify_password(password: str, password_hash: str) -> bool:
    """验证密码是否正确。

    Args:
        password: 明文密码
        password_hash: 存储的 salt:hash 字符串

    Returns:
        密码是否匹配
    """
    try:
        salt, h = password_hash.split(":", 1)
        return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS).hex() == h
    except Exception:
        return False


async def login_by_password(nickname: str, password: str) -> Optional[dict]:
    """用户名 + 密码登录。

    Args:
        nickname: 用户名
        password: 明文密码

    Returns:
        用户信息字典，验证失败返回 None
    """
    async with db_session() as db:
        cursor = await db.execute(
            "SELECT id, email, nickname, password_hash FROM users WHERE nickname = ?",
            (nickname,),
        )
        row = await cursor.fetchone()
        if not row or not row[3]:
            return None
        if not verify_password(password, row[3]):
            return None
        return {"id": row[0], "email": row[1], "nickname": row[2]}


async def get_or_create_user(email: str) -> dict:
    """获取或创建用户，返回用户信息字典。

    Args:
        email: 用户邮箱

    Returns:
        包含 id, email, nickname 的字典
    """
    async with db_session() as db:
        cursor = await db.execute(
            "SELECT id, email, nickname FROM users WHERE email = ?", (email,)
        )
        row = await cursor.fetchone()
        if row:
            return {"id": row[0], "email": row[1], "nickname": row[2]}

        # 从邮箱前缀提取昵称
        nickname = email.split("@")[0]
        cursor = await db.execute(
            "INSERT INTO users (email, nickname, login_method) VALUES (?, ?, 'email')",
            (email, nickname),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "email": email, "nickname": nickname}
