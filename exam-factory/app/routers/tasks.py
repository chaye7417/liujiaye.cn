"""任务相关路由 - 上传、AI 解析、PDF 生成、历史查询。"""

import asyncio
import json
import logging
import re
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import StreamingResponse, JSONResponse

from app.config import (
    UPLOAD_DIR, OUTPUT_DIR, MAX_FILE_SIZE_MB,
    AI_MODELS, DEFAULT_MODEL, QUIZ_BANK_DIR,
    DEFAULT_PAGE_SIZE,
    TaskStatus, TaskMode, UsageAction,
)
from app.database import db_session
from app.file_parser import parse_file
from app.ai_service import stream_ai_chunks, clean_markdown, extract_exam_info
from app.pdf_generator import MUSIC_FONTS, DEFAULT_MUSIC_FONT
from app.utils import sse, check_daily_limit, log_usage
from app.routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tasks"])

VALID_MODES = TaskMode.ALL


# ============================================================
# 配置查询
# ============================================================

@router.get("/api/models")
async def api_models():
    """返回可用的 AI 模型列表。"""
    return [
        {"key": key, "label": cfg["label"]}
        for key, cfg in AI_MODELS.items()
    ]


@router.get("/api/music-fonts")
async def api_music_fonts():
    """返回可用的 LilyPond 音乐字体列表。"""
    return [
        {"key": key, "label": cfg["label"]}
        for key, cfg in MUSIC_FONTS.items()
    ]


@router.get("/api/quiz-bank")
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
            text = csv_file.read_text(encoding="utf-8")
            lines = [l for l in text.strip().split("\n") if l.strip()]
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

@router.post("/api/extract-info")
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


@router.post("/api/upload")
async def api_upload(
    file: Optional[UploadFile] = File(None),
    title: str = Form(""),
    school: str = Form(""),
    theme: str = Form("4e9b86"),
    mode: str = Form(TaskMode.FORMAT),
    generation_params: str = Form(""),
    model: str = Form(""),
    user: dict = Depends(get_current_user),
):
    """上传文件并创建任务，支持三种模式。"""
    user_id = int(user["sub"])
    await check_daily_limit(user_id)

    if not re.match(r'^[0-9a-fA-F]{6}$', theme):
        theme = "4e9b86"

    if mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"无效模式: {mode}")

    if mode in (TaskMode.FORMAT, TaskMode.GENERATE) and not file:
        raise HTTPException(status_code=400, detail="请上传文件")

    parsed_gen_params = None
    if generation_params:
        try:
            parsed_gen_params = json.loads(generation_params)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="generation_params 格式错误")

    text = ""
    original_filename = ""

    # 音乐史模式：从内置题库读取
    if mode == TaskMode.MUSIC_HISTORY and not file:
        selected = parsed_gen_params.get("selected_topics", []) if parsed_gen_params else []
        if not selected:
            raise HTTPException(status_code=400, detail="请至少选择一个专题")
        all_lines: list[str] = []
        header_line = ""
        quiz_bank_resolved = QUIZ_BANK_DIR.resolve()
        for topic_path in selected:
            csv_path = (QUIZ_BANK_DIR / topic_path).resolve()
            if not csv_path.is_relative_to(quiz_bank_resolved):
                raise HTTPException(
                    status_code=400,
                    detail=f"非法的题库路径: {topic_path}",
                )
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

    if not title:
        title = "未命名试卷"

    model_key = model.strip() if model else DEFAULT_MODEL
    if model_key not in AI_MODELS:
        model_key = DEFAULT_MODEL

    async with db_session() as db:
        cursor = await db.execute(
            "INSERT INTO tasks (user_id, title, school, theme, mode, generation_params, original_filename, model, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, title, school, theme, mode, generation_params or None, original_filename, model_key, TaskStatus.PENDING),
        )
        await db.commit()
        task_id = cursor.lastrowid

    if text:
        raw_path = UPLOAD_DIR / f"{task_id}_raw.txt"
        raw_path.write_text(text, encoding="utf-8")

    return {"task_id": task_id, "text_length": len(text)}


# ----------------------------------------------------------
# 内容构建器（按 task_mode 分派）
# ----------------------------------------------------------

async def _build_music_history_content(
    text: Optional[str],
    task_id: int,
    gen_params: Optional[dict],
    task_model: str,
    task_mode: str,
    result_holder: list[str],
) -> AsyncGenerator[str, None]:
    """构建音乐史模式的 SSE 流。

    解析 CSV 题库，随机选题并打乱选项，生成 Markdown 格式的试题。
    完成后将 full_md 写入 result_holder[0]。

    Args:
        text: 原始 CSV 文本
        task_id: 任务 ID
        gen_params: 生成参数
        task_model: AI 模型 key（本模式未使用，保持签名一致）
        task_mode: 任务模式（本模式未使用，保持签名一致）
        result_holder: 可变列表，函数结束时 result_holder[0] 存放最终 Markdown

    Yields:
        SSE 格式的字符串
    """
    from app.modes.music_history import (
        parse_csv_questions, select_questions, shuffle_options,
        format_questions_markdown, format_questions_latex_csv,
    )

    yield sse({"type": "chunk", "text": "正在解析 CSV 题库...\n"})

    params = gen_params or {}
    questions = parse_csv_questions(text)
    count = params.get("question_count", 0)
    do_shuffle = params.get("shuffle", True)
    points = params.get("points_per_question", 2)
    title = params.get("title", "音乐史选择题")

    selected = select_questions(questions, count)

    latex_csv = format_questions_latex_csv(selected)
    quiz_csv_path = UPLOAD_DIR / f"{task_id}_quiz.csv"
    quiz_csv_path.write_text(latex_csv, encoding="utf-8")

    if do_shuffle:
        selected = [shuffle_options(q) for q in selected]
    full_md = format_questions_markdown(selected, points, title)

    yield sse({"type": "chunk", "text": full_md})
    result_holder.append(full_md)


async def _build_music_theory_content(
    text: Optional[str],
    task_id: int,
    gen_params: Optional[dict],
    task_model: str,
    task_mode: str,
    result_holder: list[str],
) -> AsyncGenerator[str, None]:
    """构建乐理模式的 SSE 流。

    根据 build_user_content 的返回值，分三种子情况处理：
    - __PRECOMPUTED__：预计算结果直接输出
    - __MIXED__：部分预计算 + 部分 AI 流式生成
    - 其他：完全 AI 流式生成

    完成后将 full_md 写入 result_holder[0]。

    Args:
        text: 原始文本（可选）
        task_id: 任务 ID（本模式未使用，保持签名一致）
        gen_params: 生成参数
        task_model: AI 模型 key
        task_mode: 任务模式
        result_holder: 可变列表，函数结束时 result_holder[0] 存放最终 Markdown

    Yields:
        SSE 格式的字符串
    """
    from app.modes.music_theory import build_user_content as _build_mt

    collected: list[str] = []
    user_content = _build_mt(gen_params or {}, text)

    if user_content.startswith("__PRECOMPUTED__"):
        full_md = user_content[len("__PRECOMPUTED__\n"):]
        yield sse({"type": "chunk", "text": full_md})
    elif user_content.startswith("__MIXED__"):
        payload = json.loads(user_content[len("__MIXED__\n"):])
        computed_md = payload["computed_md"]
        ai_prompt = payload["ai_prompt"]

        collected.append(computed_md + "\n\n")
        yield sse({"type": "chunk", "text": computed_md + "\n\n"})

        async for chunk in stream_ai_chunks(
            text, task_mode, gen_params, task_model,
            override_user_content=ai_prompt,
        ):
            collected.append(chunk)
            yield sse({"type": "chunk", "text": chunk})
        full_md = clean_markdown("".join(collected))
    else:
        async for chunk in stream_ai_chunks(text, task_mode, gen_params, task_model):
            collected.append(chunk)
            yield sse({"type": "chunk", "text": chunk})
        full_md = clean_markdown("".join(collected))

    result_holder.append(full_md)


async def _build_default_content(
    text: Optional[str],
    task_id: int,
    gen_params: Optional[dict],
    task_model: str,
    task_mode: str,
    result_holder: list[str],
) -> AsyncGenerator[str, None]:
    """构建默认模式（排版/通用出题）的 SSE 流。

    直接调用 AI 流式生成 Markdown 内容。
    完成后将 full_md 写入 result_holder[0]。

    Args:
        text: 原始文本
        task_id: 任务 ID（本模式未使用，保持签名一致）
        gen_params: 生成参数
        task_model: AI 模型 key
        task_mode: 任务模式
        result_holder: 可变列表，函数结束时 result_holder[0] 存放最终 Markdown

    Yields:
        SSE 格式的字符串
    """
    collected: list[str] = []
    async for chunk in stream_ai_chunks(text, task_mode, gen_params, task_model):
        collected.append(chunk)
        yield sse({"type": "chunk", "text": chunk})
    full_md = clean_markdown("".join(collected))
    result_holder.append(full_md)


# 内容构建器调度表
_CONTENT_BUILDERS = {
    TaskMode.MUSIC_HISTORY: _build_music_history_content,
    TaskMode.MUSIC_THEORY: _build_music_theory_content,
}


@router.get("/api/tasks/{task_id}/parse")
async def api_parse_stream(task_id: int, user: dict = Depends(get_current_user)):
    """SSE 流式 AI 解析，支持三种模式。"""
    user_id = int(user["sub"])

    async with db_session() as db:
        cursor = await db.execute(
            "SELECT mode, generation_params, model FROM tasks WHERE id = ? AND user_id = ?",
            (task_id, user_id),
        )
        task = await cursor.fetchone()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    task_mode = task["mode"] or TaskMode.FORMAT
    task_model = task["model"] or DEFAULT_MODEL
    gen_params = None
    if task["generation_params"]:
        try:
            gen_params = json.loads(task["generation_params"])
        except json.JSONDecodeError:
            pass

    raw_path = UPLOAD_DIR / f"{task_id}_raw.txt"
    text = None
    if raw_path.exists():
        text = raw_path.read_text(encoding="utf-8")
    elif task_mode in (TaskMode.FORMAT, TaskMode.GENERATE):
        raise HTTPException(status_code=404, detail="原始文本不存在，请重新上传")

    async def generate():
        try:
            builder = _CONTENT_BUILDERS.get(task_mode, _build_default_content)
            result_holder: list[str] = []
            async for event in builder(
                text, task_id, gen_params, task_model, task_mode, result_holder,
            ):
                yield event
            full_md = result_holder[0] if result_holder else ""

            async with db_session() as db2:
                await db2.execute(
                    "UPDATE tasks SET markdown_content = ?, status = ? WHERE id = ? AND user_id = ?",
                    (full_md, TaskStatus.DRAFT, task_id, user_id),
                )
                await db2.commit()

            raw_path.unlink(missing_ok=True)
            await log_usage(user_id, UsageAction.GENERATE)

            yield sse({"type": "done", "markdown": full_md})

        except Exception as e:
            logger.error("AI 解析失败: %s\n%s", e, traceback.format_exc())
            yield sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


@router.post("/api/tasks/{task_id}/update-markdown")
async def api_update_markdown(
    task_id: int,
    markdown: str = Form(...),
    user: dict = Depends(get_current_user),
):
    """更新 Markdown 内容。"""
    user_id = int(user["sub"])
    async with db_session() as db:
        await db.execute(
            "UPDATE tasks SET markdown_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            (markdown, task_id, user_id),
        )
        await db.commit()
    return {"message": "已保存"}


@router.post("/api/tasks/{task_id}/generate-pdf")
async def api_generate_pdf(
    task_id: int,
    markdown: str = Form(...),
    user: dict = Depends(get_current_user),
):
    """生成试题卷 + 答案卷，通过 SSE 返回进度。"""
    user_id = int(user["sub"])

    async with db_session() as db:
        cursor = await db.execute(
            "SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id),
        )
        task = await cursor.fetchone()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    title = task["title"]
    school = task["school"] or ""
    theme = task["theme"] or "4e9b86"
    if not re.match(r'^[0-9a-fA-F]{6}$', theme):
        theme = "4e9b86"
    task_mode = task["mode"] or TaskMode.FORMAT

    gen_params = None
    if task["generation_params"]:
        try:
            gen_params = json.loads(task["generation_params"])
        except json.JSONDecodeError:
            pass
    music_font = (gen_params or {}).get("music_font", DEFAULT_MUSIC_FONT)

    async def generate():
        try:
            yield sse({"type": "progress", "pct": 5, "msg": "保存编辑内容..."})
            async with db_session() as db2:
                await db2.execute(
                    "UPDATE tasks SET markdown_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (markdown, task_id),
                )
                await db2.commit()

            yield sse({"type": "progress", "pct": 10, "msg": "正在生成试题卷..."})

            if task_mode == TaskMode.MUSIC_HISTORY:
                from app.pdf_generator import _compile_music_history
                do_shuffle = gen_params.get("shuffle", True) if gen_params else True

                await _compile_music_history(task_id, title, theme, False, "exam", do_shuffle)
                yield sse({"type": "progress", "pct": 55, "msg": "正在生成答案卷..."})
                await _compile_music_history(task_id, title, theme, True, "answer", do_shuffle)
            else:
                from app.pdf_generator import _compile_single
                yield sse({"type": "progress", "pct": 15, "msg": "正在并行生成试题卷和答案卷..."})
                results = await asyncio.gather(
                    _compile_single(task_id, markdown, title, school, theme, False, "exam", task_mode, music_font),
                    _compile_single(task_id, markdown, title, school, theme, True, "answer", task_mode, music_font),
                    return_exceptions=True,
                )
                errors = [r for r in results if isinstance(r, Exception)]
                if errors:
                    raise errors[0]

            async with db_session() as db3:
                await db3.execute(
                    "UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (TaskStatus.DONE, task_id),
                )
                await db3.commit()

            yield sse({
                "type": "done",
                "exam_url": f"/api/tasks/{task_id}/download?type=exam",
                "answer_url": f"/api/tasks/{task_id}/download?type=answer",
                "tex_url": f"/api/tasks/{task_id}/download-tex?type=exam",
                "zip_url": f"/api/tasks/{task_id}/download-latex-zip?type=exam",
            })

        except Exception as e:
            logger.error("PDF 生成失败: %s\n%s", e, traceback.format_exc())
            yield sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


# ============================================================
# 查询
# ============================================================

@router.get("/api/tasks")
async def api_tasks(
    page: int = 1,
    mode: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """获取当前用户的任务历史列表。"""
    user_id = int(user["sub"])
    limit = DEFAULT_PAGE_SIZE
    offset = (page - 1) * limit

    async with db_session() as db:
        count_sql = "SELECT COUNT(*) FROM tasks WHERE user_id = ?"
        count_params: list = [user_id]
        if mode:
            count_sql += " AND mode = ?"
            count_params.append(mode)
        cursor = await db.execute(count_sql, count_params)
        total = (await cursor.fetchone())[0]

        list_sql = (
            "SELECT id, title, mode, status, created_at FROM tasks WHERE user_id = ?"
        )
        list_params: list = [user_id]
        if mode:
            list_sql += " AND mode = ?"
            list_params.append(mode)
        list_sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        list_params.extend([limit, offset])

        cursor = await db.execute(list_sql, list_params)
        rows = await cursor.fetchall()

    MODE_LABELS = TaskMode.LABELS

    items = []
    for r in rows:
        task_id = r["id"]
        has_exam = (OUTPUT_DIR / str(task_id) / "exam" / "main.pdf").exists()
        has_answer = (OUTPUT_DIR / str(task_id) / "answer" / "main.pdf").exists()
        items.append({
            "id": task_id,
            "title": r["title"] or "未命名",
            "mode": r["mode"],
            "mode_label": MODE_LABELS.get(r["mode"], r["mode"]),
            "status": r["status"],
            "created_at": r["created_at"],
            "has_exam_pdf": has_exam,
            "has_answer_pdf": has_answer,
        })

    return {"total": total, "page": page, "items": items}


@router.get("/api/user/stats")
async def api_user_stats(user: dict = Depends(get_current_user)):
    """获取当前用户的生成统计。"""
    user_id = int(user["sub"])
    async with db_session() as db:
        cursor = await db.execute(
            "SELECT COUNT(*) FROM tasks WHERE user_id = ?", (user_id,)
        )
        total = (await cursor.fetchone())[0]

        month_start = datetime.now(timezone.utc).strftime("%Y-%m-01")
        cursor = await db.execute(
            "SELECT COUNT(*) FROM tasks WHERE user_id = ? AND created_at >= ?",
            (user_id, month_start),
        )
        month_count = (await cursor.fetchone())[0]

        cursor = await db.execute(
            "SELECT mode, COUNT(*) as cnt FROM tasks WHERE user_id = ? GROUP BY mode",
            (user_id,),
        )
        by_mode = {r["mode"]: r["cnt"] for r in await cursor.fetchall()}

    return {"total": total, "month_count": month_count, "by_mode": by_mode}


@router.get("/api/me")
async def api_me(user: dict = Depends(get_current_user)):
    """获取当前用户信息。"""
    user_id = int(user["sub"])
    async with db_session() as db:
        cursor = await db.execute(
            "SELECT id, email, nickname, avatar_url, login_method FROM users WHERE id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {
        "user_id": row["id"],
        "email": row["email"],
        "nickname": row["nickname"],
        "avatar_url": row["avatar_url"],
        "login_method": row["login_method"],
    }
