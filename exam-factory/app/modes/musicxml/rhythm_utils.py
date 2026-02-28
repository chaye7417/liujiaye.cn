"""时值与节奏转换工具：quarterLength → spnmn 时值标记。"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from music21 import duration as m21dur
from music21 import note, stream


def _is_close(a: float, b: float, tol: float = 0.01) -> bool:
    """浮点近似比较。"""
    return abs(a - b) < tol


def deduplicate_by_offset(elements: List[Any]) -> List[Any]:
    """同一 offset 有音符和休止符重叠时，优先保留音符。

    Args:
        elements: music21 元素列表（Note / Rest / Chord 等）。

    Returns:
        去重后的元素列表，按 offset 排序。
    """
    by_offset: Dict[float, List[Any]] = defaultdict(list)
    for el in elements:
        by_offset[float(el.offset)].append(el)

    result: List[Any] = []
    for offset_val in sorted(by_offset.keys()):
        group = by_offset[offset_val]
        if len(group) == 1:
            result.append(group[0])
        else:
            notes_at = [e for e in group if not isinstance(e, note.Rest)]
            if notes_at:
                result.append(notes_at[0])
            else:
                result.append(group[0])
    return result


def remove_overlapping_rests(
    elements: List[Any],
    tol: float = 1e-6,
) -> List[Any]:
    """移除与任意音符时值区间重叠的休止符。

    MusicXML 在多声部合并后常出现“占位休止符”（用于版面/声部对齐），
    这些休止符并非实际听感上的停顿。若直接转换会产生多余的 0。
    """
    note_ranges: List[Tuple[float, float]] = []
    for el in elements:
        if isinstance(el, note.Rest):
            continue
        start = float(el.offset)
        end = start + float(el.duration.quarterLength)
        note_ranges.append((start, end))

    if not note_ranges:
        return elements

    filtered: List[Any] = []
    for el in elements:
        if not isinstance(el, note.Rest):
            filtered.append(el)
            continue

        r_start = float(el.offset)
        r_end = r_start + float(el.duration.quarterLength)
        overlaps = any(
            (r_start < n_end - tol) and (n_start < r_end - tol)
            for n_start, n_end in note_ranges
        )
        if not overlaps:
            filtered.append(el)

    return filtered


def _beat_slots_for_ts(numerator: int, denominator: int) -> List[float]:
    """根据拍号返回每一拍的起始 offset 列表（相对小节开头）。

    Args:
        numerator: 拍号分子。
        denominator: 拍号分母。

    Returns:
        每拍的 quarterLength 起始位置列表。
    """
    beat_ql = 4.0 / denominator
    return [i * beat_ql for i in range(numerator)]


def _classify_ql(ql: float) -> Tuple[str, float]:
    """将 quarterLength 分类为基础类型。

    Args:
        ql: quarterLength 值。

    Returns:
        (type_name, remainder) 元组。
        type_name: 'whole'|'dotted_half'|'half'|'dotted_quarter'|
                   'quarter'|'dotted_eighth'|'eighth'|'sixteenth'|'other'
    """
    if _is_close(ql, 4.0):
        return "whole", 0.0
    if _is_close(ql, 3.0):
        return "dotted_half", 0.0
    if _is_close(ql, 2.0):
        return "half", 0.0
    if _is_close(ql, 1.5):
        return "dotted_quarter", 0.0
    if _is_close(ql, 1.0):
        return "quarter", 0.0
    if _is_close(ql, 0.75):
        return "dotted_eighth", 0.0
    if _is_close(ql, 0.5):
        return "eighth", 0.0
    if _is_close(ql, 0.25):
        return "sixteenth", 0.0
    if _is_close(ql, 0.125):
        return "thirty_second", 0.0
    return "other", ql


def expand_to_beat_tokens(
    token: str,
    ql: float,
    beat_ql: float,
    is_tied: bool = False,
) -> List[str]:
    """将一个音符 token 按时值展开为拍级别的 spnmn 标记序列。

    只处理占据整数拍或常见时值的情况。
    超出单拍的部分用延时线 '-' 填充。

    Args:
        token: 音符 token 字符串（如 '1', '#4e', '0'）。
        ql: 音符的 quarterLength。
        beat_ql: 每拍的 quarterLength。
        is_tied: 是否有连音线延续到下一个音符。

    Returns:
        spnmn 标记列表，如 ['1', '-', '-', '-']。
    """
    tie_suffix = "~" if is_tied else ""

    # 全音符 (4 beats in 4/4)
    if _is_close(ql, beat_ql * 4):
        return [token + tie_suffix, "-", "-", "-"]

    # 附点二分 (3 beats)：
    # 在当前项目的目标记法中，3 拍统一写作 "X - -"（不用点记号）。
    if _is_close(ql, beat_ql * 3):
        return [token + tie_suffix, "-", "-"]

    # 二分 (2 beats)
    if _is_close(ql, beat_ql * 2):
        return [token + tie_suffix, "-"]

    # 附点四分 (1.5 beats) — 用附点表示
    if _is_close(ql, beat_ql * 1.5):
        return [token + "." + tie_suffix]

    # 四分 (1 beat)
    if _is_close(ql, beat_ql):
        return [token + tie_suffix]

    # 超过 4 拍的长音符
    if ql > beat_ql * 4:
        full_beats = int(ql / beat_ql)
        remainder = ql - full_beats * beat_ql
        result = [token + tie_suffix] + ["-"] * (full_beats - 1)
        if _is_close(remainder, beat_ql * 0.5):
            result.append(".")
        return result

    # 非整拍：延时线填充到最近整数拍
    if ql > beat_ql:
        full_beats = int(ql / beat_ql)
        remainder = ql - full_beats * beat_ql
        result = [token + tie_suffix] + ["-"] * (full_beats - 1)
        if _is_close(remainder, beat_ql * 0.5):
            result.append(".")
        elif remainder > 0.01:
            result.append("-")
        return result

    # 亚拍音符：必须用括号包裹以显示正确的减时线
    eighth = beat_ql / 2
    sixteenth = beat_ql / 4
    tok_with_tie = token + tie_suffix

    # 八分音符 → (token) 一层括号 = 一条减时线
    if _is_close(ql, eighth):
        return [f"({tok_with_tie})"]

    # 十六分音符 → ((token)) 两层括号 = 两条减时线
    if _is_close(ql, sixteenth):
        return [f"(({tok_with_tie}))"]

    # 其他亚拍时值用单层括号近似
    return [f"({tok_with_tie})"]


def group_sub_beat_tokens(tokens_with_ql: List[Tuple[str, float]], beat_ql: float) -> str:
    """将一拍内的亚拍音符用括号分组。

    Sparks NMN 括号规则：
    - 每层括号加一条减时线（时值减半）
    - (ab) = 两个八分音符
    - ((ab)(cd)) = 四个十六分音符
    - (a(bc)) = 八分 + 两个十六分
    - ((ab)c) = 两个十六分 + 八分
    - (a.b) = 附点八分 + 十六分

    Args:
        tokens_with_ql: [(token, quarterLength), ...] 一拍内的音符。
        beat_ql: 每拍的 quarterLength。

    Returns:
        分组后的 spnmn 字符串。
    """
    if len(tokens_with_ql) == 1:
        tok, ql = tokens_with_ql[0]
        if _is_close(ql, beat_ql):
            return tok
        return tok

    eighth = beat_ql / 2      # 八分音符时值
    sixteenth = beat_ql / 4   # 十六分音符时值
    thirtysecond = beat_ql / 8  # 三十二分音符时值

    # === 2 个音符 ===
    if len(tokens_with_ql) == 2:
        t1, q1 = tokens_with_ql[0]
        t2, q2 = tokens_with_ql[1]
        # 八分 + 八分
        if _is_close(q1, eighth) and _is_close(q2, eighth):
            return f"({t1}{t2})"
        # 附点八分 + 十六分 → (a.(b)) 十六分需要额外括号获得双减时线
        if _is_close(q1, beat_ql * 0.75) and _is_close(q2, sixteenth):
            return f"({t1}.({t2}))"
        # 十六分 + 附点八分 → ((a)b.)
        if _is_close(q1, sixteenth) and _is_close(q2, beat_ql * 0.75):
            return f"(({t1}){t2}.)"
        # 十六分 + 十六分（半拍内两个十六分）
        if _is_close(q1, sixteenth) and _is_close(q2, sixteenth):
            return f"({t1}{t2})"
        return f"({t1}{t2})"

    # === 3 个音符 ===
    if len(tokens_with_ql) == 3:
        t1, q1 = tokens_with_ql[0]
        t2, q2 = tokens_with_ql[1]
        t3, q3 = tokens_with_ql[2]

        # 三连音
        if all(_is_close(q, beat_ql / 3) for _, q in tokens_with_ql):
            return f"T({t1}{t2}{t3})"

        # 八分 + 十六分 + 十六分 → (a(bc))
        if _is_close(q1, eighth) and _is_close(q2, sixteenth) and _is_close(q3, sixteenth):
            return f"({t1}({t2}{t3}))"

        # 十六分 + 十六分 + 八分 → ((ab)c)
        if _is_close(q1, sixteenth) and _is_close(q2, sixteenth) and _is_close(q3, eighth):
            return f"(({t1}{t2}){t3})"

        # 十六分 + 八分 + 十六分 → ((a)b(c)) 用通用处理
        # 八分 + 八分 + 八分（3 个八分超出一拍，少见但处理）
        if all(_is_close(q, eighth) for _, q in tokens_with_ql):
            return f"({t1}{t2}{t3})"

        # 通用 3 音符
        inner = "".join(tok for tok, _ in tokens_with_ql)
        return f"({inner})"

    # === 4 个音符 ===
    if len(tokens_with_ql) == 4:
        t1, q1 = tokens_with_ql[0]
        t2, q2 = tokens_with_ql[1]
        t3, q3 = tokens_with_ql[2]
        t4, q4 = tokens_with_ql[3]

        # 四个十六分音符
        if all(_is_close(q, sixteenth) for _, q in tokens_with_ql):
            return f"(({t1}{t2})({t3}{t4}))"

        # 附点十六分 + 三十二分 + 十六分 + 十六分 → ((a.(b))(cd))
        # 三十二分需要第三层括号获得三条减时线
        if (_is_close(q1, sixteenth * 1.5) and _is_close(q2, thirtysecond)
                and _is_close(q3, sixteenth) and _is_close(q4, sixteenth)):
            return f"(({t1}.({t2}))({t3}{t4}))"

        # 十六分 + 十六分 + 附点十六分 + 三十二分 → ((ab)(c.(d)))
        if (_is_close(q1, sixteenth) and _is_close(q2, sixteenth)
                and _is_close(q3, sixteenth * 1.5) and _is_close(q4, thirtysecond)):
            return f"(({t1}{t2})({t3}.({t4})))"

        # 通用 4 音符
        inner = "".join(tok for tok, _ in tokens_with_ql)
        return f"({inner})"

    # === 5+ 个音符（通用处理）===
    inner = "".join(tok for tok, _ in tokens_with_ql)
    return f"({inner})"
