"""音值组合题目生成器 — 写作题 + 改错题。

Tick 系统：1 四分音符 = 12 ticks。
所有节奏型由胶囊选择控制（无默认 base 模板）。
多拍节奏型（二分、全音符、大切分系列）跨越 2-4 拍。
连音符（原子单元，不可拆分）：
  - 单拍子（2/4, 3/4, 4/4 等）：三连音
  - 复拍子（6/8, 9/8, 12/8）：二连音、四连音
"""

import random
from typing import Optional, Union

# ---------------------------------------------------------------------------
# Tick ↔ LilyPond 时值映射
# ---------------------------------------------------------------------------
_TICK_TO_LILY: dict[int, str] = {
    48: "1",    # 全音符
    36: "2.",   # 附点二分
    24: "2",    # 二分
    18: "4.",   # 附点四分
    12: "4",    # 四分
    9:  "8.",   # 附点八分
    6:  "8",    # 八分
    3:  "16",   # 十六分
}

_VALID_TICKS = frozenset(_TICK_TO_LILY.keys())

# ---------------------------------------------------------------------------
# 事件类型：普通 tick | (tick, LilyPond 字符串) 的连音符原子单元
# ---------------------------------------------------------------------------
_Evt = Union[int, tuple[int, str]]


def _evt_tick(evt: _Evt) -> int:
    """提取事件的 tick 值。"""
    return evt[0] if isinstance(evt, tuple) else evt


def _evt_to_lily(evt: _Evt) -> str:
    """将单个事件转为 LilyPond 音符（不含连线）。"""
    if isinstance(evt, tuple):
        return evt[1]
    return f"c'{_TICK_TO_LILY[evt]}"


# ---------------------------------------------------------------------------
# 单拍节奏型模板 — 按拍子大小分类，全部由胶囊控制
# ---------------------------------------------------------------------------

# ---- P12: 四分音符拍（2/4, 3/4, 4/4, C, 5/4）----
_P12_SINGLE: dict[str, list[list[_Evt]]] = {
    "double_eighth": [[6, 6]],
    "four_sixteenths": [[3, 3, 3, 3]],
    "eighth_sixteenths": [[6, 3, 3]],
    "sixteenths_eighth": [[3, 3, 6]],
    "dotted_front": [[9, 3]],
    "dotted_back": [[3, 9]],
    "syncopation": [[3, 6, 3]],
    "triplet": [[(12, "\\tuplet 3/2 { c'8 c'8 c'8 }")]],
}

# ---- P18: 附点四分音符拍（6/8, 9/8, 12/8）----
_P18_SINGLE: dict[str, list[list[_Evt]]] = {
    "double_eighth": [[6, 6, 6]],
    "quarter_eighth": [[12, 6]],
    "eighth_quarter": [[6, 12]],
    "four_sixteenths": [[6, 6, 3, 3]],  # 复拍子中四个十六的变体
    "eighth_sixteenths": [[6, 6, 3, 3]],
    "sixteenths_eighth": [[3, 3, 6, 6]],
    "dotted_front": [[9, 9], [9, 3, 6]],
    "dotted_back": [[6, 9, 3]],
    "duplet": [[(18, "\\tuplet 2/3 { c'8 c'8 }")]],
    "quadruplet": [[(18, "\\tuplet 4/3 { c'8 c'8 c'8 c'8 }")]],
}

# ---- P6: 八分音符拍（3/8）----
_P6_SINGLE: dict[str, list[list[_Evt]]] = {
    "double_eighth": [[3, 3]],
    "triplet": [[(6, "\\tuplet 3/2 { c'16 c'16 c'16 }")]],
}

# ---- P24: 二分音符拍（2/2, ₵）----
_P24_SINGLE: dict[str, list[list[_Evt]]] = {
    "double_eighth": [[12, 12]],
    "four_sixteenths": [[6, 6, 6, 6]],
    "eighth_sixteenths": [[12, 6, 6]],
    "sixteenths_eighth": [[6, 6, 12]],
    "dotted_front": [[18, 6]],
    "dotted_back": [[6, 18]],
    "syncopation": [[6, 12, 6]],
    "triplet": [[(24, "\\tuplet 3/2 { c'4 c'4 c'4 }")]],
}

# ---------------------------------------------------------------------------
# 多拍节奏型模板 — 跨越 2+ 拍（beats 字段表示占几拍）
# ---------------------------------------------------------------------------

# 多拍型定义：{capsule_key: [(beats_needed, [events]), ...]}
# beats_needed: 此模式占多少个 beat

# P12 多拍（beat=12 tick）
_P12_MULTI: dict[str, list[tuple[int, list[_Evt]]]] = {
    "half_note": [(2, [24])],
    "dotted_half": [(3, [36])],
    "whole_note": [(4, [48])],
    "big_sync": [(2, [6, 12, 6])],
    "big_sync_16f": [(2, [3, 3, 12, 6])],
    "big_sync_16b": [(2, [6, 12, 3, 3])],
    "big_sync_dot_f": [(2, [18, 6])],
    "big_sync_dot_b": [(2, [6, 18])],
    "big_sync_16fb": [(2, [3, 3, 12, 3, 3])],
}

# P18 多拍（beat=18 tick）
_P18_MULTI: dict[str, list[tuple[int, list[_Evt]]]] = {
    "half_note": [(2, [36])],
    "dotted_half": [(3, [54])],  # 3 拍 in 复拍子
}

# P6 多拍（beat=6 tick）
_P6_MULTI: dict[str, list[tuple[int, list[_Evt]]]] = {
    "half_note": [(2, [12])],
    "dotted_half": [(3, [18])],
}

# P24 多拍（beat=24 tick）
_P24_MULTI: dict[str, list[tuple[int, list[_Evt]]]] = {
    "whole_note": [(2, [48])],
    "big_sync": [(2, [12, 24, 12])],
    "big_sync_16f": [(2, [6, 6, 24, 12])],
    "big_sync_16b": [(2, [12, 24, 6, 6])],
    "big_sync_dot_f": [(2, [36, 12])],
    "big_sync_dot_b": [(2, [12, 36])],
    "big_sync_16fb": [(2, [6, 6, 24, 6, 6])],
}

# ---------------------------------------------------------------------------
# 拍号配置（11 种）
# ---------------------------------------------------------------------------
_TS: dict[str, dict] = {
    "2/4": {
        "bar": 24, "beat": 12, "n_beats": 2, "split_at": [],
        "single": _P12_SINGLE, "multi": _P12_MULTI,
        "lily_ts": "\\numericTimeSignature \\time 2/4",
        "time_frac": "2/4", "display": "2/4",
    },
    "3/4": {
        "bar": 36, "beat": 12, "n_beats": 3, "split_at": [],
        "single": _P12_SINGLE, "multi": _P12_MULTI,
        "lily_ts": "\\numericTimeSignature \\time 3/4",
        "time_frac": "3/4", "display": "3/4",
    },
    "4/4": {
        "bar": 48, "beat": 12, "n_beats": 4, "split_at": [24],
        "single": _P12_SINGLE, "multi": _P12_MULTI,
        "lily_ts": "\\numericTimeSignature \\time 4/4",
        "time_frac": "4/4", "display": "4/4",
    },
    "C": {
        "bar": 48, "beat": 12, "n_beats": 4, "split_at": [24],
        "single": _P12_SINGLE, "multi": _P12_MULTI,
        "lily_ts": "\\defaultTimeSignature \\time 4/4",
        "time_frac": "4/4", "display": "C",
    },
    "3/8": {
        "bar": 18, "beat": 6, "n_beats": 3, "split_at": [],
        "single": _P6_SINGLE, "multi": _P6_MULTI,
        "lily_ts": "\\numericTimeSignature \\time 3/8",
        "time_frac": "3/8", "display": "3/8",
    },
    "6/8": {
        "bar": 36, "beat": 18, "n_beats": 2, "split_at": [18],
        "single": _P18_SINGLE, "multi": _P18_MULTI,
        "lily_ts": "\\numericTimeSignature \\time 6/8",
        "time_frac": "6/8", "display": "6/8",
    },
    "2/2": {
        "bar": 48, "beat": 24, "n_beats": 2, "split_at": [],
        "single": _P24_SINGLE, "multi": _P24_MULTI,
        "lily_ts": "\\numericTimeSignature \\time 2/2",
        "time_frac": "2/2", "display": "2/2",
    },
    "cut_c": {
        "bar": 48, "beat": 24, "n_beats": 2, "split_at": [],
        "single": _P24_SINGLE, "multi": _P24_MULTI,
        "lily_ts": "\\defaultTimeSignature \\time 2/2",
        "time_frac": "2/2", "display": "\u20b5",
    },
    "9/8": {
        "bar": 54, "beat": 18, "n_beats": 3, "split_at": [18, 36],
        "single": _P18_SINGLE, "multi": _P18_MULTI,
        "lily_ts": "\\numericTimeSignature \\time 9/8",
        "time_frac": "9/8", "display": "9/8",
    },
    "12/8": {
        "bar": 72, "beat": 18, "n_beats": 4, "split_at": [36],
        "single": _P18_SINGLE, "multi": _P18_MULTI,
        "lily_ts": "\\numericTimeSignature \\time 12/8",
        "time_frac": "12/8", "display": "12/8",
    },
    "5/4": {
        "bar": 60, "beat": 12, "n_beats": 5, "split_at": [24],
        "single": _P12_SINGLE, "multi": _P12_MULTI,
        "lily_ts": "\\numericTimeSignature \\time 5/4",
        "time_frac": "5/4", "display": "5/4",
    },
}

# 难度默认拍号池
_TS_BASIC = ["2/4", "3/4", "4/4"]
_TS_INTERMEDIATE = _TS_BASIC + ["3/8", "6/8", "2/2"]
_TS_ADVANCED = list(_TS.keys())

# 胶囊分类
_SINGLE_BEAT_KEYS = frozenset({
    "double_eighth", "four_sixteenths",
    "eighth_sixteenths", "sixteenths_eighth",
    "dotted_front", "dotted_back", "syncopation",
    "quarter_eighth", "eighth_quarter",
    "triplet", "duplet", "quadruplet",
})
_MULTI_BEAT_KEYS = frozenset({
    "half_note", "dotted_half", "whole_note",
    "big_sync", "big_sync_16f", "big_sync_16b",
    "big_sync_dot_f", "big_sync_dot_b", "big_sync_16fb",
})
_BEHAVIOR_KEYS = frozenset({"ties"})
_ALL_CAPSULE_KEYS = _SINGLE_BEAT_KEYS | _MULTI_BEAT_KEYS | _BEHAVIOR_KEYS


# ---------------------------------------------------------------------------
# 模板构建
# ---------------------------------------------------------------------------
def _build_single_patterns(
    ts_key: str,
    enabled: set[str],
) -> list[list[_Evt]]:
    """根据胶囊选择构建可用单拍节奏型列表。

    始终包含纯拍子 [beat_size] 作为填充。
    """
    cfg = _TS[ts_key]
    beat = cfg["beat"]
    patterns: list[list[_Evt]] = [[beat]]  # 永远有纯拍子
    single_map = cfg["single"]
    for key in enabled & _SINGLE_BEAT_KEYS:
        if key in single_map:
            patterns.extend(single_map[key])
    return patterns


def _build_multi_patterns(
    ts_key: str,
    enabled: set[str],
) -> list[tuple[int, list[_Evt]]]:
    """根据胶囊选择构建可用多拍节奏型列表。

    Returns:
        [(beats_needed, events), ...] 列表
    """
    cfg = _TS[ts_key]
    n_beats = cfg["n_beats"]
    multi_map = cfg["multi"]
    patterns: list[tuple[int, list[_Evt]]] = []
    for key in enabled & _MULTI_BEAT_KEYS:
        if key in multi_map:
            for beats_needed, evts in multi_map[key]:
                if beats_needed <= n_beats:
                    patterns.append((beats_needed, evts))
    return patterns


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------
def _decompose_tick(tick: int) -> list[int]:
    """将非标准 tick 分解为合法时值之和（贪心，大优先）。"""
    valid_sorted = sorted(_VALID_TICKS, reverse=True)
    result: list[int] = []
    remaining = tick
    while remaining > 0:
        for v in valid_sorted:
            if v <= remaining:
                result.append(v)
                remaining -= v
                break
        else:
            result.append(remaining)
            break
    return result


def _ticks_to_lily(ticks_with_ties: list[tuple[_Evt, bool]]) -> str:
    """将 [(_Evt, needs_tie), ...] 转为 LilyPond 音符字符串。"""
    parts: list[str] = []
    for evt, tie_after in ticks_with_ties:
        if isinstance(evt, tuple):
            parts.append(evt[1])
        elif evt in _VALID_TICKS:
            ns = f"c'{_TICK_TO_LILY[evt]}"
            if tie_after:
                ns += "~"
            parts.append(ns)
        else:
            sub = _decompose_tick(evt)
            for j, st in enumerate(sub):
                ns = f"c'{_TICK_TO_LILY[st]}"
                if j < len(sub) - 1 or tie_after:
                    ns += "~"
                parts.append(ns)
    return " ".join(parts)


# ---------------------------------------------------------------------------
# 核心：从 flat ticks 推导正确分组（答案）
# ---------------------------------------------------------------------------
def _regroup(flat_ticks: list[_Evt], ts_key: str) -> list[list[tuple[_Evt, bool]]]:
    """将扁平事件序列按音值组合法则重新分组。

    拆分规则：
      1. 小节线处必须拆分
      2. 强边界（split_at）处必须拆分
      3. 拍内边界：仅当音符起始于拍中间时，在下一个拍线处拆分
      4. 连音符是原子单元，永不拆分
      5. 起始于小节头部的音符不在 split_at 处拆分（如全音符不应被劈成两个二分）

    Args:
        flat_ticks: 扁平事件序列（int 或 tuple）
        ts_key: 拍号 key

    Returns:
        小节列表，每小节是 [(_Evt, tie_after), ...] 列表
    """
    cfg = _TS[ts_key]
    bar_size = cfg["bar"]
    beat_size = cfg["beat"]
    strong_splits = cfg["split_at"]

    total = sum(_evt_tick(e) for e in flat_ticks)
    n_bars = total // bar_size

    # 绝对强边界（小节线 + split_at）
    bar_lines: set[int] = set()
    split_at_abs: set[int] = set()
    for bar_idx in range(n_bars + 1):
        base = bar_idx * bar_size
        if 0 < base < total:
            bar_lines.add(base)
        for sp in strong_splits:
            abs_sp = base + sp
            if 0 < abs_sp < total:
                split_at_abs.add(abs_sp)

    # 遍历每个事件，在边界处拆分
    result: list[tuple[_Evt, bool]] = []
    pos = 0

    for evt in flat_ticks:
        tick = _evt_tick(evt)
        end = pos + tick

        if isinstance(evt, tuple):
            result.append((evt, False))
        else:
            cuts: set[int] = set()

            # 1. 小节线（始终拆分）
            for b in bar_lines:
                if pos < b < end:
                    cuts.add(b)

            # 2. 强边界（split_at）— 仅当音符不从小节开头开始时
            starts_at_bar = (pos % bar_size == 0)
            if not starts_at_bar:
                for b in split_at_abs:
                    if pos < b < end:
                        cuts.add(b)

            # 3. 拍内边界（仅当起始于拍中间时）
            bar_start = (pos // bar_size) * bar_size
            beat_pos = (pos - bar_start) % beat_size
            if beat_pos != 0:
                next_beat = pos + (beat_size - beat_pos)
                if next_beat < end:
                    cuts.add(next_beat)

            if not cuts:
                result.append((tick, False))
            else:
                points = [pos] + sorted(cuts) + [end]
                for i in range(len(points) - 1):
                    sub = points[i + 1] - points[i]
                    needs_tie = i < len(points) - 2
                    result.append((sub, needs_tie))

        pos = end

    # 按小节线分组
    bars: list[list[tuple[_Evt, bool]]] = []
    current_bar: list[tuple[_Evt, bool]] = []
    bar_pos = 0

    for evt, tie in result:
        current_bar.append((evt, tie))
        bar_pos += _evt_tick(evt)
        if bar_pos >= bar_size:
            bars.append(current_bar)
            current_bar = []
            bar_pos = 0

    if current_bar:
        bars.append(current_bar)

    return bars


# ---------------------------------------------------------------------------
# 序列生成（支持多拍模式）
# ---------------------------------------------------------------------------
def _generate_flat(
    ts_key: str,
    single_pats: list[list[_Evt]],
    multi_pats: list[tuple[int, list[_Evt]]],
    n_bars: int,
) -> list[_Evt]:
    """按拍生成正确节奏型，展平为事件列表。

    在每小节内逐拍填充：先尝试插入多拍模式（30% 概率），
    剩余用单拍模式填充。
    """
    cfg = _TS[ts_key]
    n_beats = cfg["n_beats"]
    flat: list[_Evt] = []

    for _ in range(n_bars):
        beat_idx = 0
        while beat_idx < n_beats:
            remaining = n_beats - beat_idx
            # 尝试多拍模式（30% 概率）
            if multi_pats and remaining >= 2 and random.random() < 0.3:
                candidates = [
                    (bn, evts) for bn, evts in multi_pats
                    if bn <= remaining
                ]
                if candidates:
                    bn, evts = random.choice(candidates)
                    flat.extend(evts)
                    beat_idx += bn
                    continue
            # 单拍模式
            flat.extend(random.choice(single_pats))
            beat_idx += 1

    return flat


def _merge_random(
    flat: list[_Evt],
    ts_key: str,
    allow_cross_bar: bool = True,
) -> list[_Evt]:
    """随机合并相邻普通音符（跳过连音符）。

    仅在 allow_cross_bar=True 时允许跨小节线合并（同音连线）。
    拍内和跨拍合并始终允许（跨拍大切分现在由多拍模板直接生成）。

    Args:
        flat: 扁平事件序列
        ts_key: 拍号 key
        allow_cross_bar: 是否允许跨小节线合并
    """
    cfg = _TS[ts_key]
    bar_size = cfg["bar"]

    ticks = list(flat)
    for _ in range(len(ticks) * 2):
        if len(ticks) < 3:
            break
        i = random.randint(0, len(ticks) - 2)
        if isinstance(ticks[i], tuple) or isinstance(ticks[i + 1], tuple):
            continue
        merged = ticks[i] + ticks[i + 1]
        if merged not in _VALID_TICKS:
            continue

        pos = sum(_evt_tick(e) for e in ticks[:i])
        end = pos + merged

        # 检查是否跨小节线
        bar_of_start = pos // bar_size
        bar_of_end = (end - 1) // bar_size
        if bar_of_start != bar_of_end and not allow_cross_bar:
            continue

        ticks = ticks[:i] + [merged] + ticks[i + 2:]
    return ticks


# ---------------------------------------------------------------------------
# 写作题
# ---------------------------------------------------------------------------
def _generate_writing_item(
    ts_key: str,
    single_pats: list[list[_Evt]],
    multi_pats: list[tuple[int, list[_Evt]]],
    n_bars: int,
    allow_cross_bar: bool,
) -> tuple[str, str]:
    """生成一道写作题。

    题目：合并后的音符（无拍号、无小节线）。
    答案：从题目推导的正确分组。
    """
    cfg = _TS[ts_key]
    flat = _generate_flat(ts_key, single_pats, multi_pats, n_bars)
    question_ticks = _merge_random(flat, ts_key, allow_cross_bar=allow_cross_bar)

    q_notes = " ".join(_evt_to_lily(t) for t in question_ticks)
    q_lily = (
        f"\\new RhythmicStaff {{ \\omit Score.BarNumber "
        f"\\omit Staff.TimeSignature \\omit Staff.BarLine "
        f"\\time {cfg['time_frac']} {q_notes} }}"
    )

    answer_bars = _regroup(question_ticks, ts_key)
    bar_strs = [_ticks_to_lily(bar) for bar in answer_bars]
    a_lily = (
        f"\\new RhythmicStaff {{ \\omit Score.BarNumber "
        f"{cfg['lily_ts']} {_join_bars(bar_strs)} }}"
    )

    return q_lily, a_lily


# ---------------------------------------------------------------------------
# 改错题
# ---------------------------------------------------------------------------
def _generate_correction_item(
    ts_key: str,
    single_pats: list[list[_Evt]],
    multi_pats: list[tuple[int, list[_Evt]]],
    n_bars: int,
) -> tuple[str, str]:
    """生成一道改错题。

    题目：有拍号和小节线，但部分音符跨越分组边界。
    答案：从题目推导的正确分组。
    """
    cfg = _TS[ts_key]
    split_points = cfg["split_at"]
    beat_size = cfg["beat"]
    n_beats = cfg["n_beats"]

    error_bars: list[list[_Evt]] = []
    for _ in range(n_bars):
        # 生成一个小节的正确节奏
        beat_ticks: list[_Evt] = []
        beat_idx = 0
        while beat_idx < n_beats:
            remaining = n_beats - beat_idx
            if multi_pats and remaining >= 2 and random.random() < 0.2:
                candidates = [
                    (bn, evts) for bn, evts in multi_pats
                    if bn <= remaining
                ]
                if candidates:
                    bn, evts = random.choice(candidates)
                    beat_ticks.extend(evts)
                    beat_idx += bn
                    continue
            beat_ticks.extend(random.choice(single_pats))
            beat_idx += 1

        # 在小节内制造错误合并
        new_bar: list[_Evt] = list(beat_ticks)
        merge_count = 0
        for _ in range(25):
            if len(new_bar) < 2 or merge_count >= 3:
                break
            i = random.randint(0, len(new_bar) - 2)
            if isinstance(new_bar[i], tuple) or isinstance(new_bar[i + 1], tuple):
                continue
            merged = new_bar[i] + new_bar[i + 1]
            if merged not in _VALID_TICKS:
                continue
            pos = sum(_evt_tick(e) for e in new_bar[:i])
            end = pos + merged
            crosses_strong = any(pos < sp < end for sp in split_points)
            beat_pos = pos % beat_size
            crosses_beat = beat_pos != 0 and (pos + beat_size - beat_pos) < end
            if crosses_strong or crosses_beat:
                new_bar = new_bar[:i] + [merged] + new_bar[i + 2:]
                merge_count += 1
        error_bars.append(new_bar)

    q_bar_strs = [" ".join(_evt_to_lily(t) for t in bar) for bar in error_bars]
    q_lily = (
        f"\\new RhythmicStaff {{ \\omit Score.BarNumber "
        f"{cfg['lily_ts']} {_join_bars(q_bar_strs)} }}"
    )

    flat_from_error: list[_Evt] = []
    for bar in error_bars:
        flat_from_error.extend(bar)
    answer_bars = _regroup(flat_from_error, ts_key)
    a_bar_strs = [_ticks_to_lily(bar) for bar in answer_bars]
    a_lily = (
        f"\\new RhythmicStaff {{ \\omit Score.BarNumber "
        f"{cfg['lily_ts']} {_join_bars(a_bar_strs)} }}"
    )

    return q_lily, a_lily


# ---------------------------------------------------------------------------
# 拍号选择
# ---------------------------------------------------------------------------
def _get_ts_pool(
    difficulty: str,
    user_ts: Optional[list[str]] = None,
) -> list[str]:
    """返回可用拍号列表。优先使用用户胶囊选择，否则按难度。"""
    if user_ts:
        valid = [ts for ts in user_ts if ts in _TS]
        if valid:
            return valid
    if difficulty == "高级":
        return _TS_ADVANCED
    if difficulty == "中级":
        return _TS_INTERMEDIATE
    return _TS_BASIC


def _pick_time_signatures(n: int, pool: list[str]) -> list[str]:
    """为 n 道题选择拍号，尽量覆盖不同拍号。"""
    if not pool:
        pool = _TS_BASIC
    result: list[str] = []
    shuffled = list(pool)
    random.shuffle(shuffled)
    for ts in shuffled:
        if len(result) >= n:
            break
        result.append(ts)
    while len(result) < n:
        result.append(random.choice(pool))
    random.shuffle(result)
    return result[:n]


# ---------------------------------------------------------------------------
# LilyPond 输出辅助
# ---------------------------------------------------------------------------
_BARS_PER_LINE = 4


def _join_bars(bar_strs: list[str], bars_per_line: int = _BARS_PER_LINE) -> str:
    """用 | 连接小节，每 bars_per_line 小节插入 \\break。"""
    parts: list[str] = []
    for idx, bar_str in enumerate(bar_strs):
        parts.append(bar_str)
        if idx < len(bar_strs) - 1:
            parts.append("|")
            if (idx + 1) % bars_per_line == 0:
                parts.append("\\break")
    return " ".join(parts)


def _wrap_lily(code: str) -> str:
    """包装 LilyPond 代码块。"""
    return f"```lilypond\n{{ {code} }}\n```"


# ---------------------------------------------------------------------------
# 主入口：生成音值组合 Markdown
# ---------------------------------------------------------------------------
def generate_rhythm(
    section_num: str,
    difficulty: str = "中级",
    generation_params: Optional[dict] = None,
    **kwargs,
) -> str:
    """生成音值组合题的完整 Markdown。

    通过 generation_params 读取参数：
        - rhythm_writing_n: 写作题数量（默认 3）
        - rhythm_correction_n: 改错题数量（默认 2）
        - rhythm_bars: 每题小节数（默认 8）
        - rhythm_time_sigs: 选中的拍号 key 列表（默认按难度）
        - rhythm_patterns: 选中的节奏型 key 列表（默认全部）

    Args:
        section_num: 大题编号
        difficulty: 难度级别
        generation_params: 额外参数
    """
    params = generation_params or {}
    n_writing = params.get("rhythm_writing_n", 3)
    n_correction = params.get("rhythm_correction_n", 2)
    n_bars = params.get("rhythm_bars", 8)

    # 胶囊选择
    user_ts: Optional[list[str]] = params.get("rhythm_time_sigs")
    user_patterns: Optional[list[str]] = params.get("rhythm_patterns")

    # 解析启用的胶囊
    if user_patterns is not None:
        enabled = set(user_patterns) & _ALL_CAPSULE_KEYS
        allow_cross_bar = "ties" in user_patterns
    else:
        # 未指定胶囊 → 全部启用
        enabled = set(_ALL_CAPSULE_KEYS)
        allow_cross_bar = True

    # 改错题需要跨拍内边界的合并才能制造错误
    # 如果没有启用任何能产生跨拍内容的胶囊，改错题仍可基于拍内错误生成
    # 但如果只有纯拍子，则无法制造错误 → 转写作题
    has_non_trivial = bool(enabled - _BEHAVIOR_KEYS - {"double_eighth"})
    if n_correction > 0 and not has_non_trivial:
        n_writing += n_correction
        n_correction = 0

    total = n_writing + n_correction
    ts_pool = _get_ts_pool(difficulty, user_ts)
    ts_list = _pick_time_signatures(total, ts_pool)

    sections: list[str] = ["# 音值组合\n"]

    if n_writing > 0:
        for i in range(n_writing):
            ts_key = ts_list[i]
            cfg = _TS[ts_key]
            single_pats = _build_single_patterns(ts_key, enabled)
            multi_pats = _build_multi_patterns(ts_key, enabled)
            q_lily, a_lily = _generate_writing_item(
                ts_key, single_pats, multi_pats, n_bars, allow_cross_bar,
            )
            if i == 0:
                sections.extend([
                    "## [2分]",
                    "按照指定拍号，为下列音符划分小节并写出正确的音值组合。"
                    f"拍号：{cfg['display']}",
                ])
            else:
                sections.extend(["## [续]", f"拍号：{cfg['display']}"])
            sections.extend([
                "> 仅试题:", _wrap_lily(q_lily),
                "> 单线谱: 2",
                "> 答案:", _wrap_lily(a_lily), "",
            ])

    if n_correction > 0:
        for i in range(n_correction):
            ts_key = ts_list[n_writing + i]
            cfg = _TS[ts_key]
            single_pats = _build_single_patterns(ts_key, enabled)
            multi_pats = _build_multi_patterns(ts_key, enabled)
            q_lily, a_lily = _generate_correction_item(
                ts_key, single_pats, multi_pats, n_bars,
            )
            if i == 0:
                sections.extend([
                    "## [2分]",
                    "下列各组音值组合有误，请改正：",
                ])
            else:
                sections.append("## [续]")
            sections.extend([
                "> 仅试题:", _wrap_lily(q_lily),
                "> 单线谱: 2",
                "> 答案:", _wrap_lily(a_lily), "",
            ])

    return "\n".join(sections)
