"""数据库模块 - SQLite 异步操作。"""

import aiosqlite
from app.config import DATABASE_URL


async def get_db() -> aiosqlite.Connection:
    """获取数据库连接。"""
    db = await aiosqlite.connect(DATABASE_URL)
    db.row_factory = aiosqlite.Row
    return db


async def init_db() -> None:
    """初始化数据库表结构。"""
    db = await get_db()
    try:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE,
                nickname TEXT,
                avatar_url TEXT,
                wechat_openid TEXT UNIQUE,
                login_method TEXT DEFAULT 'email',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS verify_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                code TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                used INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS usage_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                mode TEXT DEFAULT 'format',
                title TEXT,
                school TEXT,
                theme TEXT DEFAULT '4e9b86',
                original_filename TEXT,
                markdown_content TEXT,
                generation_params TEXT,
                pdf_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        """)
        # 迁移：为已有的 tasks 表添加新列（不存在则添加）
        cursor = await db.execute("PRAGMA table_info(tasks)")
        columns = {row[1] for row in await cursor.fetchall()}
        if "mode" not in columns:
            await db.execute("ALTER TABLE tasks ADD COLUMN mode TEXT DEFAULT 'format'")
        if "generation_params" not in columns:
            await db.execute("ALTER TABLE tasks ADD COLUMN generation_params TEXT")
        if "model" not in columns:
            await db.execute("ALTER TABLE tasks ADD COLUMN model TEXT")

        # 迁移：为已有的 users 表添加新列
        cursor_u = await db.execute("PRAGMA table_info(users)")
        user_columns = {row[1] for row in await cursor_u.fetchall()}
        if "nickname" not in user_columns:
            await db.execute("ALTER TABLE users ADD COLUMN nickname TEXT")
        if "avatar_url" not in user_columns:
            await db.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
        if "wechat_openid" not in user_columns:
            await db.execute("ALTER TABLE users ADD COLUMN wechat_openid TEXT UNIQUE")
        if "login_method" not in user_columns:
            await db.execute("ALTER TABLE users ADD COLUMN login_method TEXT DEFAULT 'email'")

        await db.commit()
    finally:
        await db.close()
