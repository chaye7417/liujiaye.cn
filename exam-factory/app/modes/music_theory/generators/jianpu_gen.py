"""简谱五线谱互译题 — 程序化旋律生成。

生成节拍 100% 正确的 jianpu-ly 代码和 LilyPond 代码，
避免 AI 拍数计算错误。
"""

import random

# ---------------------------------------------------------------------------
# 调号配置
# ---------------------------------------------------------------------------
KEYS = ["C", "G", "F", "D", "bB"]

JIANPU_KEY = {"C": "1=C", "G": "1=G", "F": "1=F", "D": "1=D", "bB": "1=bB"}
LY_KEY_CMD = {
    "C": r"\key c \major", "G": r"\key g \major", "F": r"\key f \major",
    "D": r"\key d \major", "bB": r"\key bes \major",
}

# 每个调的音符池：(jianpu 写法, LilyPond 绝对音名)
# 索引 0-2 = 低八度 5,6,7；索引 3-9 = 基本 1-7；索引 10 = 高八度 1'
_NP = {
    "C": [
        ("5,", "g"), ("6,", "a"), ("7,", "b"),
        ("1", "c'"), ("2", "d'"), ("3", "e'"), ("4", "f'"),
        ("5", "g'"), ("6", "a'"), ("7", "b'"),
        ("1'", "c''"),
    ],
    "G": [
        ("5,", "d"), ("6,", "e"), ("7,", "fis"),
        ("1", "g"), ("2", "a"), ("3", "b"), ("4", "c'"),
        ("5", "d'"), ("6", "e'"), ("7", "fis'"),
        ("1'", "g'"),
    ],
    "F": [
        ("5,", "c"), ("6,", "d"), ("7,", "e"),
        ("1", "f"), ("2", "g"), ("3", "a"), ("4", "bes"),
        ("5", "c'"), ("6", "d'"), ("7", "e'"),
        ("1'", "f'"),
    ],
    "D": [
        ("5,", "a"), ("6,", "b"), ("7,", "cis'"),
        ("1", "d'"), ("2", "e'"), ("3", "fis'"), ("4", "g'"),
        ("5", "a'"), ("6", "b'"), ("7", "cis''"),
        ("1'", "d''"),
    ],
    "bB": [
        ("5,", "f"), ("6,", "g"), ("7,", "a"),
        ("1", "bes"), ("2", "c'"), ("3", "d'"), ("4", "ees'"),
        ("5", "f'"), ("6", "g'"), ("7", "a'"),
        ("1'", "bes'"),
    ],
}

_TONIC = 3  # 主音在音符池中的索引

# ---------------------------------------------------------------------------
# 节奏型（拍数列表，每组总和 = 每小节拍数）
# ---------------------------------------------------------------------------
_R4 = [  # 4/4 拍
    [1, 1, 1, 1],
    [2, 1, 1], [1, 1, 2], [1, 2, 1],
    [1, 0.5, 0.5, 1, 1], [0.5, 0.5, 1, 1, 1],
    [1, 1, 0.5, 0.5, 1], [1, 1, 1, 0.5, 0.5],
    [1.5, 0.5, 1, 1], [1, 1, 1.5, 0.5],
]
_R3 = [  # 3/4 拍
    [1, 1, 1],
    [2, 1], [1, 2],
    [1, 0.5, 0.5, 1], [0.5, 0.5, 1, 1],
    [1.5, 0.5, 1],
]
_LAST4 = [[1, 1, 1, 1], [1, 3], [1, 1, 2], [2, 2]]
_LAST3 = [[1, 1, 1], [1, 2], [3]]

# ---------------------------------------------------------------------------
# 时值转换
# ---------------------------------------------------------------------------
_LY_DUR = {0.5: "8", 1: "4", 1.5: "4.", 2: "2", 3: "2.", 4: "1"}


def _fmt_jp(jp: str, dur: float) -> str:
    """jianpu 音符 + 时值。"""
    if dur == 0.5:
        return f"q{jp}"
    if dur == 1:
        return jp
    if dur == 1.5:
        return f"{jp}."
    if dur == 2:
        return f"{jp} -"
    if dur == 3:
        return f"{jp} - ."
    if dur == 4:
        return f"{jp} - - -"
    return jp


def _fmt_ly(ly: str, dur: float) -> str:
    """LilyPond 音符 + 时值。"""
    return f"{ly}{_LY_DUR[dur]}"


# ---------------------------------------------------------------------------
# 旋律生成
# ---------------------------------------------------------------------------
def _gen_melody(n_bars: int, time_sig: str) -> list[list[tuple[int, float, bool]]]:
    """生成旋律（音符池索引 + 时值 + 是否休止）。"""
    pool_size = len(next(iter(_NP.values())))
    pats = _R4 if time_sig == "4/4" else _R3
    last_pats = _LAST4 if time_sig == "4/4" else _LAST3

    bars: list[list[tuple[int, float, bool]]] = []
    cur = _TONIC

    for bi in range(n_bars):
        is_last = bi == n_bars - 1
        pat = random.choice(last_pats if is_last else pats)
        bar: list[tuple[int, float, bool]] = []

        for ni, dur in enumerate(pat):
            # 末尾小节最后一个音 → 主音
            if is_last and ni == len(pat) - 1:
                bar.append((_TONIC, dur, False))
                cur = _TONIC
            # 小概率休止（仅四分或八分，非首末小节）
            elif 0 < bi < n_bars - 1 and dur <= 1 and random.random() < 0.1:
                bar.append((cur, dur, True))
            else:
                step = random.choice([-2, -1, -1, 0, 0, 1, 1, 2])
                cur = max(0, min(pool_size - 1, cur + step))
                bar.append((cur, dur, False))

        bars.append(bar)
    return bars


def _to_jianpu(bars: list, key: str, ts: str, with_staff: bool = False) -> str:
    """旋律 → jianpu-ly 代码。"""
    pool = _NP[key]
    lines = []
    if with_staff:
        lines.append("WithStaff")
    lines.append(JIANPU_KEY[key])
    lines.append(ts)

    bar_strs = []
    for bar in bars:
        tokens = []
        for idx, dur, rest in bar:
            if rest:
                tokens.append("q0" if dur == 0.5 else "0")
            else:
                tokens.append(_fmt_jp(pool[idx][0], dur))
        bar_strs.append(" ".join(tokens))
    lines.append(" | ".join(bar_strs) + " |")
    return "\n".join(lines)


def _to_lilypond(bars: list, key: str, ts: str) -> str:
    """旋律 → LilyPond 代码。"""
    pool = _NP[key]
    bar_strs = []
    for bar in bars:
        tokens = []
        for idx, dur, rest in bar:
            if rest:
                tokens.append(f"r{_LY_DUR[dur]}")
            else:
                tokens.append(_fmt_ly(pool[idx][1], dur))
        bar_strs.append(" ".join(tokens))

    body = " | ".join(bar_strs) + " |"
    return "{\n" + f"  {LY_KEY_CMD[key]} \\time {ts}\n" + f"  {body}\n" + "}"


# ---------------------------------------------------------------------------
# 公共接口
# ---------------------------------------------------------------------------
def generate_jianpu(
    section_num: str = "",
    difficulty: str = "中级",
    generation_params: dict | None = None,
) -> str:
    """生成简谱五线谱互译题 Markdown。

    Args:
        section_num: 大题序号（系统自动分配）
        difficulty: 难度级别
        generation_params: {jianpu_n: 题数, jianpu_bars: 每题小节数}

    Returns:
        Markdown 格式的完整大题
    """
    params = generation_params or {}
    n_q = int(params.get("jianpu_n", 5))
    n_bars = int(params.get("jianpu_bars", 4))
    n_jp2staff = (n_q + 1) // 2  # 简→五 题数

    # 打乱调号分配
    key_pool = (KEYS * ((n_q // len(KEYS)) + 1))[:n_q]
    random.shuffle(key_pool)
    ts_choices = ["4/4", "3/4"]

    parts = ["# 简谱五线谱互译\n"]

    for i in range(n_q):
        key = key_pool[i]
        ts = random.choice(ts_choices)
        melody = _gen_melody(n_bars, ts)

        if i < n_jp2staff:
            # 简谱→五线谱
            jp_q = _to_jianpu(melody, key, ts, with_staff=False)
            jp_a = _to_jianpu(melody, key, ts, with_staff=True)
            parts.append(
                f"## [2分]\n"
                f"将下列简谱译为五线谱：\n"
                f"```jianpu\n{jp_q}\n```\n"
                f"> 五线谱: 1\n"
                f"> 答案:\n"
                f"```jianpu\n{jp_a}\n```\n"
            )
        else:
            # 五线谱→简谱
            ly_q = _to_lilypond(melody, key, ts)
            jp_a = _to_jianpu(melody, key, ts, with_staff=True)
            parts.append(
                f"## [2分]\n"
                f"将下列五线谱译为简谱（{JIANPU_KEY[key]}）：\n"
                f"```lilypond\n{ly_q}\n```\n"
                f"> 行数: 1\n"
                f"> 答案:\n"
                f"```jianpu\n{jp_a}\n```\n"
            )

    return "\n".join(parts)
