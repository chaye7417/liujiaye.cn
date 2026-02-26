"""共享工具函数。"""

import json
import re
from datetime import datetime, timezone

from fastapi import HTTPException

from app.config import MAX_DAILY_USES, UsageAction
from app.database import db_session


def sse(data: dict) -> str:
    """构造 SSE 事件字符串。"""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def check_daily_limit(user_id: int) -> None:
    """检查每日使用次数。"""
    async with db_session() as db:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        cursor = await db.execute(
            "SELECT COUNT(*) FROM usage_log WHERE user_id = ? AND action = ? AND DATE(created_at) = ?",
            (user_id, UsageAction.GENERATE, today),
        )
        row = await cursor.fetchone()
        if row[0] >= MAX_DAILY_USES:
            raise HTTPException(status_code=429, detail=f"每日最多 {MAX_DAILY_USES} 次")


async def log_usage(user_id: int, action: str) -> None:
    """记录使用日志。"""
    async with db_session() as db:
        await db.execute("INSERT INTO usage_log (user_id, action) VALUES (?, ?)", (user_id, action))
        await db.commit()


def strip_yaml_frontmatter(text: str) -> str:
    """去除 Markdown 文本开头的 YAML frontmatter 块。

    YAML frontmatter 是以 ``---`` 开头和结尾的元数据块，常见于
    Markdown 文件头部。此函数将其完整移除，返回正文内容。

    Args:
        text: 可能包含 YAML frontmatter 的 Markdown 文本

    Returns:
        去除 frontmatter 后的文本；若无 frontmatter 则原样返回
    """
    return re.sub(
        r'^---\s*\n.*?\n---\s*\n', '', text, count=1, flags=re.DOTALL
    )
