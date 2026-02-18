"""音值组合题目生成器 — 写作题 + 改错题。

Tick 系统：1 四分音符 = 12 ticks。
分组规则：
  - 小节线和强边界（半小节/复合拍组）处必须拆分
  - 拍内边界仅在音符起始于拍中间时才拆分
"""

import random
from typing import Optional

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
# 拍内节奏型模板
# ---------------------------------------------------------------------------
_P12: list[list[int]] = [
    [12], [6, 6], [9, 3], [3, 9],
    [3, 3, 6], [6, 3, 3], [3, 3, 3, 3], [3, 6, 3],
]

_P18: list[list[int]] = [
    [18], [12, 6], [6, 12], [6, 6, 6], [9, 9],
    [9, 3, 6], [6, 9, 3], [3, 3, 6, 6], [6, 6, 3, 3],
]

_P6: list[list[int]] = [[6], [3, 3]]

_P24: list[list[int]] = [
    [24], [12, 12], [12, 6, 6], [6, 6, 12],
    [6, 6, 6, 6], [18, 6], [6, 18],
]

# ---------------------------------------------------------------------------
# 拍号配置
# split_at = 强边界（半小节/复合拍组），始终拆分
# 拍内边界由 beat 大小自动计算，仅拆分起始于拍中间的音符
# ---------------------------------------------------------------------------
_TS: dict[str, dict] = {
    "2/4":  {"bar": 24, "beat": 12, "n_beats": 2, "split_at": [],       "patterns": _P12},
    "3/4":  {"bar": 36, "beat": 12, "n_beats": 3, "split_at": [],       "patterns": _P12},
    "4/4":  {"bar": 48, "beat": 12, "n_beats": 4, "split_at": [24],     "patterns": _P12},
    "6/8":  {"bar": 36, "beat": 18, "n_beats": 2, "split_at": [18],     "patterns": _P18},
    "9/8":  {"bar": 54, "beat": 18, "n_beats": 3, "split_at": [18, 36], "patterns": _P18},
    "12/8": {"bar": 72, "beat": 18, "n_beats": 4, "split_at": [36],     "patterns": _P18},
    "2/2":  {"bar": 48, "beat": 24, "n_beats": 2, "split_at": [],       "patterns": _P24},
    "3/8":  {"bar": 18, "beat": 6,  "n_beats": 3, "split_at": [],       "patterns": _P6},
    "5/4":  {"bar": 60, "beat": 12, "n_beats": 5, "split_at": [24],     "patterns": _P12},
}

_TS_BASIC = ["2/4", "3/4", "4/4"]
_TS_INTERMEDIATE = _TS_BASIC + ["3/8", "6/8", "2/2"]
_TS_ADVANCED = _TS_INTERMEDIATE + ["9/8", "12/8", "5/4"]


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


def _ticks_to_lily(ticks_with_ties: list[tuple[int, bool]]) -> str:
    """将 [(tick, needs_tie), ...] 转为 LilyPond 音符字符串。"""
    parts: list[str] = []
    for tick, tie_after in ticks_with_ties:
        if tick in _VALID_TICKS:
            ns = f"c'{_TICK_TO_LILY[tick]}"
            if tie_after:
                ns += "~"
            parts.append(ns)
        else:
            sub = _decompose_tick(tick)
            for j, st in enumerate(sub):
                ns = f"c'{_TICK_TO_LILY[st]}"
                if j < len(sub) - 1 or tie_after:
                    ns += "~"
                parts.append(ns)
    return " ".join(parts)


# ---------------------------------------------------------------------------
# 核心：从 flat ticks 推导正确分组（答案）
# ---------------------------------------------------------------------------
def _regroup(flat_ticks: list[int], ts_key: str) -> list[list[tuple[int, bool]]]:
    """将扁平 tick 序列按音值组合法则重新分组。

    拆分规则：
      1. 小节线处必须拆分
      2. 强边界（split_at）处必须拆分
      3. 拍内边界：仅当音符起始于拍中间时，在下一个拍线处拆分

    Args:
        flat_ticks: 扁平 tick 序列
        ts_key: 拍号

    Returns:
        小节列表，每小节是 [(tick, tie_after), ...] 列表
    """
    cfg = _TS[ts_key]
    bar_size = cfg["bar"]
    beat_size = cfg["beat"]
    strong_splits = cfg["split_at"]

    total = sum(flat_ticks)
    n_bars = total // bar_size

    # 绝对强边界（小节线 + split_at）
    strong_abs: set[int] = set()
    for bar_idx in range(n_bars + 1):
        base = bar_idx * bar_size
        if 0 < base < total:
            strong_abs.add(base)
        for sp in strong_splits:
            abs_sp = base + sp
            if 0 < abs_sp < total:
                strong_abs.add(abs_sp)

    # 遍历每个 tick，在边界处拆分
    result: list[tuple[int, bool]] = []
    pos = 0

    for tick in flat_ticks:
        end = pos + tick

        # 收集此音符需要拆分的所有点
        cuts: set[int] = set()

        # 1. 强边界（始终拆分）
        for b in strong_abs:
            if pos < b < end:
                cuts.add(b)

        # 2. 拍内边界（仅当起始于拍中间时）
        bar_start = (pos // bar_size) * bar_size
        beat_pos = (pos - bar_start) % beat_size
        if beat_pos != 0:
            next_beat = pos + (beat_size - beat_pos)
            if next_beat < end:
                cuts.add(next_beat)

        # 执行拆分
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
    bars: list[list[tuple[int, bool]]] = []
    current_bar: list[tuple[int, bool]] = []
    bar_pos = 0

    for tick, tie in result:
        current_bar.append((tick, tie))
        bar_pos += tick
        if bar_pos >= bar_size:
            bars.append(current_bar)
            current_bar = []
            bar_pos = 0

    if current_bar:
        bars.append(current_bar)

    return bars


# ---------------------------------------------------------------------------
# 序列生成
# ---------------------------------------------------------------------------
def _generate_flat(ts_key: str, n_bars: int) -> list[int]:
    """按拍生成正确节奏型，展平为 tick 列表。"""
    cfg = _TS[ts_key]
    flat: list[int] = []
    for _ in range(n_bars):
        for _ in range(cfg["n_beats"]):
            flat.extend(random.choice(cfg["patterns"]))
    return flat


def _merge_random(flat: list[int]) -> list[int]:
    """随机合并相邻音符（合并值必须是合法时值）。"""
    ticks = list(flat)
    for _ in range(len(ticks)):
        if len(ticks) < 3:
            break
        i = random.randint(0, len(ticks) - 2)
        merged = ticks[i] + ticks[i + 1]
        if merged in _VALID_TICKS:
            ticks = ticks[:i] + [merged] + ticks[i + 2:]
    return ticks


# ---------------------------------------------------------------------------
# 写作题
# ---------------------------------------------------------------------------
def _generate_writing_item(ts_key: str, n_bars: int) -> tuple[str, str]:
    """生成一道写作题。

    题目：合并后的音符（无拍号、无小节线）。
    答案：从题目推导的正确分组。
    """
    flat = _generate_flat(ts_key, n_bars)
    question_ticks = _merge_random(flat)

    q_notes = " ".join(f"c'{_TICK_TO_LILY[t]}" for t in question_ticks)
    q_lily = (
        f"\\omit Staff.TimeSignature \\omit Staff.BarLine "
        f"\\time {ts_key} \\clef treble {q_notes}"
    )

    answer_bars = _regroup(question_ticks, ts_key)
    a_parts = [f"\\time {ts_key}", "\\clef treble"]
    for idx, bar in enumerate(answer_bars):
        a_parts.append(_ticks_to_lily(bar))
        if idx < len(answer_bars) - 1:
            a_parts.append("|")
    a_lily = " ".join(a_parts)

    return q_lily, a_lily


# ---------------------------------------------------------------------------
# 改错题
# ---------------------------------------------------------------------------
def _generate_correction_item(ts_key: str, n_bars: int) -> tuple[str, str]:
    """生成一道改错题。

    题目：有拍号和小节线，但部分音符跨越分组边界。
    答案：从题目推导的正确分组。
    """
    cfg = _TS[ts_key]
    split_points = cfg["split_at"]
    beat_size = cfg["beat"]

    # 逐小节生成并制造错误
    error_bars: list[list[int]] = []
    for _ in range(n_bars):
        beat_ticks: list[int] = []
        for _ in range(cfg["n_beats"]):
            beat_ticks.extend(random.choice(cfg["patterns"]))

        # 尝试合并跨边界的相邻音符
        new_bar = list(beat_ticks)
        for _ in range(15):
            if len(new_bar) < 2:
                break
            i = random.randint(0, len(new_bar) - 2)
            merged = new_bar[i] + new_bar[i + 1]
            if merged not in _VALID_TICKS:
                continue
            pos = sum(new_bar[:i])
            end = pos + merged
            # 检查是否跨越强边界或拍线
            crosses_strong = any(pos < sp < end for sp in split_points)
            beat_pos = pos % beat_size
            crosses_beat = beat_pos != 0 and (pos + beat_size - beat_pos) < end
            if crosses_strong or crosses_beat:
                new_bar = new_bar[:i] + [merged] + new_bar[i + 2:]
                break
        error_bars.append(new_bar)

    # 题目：带拍号和小节线，但有错误分组
    q_parts = [f"\\time {ts_key}", "\\clef treble"]
    for idx, bar in enumerate(error_bars):
        notes = " ".join(f"c'{_TICK_TO_LILY[t]}" for t in bar)
        q_parts.append(notes)
        if idx < len(error_bars) - 1:
            q_parts.append("|")
    q_lily = " ".join(q_parts)

    # 答案：从题目的 flat 序列推导正确分组
    flat_from_error: list[int] = []
    for bar in error_bars:
        flat_from_error.extend(bar)
    answer_bars = _regroup(flat_from_error, ts_key)
    a_parts = [f"\\time {ts_key}", "\\clef treble"]
    for idx, bar in enumerate(answer_bars):
        a_parts.append(_ticks_to_lily(bar))
        if idx < len(answer_bars) - 1:
            a_parts.append("|")
    a_lily = " ".join(a_parts)

    return q_lily, a_lily


# ---------------------------------------------------------------------------
# 拍号选择
# ---------------------------------------------------------------------------
def _get_ts_pool(difficulty: str) -> list[str]:
    """根据难度返回可用拍号列表。"""
    if difficulty == "高级":
        return _TS_ADVANCED
    elif difficulty == "中级":
        return _TS_INTERMEDIATE
    return _TS_BASIC


def _pick_time_signatures(n: int, difficulty: str) -> list[str]:
    """为 n 道题选择拍号，尽量覆盖不同拍号。"""
    pool = _get_ts_pool(difficulty)
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
# Markdown 输出
# ---------------------------------------------------------------------------
def _wrap_lily(code: str) -> str:
    """包装 LilyPond 代码块。"""
    return f"```lilypond\n{{ {code} }}\n```"


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
        - rhythm_bars: 每题小节数（默认 2）

    Args:
        section_num: 大题编号
        difficulty: 难度级别
        generation_params: 额外参数
    """
    params = generation_params or {}
    n_writing = params.get("rhythm_writing_n", 3)
    n_correction = params.get("rhythm_correction_n", 2)
    n_bars = params.get("rhythm_bars", 2)

    total = n_writing + n_correction
    ts_list = _pick_time_signatures(total, difficulty)

    sections: list[str] = ["# 音值组合\n"]

    if n_writing > 0:
        sections.append("## [10分]")
        sections.append("按照指定拍号，为下列音符划分小节并写出正确的音值组合：")
        sections.append("")
        for i in range(n_writing):
            ts_key = ts_list[i]
            q_lily, a_lily = _generate_writing_item(ts_key, n_bars)
            sections.extend([
                f"**({i + 1})** 拍号：{ts_key}", "",
                "> 仅试题:", _wrap_lily(q_lily),
                "> 答案:", _wrap_lily(a_lily), "",
            ])

    if n_correction > 0:
        sections.append("## [10分]")
        sections.append("下列各组音值组合有误，请改正：")
        sections.append("")
        for i in range(n_correction):
            ts_key = ts_list[n_writing + i]
            q_lily, a_lily = _generate_correction_item(ts_key, n_bars)
            sections.extend([
                f"**({i + 1})**", "",
                "> 仅试题:", _wrap_lily(q_lily),
                "> 答案:", _wrap_lily(a_lily), "",
            ])

    return "\n".join(sections)
