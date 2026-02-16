"""试卷工厂 - FastAPI 主应用。"""

import json
import logging
import traceback
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import (
    UPLOAD_DIR, OUTPUT_DIR, MAX_FILE_SIZE_MB, MAX_DAILY_USES,
    TEMPLATE_DIR, BASE_DIR,
)
from app.database import init_db, get_db
from app.auth import (
    generate_code, send_verify_code, save_code, check_code,
    get_or_create_user, create_token, verify_token,
)
from app.file_parser import parse_file
from app.ai_service import stream_ai_chunks, clean_markdown
from app.pdf_generator import generate_both_pdfs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="试卷工厂", version="1.0.0")

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


def _sse(data: dict) -> str:
    """构造 SSE 事件字符串。"""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.on_event("startup")
async def startup():
    """应用启动时初始化数据库。"""
    await init_db()


# ============================================================
# 认证
# ============================================================

async def get_current_user(request: Request) -> dict:
    """从请求中获取当前用户。"""
    # TODO: 邮箱验证上线后移除此临时放行
    token = request.cookies.get("token")
    if not token:
        return {"sub": "1", "email": "guest@test.com"}
    payload = verify_token(token)
    if not payload:
        return {"sub": "1", "email": "guest@test.com"}
    return payload


@app.post("/api/auth/send-code")
async def api_send_code(email: str = Form(...)):
    """发送验证码。"""
    code = generate_code()
    await save_code(email, code)
    success = await send_verify_code(email, code)
    if not success:
        raise HTTPException(status_code=500, detail="验证码发送失败")
    return {"message": "验证码已发送"}


@app.post("/api/auth/login")
async def api_login(email: str = Form(...), code: str = Form(...)):
    """验证码登录。"""
    from fastapi.responses import JSONResponse
    valid = await check_code(email, code)
    if not valid:
        raise HTTPException(status_code=400, detail="验证码错误或已过期")
    user_id = await get_or_create_user(email)
    token = create_token(user_id, email)
    response = JSONResponse({"message": "登录成功", "email": email})
    response.set_cookie(key="token", value=token, httponly=True, max_age=86400, samesite="lax")
    return response


@app.post("/api/auth/logout")
async def api_logout():
    """退出登录。"""
    from fastapi.responses import JSONResponse
    response = JSONResponse({"message": "已退出"})
    response.delete_cookie("token")
    return response


# ============================================================
# 核心功能
# ============================================================

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


@app.post("/api/upload")
async def api_upload(
    file: UploadFile = File(...),
    title: str = Form(...),
    school: str = Form(""),
    theme: str = Form("4e9b86"),
    user: dict = Depends(get_current_user),
):
    """上传文件并提取文本（不做 AI 解析）。"""
    user_id = int(user["sub"])
    await check_daily_limit(user_id)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"文件不能超过 {MAX_FILE_SIZE_MB}MB")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".docx", ".pdf", ".txt", ".md"):
        raise HTTPException(status_code=400, detail="仅支持 docx、pdf、txt、md 格式")

    file_path = UPLOAD_DIR / f"{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}{suffix}"
    file_path.write_bytes(content)

    try:
        text = parse_file(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {e}")

    if not text.strip():
        raise HTTPException(status_code=400, detail="文件内容为空")

    # 建任务
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO tasks (user_id, title, school, theme, original_filename, status) VALUES (?, ?, ?, ?, ?, 'pending')",
            (user_id, title, school, theme, file.filename),
        )
        await db.commit()
        task_id = cursor.lastrowid
    finally:
        await db.close()

    # 保存原始文本供后续解析
    raw_path = UPLOAD_DIR / f"{task_id}_raw.txt"
    raw_path.write_text(text, encoding="utf-8")

    return {"task_id": task_id, "text_length": len(text)}


@app.get("/api/tasks/{task_id}/parse")
async def api_parse_stream(task_id: int, user: dict = Depends(get_current_user)):
    """SSE 流式 AI 解析。"""
    user_id = int(user["sub"])

    raw_path = UPLOAD_DIR / f"{task_id}_raw.txt"
    if not raw_path.exists():
        raise HTTPException(status_code=404, detail="原始文本不存在，请重新上传")
    text = raw_path.read_text(encoding="utf-8")

    async def generate():
        collected: list[str] = []
        try:
            async for chunk in stream_ai_chunks(text):
                collected.append(chunk)
                yield _sse({"type": "chunk", "text": chunk})

            full_md = clean_markdown("".join(collected))

            # 存入数据库
            db = await get_db()
            try:
                await db.execute(
                    "UPDATE tasks SET markdown_content = ?, status = 'draft' WHERE id = ? AND user_id = ?",
                    (full_md, task_id, user_id),
                )
                await db.commit()
            finally:
                await db.close()

            raw_path.unlink(missing_ok=True)
            await log_usage(user_id, "generate")

            yield _sse({"type": "done", "markdown": full_md})

        except Exception as e:
            logger.error("AI 解析失败: %s\n%s", e, traceback.format_exc())
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


@app.post("/api/tasks/{task_id}/update-markdown")
async def api_update_markdown(
    task_id: int,
    markdown: str = Form(...),
    user: dict = Depends(get_current_user),
):
    """更新 Markdown 内容。"""
    user_id = int(user["sub"])
    db = await get_db()
    try:
        await db.execute(
            "UPDATE tasks SET markdown_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            (markdown, task_id, user_id),
        )
        await db.commit()
    finally:
        await db.close()
    return {"message": "已保存"}


@app.post("/api/tasks/{task_id}/generate-pdf")
async def api_generate_pdf(
    task_id: int,
    markdown: str = Form(...),
    user: dict = Depends(get_current_user),
):
    """生成试题卷 + 答案卷，通过 SSE 返回进度。"""
    user_id = int(user["sub"])

    # 读取任务信息
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id),
        )
        task = await cursor.fetchone()
    finally:
        await db.close()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    title = task["title"]
    school = task["school"] or ""
    theme = task["theme"] or "4e9b86"

    async def generate():
        try:
            # 保存最新 markdown
            yield _sse({"type": "progress", "pct": 5, "msg": "保存编辑内容..."})
            db2 = await get_db()
            try:
                await db2.execute(
                    "UPDATE tasks SET markdown_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (markdown, task_id),
                )
                await db2.commit()
            finally:
                await db2.close()

            # 生成试题卷
            yield _sse({"type": "progress", "pct": 10, "msg": "正在生成试题卷..."})
            from app.pdf_generator import _compile_single
            await _compile_single(task_id, markdown, title, school, theme, False, "exam")

            yield _sse({"type": "progress", "pct": 55, "msg": "正在生成答案卷..."})
            await _compile_single(task_id, markdown, title, school, theme, True, "answer")

            # 更新状态
            db3 = await get_db()
            try:
                await db3.execute(
                    "UPDATE tasks SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (task_id,),
                )
                await db3.commit()
            finally:
                await db3.close()

            yield _sse({
                "type": "done",
                "exam_url": f"/api/tasks/{task_id}/download?type=exam",
                "answer_url": f"/api/tasks/{task_id}/download?type=answer",
            })

        except Exception as e:
            logger.error("PDF 生成失败: %s\n%s", e, traceback.format_exc())
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


@app.get("/api/tasks/{task_id}/download")
async def api_download(
    task_id: int,
    type: str = "exam",
    user: dict = Depends(get_current_user),
):
    """下载 PDF（type=exam 或 answer）。"""
    user_id = int(user["sub"])
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT title FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id),
        )
        task = await cursor.fetchone()
    finally:
        await db.close()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    variant = "answer" if type == "answer" else "exam"
    pdf_path = OUTPUT_DIR / str(task_id) / variant / "main.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF 文件不存在")

    suffix = "答案卷" if variant == "answer" else "试题卷"
    filename = f"{task['title']}_{suffix}.pdf"
    return FileResponse(pdf_path, filename=filename, media_type="application/pdf")


@app.get("/api/me")
async def api_me(user: dict = Depends(get_current_user)):
    """获取当前用户信息。"""
    return {"user_id": user["sub"], "email": user["email"]}


# ============================================================
# 页面路由
# ============================================================

@app.get("/", response_class=HTMLResponse)
async def page_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/login", response_class=HTMLResponse)
async def page_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/workspace", response_class=HTMLResponse)
async def page_workspace(request: Request):
    return templates.TemplateResponse("workspace.html", {"request": request})
