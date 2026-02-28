"""MusicXML 元数据提取：标题、作曲家、调号、拍号、速度。"""

from __future__ import annotations

from typing import List, Optional, Tuple

from music21 import key as m21key, meter, stream, tempo

from app.modes.musicxml.constants import MAJOR_KEY_MAP, MINOR_KEY_MAP


def extract_title(score: stream.Score) -> str:
    """从 score metadata 提取标题。

    MusicXML 中标题可能存储为 title 或 movementName，
    需依次尝试两个字段。

    Args:
        score: music21 Score 对象。

    Returns:
        标题字符串，无标题时返回 'Untitled'。
    """
    md = score.metadata
    if md:
        if md.title:
            return md.title
        # MusicXML 常将标题存储为 movementName
        movement = getattr(md, "movementName", None)
        if movement:
            return movement
    return "Untitled"


def extract_composer(score: stream.Score) -> str:
    """从 score metadata 提取作曲家。

    Args:
        score: music21 Score 对象。

    Returns:
        作曲家名称，未找到时返回空字符串。
    """
    md = score.metadata
    if md:
        for attr in ("composer", "creator"):
            val = getattr(md, attr, None)
            if val:
                return val
    return ""


def extract_key(
    part: stream.Part,
    warnings: List[str],
) -> Tuple[m21key.Key, str]:
    """提取调号并映射为 spnmn 格式。

    Args:
        part: music21 Part 对象。
        warnings: 警告列表，缺少调号时追加警告。

    Returns:
        (Key 对象, spnmn 调号字符串) 元组。
    """
    ks_list = part.flatten().getElementsByClass(m21key.KeySignature)
    ks: Optional[m21key.Key] = None
    for item in ks_list:
        if isinstance(item, m21key.Key):
            ks = item
            break
        ks = item.asKey()
        break

    if ks is None:
        ks = m21key.Key("C")
        warnings.append("未检测到调号，默认使用 C 大调。")

    tonic_name = ks.tonic.name
    if ks.mode == "minor":
        key_str = MINOR_KEY_MAP.get(tonic_name, f"6={tonic_name}")
    else:
        key_str = MAJOR_KEY_MAP.get(tonic_name, f"1={tonic_name}")

    return ks, key_str


def extract_time_signature(
    part: stream.Part,
    warnings: List[str],
) -> Tuple[meter.TimeSignature, str]:
    """提取拍号。

    Args:
        part: music21 Part 对象。
        warnings: 警告列表，缺少拍号时追加警告。

    Returns:
        (TimeSignature 对象, 拍号字符串) 元组。
    """
    ts_list = part.flatten().getElementsByClass(meter.TimeSignature)
    ts: Optional[meter.TimeSignature] = None
    for item in ts_list:
        ts = item
        break

    if ts is None:
        ts = meter.TimeSignature("4/4")
        warnings.append("未检测到拍号，默认使用 4/4。")

    return ts, ts.ratioString


def extract_tempo(part: stream.Part) -> int:
    """提取速度 (qpm)。

    Args:
        part: music21 Part 对象。

    Returns:
        每分钟四分音符数，默认 120。
    """
    for el in part.flatten().getElementsByClass(tempo.MetronomeMark):
        if el.number is not None:
            return int(el.number)
    return 120


def is_pickup_measure(
    measure: stream.Measure,
    ts: meter.TimeSignature,
) -> bool:
    """判断是否为弱起小节。

    Args:
        measure: music21 Measure 对象。
        ts: 当前拍号。

    Returns:
        True 表示弱起小节。
    """
    expected = ts.barDuration.quarterLength
    actual = measure.duration.quarterLength
    return actual < expected - 0.01


def build_header(
    title: str,
    composer: str,
    key_str: str,
    ts_str: str,
    qpm: int,
) -> str:
    """生成 .spnmn 文件头。

    Args:
        title: 曲名。
        composer: 作曲家。
        key_str: spnmn 调号（如 '1=C'）。
        ts_str: 拍号（如 '4/4'）。
        qpm: 速度。

    Returns:
        完整的 spnmn 文件头文本。
    """
    lines = [f"Dt: {title}"]
    if composer:
        lines.append(f"Da[作曲]: {composer}")
    lines.append(f"P: {key_str} {ts_str} qpm={qpm}")
    lines.append("Rp: page=A4 font_lyrics=Roman,CommonSerif/600/0.95")
    lines.append("====")
    return "\n".join(lines)
