"""共享工具函数。"""

import json
from datetime import datetime, timezone

from fastapi import HTTPException

from app.config import MAX_DAILY_USES
from app.database import get_db


def sse(data: dict) -> str:
    """构造 SSE 事件字符串。"""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def check_daily_limit(user_id: int) -> None:
    """检查每日使用次数。"""
    db = await get_db()
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        cursor = await db.execute(
            "SELECT COUNT(*) FROM usage_log WHERE user_id = ? AND action = 'generate' AND DATE(created_at) = ?",
            (user_id, today),
        )
        row = await cursor.fetchone()
        if row[0] >= MAX_DAILY_USES:
            raise HTTPException(status_code=429, detail=f"每日最多 {MAX_DAILY_USES} 次")
    finally:
        await db.close()


async def log_usage(user_id: int, action: str) -> None:
    """记录使用日志。"""
    db = await get_db()
    try:
        await db.execute("INSERT INTO usage_log (user_id, action) VALUES (?, ?)", (user_id, action))
        await db.commit()
    finally:
        await db.close()
