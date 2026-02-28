"""音高转换工具：pitch → 简谱音级、八度后缀、升降号。"""

from typing import Dict, List, Optional, Tuple

from music21 import key as m21key
from music21 import pitch as m21pitch

from app.modes.musicxml.constants import MAJOR_SCALE_INTERVALS, REFERENCE_OCTAVE


def build_scale_pc_map(tonic_pc: int) -> Dict[int, int]:
    """构建音阶 pitchClass → degree(1-7) 的映射。

    Args:
        tonic_pc: 主音的 pitchClass（0=C, 2=D, ...）

    Returns:
        {pitchClass: degree} 映射，degree 从 1 开始。
    """
    mapping: Dict[int, int] = {}
    for i, interval in enumerate(MAJOR_SCALE_INTERVALS):
        pc = (tonic_pc + interval) % 12
        mapping[pc] = i + 1
    return mapping


def pitch_to_degree(
    p: m21pitch.Pitch,
    scale_pc_map: Dict[int, int],
) -> Tuple[int, str]:
    """将 music21 Pitch 转换为简谱音级和变音记号。

    Args:
        p: music21 Pitch 对象。
        scale_pc_map: 音阶 pitchClass → degree 映射。

    Returns:
        (degree, accidental_str) 元组。
        degree 为 1-7，accidental_str 为 '#'/'b'/''。
    """
    pc = p.pitchClass
    # 直接在自然音阶中
    if pc in scale_pc_map:
        return scale_pc_map[pc], ""

    # 尝试升半音还原 → 原始是降号
    up = (pc + 1) % 12
    if up in scale_pc_map:
        return scale_pc_map[up], "b"

    # 尝试降半音还原 → 原始是升号
    down = (pc - 1) % 12
    if down in scale_pc_map:
        return scale_pc_map[down], "#"

    # 双升/双降等罕见情况，用最近的自然音级
    for delta in (2, -2):
        candidate = (pc + delta) % 12
        if candidate in scale_pc_map:
            acc = "b" * delta if delta > 0 else "#" * (-delta)
            return scale_pc_map[candidate], acc

    # fallback: 当作 1
    return 1, ""


def octave_suffix(p: m21pitch.Pitch, tonic_octave: int) -> str:
    """计算八度后缀 e（升）/ d（降）。

    Args:
        p: music21 Pitch 对象。
        tonic_octave: 主音参考八度。

    Returns:
        'e' * n 或 'd' * n 或 ''。
    """
    oct = p.octave if p.octave is not None else REFERENCE_OCTAVE
    diff = oct - tonic_octave
    if diff > 0:
        return "e" * diff
    if diff < 0:
        return "d" * (-diff)
    return ""


def resolve_tonic_octave(ks: m21key.Key) -> int:
    """根据调号判断参考八度。

    大调以中央 C 区域（octave 4）为基准；
    小调以 A3 区域（octave 3）为基准，但通常也用 4。

    Args:
        ks: music21 Key 对象。

    Returns:
        参考八度数。
    """
    return REFERENCE_OCTAVE


def format_note_token(
    p: m21pitch.Pitch,
    scale_pc_map: Dict[int, int],
    tonic_octave: int,
) -> str:
    """将 pitch 转换为 spnmn 音符 token（不含时值）。

    Args:
        p: music21 Pitch。
        scale_pc_map: 音阶映射。
        tonic_octave: 参考八度。

    Returns:
        如 '1', '#4e', 'b3d' 等。
    """
    degree, acc = pitch_to_degree(p, scale_pc_map)
    oct = octave_suffix(p, tonic_octave)
    return f"{acc}{degree}{oct}"
