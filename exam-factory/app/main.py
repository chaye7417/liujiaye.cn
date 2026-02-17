"""试卷工厂 - FastAPI 主应用，支持排版 / 通用出题 / 乐理出题三种模式。"""

import json
import logging
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import (
    UPLOAD_DIR, OUTPUT_DIR, MAX_FILE_SIZE_MB, MAX_DAILY_USES,
    TEMPLATE_DIR, BASE_DIR, AI_MODELS, DEFAULT_MODEL, QUIZ_BANK_DIR,
)
from app.database import init_db, get_db
from app.auth import (
    generate_code, send_verify_code, save_code, check_code,
    get_or_create_user, create_token, verify_token,
)
from app.file_parser import parse_file
from app.ai_service import stream_ai_chunks, clean_markdown, extract_exam_info
from app.pdf_generator import generate_both_pdfs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="试卷工厂", version="2.0.0")

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

VALID_MODES = {"format", "generate", "music_theory", "music_history"}


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
# 模型列表
# ============================================================

@app.get("/api/models")
async def api_models():
    """返回可用的 AI 模型列表。"""
    return [
        {"key": key, "label": cfg["label"]}
        for key, cfg in AI_MODELS.items()
    ]


# ============================================================
# 内置题库
# ============================================================

@app.get("/api/quiz-bank")
async def api_quiz_bank():
    """返回内置音乐史题库的分类列表和题目数量。"""
    result = {}
    for category in ("chinese", "western"):
        cat_dir = QUIZ_BANK_DIR / category
        if not cat_dir.exists():
            result[category] = []
            continue
        items = []
        for csv_file in sorted(cat_dir.glob("*.csv")):
            # 快速统计题目数：总行数减去表头和空行
            text = csv_file.read_text(encoding="utf-8")
            lines = [l for l in text.strip().split("\n") if l.strip()]
            # 跳过表头行（包含 "问题" 和 "选项"）
            count = sum(
                1 for l in lines
                if not ("问题" in l and "选项" in l)
            )
            items.append({
                "file": f"{category}/{csv_file.name}",
                "name": csv_file.stem,
                "count": count,
            })
        result[category] = items
    return result


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


@app.post("/api/extract-info")
async def api_extract_info(file: UploadFile = File(...)):
    """从上传文件中快速提取试卷标题和学校名称。"""
    content = await file.read()
    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".docx", ".pdf", ".txt", ".md"):
        return {"title": "", "school": ""}

    temp_path = UPLOAD_DIR / f"temp_{file.filename}"
    temp_path.write_bytes(content)

    try:
        text = parse_file(temp_path)
        if not text.strip():
            return {"title": "", "school": ""}
        return await extract_exam_info(text)
    except Exception:
        return {"title": "", "school": ""}
    finally:
        temp_path.unlink(missing_ok=True)


@app.post("/api/upload")
async def api_upload(
    file: Optional[UploadFile] = File(None),
    title: str = Form(""),
    school: str = Form(""),
    theme: str = Form("4e9b86"),
    mode: str = Form("format"),
    generation_params: str = Form(""),
    model: str = Form(""),
    user: dict = Depends(get_current_user),
):
    """上传文件并创建任务，支持三种模式。

    - format: 排版模式（文件必填）
    - generate: 通用出题（文件必填作为参考资料）
    - music_theory: 乐理出题（文件可选）
    """
    user_id = int(user["sub"])
    await check_daily_limit(user_id)

    # 验证 mode
    if mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"无效模式: {mode}")

    # 排版和通用出题模式必须上传文件
    if mode in ("format", "generate") and not file:
        raise HTTPException(status_code=400, detail="请上传文件")

    # 解析 generation_params JSON
    parsed_gen_params = None
    if generation_params:
        try:
            parsed_gen_params = json.loads(generation_params)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="generation_params 格式错误")

    text = ""
    original_filename = ""

    # 音乐史模式：从内置题库读取（无需上传文件）
    if mode == "music_history" and not file:
        selected = parsed_gen_params.get("selected_topics", []) if parsed_gen_params else []
        if not selected:
            raise HTTPException(status_code=400, detail="请至少选择一个专题")
        all_lines: list[str] = []
        header_line = ""
        for topic_path in selected:
            csv_path = QUIZ_BANK_DIR / topic_path
            if not csv_path.exists() or not csv_path.suffix == ".csv":
                continue
            csv_text = csv_path.read_text(encoding="utf-8")
            for line in csv_text.strip().split("\n"):
                line = line.strip()
                if not line:
                    continue
                if "问题" in line and "选项" in line:
                    if not header_line:
                        header_line = line
                    continue
                all_lines.append(line)
        if not all_lines:
            raise HTTPException(status_code=400, detail="所选专题无有效题目")
        # 拼接：表头 + 所有数据行
        combined = (header_line + "\n" if header_line else "") + "\n".join(all_lines)
        text = combined
        original_filename = "quiz_bank_combined.csv"

    # 处理文件上传
    if file:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"文件不能超过 {MAX_FILE_SIZE_MB}MB")

        suffix = Path(file.filename).suffix.lower()
        if suffix not in (".docx", ".pdf", ".txt", ".md", ".csv"):
            raise HTTPException(status_code=400, detail="仅支持 docx、pdf、txt、md、csv 格式")

        file_path = UPLOAD_DIR / f"{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}{suffix}"
        file_path.write_bytes(content)

        try:
            text = parse_file(file_path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"文件解析失败: {e}")

        if not text.strip():
            raise HTTPException(status_code=400, detail="文件内容为空")

        original_filename = file.filename

    # 默认标题
    if not title:
        title = "未命名试卷"

    # 验证 model key
    model_key = model.strip() if model else DEFAULT_MODEL
    if model_key not in AI_MODELS:
        model_key = DEFAULT_MODEL

    # 建任务
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO tasks (user_id, title, school, theme, mode, generation_params, original_filename, model, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
            (user_id, title, school, theme, mode, generation_params or None, original_filename, model_key),
        )
        await db.commit()
        task_id = cursor.lastrowid
    finally:
        await db.close()

    # 保存原始文本供后续解析（有文件时才保存）
    if text:
        raw_path = UPLOAD_DIR / f"{task_id}_raw.txt"
        raw_path.write_text(text, encoding="utf-8")

    return {"task_id": task_id, "text_length": len(text)}


@app.get("/api/tasks/{task_id}/parse")
async def api_parse_stream(task_id: int, user: dict = Depends(get_current_user)):
    """SSE 流式 AI 解析，支持三种模式。"""
    user_id = int(user["sub"])

    # 读取任务信息（获取 mode、generation_params、model）
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT mode, generation_params, model FROM tasks WHERE id = ? AND user_id = ?",
            (task_id, user_id),
        )
        task = await cursor.fetchone()
    finally:
        await db.close()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    task_mode = task["mode"] or "format"
    task_model = task["model"] or DEFAULT_MODEL
    gen_params = None
    if task["generation_params"]:
        try:
            gen_params = json.loads(task["generation_params"])
        except json.JSONDecodeError:
            pass

    # 读取原始文本（乐理模式可能没有文件）
    raw_path = UPLOAD_DIR / f"{task_id}_raw.txt"
    text = None
    if raw_path.exists():
        text = raw_path.read_text(encoding="utf-8")
    elif task_mode in ("format", "generate"):
        raise HTTPException(status_code=404, detail="原始文本不存在，请重新上传")

    async def generate():
        collected: list[str] = []
        try:
            if task_mode == "music_history":
                # CSV 直接处理，不调用 AI
                from app.modes.music_history import (
                    parse_csv_questions, select_questions, shuffle_options,
                    format_questions_markdown, format_questions_latex_csv,
                )
                yield _sse({"type": "chunk", "text": "正在解析 CSV 题库...\n"})

                params = gen_params or {}
                questions = parse_csv_questions(text)
                count = params.get("question_count", 0)
                do_shuffle = params.get("shuffle", True)
                points = params.get("points_per_question", 2)
                title = params.get("title", "音乐史选择题")

                selected = select_questions(questions, count)

                # 保存 LaTeX 用的 CSV（正确答案在列A，不打乱，由 LaTeX 打乱）
                latex_csv = format_questions_latex_csv(selected)
                quiz_csv_path = UPLOAD_DIR / f"{task_id}_quiz.csv"
                quiz_csv_path.write_text(latex_csv, encoding="utf-8")

                # 生成 Markdown 预览（Python 端打乱选项）
                if do_shuffle:
                    selected = [shuffle_options(q) for q in selected]
                full_md = format_questions_markdown(selected, points, title)

                yield _sse({"type": "chunk", "text": full_md})
            else:
                async for chunk in stream_ai_chunks(text, task_mode, gen_params, task_model):
                    collected.append(chunk)
                    yield _sse({"type": "chunk", "text": chunk})
                full_md = clean_markdown("".join(collected))

            # 存入数据库
            db2 = await get_db()
            try:
                await db2.execute(
                    "UPDATE tasks SET markdown_content = ?, status = 'draft' WHERE id = ? AND user_id = ?",
                    (full_md, task_id, user_id),
                )
                await db2.commit()
            finally:
                await db2.close()

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
    task_mode = task["mode"] or "format"

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

            if task_mode == "music_history":
                # 音乐史模式：使用旧模板直接编译 CSV
                from app.pdf_generator import _compile_music_history
                gen_params = None
                if task["generation_params"]:
                    try:
                        gen_params = json.loads(task["generation_params"])
                    except json.JSONDecodeError:
                        pass
                do_shuffle = gen_params.get("shuffle", True) if gen_params else True

                await _compile_music_history(task_id, title, theme, False, "exam", do_shuffle)
                yield _sse({"type": "progress", "pct": 55, "msg": "正在生成答案卷..."})
                await _compile_music_history(task_id, title, theme, True, "answer", do_shuffle)
            else:
                from app.pdf_generator import _compile_single
                await _compile_single(task_id, markdown, title, school, theme, False, "exam", task_mode)
                yield _sse({"type": "progress", "pct": 55, "msg": "正在生成答案卷..."})
                await _compile_single(task_id, markdown, title, school, theme, True, "answer", task_mode)

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
