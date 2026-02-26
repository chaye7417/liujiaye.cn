"""下载路由 - PDF、LaTeX 源文件、LaTeX 工程压缩包。"""

import io
import zipfile
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse, Response

from app.config import OUTPUT_DIR, TaskMode
from app.database import db_session
from app.routers.auth import get_current_user

router = APIRouter(tags=["download"])

# LaTeX 下载时排除的文件扩展名和目录
_LATEX_ZIP_EXCLUDE_EXTS = {
    ".aux", ".log", ".out", ".fls", ".fdb_latexmk", ".synctex.gz",
    ".toc", ".nav", ".snm", ".vrb", ".bbl", ".blg", ".bcf",
    ".run.xml", ".xdv", ".pdf",
}
_LATEX_ZIP_EXCLUDE_DIRS = {"lilypond-out"}


@router.get("/api/tasks/{task_id}/download")
async def api_download(
    task_id: int,
    type: str = "exam",
    user: dict = Depends(get_current_user),
):
    """下载 PDF（type=exam 或 answer）。"""
    user_id = int(user["sub"])
    async with db_session() as db:
        cursor = await db.execute(
            "SELECT title FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id),
        )
        task = await cursor.fetchone()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    variant = "answer" if type == "answer" else "exam"
    pdf_path = OUTPUT_DIR / str(task_id) / variant / "main.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF 文件不存在")

    suffix = "答案卷" if variant == "answer" else "试题卷"
    filename = f"{task['title']}_{suffix}.pdf"
    return FileResponse(pdf_path, filename=filename, media_type="application/pdf")


@router.get("/api/tasks/{task_id}/download-tex")
async def api_download_tex(
    task_id: int,
    type: str = "exam",
    user: dict = Depends(get_current_user),
):
    """下载单个 LaTeX 源文件（.tex）。"""
    user_id = int(user["sub"])
    async with db_session() as db:
        cursor = await db.execute(
            "SELECT title, mode FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id),
        )
        task = await cursor.fetchone()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    variant = "answer" if type == "answer" else "exam"
    work_dir = OUTPUT_DIR / str(task_id) / variant
    task_mode = task["mode"] or TaskMode.FORMAT

    if task_mode == TaskMode.MUSIC_HISTORY:
        tex_name = "answer_sheet.tex" if variant == "answer" else "question_paper.tex"
        tex_path = work_dir / tex_name
    else:
        lilypond_tex = work_dir / "lilypond-out" / "main.tex"
        tex_path = lilypond_tex if lilypond_tex.exists() else work_dir / "main.tex"

    if not tex_path.exists():
        raise HTTPException(status_code=404, detail="LaTeX 源文件不存在，请先生成 PDF")

    suffix = "答案卷" if variant == "answer" else "试题卷"
    filename = f"{task['title']}_{suffix}.tex"
    return FileResponse(tex_path, filename=filename, media_type="application/x-tex")


@router.get("/api/tasks/{task_id}/download-latex-zip")
async def api_download_latex_zip(
    task_id: int,
    type: str = "exam",
    user: dict = Depends(get_current_user),
):
    """下载完整 LaTeX 工程压缩包（含模板、样式、资源）。"""
    user_id = int(user["sub"])
    async with db_session() as db:
        cursor = await db.execute(
            "SELECT title, mode FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id),
        )
        task = await cursor.fetchone()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    variant = "answer" if type == "answer" else "exam"
    work_dir = OUTPUT_DIR / str(task_id) / variant

    if not work_dir.exists():
        raise HTTPException(status_code=404, detail="LaTeX 文件不存在，请先生成 PDF")

    lilypond_out = work_dir / "lilypond-out"
    pack_dir = lilypond_out if lilypond_out.exists() else work_dir

    buf = io.BytesIO()
    suffix = "答案卷" if variant == "answer" else "试题卷"
    zip_root = f"{task['title']}_{suffix}_LaTeX"

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in sorted(pack_dir.rglob("*")):
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() in _LATEX_ZIP_EXCLUDE_EXTS:
                if not (file_path.suffix.lower() == ".pdf" and file_path.name.startswith("lily-")):
                    continue
            rel = file_path.relative_to(pack_dir)
            if file_path.name in ("lilypond-wrapper.sh", "main-template.tex", "lock"):
                continue
            if file_path.suffix.lower() in (".ly", ".eps", ".count", ".texi", ".dep"):
                continue
            zf.write(file_path, f"{zip_root}/{rel}")

    buf.seek(0)
    filename = f"{zip_root}.zip"
    encoded = quote(filename)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded}",
        },
    )
