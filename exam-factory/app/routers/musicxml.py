"""MusicXML 转简谱 API 端点。"""

import logging
import shutil
import uuid
from io import BytesIO
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.config import MAX_FILE_SIZE_MB, OUTPUT_DIR

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/musicxml", tags=["musicxml"])

# MusicXML 允许的文件扩展名
ALLOWED_EXTENSIONS = {".musicxml", ".xml", ".mxl"}

# 工具临时输出目录
TOOLS_OUTPUT_DIR = OUTPUT_DIR / "tools"


class DownloadSpnmnRequest(BaseModel):
    """下载 .spnmn 文件的请求体。

    Attributes:
        spnmn_text: .spnmn 格式的文本内容
        filename: 可选的下载文件名（不含扩展名）
    """

    spnmn_text: str
    filename: Optional[str] = None


# ============================================================
# 端点
# ============================================================


@router.post("/convert")
async def convert_musicxml(
    file: UploadFile = File(...),
    part_index: int = 0,
) -> JSONResponse:
    """上传 MusicXML 文件，转换为 .spnmn 格式文本。

    Args:
        file: 上传的 MusicXML 文件（.musicxml, .xml, .mxl）
        part_index: 声部索引，默认为 0（第一声部）

    Returns:
        包含转换结果的 JSON 响应

    Raises:
        HTTPException: 文件格式错误(400)、转换失败(400/500)
    """
    # 校验文件扩展名
    suffix = Path(file.filename).suffix.lower() if file.filename else ""
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: {suffix}，仅支持 .musicxml, .xml, .mxl",
        )

    # 读取文件内容并校验大小
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"文件不能超过 {MAX_FILE_SIZE_MB}MB",
        )

    # 生成任务 ID 和临时目录
    task_id = str(uuid.uuid4())
    task_dir = TOOLS_OUTPUT_DIR / task_id
    task_dir.mkdir(parents=True, exist_ok=True)

    # 保存上传文件
    input_path = task_dir / "input.musicxml"
    input_path.write_bytes(content)

    try:
        from app.modes.musicxml.converter import convert_musicxml_to_spnmn

        result = convert_musicxml_to_spnmn(str(input_path), part_index=part_index)

        return JSONResponse(content={
            "task_id": task_id,
            "spnmn_text": result["spnmn_text"],
            "key_name": result.get("key_name", ""),
            "time_signature": result.get("time_signature", ""),
            "total_measures": result.get("total_measures", 0),
            "part_name": result.get("part_name", ""),
            "num_parts": result.get("num_parts", 0),
            "warnings": result.get("warnings", []),
        })

    except ValueError as e:
        logger.warning("MusicXML 转换参数错误 [task=%s]: %s", task_id, e)
        _cleanup_task_dir(task_dir)
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error("MusicXML 转换失败 [task=%s]: %s", task_id, e, exc_info=True)
        _cleanup_task_dir(task_dir)
        raise HTTPException(
            status_code=500,
            detail=f"转换失败: {e}",
        )


@router.post("/download-spnmn")
async def download_spnmn(body: DownloadSpnmnRequest) -> StreamingResponse:
    """接收 .spnmn 文本，返回可下载的 .spnmn 文件。

    Args:
        body: 包含 spnmn_text 和可选 filename 的请求体

    Returns:
        StreamingResponse，浏览器将触发文件下载
    """
    if not body.spnmn_text.strip():
        raise HTTPException(status_code=400, detail="spnmn_text 不能为空")

    filename = body.filename.strip() if body.filename else "output"
    # 移除不安全字符，保留基本文件名
    safe_filename = "".join(
        c for c in filename if c.isalnum() or c in ("-", "_", ".", " ")
    ).strip()
    if not safe_filename:
        safe_filename = "output"
    if not safe_filename.endswith(".spnmn"):
        safe_filename += ".spnmn"

    text_bytes = body.spnmn_text.encode("utf-8")
    buffer = BytesIO(text_bytes)

    return StreamingResponse(
        buffer,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
            "Content-Length": str(len(text_bytes)),
        },
    )


# ============================================================
# 工具函数
# ============================================================


def _cleanup_task_dir(task_dir: Path) -> None:
    """清理任务临时目录。

    Args:
        task_dir: 要删除的任务目录路径
    """
    try:
        if task_dir.exists():
            shutil.rmtree(task_dir)
    except OSError as e:
        logger.warning("清理临时目录失败 [%s]: %s", task_dir, e)
