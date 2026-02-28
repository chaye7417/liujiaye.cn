"""工具箱路由 - MusicXML 转简谱等独立工具。"""

import asyncio
import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse

from app.config import OUTPUT_DIR, MAX_FILE_SIZE_MB
from app.pdf_generator import (
    _run_jianpu_ly, MUSIC_FONTS, DEFAULT_MUSIC_FONT, _sanitize_error_msg,
)
from app.tools.musicxml_to_jianpu import convert_musicxml_to_jianpu

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tools", tags=["tools"])

TOOLS_DIR = OUTPUT_DIR / "tools"
TOOLS_DIR.mkdir(parents=True, exist_ok=True)


def _tools_workdir(task_id: str) -> Path:
    """创建/获取工具任务的工作目录。"""
    d = TOOLS_DIR / task_id
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/musicxml-to-jianpu")
async def api_musicxml_to_jianpu(
    file: UploadFile = File(...),
):
    """上传 MusicXML 文件，转换为 jianpu-ly 文本。"""
    filename = file.filename or ""
    suffix = Path(filename).suffix.lower()
    if suffix not in (".musicxml", ".xml", ".mxl"):
        raise HTTPException(400, "仅支持 .musicxml / .xml / .mxl 文件")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"文件大小超过 {MAX_FILE_SIZE_MB}MB 限制")

    task_id = uuid.uuid4().hex[:12]
    work_dir = _tools_workdir(task_id)
    input_path = work_dir / f"input{suffix}"
    input_path.write_bytes(contents)

    try:
        result = convert_musicxml_to_jianpu(str(input_path))
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.error("MusicXML 转换失败: %s", e)
        raise HTTPException(500, f"转换失败: {e}")

    result["task_id"] = task_id
    return {"data": result, "error": None}


@router.post("/jianpu-render")
async def api_jianpu_render(
    jianpu_text: str = Form(...),
    font: str = Form(DEFAULT_MUSIC_FONT),
    task_id: str = Form(""),
):
    """渲染 jianpu-ly 文本为 PDF。"""
    if not jianpu_text.strip():
        raise HTTPException(400, "jianpu-ly 文本不能为空")

    if font not in MUSIC_FONTS:
        font = DEFAULT_MUSIC_FONT

    if not task_id:
        task_id = uuid.uuid4().hex[:12]
    work_dir = _tools_workdir(task_id)

    # 提取谱号标记
    text = jianpu_text.strip()
    clef = "treble"
    if text.startswith("CLEF:"):
        first_nl = text.index("\n")
        clef = text[5:first_nl].strip()
        text = text[first_nl + 1:]

    # jianpu-ly → LilyPond
    try:
        ly_content = await _run_jianpu_ly(text, "render", work_dir)
    except RuntimeError as e:
        raise HTTPException(422, f"jianpu-ly 转换失败: {e}")

    # 去水印
    ly_content = ly_content.replace(
        '% \\header { tagline="" }',
        '\\header { tagline="" }',
    )

    # 注入谱号
    if clef != "treble" and "\\clef treble" in ly_content:
        ly_content = ly_content.replace("\\clef treble", f"\\clef {clef}", 1)

    # 注入字体
    font_cfg = MUSIC_FONTS.get(font, MUSIC_FONTS[DEFAULT_MUSIC_FONT])
    ly_content = re.sub(
        r'#\(define fonts\s*\n\s*\(set-global-fonts\n(?:\s+.*\n)*?\s*\)\)',
        (
            "#(define fonts\n"
            "    (set-global-fonts\n"
            f'      #:music "{font_cfg["music"]}"\n'
            f'      #:brace "{font_cfg["brace"]}"\n'
            '      #:roman "Source Serif Pro,Source Han Serif SC,Times New Roman,Arial Unicode MS"\n'
            "      #:factor (/ staff-height pt 20)\n"
            "    ))"
        ),
        ly_content,
        count=1,
    )

    ly_file = work_dir / "render.ly"
    ly_file.write_text(ly_content, encoding="utf-8")

    # LilyPond → PDF
    try:
        proc = await asyncio.create_subprocess_exec(
            "lilypond", "--pdf", "-o", str(work_dir / "render"),
            str(ly_file),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(work_dir),
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            err = stderr.decode(errors="replace")
            raise RuntimeError(f"LilyPond 编译失败:\n{_sanitize_error_msg(err[-1000:])}")
    except FileNotFoundError:
        raise HTTPException(500, "服务器未安装 LilyPond")

    pdf_path = work_dir / "render.pdf"
    if not pdf_path.exists():
        raise HTTPException(500, "PDF 生成失败")

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename="jianpu.pdf",
    )
