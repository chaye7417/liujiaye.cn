"""MusicXML → jianpu-ly 转换模块。

解析 MusicXML 文件，提取单声部旋律信息，
转换为 jianpu-ly 格式文本供后续渲染。

支持：音符、休止符、附点、连音线、三连音、调号、拍号、
      弱起小节、高低音谱号。
"""

from fractions import Fraction
from pathlib import Path

import music21
from music21 import (
    clef as m21clef, converter, duration, key,
    meter, note, stream, tie,
)


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

    Returns:
        (degree 1-7, accidental "" / "#" / "b")
    """
    pc = pitch_obj.pitchClass
    if pc in scale_pcs:
        return scale_pcs.index(pc) + 1, ""
    lower_pc = (pc - 1) % 12
    if lower_pc in scale_pcs:
        return scale_pcs.index(lower_pc) + 1, "#"
    upper_pc = (pc + 1) % 12
    if upper_pc in scale_pcs:
        return scale_pcs.index(upper_pc) + 1, "b"
    for offset in range(2, 4):
        for direction in (-1, 1):
            test_pc = (pc + direction * offset) % 12
            if test_pc in scale_pcs:
                acc = "#" * offset if direction > 0 else "b" * offset
                return scale_pcs.index(test_pc) + 1, acc
    return 1, ""


def _octave_mark(pitch_obj: music21.pitch.Pitch, tonic_octave: int) -> str:
    """计算八度标记（高点/低点）。"""
    note_oct = pitch_obj.octave or 4
    diff = note_oct - tonic_octave
    if diff > 0:
        return "'" * diff
    elif diff < 0:
        return "," * (-diff)
    return ""


# ---------------------------------------------------------------------------
# 时值转换 — 使用 Fraction 精确匹配，支持三连音
# ---------------------------------------------------------------------------
# (quarterLength as Fraction, prefix, suffix)
_DURATION_MAP: list[tuple[Fraction, str, str]] = [
    (Fraction(1, 4), "s", ""),       # 十六分
    (Fraction(3, 8), "s", "."),      # 附点十六分
    (Fraction(1, 2), "q", ""),       # 八分
    (Fraction(3, 4), "q", "."),      # 附点八分
    (Fraction(1, 1), "",  ""),       # 四分
    (Fraction(3, 2), "",  "."),      # 附点四分
    (Fraction(2, 1), "",  " -"),     # 二分
    (Fraction(3, 1), "",  " - ."),   # 附点二分
    (Fraction(4, 1), "",  " - - -"), # 全音符
]


def _dur_to_jianpu(ql: float) -> tuple[str, str]:
    """quarterLength → (prefix, suffix) for jianpu-ly。

    使用 Fraction 精确比较，避免浮点误差。
    """
    frac = Fraction(ql).limit_denominator(64)
    for target, prefix, suffix in _DURATION_MAP:
        if frac == target:
            return prefix, suffix
    # 非标准时值：取最近的
    best = min(_DURATION_MAP, key=lambda t: abs(t[0] - frac))
    return best[1], best[2]


def _rest_to_jianpu(ql: float) -> str:
    """休止符的 jianpu-ly 表示。"""
    prefix, suffix = _dur_to_jianpu(ql)
    return f"{prefix}0{suffix}"


def _is_tuplet(el: music21.base.Music21Object) -> bool:
    """检查元素是否属于连音组（三连音等）。"""
    return bool(el.duration.tuplets)


def _get_tuplet_ratio(el: music21.base.Music21Object) -> tuple[int, int]:
    """获取连音比例，如三连音返回 (3, 2)。"""
    if el.duration.tuplets:
        t = el.duration.tuplets[0]
        return t.numberNotesActual, t.numberNotesNormal
    return 1, 1


def _note_to_token(
    el: note.Note,
    scale_pcs: list[int],
    tonic_octave: int,
    in_tuplet: bool,
) -> str:
    """将单个 Note 转换为 jianpu-ly token。"""
    degree, acc = _pitch_to_jianpu_degree(el.pitch, scale_pcs)
    oct = _octave_mark(el.pitch, tonic_octave)

    if in_tuplet:
        # 三连音内部：用 tuplet 的「写出时值」计算 prefix
        actual, normal = _get_tuplet_ratio(el)
        # 三连音八分：实际 ql=1/3，写出时值=1/2（八分），所以用 q
        written_ql = float(el.quarterLength) * actual / normal
        prefix, suffix = _dur_to_jianpu(written_ql)
    else:
        prefix, suffix = _dur_to_jianpu(el.quarterLength)

    token = f"{prefix}{acc}{degree}{oct}{suffix}"

    if el.tie and el.tie.type in ("start", "continue"):
        token += " ~"

    return token


def _rest_token(el: note.Rest, in_tuplet: bool) -> str:
    """将 Rest 转换为 jianpu-ly token。"""
    if in_tuplet:
        actual, normal = _get_tuplet_ratio(el)
        written_ql = float(el.quarterLength) * actual / normal
        prefix, suffix = _dur_to_jianpu(written_ql)
        return f"{prefix}0{suffix}"
    return _rest_to_jianpu(el.quarterLength)


def _element_to_token(
    el: music21.base.Music21Object,
    scale_pcs: list[int],
    tonic_octave: int,
    in_tuplet: bool,
    warnings: list[str],
    chord_warned: list[bool],
) -> str:
    """将单个元素转换为 jianpu-ly token。"""
    if isinstance(el, note.Rest):
        return _rest_token(el, in_tuplet)
    elif isinstance(el, note.Note):
        return _note_to_token(el, scale_pcs, tonic_octave, in_tuplet)
    elif hasattr(el, "pitches") and el.pitches:
        top = el.pitches[-1]
        degree, acc = _pitch_to_jianpu_degree(top, scale_pcs)
        oct = _octave_mark(top, tonic_octave)
        if in_tuplet:
            actual, normal = _get_tuplet_ratio(el)
            written_ql = float(el.quarterLength) * actual / normal
            prefix, suffix = _dur_to_jianpu(written_ql)
        else:
            prefix, suffix = _dur_to_jianpu(el.quarterLength)
        if not chord_warned[0]:
            warnings.append("和弦已简化为最高音")
            chord_warned[0] = True
        return f"{prefix}{acc}{degree}{oct}{suffix}"
    return ""


def _deduplicate_by_offset(
    elements: list[music21.base.Music21Object],
) -> list[music21.base.Music21Object]:
    """去除同一 offset 上的重复元素。

    当音符和休止符重叠在同一时间位置时（常见于多声部 MusicXML），
    优先保留音符，过滤掉多余的休止符。
    """
    from collections import defaultdict
    by_offset: dict[float, list[music21.base.Music21Object]] = defaultdict(list)
    for el in elements:
        by_offset[float(el.offset)].append(el)

    result: list[music21.base.Music21Object] = []
    for offset_val in sorted(by_offset.keys()):
        group = by_offset[offset_val]
        if len(group) == 1:
            result.append(group[0])
        else:
            # 同一 offset 有多个元素：优先保留音符
            notes_at = [e for e in group if not isinstance(e, note.Rest)]
            if notes_at:
                result.extend(notes_at)
            else:
                result.append(group[0])
    return result


def _process_measure(
    m: stream.Measure,
    scale_pcs: list[int],
    tonic_octave: int,
    warnings: list[str],
    chord_warned: list[bool],
) -> list[str]:
    """处理单小节，返回 jianpu-ly token 列表。

    三连音分组策略：收集连续 tuplet 音符，按 numberNotesActual 个一组输出。
    """
    tokens: list[str] = []
    # 如果有多个声部，只取第一个声部，避免混合多声部内容
    voices = list(m.voices)
    if voices:
        raw = list(voices[0].flatten().notesAndRests)
    else:
        raw = list(m.flatten().notesAndRests)
    # 去重：同一 offset 有音符和休止符重叠时，优先保留音符
    elements = _deduplicate_by_offset(raw)
    i = 0

    while i < len(elements):
        el = elements[i]

        if _is_tuplet(el):
            actual, normal = _get_tuplet_ratio(el)

            # 收集所有连续的同 ratio tuplet 音符
            all_tuplet: list[music21.base.Music21Object] = []
            j = i
            while j < len(elements) and _is_tuplet(elements[j]):
                a2, n2 = _get_tuplet_ratio(elements[j])
                if a2 != actual or n2 != normal:
                    break
                all_tuplet.append(elements[j])
                j += 1

            # 按 actual 个一组输出
            for k in range(0, len(all_tuplet), actual):
                group = all_tuplet[k:k + actual]
                if len(group) == actual:
                    # 完整的 tuplet 组
                    inner = [
                        _element_to_token(
                            g, scale_pcs, tonic_octave, True,
                            warnings, chord_warned,
                        )
                        for g in group
                    ]
                    tokens.append(f"{actual}[ {' '.join(inner)} ]")
                else:
                    # 不完整组（跨小节残余）：作为普通音符输出
                    for g in group:
                        token = _element_to_token(
                            g, scale_pcs, tonic_octave, False,
                            warnings, chord_warned,
                        )
                        if token:
                            tokens.append(token)

            i = j
            continue

        # 普通音符/休止符
        token = _element_to_token(
            el, scale_pcs, tonic_octave, False,
            warnings, chord_warned,
        )
        if token:
            tokens.append(token)
        i += 1

    return tokens


def _pickup_rests(padding_ql: float) -> str:
    """为弱起小节生成前置休止符。

    将 paddingLeft 的时值拆成标准休止符组合。
    """
    if padding_ql <= 0:
        return ""

    rests: list[str] = []
    remaining = Fraction(padding_ql).limit_denominator(64)
    # 从大到小尝试标准时值
    standard = [
        Fraction(4), Fraction(3), Fraction(2), Fraction(3, 2),
        Fraction(1), Fraction(3, 4), Fraction(1, 2),
        Fraction(3, 8), Fraction(1, 4),
    ]
    for std in standard:
        while remaining >= std:
            rests.append(_rest_to_jianpu(float(std)))
            remaining -= std

    return " ".join(rests)


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
        warnings.append(
            f"文件包含 {num_parts} 个声部，当前仅转换第 {part_index + 1} 声部"
        )

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

    # 检测谱号
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
    chord_warned: list[bool] = [False]

    for m in measures:
        tokens = _process_measure(
            m, scale_pcs, tonic_octave, warnings, chord_warned,
        )

        if not tokens:
            continue

        bar_text = " ".join(tokens)

        # 弱起小节：在前面补休止符
        if m.paddingLeft > 0:
            pickup = _pickup_rests(float(m.paddingLeft))
            if pickup:
                bar_text = f"{pickup} {bar_text}"

        bar_strings.append(bar_text)

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
