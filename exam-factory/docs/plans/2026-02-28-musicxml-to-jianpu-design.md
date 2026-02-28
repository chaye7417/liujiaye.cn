# MusicXML 转简谱 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 exam-factory 中新增独立工具页面，用户上传 MusicXML 文件后自动转换为 jianpu-ly 格式简谱文本，并渲染为简谱图片/PDF。

**Architecture:** 用 `music21` 解析 MusicXML 提取单声部音符/元信息，自写转换逻辑输出 jianpu-ly 文本，复用项目现有的 `_run_jianpu_ly()` + LilyPond 编译管线渲染图片。前端新增 `/tools` 页面，左右分栏展示 jianpu-ly 源码和渲染图片。

**Tech Stack:** Python music21, FastAPI, jianpu-ly CLI, LilyPond, Jinja2 模板

---

## Task 1: 安装 music21 依赖

**Files:**
- Modify: `requirements.txt`

**Step 1: 添加 music21 到 requirements.txt**

在 `requirements.txt` 末尾添加：

```
music21==9.1.0
```

**Step 2: 安装依赖**

Run: `cd /Users/liujiaye/Developer/liujiaye.cn/exam-factory && pip install music21==9.1.0`

**Step 3: 验证安装**

Run: `python3 -c "import music21; print(music21.VERSION_STR)"`
Expected: 版本号输出，无报错

**Step 4: Commit**

```bash
git add requirements.txt
git commit -m "feat: 添加 music21 依赖用于 MusicXML 解析"
```

---

## Task 2: 核心转换模块 — MusicXML → jianpu-ly

**Files:**
- Create: `app/tools/__init__.py`（空文件）
- Create: `app/tools/musicxml_to_jianpu.py`

**背景知识:**
- jianpu-ly 格式参考 `app/modes/music_theory/generators/jianpu_gen.py` 中的 `_to_jianpu()` 函数（:269-294）
- 调号映射复用 `_KEY_DEFS`（:69-95），jianpu 调号格式为 `1=C`（大调）或 `6=A`（小调）
- 时值格式：四分=`1`，八分=`q1`，十六分=`s1`，二分=`1 -`，全音符=`1 - - -`，附点=`1.`
- 休止符：`0`（四分），`q0`（八分），`s0`（十六分）
- 高低八度：高八度加 `'`（如 `1'`），低八度加 `,`（如 `5,`）
- 连音线用 `~` 连接
- 小节线用 `|` 分隔

**Step 1: 创建空的 `__init__.py`**

```python
# app/tools/__init__.py
```

**Step 2: 实现核心转换模块**

创建 `app/tools/musicxml_to_jianpu.py`，完整实现：

```python
"""MusicXML → jianpu-ly 转换模块。

解析 MusicXML 文件，提取单声部旋律信息，
转换为 jianpu-ly 格式文本供后续渲染。
"""

from pathlib import Path
from typing import Optional

import music21
from music21 import converter, key, meter, note, stream, tie


# ---------------------------------------------------------------------------
# 调号 → jianpu-ly 调号标记映射
# ---------------------------------------------------------------------------
# music21 的 key.Key tonic name → jianpu "1=X" / "6=X"
_MAJOR_KEY_MAP: dict[str, str] = {
    "C": "1=C", "D-": "1=bD", "D": "1=D", "E-": "1=bE",
    "E": "1=E", "F": "1=F", "G-": "1=bG", "G": "1=G",
    "A-": "1=bA", "A": "1=A", "B-": "1=bB", "B": "1=B",
    # 等价异名调
    "C#": "1=bD", "F#": "1=bG", "C-": "1=B",
}
_MINOR_KEY_MAP: dict[str, str] = {
    "A": "6=A", "D": "6=D", "E": "6=E", "G": "6=G",
    "C": "6=C", "F": "6=F", "B-": "6=bB", "E-": "6=bE",
    "B": "6=B", "F#": "6=#F", "C#": "6=#C", "G#": "6=#G",
    # 等价异名调
    "A-": "6=#G", "D-": "6=#C", "D#": "6=bE",
}

# 音名 → 大调下的音级（以 C 大调为基准的半音距离 → 音级）
_PITCH_CLASS_TO_DEGREE_MAJOR = {
    0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7,
}
# 半音微调（升降号产生的非自然音级）
_CHROMATIC_ABOVE = {1: (1, "#"), 3: (2, "#"), 6: (4, "#"), 8: (5, "#"), 10: (6, "#")}
_CHROMATIC_BELOW = {1: (2, "b"), 3: (3, "b"), 6: (4, "b"), 8: (6, "b"), 10: (7, "b")}


def _get_key_jianpu(k: key.Key) -> str:
    """music21 Key → jianpu-ly 调号字符串。"""
    tonic_name = k.tonic.name  # e.g. "C", "F#", "B-"
    if k.mode == "minor":
        return _MINOR_KEY_MAP.get(tonic_name, f"6={tonic_name}")
    return _MAJOR_KEY_MAP.get(tonic_name, f"1={tonic_name}")


def _get_scale_pitches(k: key.Key) -> list[int]:
    """获取调式的 7 个音级对应的 pitch class（0-11）。"""
    sc = k.getScale()
    pitches = []
    for p in sc.pitches[:7]:
        pitches.append(p.pitchClass)
    return pitches


def _pitch_to_jianpu_degree(
    pitch_obj: music21.pitch.Pitch,
    scale_pcs: list[int],
    tonic_pc: int,
) -> tuple[int, str]:
    """将 music21 Pitch 转换为简谱音级和变化记号。

    Args:
        pitch_obj: music21 音高对象
        scale_pcs: 当前调式的 7 个 pitch class
        tonic_pc: 主音的 pitch class

    Returns:
        (degree 1-7, accidental "" / "#" / "b")
    """
    pc = pitch_obj.pitchClass
    # 先检查是否在调式音阶上
    if pc in scale_pcs:
        idx = scale_pcs.index(pc)
        return idx + 1, ""
    # 不在音阶上：找最近的音阶音
    # 尝试向下半音找
    lower_pc = (pc - 1) % 12
    if lower_pc in scale_pcs:
        idx = scale_pcs.index(lower_pc)
        return idx + 1, "#"
    # 尝试向上半音找
    upper_pc = (pc + 1) % 12
    if upper_pc in scale_pcs:
        idx = scale_pcs.index(upper_pc)
        return idx + 1, "b"
    # 兜底：用相对主音的半音距离粗略映射
    semitones = (pc - tonic_pc) % 12
    if semitones in _PITCH_CLASS_TO_DEGREE_MAJOR:
        return _PITCH_CLASS_TO_DEGREE_MAJOR[semitones], ""
    if semitones in _CHROMATIC_ABOVE:
        return _CHROMATIC_ABOVE[semitones]
    if semitones in _CHROMATIC_BELOW:
        return _CHROMATIC_BELOW[semitones]
    return 1, ""


def _octave_mark(
    pitch_obj: music21.pitch.Pitch,
    tonic_octave: int,
    is_minor: bool,
) -> str:
    """计算八度标记（高点/低点）。

    简谱参考八度：
    - 大调：主音所在八度的 do 为中心八度（无标记）
    - 小调：主音所在八度的 la 为中心八度（无标记）

    Args:
        pitch_obj: 音高
        tonic_octave: 主音的 MIDI 八度
        is_minor: 是否小调

    Returns:
        "" / "'" / "''" / "," / ",,"
    """
    # 中心八度：大调看 C 的位置，小调看 A 的位置
    center_oct = tonic_octave
    note_oct = pitch_obj.octave or 4

    diff = note_oct - center_oct
    if diff > 0:
        return "'" * diff
    elif diff < 0:
        return "," * (-diff)
    return ""


def _duration_to_jianpu(
    ql: float,
    beat_unit_ql: float,
) -> tuple[str, str, float]:
    """将 music21 的 quarterLength 转换为 jianpu-ly 时值标记。

    Args:
        ql: 音符的 quarterLength
        beat_unit_ql: 一拍的 quarterLength（4/4 → 1.0，6/8 → 1.5）

    Returns:
        (prefix, suffix, remaining_ql)
        prefix: "q" / "s" / "" (八分/十六分/无前缀)
        suffix: "." / " -" / " - -" / " - - -" 等
        remaining_ql: 0（无连音延长时）
    """
    # 标准化为「一拍 = 1.0」的比例
    # 对于 4/4, beat_unit_ql=1.0：四分=1拍, 八分=0.5拍, 十六=0.25拍, 二分=2拍
    # 对于 6/8, beat_unit_ql=1.5：附点四分=1拍, 四分=2/3拍 ... 需要特殊处理
    # 简化：直接按 quarterLength 映射（以四分音符=1 ql 为基准）

    if ql <= 0:
        return "", "", 0

    # 十六分音符 (0.25 ql)
    if abs(ql - 0.25) < 0.01:
        return "s", "", 0
    # 八分音符 (0.5 ql)
    if abs(ql - 0.5) < 0.01:
        return "q", "", 0
    # 附点八分 (0.75 ql)
    if abs(ql - 0.75) < 0.01:
        return "q", ".", 0
    # 四分音符 (1.0 ql)
    if abs(ql - 1.0) < 0.01:
        return "", "", 0
    # 附点四分 (1.5 ql)
    if abs(ql - 1.5) < 0.01:
        return "", ".", 0
    # 二分音符 (2.0 ql)
    if abs(ql - 2.0) < 0.01:
        return "", " -", 0
    # 附点二分 (3.0 ql)
    if abs(ql - 3.0) < 0.01:
        return "", " - .", 0
    # 全音符 (4.0 ql)
    if abs(ql - 4.0) < 0.01:
        return "", " - - -", 0

    # 其他时值：用最近的标准时值 + 延音线处理
    # 向下取整到最近的标准时值
    standard_qls = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0]
    best = min(standard_qls, key=lambda x: abs(x - ql) if x <= ql + 0.01 else 999)
    prefix, suffix, _ = _duration_to_jianpu(best, beat_unit_ql)
    remaining = ql - best
    return prefix, suffix, remaining if remaining > 0.01 else 0


def _rest_to_jianpu(ql: float) -> str:
    """休止符的 jianpu-ly 表示。"""
    if abs(ql - 0.25) < 0.01:
        return "s0"
    if abs(ql - 0.5) < 0.01:
        return "q0"
    if abs(ql - 0.75) < 0.01:
        return "q0."
    if abs(ql - 1.0) < 0.01:
        return "0"
    if abs(ql - 1.5) < 0.01:
        return "0."
    if abs(ql - 2.0) < 0.01:
        return "0 -"
    if abs(ql - 3.0) < 0.01:
        return "0 - ."
    if abs(ql - 4.0) < 0.01:
        return "0 - - -"
    # 兜底
    return "0"


def convert_musicxml_to_jianpu(
    file_path: str | Path,
    part_index: int = 0,
) -> dict:
    """将 MusicXML 文件转换为 jianpu-ly 文本。

    Args:
        file_path: MusicXML 文件路径
        part_index: 声部索引（默认 0 = 第一声部）

    Returns:
        {
            "jianpu_text": str,       # jianpu-ly 格式文本
            "key_name": str,          # 调号名称（如 "C大调"）
            "time_signature": str,    # 拍号（如 "4/4"）
            "total_measures": int,    # 总小节数
            "part_name": str,         # 声部名称
            "num_parts": int,         # 总声部数
            "warnings": list[str],    # 警告信息
        }

    Raises:
        ValueError: 文件解析失败或无有效音符
    """
    warnings: list[str] = []

    # 解析 MusicXML
    try:
        score = converter.parse(str(file_path))
    except Exception as e:
        raise ValueError(f"MusicXML 解析失败: {e}")

    if not score.parts:
        raise ValueError("文件中没有找到任何声部")

    num_parts = len(score.parts)
    if part_index >= num_parts:
        part_index = 0
        warnings.append(f"请求的声部不存在，已使用第 1 声部")

    if num_parts > 1:
        warnings.append(f"文件包含 {num_parts} 个声部，当前仅转换第 {part_index + 1} 声部")

    part = score.parts[part_index]
    part_name = part.partName or f"声部 {part_index + 1}"

    # 提取调号
    first_key = part.flatten().getElementsByClass(key.Key)
    if first_key:
        current_key = first_key[0]
    else:
        # 尝试从 KeySignature 推断
        ks_list = part.flatten().getElementsByClass(key.KeySignature)
        if ks_list:
            current_key = ks_list[0].asKey()
        else:
            current_key = key.Key("C")
            warnings.append("未检测到调号，默认使用 C 大调")

    jianpu_key_str = _get_key_jianpu(current_key)
    scale_pcs = _get_scale_pitches(current_key)
    tonic_pc = current_key.tonic.pitchClass
    tonic_octave = 4  # 简谱中心八度
    is_minor = current_key.mode == "minor"

    # 调号显示名
    mode_cn = "小调" if is_minor else "大调"
    key_display = f"{current_key.tonic.name}{mode_cn}"

    # 提取拍号
    first_ts = part.flatten().getElementsByClass(meter.TimeSignature)
    if first_ts:
        ts = first_ts[0]
        ts_str = f"{ts.numerator}/{ts.denominator}"
    else:
        ts_str = "4/4"
        warnings.append("未检测到拍号，默认使用 4/4")

    # 检测谱号
    clefs = part.flatten().getElementsByClass(music21.clef.Clef)
    clef_str = ""
    if clefs:
        c = clefs[0]
        if isinstance(c, music21.clef.BassClef):
            clef_str = "CLEF:bass"
            tonic_octave = 3  # 低音谱号中心八度下移

    # 逐小节转换
    measures = list(part.getElementsByClass(stream.Measure))
    if not measures:
        raise ValueError("文件中没有找到小节")

    bar_strings: list[str] = []

    for m in measures:
        tokens: list[str] = []
        elements = m.flatten().notesAndRests

        for el in elements:
            if isinstance(el, note.Rest):
                tokens.append(_rest_to_jianpu(el.quarterLength))
            elif isinstance(el, note.Note):
                degree, acc = _pitch_to_jianpu_degree(
                    el.pitch, scale_pcs, tonic_pc,
                )
                oct_mark = _octave_mark(el.pitch, tonic_octave, is_minor)
                prefix, suffix, _ = _duration_to_jianpu(el.quarterLength, 1.0)

                # 构建音符 token
                note_str = f"{prefix}{acc}{degree}{oct_mark}{suffix}"

                # 连音线
                if el.tie and el.tie.type in ("start", "continue"):
                    note_str += " ~"

                tokens.append(note_str)

            elif hasattr(el, 'pitches') and el.pitches:
                # Chord: 取最高音
                top_pitch = el.pitches[-1]
                degree, acc = _pitch_to_jianpu_degree(
                    top_pitch, scale_pcs, tonic_pc,
                )
                oct_mark = _octave_mark(top_pitch, tonic_octave, is_minor)
                prefix, suffix, _ = _duration_to_jianpu(el.quarterLength, 1.0)
                note_str = f"{prefix}{acc}{degree}{oct_mark}{suffix}"
                tokens.append(note_str)
                if len(el.pitches) > 1:
                    warnings.append(f"小节 {m.number}: 和弦已简化为最高音")

        if tokens:
            bar_strings.append(" ".join(tokens))

    if not bar_strings:
        raise ValueError("未提取到任何音符")

    # 组装 jianpu-ly 文本
    lines: list[str] = []
    if clef_str:
        lines.append(clef_str)
    lines.append(jianpu_key_str)
    lines.append(ts_str)
    lines.append(" | ".join(bar_strings) + " |")

    jianpu_text = "\n".join(lines)

    # 去重警告
    warnings = list(dict.fromkeys(warnings))

    return {
        "jianpu_text": jianpu_text,
        "key_name": key_display,
        "time_signature": ts_str,
        "total_measures": len(bar_strings),
        "part_name": part_name,
        "num_parts": num_parts,
        "warnings": warnings,
    }
```

**Step 3: 快速验证模块可导入**

Run: `cd /Users/liujiaye/Developer/liujiaye.cn/exam-factory && python3 -c "from app.tools.musicxml_to_jianpu import convert_musicxml_to_jianpu; print('OK')"`
Expected: `OK`

**Step 4: Commit**

```bash
git add app/tools/__init__.py app/tools/musicxml_to_jianpu.py
git commit -m "feat: 添加 MusicXML → jianpu-ly 核心转换模块"
```

---

## Task 3: API 路由 — 上传转换 + 渲染端点

**Files:**
- Create: `app/routers/tools.py`
- Modify: `app/main.py:18,29` — 注册新路由

**背景知识:**
- 现有路由注册模式参考 `app/main.py:14-31`
- 文件上传处理参考 `app/routers/tasks.py` 中的 `/api/upload` 端点
- jianpu-ly 渲染复用 `app/pdf_generator.py` 中的 `_run_jianpu_ly()` 和 `_preprocess_jianpu()`
- 工作目录用 `app/config.py:OUTPUT_DIR`

**Step 1: 创建 tools 路由**

创建 `app/routers/tools.py`：

```python
"""工具箱路由 - MusicXML 转简谱等独立工具。"""

import asyncio
import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from app.config import OUTPUT_DIR, MAX_FILE_SIZE_MB
from app.pdf_generator import (
    _run_jianpu_ly, _generate_font_settings_ily,
    MUSIC_FONTS, DEFAULT_MUSIC_FONT, _sanitize_error_msg,
)
from app.tools.musicxml_to_jianpu import convert_musicxml_to_jianpu

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tools", tags=["tools"])

# 工具任务的临时目录
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
    """上传 MusicXML 文件，转换为 jianpu-ly 文本。

    接受 .musicxml, .xml, .mxl 文件。
    返回 jianpu-ly 文本及元信息。
    """
    # 文件类型校验
    filename = file.filename or ""
    suffix = Path(filename).suffix.lower()
    if suffix not in (".musicxml", ".xml", ".mxl"):
        raise HTTPException(400, "仅支持 .musicxml / .xml / .mxl 文件")

    # 文件大小校验
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"文件大小超过 {MAX_FILE_SIZE_MB}MB 限制")

    # 保存到临时目录
    task_id = uuid.uuid4().hex[:12]
    work_dir = _tools_workdir(task_id)
    input_path = work_dir / f"input{suffix}"
    input_path.write_bytes(contents)

    # 转换
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
    """渲染 jianpu-ly 文本为 PDF 图片。

    接受 jianpu-ly 格式文本，返回渲染后的 PDF 文件。
    """
    if not jianpu_text.strip():
        raise HTTPException(400, "jianpu-ly 文本不能为空")

    if font not in MUSIC_FONTS:
        font = DEFAULT_MUSIC_FONT

    # 工作目录
    if not task_id:
        task_id = uuid.uuid4().hex[:12]
    work_dir = _tools_workdir(task_id)

    # 检测并提取谱号标记
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

    # 后处理：去水印
    ly_content = ly_content.replace(
        '% \\header { tagline="" }',
        '\\header { tagline="" }',
    )

    # 注入谱号
    if clef != "treble":
        if "\\clef treble" in ly_content:
            ly_content = ly_content.replace("\\clef treble", f"\\clef {clef}", 1)

    # 注入字体配置
    font_cfg = MUSIC_FONTS.get(font, MUSIC_FONTS[DEFAULT_MUSIC_FONT])
    import re
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

    # 写入 .ly 文件
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
```

**Step 2: 注册路由到 main.py**

在 `app/main.py` 中添加导入和注册：

在 import 区（约第 17 行后）添加：
```python
from app.routers.tools import router as tools_router
```

在 `app.include_router(admin_router)` 之后（约第 31 行后）添加：
```python
app.include_router(tools_router)
```

**Step 3: 验证路由注册**

Run: `cd /Users/liujiaye/Developer/liujiaye.cn/exam-factory && python3 -c "from app.main import app; routes = [r.path for r in app.routes]; print([r for r in routes if 'tools' in r])"`
Expected: `['/api/tools/musicxml-to-jianpu', '/api/tools/jianpu-render']`

**Step 4: Commit**

```bash
git add app/routers/tools.py app/main.py
git commit -m "feat: 添加 MusicXML 转简谱 API 端点"
```

---

## Task 4: 工具页面路由 + HTML 模板

**Files:**
- Modify: `app/routers/pages.py:1-13,64` — 添加 /tools 页面路由
- Create: `templates/tools.html` — 工具页面模板

**背景知识:**
- 页面路由模式参考 `app/routers/pages.py`
- 模板基于 `templates/base.html`
- workspace.html 使用 mode-tabs 切换模式（参考 :486-498）
- 前端为原生 JS + Jinja2 模板

**Step 1: 添加 /tools 页面路由**

在 `app/routers/pages.py` 末尾添加：

```python
@router.get("/tools", response_class=HTMLResponse)
async def page_tools(request: Request):
    """工具箱页面。"""
    return templates.TemplateResponse("tools.html", {"request": request})
```

**Step 2: 创建工具页面模板**

创建 `templates/tools.html`（完整代码）：

```html
{% extends "base.html" %}
{% block title %}工具箱 - 试卷工厂{% endblock %}

{% block head %}
<style>
    .tools-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px;
    }
    .tools-header {
        margin-bottom: 24px;
    }
    .tools-header h2 {
        font-size: 24px;
        font-weight: 600;
        margin: 0 0 8px 0;
    }
    .tools-header p {
        color: var(--text-muted);
        margin: 0;
    }
    .tool-card {
        background: white;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 24px;
    }
    .tool-card h3 {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 16px 0;
    }
    /* 上传区域 */
    .upload-zone {
        border: 2px dashed var(--border);
        border-radius: 12px;
        padding: 40px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 16px;
    }
    .upload-zone:hover, .upload-zone.dragover {
        border-color: var(--primary);
        background: var(--primary-light, #f0f7ff);
    }
    .upload-zone p {
        margin: 8px 0 0;
        color: var(--text-muted);
        font-size: 14px;
    }
    .upload-zone .icon {
        font-size: 36px;
        margin-bottom: 8px;
    }
    /* 结果区域 */
    .result-area {
        display: none;
        margin-top: 24px;
    }
    .result-area.show { display: block; }
    .result-split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-top: 16px;
    }
    @media (max-width: 768px) {
        .result-split { grid-template-columns: 1fr; }
    }
    .result-panel {
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
    }
    .result-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: #f8f9fa;
        border-bottom: 1px solid var(--border);
        font-size: 14px;
        font-weight: 500;
    }
    .result-panel-body {
        padding: 14px;
    }
    /* 代码编辑器 */
    .jianpu-editor {
        width: 100%;
        min-height: 200px;
        font-family: 'SF Mono', 'Fira Code', monospace;
        font-size: 14px;
        line-height: 1.6;
        border: none;
        outline: none;
        resize: vertical;
        padding: 0;
    }
    /* PDF 预览 */
    .pdf-preview {
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
    }
    .pdf-preview iframe {
        width: 100%;
        height: 400px;
        border: none;
    }
    .pdf-preview img {
        max-width: 100%;
        height: auto;
    }
    /* 工具栏 */
    .tool-actions {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-top: 16px;
        flex-wrap: wrap;
    }
    .tool-actions select {
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        font-size: 14px;
    }
    /* 元信息 */
    .meta-info {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin-top: 12px;
        font-size: 13px;
        color: var(--text-muted);
    }
    .meta-info span {
        background: #f0f0f0;
        padding: 4px 10px;
        border-radius: 12px;
    }
    /* 警告 */
    .warnings {
        margin-top: 12px;
        padding: 10px 14px;
        background: #fff8e1;
        border: 1px solid #ffe082;
        border-radius: 8px;
        font-size: 13px;
        color: #f57f17;
    }
    .warnings ul { margin: 4px 0 0 16px; padding: 0; }
    /* 按钮 */
    .btn-tool {
        padding: 8px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--border);
        background: white;
        transition: all 0.2s;
    }
    .btn-tool:hover {
        border-color: var(--primary);
        color: var(--primary);
    }
    .btn-tool.primary {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
    }
    .btn-tool.primary:hover {
        opacity: 0.9;
    }
    .btn-tool:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    /* 加载状态 */
    .loading { opacity: 0.6; pointer-events: none; }
    .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid #ccc;
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
        margin-right: 6px;
        vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    /* 返回链接 */
    .back-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--text-muted);
        text-decoration: none;
        font-size: 14px;
        margin-bottom: 16px;
    }
    .back-link:hover { color: var(--primary); }
</style>
{% endblock %}

{% block content %}
<div class="tools-container">
    <a href="/workspace" class="back-link">&larr; 返回工作台</a>

    <div class="tools-header">
        <h2>工具箱</h2>
        <p>独立工具，无需创建任务即可使用</p>
    </div>

    <!-- MusicXML 转简谱 -->
    <div class="tool-card">
        <h3>MusicXML 转简谱</h3>
        <p style="color: var(--text-muted); font-size: 14px; margin: 0 0 16px;">
            上传 MusicXML 文件（MuseScore / Sibelius / Finale 导出），自动转换为简谱
        </p>

        <!-- 上传区 -->
        <div class="upload-zone" id="uploadZone" onclick="document.getElementById('fileInput').click()">
            <div class="icon">&#127925;</div>
            <div><strong>点击或拖拽上传 MusicXML 文件</strong></div>
            <p>支持 .musicxml / .xml / .mxl 格式</p>
        </div>
        <input type="file" id="fileInput" accept=".musicxml,.xml,.mxl" style="display:none">

        <!-- 结果区 -->
        <div class="result-area" id="resultArea">
            <!-- 元信息 -->
            <div class="meta-info" id="metaInfo"></div>
            <!-- 警告 -->
            <div class="warnings" id="warnings" style="display:none">
                <strong>注意：</strong>
                <ul id="warningList"></ul>
            </div>

            <!-- 左右分栏 -->
            <div class="result-split">
                <!-- 左：jianpu-ly 源码 -->
                <div class="result-panel">
                    <div class="result-panel-header">
                        <span>jianpu-ly 源码</span>
                        <button class="btn-tool" onclick="copyJianpu()" style="padding:4px 12px; font-size:12px;">复制</button>
                    </div>
                    <div class="result-panel-body">
                        <textarea class="jianpu-editor" id="jianpuEditor"></textarea>
                    </div>
                </div>
                <!-- 右：渲染预览 -->
                <div class="result-panel">
                    <div class="result-panel-header">
                        <span>简谱预览</span>
                    </div>
                    <div class="result-panel-body">
                        <div class="pdf-preview" id="pdfPreview">
                            <span>点击「渲染简谱」查看预览</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 操作栏 -->
            <div class="tool-actions">
                <select id="fontSelect">
                    <option value="gonville">Gonville（传统手刻）</option>
                    <option value="emmentaler">Emmentaler（LilyPond 默认）</option>
                    <option value="profondo">Profondo（现代清晰）</option>
                    <option value="cadence">Cadence（优雅圆润）</option>
                    <option value="lilyjazz">LilyJazz（手写爵士）</option>
                    <option value="beethoven">Beethoven（古典风格）</option>
                </select>
                <button class="btn-tool primary" id="renderBtn" onclick="renderJianpu()">
                    渲染简谱
                </button>
                <button class="btn-tool" id="downloadBtn" onclick="downloadPdf()" style="display:none">
                    下载 PDF
                </button>
            </div>
        </div>
    </div>
</div>

<script>
    let currentTaskId = '';
    let currentPdfUrl = '';

    // ===== 拖拽上传 =====
    const zone = document.getElementById('uploadZone');
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    document.getElementById('fileInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    // ===== 上传转换 =====
    async function handleFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['musicxml', 'xml', 'mxl'].includes(ext)) {
            alert('仅支持 .musicxml / .xml / .mxl 文件');
            return;
        }

        zone.innerHTML = '<div class="spinner"></div> 正在转换...';
        zone.style.pointerEvents = 'none';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const resp = await fetch('/api/tools/musicxml-to-jianpu', {
                method: 'POST',
                body: formData,
            });
            const json = await resp.json();

            if (!resp.ok) {
                throw new Error(json.detail || '转换失败');
            }

            const data = json.data;
            currentTaskId = data.task_id;

            // 显示结果区
            document.getElementById('resultArea').classList.add('show');

            // 填充编辑器
            document.getElementById('jianpuEditor').value = data.jianpu_text;

            // 元信息
            const meta = document.getElementById('metaInfo');
            meta.innerHTML = `
                <span>调号: ${data.key_name}</span>
                <span>拍号: ${data.time_signature}</span>
                <span>小节数: ${data.total_measures}</span>
                <span>声部: ${data.part_name}</span>
            `;

            // 警告
            if (data.warnings && data.warnings.length > 0) {
                document.getElementById('warnings').style.display = 'block';
                document.getElementById('warningList').innerHTML =
                    data.warnings.map(w => `<li>${w}</li>`).join('');
            } else {
                document.getElementById('warnings').style.display = 'none';
            }

            // 重置预览
            document.getElementById('pdfPreview').innerHTML = '<span>点击「渲染简谱」查看预览</span>';
            document.getElementById('downloadBtn').style.display = 'none';

            // 恢复上传区
            zone.innerHTML = `
                <div class="icon">&#9989;</div>
                <div><strong>${file.name}</strong> 转换成功</div>
                <p>点击重新上传其他文件</p>
            `;
            zone.style.pointerEvents = 'auto';

        } catch (err) {
            alert(err.message);
            zone.innerHTML = `
                <div class="icon">&#127925;</div>
                <div><strong>点击或拖拽上传 MusicXML 文件</strong></div>
                <p>支持 .musicxml / .xml / .mxl 格式</p>
            `;
            zone.style.pointerEvents = 'auto';
        }
    }

    // ===== 渲染简谱 =====
    async function renderJianpu() {
        const text = document.getElementById('jianpuEditor').value.trim();
        if (!text) { alert('请先上传 MusicXML 文件或输入 jianpu-ly 文本'); return; }

        const btn = document.getElementById('renderBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>渲染中...';

        const formData = new FormData();
        formData.append('jianpu_text', text);
        formData.append('font', document.getElementById('fontSelect').value);
        formData.append('task_id', currentTaskId);

        try {
            const resp = await fetch('/api/tools/jianpu-render', {
                method: 'POST',
                body: formData,
            });

            if (!resp.ok) {
                const json = await resp.json();
                throw new Error(json.detail || '渲染失败');
            }

            const blob = await resp.blob();
            currentPdfUrl = URL.createObjectURL(blob);

            // 显示 PDF 预览
            document.getElementById('pdfPreview').innerHTML =
                `<iframe src="${currentPdfUrl}#toolbar=0&navpanes=0"></iframe>`;
            document.getElementById('downloadBtn').style.display = 'inline-block';

        } catch (err) {
            alert(err.message);
            document.getElementById('pdfPreview').innerHTML =
                `<span style="color:#e53935;">渲染失败: ${err.message}</span>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '渲染简谱';
        }
    }

    // ===== 复制 =====
    function copyJianpu() {
        const editor = document.getElementById('jianpuEditor');
        editor.select();
        navigator.clipboard.writeText(editor.value).then(() => {
            const btn = event.target;
            const orig = btn.textContent;
            btn.textContent = '已复制';
            setTimeout(() => btn.textContent = orig, 1500);
        });
    }

    // ===== 下载 =====
    function downloadPdf() {
        if (!currentPdfUrl) return;
        const a = document.createElement('a');
        a.href = currentPdfUrl;
        a.download = 'jianpu.pdf';
        a.click();
    }
</script>
{% endblock %}
```

**Step 3: 验证页面路由可访问**

Run: `cd /Users/liujiaye/Developer/liujiaye.cn/exam-factory && python3 -c "from app.routers.pages import router; paths = [r.path for r in router.routes]; print('/tools' in paths)"`
Expected: `True`

**Step 4: Commit**

```bash
git add app/routers/pages.py templates/tools.html
git commit -m "feat: 添加工具箱页面和 MusicXML 转简谱 UI"
```

---

## Task 5: 导航入口 — 在 workspace 添加工具箱链接

**Files:**
- Modify: `templates/workspace.html` — 在模式 Tab 区域添加工具箱入口

**背景知识:**
- Tab 栏在 `templates/workspace.html:486-498`
- 工具箱是独立页面，用外链而不是 Tab

**Step 1: 在 Tab 栏末尾添加工具箱链接**

在 `templates/workspace.html` 第 498 行（音乐史 Tab 按钮后面，`</div>` 之前）添加：

```html
            <a href="/tools" class="mode-tab" style="margin-left: auto; text-decoration: none;">
                <span class="tab-icon">&#128295;</span>工具箱
            </a>
```

**Step 2: Commit**

```bash
git add templates/workspace.html
git commit -m "feat: 工作台添加工具箱入口链接"
```

---

## Task 6: 端到端测试

**Step 1: 创建测试用 MusicXML 文件**

Run:
```bash
cd /Users/liujiaye/Developer/liujiaye.cn/exam-factory
python3 -c "
from music21 import stream, note, meter, key as m21key
s = stream.Score()
p = stream.Part()
p.partName = 'Test'
p.append(m21key.Key('G'))
p.append(meter.TimeSignature('4/4'))
m1 = stream.Measure(number=1)
m1.append(note.Note('G4', quarterLength=1))
m1.append(note.Note('A4', quarterLength=1))
m1.append(note.Note('B4', quarterLength=1))
m1.append(note.Note('D5', quarterLength=1))
p.append(m1)
m2 = stream.Measure(number=2)
m2.append(note.Note('E5', quarterLength=2))
m2.append(note.Note('D5', quarterLength=2))
p.append(m2)
s.append(p)
s.write('musicxml', '/tmp/test_jianpu.musicxml')
print('Test file created')
"
```

**Step 2: 测试核心转换模块**

Run:
```bash
cd /Users/liujiaye/Developer/liujiaye.cn/exam-factory
python3 -c "
from app.tools.musicxml_to_jianpu import convert_musicxml_to_jianpu
result = convert_musicxml_to_jianpu('/tmp/test_jianpu.musicxml')
print('调号:', result['key_name'])
print('拍号:', result['time_signature'])
print('小节数:', result['total_measures'])
print('jianpu-ly:')
print(result['jianpu_text'])
print('警告:', result['warnings'])
"
```

Expected: 输出 G 大调、4/4 拍、2 个小节的 jianpu-ly 文本，音级映射正确（G=1, A=2, B=3, D=5, E=6）

**Step 3: 测试 API 端点**

Run:
```bash
cd /Users/liujiaye/Developer/liujiaye.cn/exam-factory
python3 -c "
import asyncio
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# 测试上传转换
with open('/tmp/test_jianpu.musicxml', 'rb') as f:
    resp = client.post('/api/tools/musicxml-to-jianpu', files={'file': ('test.musicxml', f, 'application/xml')})
print('上传状态:', resp.status_code)
data = resp.json()['data']
print('jianpu-ly:', data['jianpu_text'])

# 测试渲染
resp2 = client.post('/api/tools/jianpu-render', data={
    'jianpu_text': data['jianpu_text'],
    'font': 'emmentaler',
    'task_id': data['task_id'],
})
print('渲染状态:', resp2.status_code)
print('PDF 大小:', len(resp2.content), 'bytes')
"
```

Expected: 上传状态 200，渲染状态 200，PDF 大小 > 0

**Step 4: 如果测试通过，最终 commit**

```bash
git add -A
git commit -m "feat: MusicXML 转简谱功能完成 — 核心转换、API、前端页面"
```

---

## 文件清单总结

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| Modify | `requirements.txt` | 添加 music21 |
| Create | `app/tools/__init__.py` | 空包文件 |
| Create | `app/tools/musicxml_to_jianpu.py` | 核心转换逻辑（~280 行） |
| Create | `app/routers/tools.py` | API 路由（~160 行） |
| Modify | `app/main.py` | 注册 tools_router（+2 行） |
| Modify | `app/routers/pages.py` | 添加 /tools 路由（+5 行） |
| Create | `templates/tools.html` | 工具页面模板（~300 行） |
| Modify | `templates/workspace.html` | 添加工具箱链接（+3 行） |
