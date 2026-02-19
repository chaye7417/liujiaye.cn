"""音值组合题目生成器 — 写作题 + 改错题。

Tick 系统：1 四分音符 = 12 ticks。
分组规则：
  - 小节线和强边界（半小节/复合拍组）处必须拆分
  - 拍内边界仅在音符起始于拍中间时才拆分
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
# 拍内节奏型模板（含连音符）
# ---------------------------------------------------------------------------
_P12: list[list[_Evt]] = [
    [12], [6, 6], [9, 3], [3, 9],
    [3, 3, 6], [6, 3, 3], [3, 3, 3, 3], [3, 6, 3],
    # 三连音（3 个八分音符占 1 拍）
    [(12, "\\tuplet 3/2 { c'8 c'8 c'8 }")],
]

_P18: list[list[_Evt]] = [
    [18], [12, 6], [6, 12], [6, 6, 6], [9, 9],
    [9, 3, 6], [6, 9, 3], [3, 3, 6, 6], [6, 6, 3, 3],
    # 二连音（2 个八分音符占 1 复拍）
    [(18, "\\tuplet 2/3 { c'8 c'8 }")],
    # 四连音（4 个八分音符占 1 复拍）
    [(18, "\\tuplet 4/3 { c'8 c'8 c'8 c'8 }")],
]

_P6: list[list[_Evt]] = [
    [6], [3, 3],
    # 三连音（3 个十六分音符占 1 拍）
    [(6, "\\tuplet 3/2 { c'16 c'16 c'16 }")],
]

_P24: list[list[_Evt]] = [
    [24], [12, 12], [12, 6, 6], [6, 6, 12],
    [6, 6, 6, 6], [18, 6], [6, 18],
    # 三连音（3 个四分音符占 1 拍）
    [(24, "\\tuplet 3/2 { c'4 c'4 c'4 }")],
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


def _ticks_to_lily(ticks_with_ties: list[tuple[_Evt, bool]]) -> str:
    """将 [(_Evt, needs_tie), ...] 转为 LilyPond 音符字符串。"""
    parts: list[str] = []
    for evt, tie_after in ticks_with_ties:
        if isinstance(evt, tuple):
            # 连音符 — 直接输出 LilyPond 字符串（不需要连线）
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

    Args:
        flat_ticks: 扁平事件序列（int 或 tuple）
        ts_key: 拍号

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
    strong_abs: set[int] = set()
    for bar_idx in range(n_bars + 1):
        base = bar_idx * bar_size
        if 0 < base < total:
            strong_abs.add(base)
        for sp in strong_splits:
            abs_sp = base + sp
            if 0 < abs_sp < total:
                strong_abs.add(abs_sp)

    # 遍历每个事件，在边界处拆分
    result: list[tuple[_Evt, bool]] = []
    pos = 0

    for evt in flat_ticks:
        tick = _evt_tick(evt)
        end = pos + tick

        if isinstance(evt, tuple):
            # 连音符是原子单元，永不拆分
            result.append((evt, False))
        else:
            # 普通音符 — 按边界拆分
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
# 序列生成
# ---------------------------------------------------------------------------
def _generate_flat(ts_key: str, n_bars: int) -> list[_Evt]:
    """按拍生成正确节奏型，展平为事件列表。"""
    cfg = _TS[ts_key]
    flat: list[_Evt] = []
    for _ in range(n_bars):
        for _ in range(cfg["n_beats"]):
            flat.extend(random.choice(cfg["patterns"]))
    return flat


def _merge_random(flat: list[_Evt]) -> list[_Evt]:
    """随机合并相邻普通音符（跳过连音符，合并值必须是合法时值）。"""
    ticks = list(flat)
    # 多次尝试以产生更多合并（更多同音连线）
    for _ in range(len(ticks) * 2):
        if len(ticks) < 3:
            break
        i = random.randint(0, len(ticks) - 2)
        # 跳过连音符
        if isinstance(ticks[i], tuple) or isinstance(ticks[i + 1], tuple):
            continue
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

    q_notes = " ".join(_evt_to_lily(t) for t in question_ticks)
    q_lily = (
        f"\\new RhythmicStaff {{ \\omit Score.BarNumber "
        f"\\omit Staff.TimeSignature \\omit Staff.BarLine "
        f"\\time {ts_key} {q_notes} }}"
    )

    answer_bars = _regroup(question_ticks, ts_key)
    bar_strs = [_ticks_to_lily(bar) for bar in answer_bars]
    a_lily = (
        f"\\new RhythmicStaff {{ \\omit Score.BarNumber "
        f"\\time {ts_key} {_join_bars(bar_strs)} }}"
    )

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
    error_bars: list[list[_Evt]] = []
    for _ in range(n_bars):
        beat_ticks: list[_Evt] = []
        for _ in range(cfg["n_beats"]):
            beat_ticks.extend(random.choice(cfg["patterns"]))

        # 尝试合并跨边界的相邻普通音符（允许多个错误）
        new_bar: list[_Evt] = list(beat_ticks)
        merge_count = 0
        for _ in range(25):
            if len(new_bar) < 2 or merge_count >= 3:
                break
            i = random.randint(0, len(new_bar) - 2)
            # 跳过连音符
            if isinstance(new_bar[i], tuple) or isinstance(new_bar[i + 1], tuple):
                continue
            merged = new_bar[i] + new_bar[i + 1]
            if merged not in _VALID_TICKS:
                continue
            pos = sum(_evt_tick(e) for e in new_bar[:i])
            end = pos + merged
            # 检查是否跨越强边界或拍线
            crosses_strong = any(pos < sp < end for sp in split_points)
            beat_pos = pos % beat_size
            crosses_beat = beat_pos != 0 and (pos + beat_size - beat_pos) < end
            if crosses_strong or crosses_beat:
                new_bar = new_bar[:i] + [merged] + new_bar[i + 2:]
                merge_count += 1
        error_bars.append(new_bar)

    # 题目：带拍号和小节线，但有错误分组
    q_bar_strs = [" ".join(_evt_to_lily(t) for t in bar) for bar in error_bars]
    q_lily = (
        f"\\new RhythmicStaff {{ \\omit Score.BarNumber "
        f"\\time {ts_key} {_join_bars(q_bar_strs)} }}"
    )

    # 答案：从题目的 flat 序列推导正确分组
    flat_from_error: list[_Evt] = []
    for bar in error_bars:
        flat_from_error.extend(bar)
    answer_bars = _regroup(flat_from_error, ts_key)
    a_bar_strs = [_ticks_to_lily(bar) for bar in answer_bars]
    a_lily = (
        f"\\new RhythmicStaff {{ \\omit Score.BarNumber "
        f"\\time {ts_key} {_join_bars(a_bar_strs)} }}"
    )

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
# LilyPond 输出辅助
# ---------------------------------------------------------------------------
_BARS_PER_LINE = 4

_RHYTHM_HEAD = "\\new RhythmicStaff {{ \\omit Score.BarNumber \\time {ts}"


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
        - rhythm_bars: 每题小节数（默认 8）

    Args:
        section_num: 大题编号
        difficulty: 难度级别
        generation_params: 额外参数
    """
    params = generation_params or {}
    n_writing = params.get("rhythm_writing_n", 3)
    n_correction = params.get("rhythm_correction_n", 2)
    n_bars = params.get("rhythm_bars", 8)

    total = n_writing + n_correction
    ts_list = _pick_time_signatures(total, difficulty)

    sections: list[str] = ["# 音值组合\n"]

    # 每道小题用独立的 ## 块（md2latex 每个 ## 只处理一对 仅试题/答案）
    if n_writing > 0:
        for i in range(n_writing):
            ts_key = ts_list[i]
            q_lily, a_lily = _generate_writing_item(ts_key, n_bars)
            if i == 0:
                sections.extend([
                    "## [2分]",
                    f"按照指定拍号，为下列音符划分小节并写出正确的音值组合。拍号：{ts_key}",
                ])
            else:
                sections.extend(["## [续]", f"拍号：{ts_key}"])
            sections.extend([
                "> 仅试题:", _wrap_lily(q_lily),
                "> 单线谱: 2",
                "> 答案:", _wrap_lily(a_lily), "",
            ])

    if n_correction > 0:
        for i in range(n_correction):
            ts_key = ts_list[n_writing + i]
            q_lily, a_lily = _generate_correction_item(ts_key, n_bars)
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
