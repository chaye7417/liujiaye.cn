"""MusicXML → jianpu-ly 转换模块。

解析 MusicXML 文件，提取单声部旋律信息，
转换为 jianpu-ly 格式文本供后续渲染。
"""

from pathlib import Path

import music21
from music21 import clef as m21clef, converter, key, meter, note, stream


# ---------------------------------------------------------------------------
# 调号 → jianpu-ly 调号标记映射
# ---------------------------------------------------------------------------
_MAJOR_KEY_MAP: dict[str, str] = {
    "C": "1=C", "D-": "1=bD", "D": "1=D", "E-": "1=bE",
    "E": "1=E", "F": "1=F", "G-": "1=bG", "G": "1=G",
    "A-": "1=bA", "A": "1=A", "B-": "1=bB", "B": "1=B",
    "C#": "1=bD", "F#": "1=bG", "C-": "1=B",
}
_MINOR_KEY_MAP: dict[str, str] = {
    "A": "6=A", "D": "6=D", "E": "6=E", "G": "6=G",
    "C": "6=C", "F": "6=F", "B-": "6=bB", "E-": "6=bE",
    "B": "6=B", "F#": "6=#F", "C#": "6=#C", "G#": "6=#G",
    "A-": "6=#G", "D-": "6=#C", "D#": "6=bE",
}


def _get_key_jianpu(k: key.Key) -> str:
    """music21 Key → jianpu-ly 调号字符串。"""
    tonic_name = k.tonic.name
    if k.mode == "minor":
        return _MINOR_KEY_MAP.get(tonic_name, f"6={tonic_name}")
    return _MAJOR_KEY_MAP.get(tonic_name, f"1={tonic_name}")


def _get_scale_pitches(k: key.Key) -> list[int]:
    """获取调式的 7 个音级对应的 pitch class（0-11）。"""
    sc = k.getScale()
    return [p.pitchClass for p in sc.pitches[:7]]


def _pitch_to_jianpu_degree(
    pitch_obj: music21.pitch.Pitch,
    scale_pcs: list[int],
) -> tuple[int, str]:
    """将 music21 Pitch 转换为简谱音级和变化记号。

    Args:
        pitch_obj: music21 音高对象
        scale_pcs: 当前调式的 7 个 pitch class

    Returns:
        (degree 1-7, accidental "" / "#" / "b")
    """
    pc = pitch_obj.pitchClass
    if pc in scale_pcs:
        return scale_pcs.index(pc) + 1, ""
    # 半音上方
    lower_pc = (pc - 1) % 12
    if lower_pc in scale_pcs:
        return scale_pcs.index(lower_pc) + 1, "#"
    # 半音下方
    upper_pc = (pc + 1) % 12
    if upper_pc in scale_pcs:
        return scale_pcs.index(upper_pc) + 1, "b"
    # 兜底：最近的音阶音
    for offset in range(2, 4):
        for direction in (-1, 1):
            test_pc = (pc + direction * offset) % 12
            if test_pc in scale_pcs:
                acc = "#" * offset if direction > 0 else "b" * offset
                return scale_pcs.index(test_pc) + 1, acc
    return 1, ""


def _octave_mark(pitch_obj: music21.pitch.Pitch, tonic_octave: int) -> str:
    """计算八度标记。

    Args:
        pitch_obj: 音高
        tonic_octave: 主音的中心八度

    Returns:
        "" / "'" / "''" / "," / ",,"
    """
    note_oct = pitch_obj.octave or 4
    diff = note_oct - tonic_octave
    if diff > 0:
        return "'" * diff
    elif diff < 0:
        return "," * (-diff)
    return ""


def _dur_to_jianpu(ql: float) -> tuple[str, str]:
    """quarterLength → (prefix, suffix) for jianpu-ly.

    Returns:
        (prefix, suffix) 其中 prefix 为 "s"/"q"/"", suffix 为 ""/"."/" -" 等
    """
    if abs(ql - 0.25) < 0.01:
        return "s", ""
    if abs(ql - 0.5) < 0.01:
        return "q", ""
    if abs(ql - 0.75) < 0.01:
        return "q", "."
    if abs(ql - 1.0) < 0.01:
        return "", ""
    if abs(ql - 1.5) < 0.01:
        return "", "."
    if abs(ql - 2.0) < 0.01:
        return "", " -"
    if abs(ql - 3.0) < 0.01:
        return "", " - ."
    if abs(ql - 4.0) < 0.01:
        return "", " - - -"
    # 非标准时值：近似到最近的标准时值
    standard = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0]
    best = min(standard, key=lambda x: abs(x - ql))
    return _dur_to_jianpu(best)


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
            "jianpu_text": str,
            "key_name": str,
            "time_signature": str,
            "total_measures": int,
            "part_name": str,
            "num_parts": int,
            "warnings": list[str],
        }

    Raises:
        ValueError: 文件解析失败或无有效音符
    """
    warnings: list[str] = []

    try:
        score = converter.parse(str(file_path))
    except Exception as e:
        raise ValueError(f"MusicXML 解析失败: {e}")

    if not score.parts:
        raise ValueError("文件中没有找到任何声部")

    num_parts = len(score.parts)
    if part_index >= num_parts:
        part_index = 0
        warnings.append("请求的声部不存在，已使用第 1 声部")

    if num_parts > 1:
        warnings.append(f"文件包含 {num_parts} 个声部，当前仅转换第 {part_index + 1} 声部")

    part = score.parts[part_index]
    part_name = part.partName or f"声部 {part_index + 1}"

    # 提取调号
    first_key = part.flatten().getElementsByClass(key.Key)
    if first_key:
        current_key = first_key[0]
    else:
        ks_list = part.flatten().getElementsByClass(key.KeySignature)
        if ks_list:
            current_key = ks_list[0].asKey()
        else:
            current_key = key.Key("C")
            warnings.append("未检测到调号，默认使用 C 大调")

    jianpu_key_str = _get_key_jianpu(current_key)
    scale_pcs = _get_scale_pitches(current_key)
    is_minor = current_key.mode == "minor"

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

    # 检测谱号，决定中心八度
    tonic_octave = 4
    clef_str = ""
    clefs = part.flatten().getElementsByClass(m21clef.Clef)
    if clefs:
        c = clefs[0]
        if isinstance(c, m21clef.BassClef):
            clef_str = "CLEF:bass"
            tonic_octave = 3

    # 逐小节转换
    measures = list(part.getElementsByClass(stream.Measure))
    if not measures:
        raise ValueError("文件中没有找到小节")

    bar_strings: list[str] = []
    chord_warned = False

    for m in measures:
        tokens: list[str] = []

        for el in m.flatten().notesAndRests:
            if isinstance(el, note.Rest):
                tokens.append(_rest_to_jianpu(el.quarterLength))

            elif isinstance(el, note.Note):
                degree, acc = _pitch_to_jianpu_degree(el.pitch, scale_pcs)
                oct = _octave_mark(el.pitch, tonic_octave)
                prefix, suffix = _dur_to_jianpu(el.quarterLength)

                token = f"{prefix}{acc}{degree}{oct}{suffix}"

                if el.tie and el.tie.type in ("start", "continue"):
                    token += " ~"

                tokens.append(token)

            elif hasattr(el, "pitches") and el.pitches:
                # Chord: 取最高音
                top = el.pitches[-1]
                degree, acc = _pitch_to_jianpu_degree(top, scale_pcs)
                oct = _octave_mark(top, tonic_octave)
                prefix, suffix = _dur_to_jianpu(el.quarterLength)
                tokens.append(f"{prefix}{acc}{degree}{oct}{suffix}")
                if not chord_warned:
                    warnings.append("和弦已简化为最高音")
                    chord_warned = True

        if tokens:
            bar_strings.append(" ".join(tokens))

    if not bar_strings:
        raise ValueError("未提取到任何音符")

    # 组装 jianpu-ly
    lines: list[str] = []
    if clef_str:
        lines.append(clef_str)
    lines.append(jianpu_key_str)
    lines.append(ts_str)
    lines.append(" | ".join(bar_strings) + " |")

    return {
        "jianpu_text": "\n".join(lines),
        "key_name": key_display,
        "time_signature": ts_str,
        "total_measures": len(bar_strings),
        "part_name": part_name,
        "num_parts": num_parts,
        "warnings": list(dict.fromkeys(warnings)),
    }
