"""简谱五线谱互译题 — 程序化旋律生成。

生成节拍 100% 正确的 jianpu-ly 代码和 LilyPond 代码，
支持 12 个大调和 12 个小调（共 24 个调）。
"""

import random

# ---------------------------------------------------------------------------
# 音高计算辅助
# ---------------------------------------------------------------------------
_LETTERS = ["c", "d", "e", "f", "g", "a", "b"]
_LETTER_SEMI = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}
_MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
_MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]


def _ly_oct(octave: int) -> str:
    """八度数字转 LilyPond 八度标记。3=无标记, 4=', 5='', 2=,"""
    if octave == 3:
        return ""
    if octave > 3:
        return "'" * (octave - 3)
    return "," * (3 - octave)


def _compute_scale(
    tonic_letter: str,
    tonic_acc: str,
    tonic_octave: int,
    intervals: list[int],
) -> list[tuple[str, int]]:
    """计算音阶 7 个音的 (ly_note_name, octave)。"""
    tonic_idx = _LETTERS.index(tonic_letter)
    acc_val = {"": 0, "is": 1, "es": -1}.get(tonic_acc, 0)
    tonic_abs = tonic_octave * 12 + _LETTER_SEMI[tonic_letter] + acc_val

    result: list[tuple[str, int]] = []
    for degree, interval in enumerate(intervals):
        target = tonic_abs + interval
        letter = _LETTERS[(tonic_idx + degree) % 7]
        base_semi = _LETTER_SEMI[letter]
        octave = round((target - base_semi) / 12)
        diff = target - (octave * 12 + base_semi)

        if diff == 0:
            name = letter
        elif diff == 1:
            name = letter + "is"
        elif diff == -1:
            name = letter + "es"
        elif diff == 2:
            name = letter + "isis"
        elif diff == -2:
            name = letter + "eses"
        else:
            raise ValueError(f"音阶计算异常: letter={letter}, diff={diff}")
        result.append((name, octave))
    return result


def _build_pool(
    scale: list[tuple[str, int]], is_minor: bool
) -> list[tuple[str, str]]:
    """构建 11 音符池 (jianpu_name, ly_absolute_note)。

    大调: 5, 6, 7, | 1 2 3 4 5 6 7 | 1'
    小调: 3, 4, 5, | 6 7 1 2 3 4 5 | 6'
    """
    if is_minor:
        jp = ["3,", "4,", "5,", "6", "7", "1", "2", "3", "4", "5", "6'"]
        low_degs = [4, 5, 6]   # 小调低音区: 度 3,4,5（scale 索引 4,5,6）
    else:
        jp = ["5,", "6,", "7,", "1", "2", "3", "4", "5", "6", "7", "1'"]
        low_degs = [4, 5, 6]   # 大调低音区: 度 5,6,7（scale 索引 4,5,6）

    pool: list[tuple[str, str]] = []
    # 低八度 3 个音
    for i, deg in enumerate(low_degs):
        name, oct = scale[deg]
        pool.append((jp[i], name + _ly_oct(oct - 1)))
    # 主八度 7 个音
    for i in range(7):
        name, oct = scale[i]
        pool.append((jp[i + 3], name + _ly_oct(oct)))
    # 高八度 1 个音
    name, oct = scale[0]
    pool.append((jp[10], name + _ly_oct(oct + 1)))
    return pool


# ---------------------------------------------------------------------------
# 24 调配置：(key_id, jianpu_key, ly_key_cmd, letter, acc, octave, is_minor)
# 八度规则：字母 c/d/e → 八度 4，f/g/a/b → 八度 3
# ---------------------------------------------------------------------------
_KEY_DEFS: list[tuple[str, str, str, str, str, int, bool]] = [
    # 12 大调
    ("C",   "1=C",  r"\key c \major",   "c", "",   4, False),
    ("bD",  "1=bD", r"\key des \major", "d", "es", 4, False),
    ("D",   "1=D",  r"\key d \major",   "d", "",   4, False),
    ("bE",  "1=bE", r"\key ees \major", "e", "es", 4, False),
    ("E",   "1=E",  r"\key e \major",   "e", "",   4, False),
    ("F",   "1=F",  r"\key f \major",   "f", "",   3, False),
    ("bG",  "1=bG", r"\key ges \major", "g", "es", 3, False),
    ("G",   "1=G",  r"\key g \major",   "g", "",   3, False),
    ("bA",  "1=bA", r"\key aes \major", "a", "es", 3, False),
    ("A",   "1=A",  r"\key a \major",   "a", "",   3, False),
    ("bB",  "1=bB", r"\key bes \major", "b", "es", 3, False),
    ("B",   "1=B",  r"\key b \major",   "b", "",   3, False),
    # 12 小调
    ("am",  "6=A",  r"\key a \minor",   "a", "",   3, True),
    ("dm",  "6=D",  r"\key d \minor",   "d", "",   4, True),
    ("gm",  "6=G",  r"\key g \minor",   "g", "",   3, True),
    ("cm",  "6=C",  r"\key c \minor",   "c", "",   4, True),
    ("fm",  "6=F",  r"\key f \minor",   "f", "",   3, True),
    ("bbm", "6=bB", r"\key bes \minor", "b", "es", 3, True),
    ("bem", "6=bE", r"\key ees \minor", "e", "es", 4, True),
    ("em",  "6=E",  r"\key e \minor",   "e", "",   4, True),
    ("bm",  "6=B",  r"\key b \minor",   "b", "",   3, True),
    ("#fm", "6=#F", r"\key fis \minor", "f", "is", 3, True),
    ("#cm", "6=#C", r"\key cis \minor", "c", "is", 4, True),
    ("#gm", "6=#G", r"\key gis \minor", "g", "is", 3, True),
]

# ---------------------------------------------------------------------------
# 构建运行时查找表
# ---------------------------------------------------------------------------
KEYS: list[str] = []
_JIANPU_KEY: dict[str, str] = {}
_LY_KEY_CMD: dict[str, str] = {}
_NP: dict[str, list[tuple[str, str]]] = {}
_IS_MINOR: dict[str, bool] = {}

for _kid, _jpk, _lyk, _let, _acc, _oct, _min in _KEY_DEFS:
    KEYS.append(_kid)
    _JIANPU_KEY[_kid] = _jpk
    _LY_KEY_CMD[_kid] = _lyk
    _IS_MINOR[_kid] = _min
    _scale = _compute_scale(
        _let, _acc, _oct,
        _MINOR_INTERVALS if _min else _MAJOR_INTERVALS,
    )
    _NP[_kid] = _build_pool(_scale, _min)

MAJOR_KEYS = [k for k in KEYS if not _IS_MINOR[k]]
MINOR_KEYS = [k for k in KEYS if _IS_MINOR[k]]

_TONIC = 3  # 主音在音符池中的索引（大调=1，小调=6）

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
_POOL_SIZE = 11  # 每个调的音符池大小


def _gen_melody(n_bars: int, time_sig: str) -> list[list[tuple[int, float, bool]]]:
    """生成旋律（音符池索引 + 时值 + 是否休止）。"""
    pats = _R4 if time_sig == "4/4" else _R3
    last_pats = _LAST4 if time_sig == "4/4" else _LAST3

    bars: list[list[tuple[int, float, bool]]] = []
    cur = _TONIC

    for bi in range(n_bars):
        is_last = bi == n_bars - 1
        pat = random.choice(last_pats if is_last else pats)
        bar: list[tuple[int, float, bool]] = []

        for ni, dur in enumerate(pat):
            if is_last and ni == len(pat) - 1:
                bar.append((_TONIC, dur, False))
                cur = _TONIC
            elif 0 < bi < n_bars - 1 and dur <= 1 and random.random() < 0.1:
                bar.append((cur, dur, True))
            else:
                step = random.choice([-2, -1, -1, 0, 0, 1, 1, 2])
                cur = max(0, min(_POOL_SIZE - 1, cur + step))
                bar.append((cur, dur, False))

        bars.append(bar)
    return bars


def _to_jianpu(
    bars: list[list[tuple[int, float, bool]]],
    key: str,
    ts: str,
    with_staff: bool = False,
) -> str:
    """旋律 → jianpu-ly 代码。"""
    pool = _NP[key]
    lines: list[str] = []
    if with_staff:
        lines.append("WithStaff")
    lines.append(_JIANPU_KEY[key])
    lines.append(ts)

    bar_strs: list[str] = []
    for bar in bars:
        tokens: list[str] = []
        for idx, dur, rest in bar:
            if rest:
                tokens.append("q0" if dur == 0.5 else "0")
            else:
                tokens.append(_fmt_jp(pool[idx][0], dur))
        bar_strs.append(" ".join(tokens))
    lines.append(" | ".join(bar_strs) + " |")
    return "\n".join(lines)


def _to_lilypond(
    bars: list[list[tuple[int, float, bool]]], key: str, ts: str
) -> str:
    """旋律 → LilyPond 代码。"""
    pool = _NP[key]
    bar_strs: list[str] = []
    for bar in bars:
        tokens: list[str] = []
        for idx, dur, rest in bar:
            if rest:
                tokens.append(f"r{_LY_DUR[dur]}")
            else:
                tokens.append(_fmt_ly(pool[idx][1], dur))
        bar_strs.append(" ".join(tokens))

    body = " | ".join(bar_strs) + " |"
    return "{\n" + f"  {_LY_KEY_CMD[key]} \\time {ts}\n" + f"  {body}\n" + "}"


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

    # 打乱调号分配，大小调混合
    key_pool = (KEYS * ((n_q // len(KEYS)) + 1))[:n_q]
    random.shuffle(key_pool)
    ts_choices = ["4/4", "3/4"]

    parts = ["# 简谱五线谱互译\n"]

    for i in range(n_q):
        key = key_pool[i]
        ts = random.choice(ts_choices)
        melody = _gen_melody(n_bars, ts)

        if i < n_jp2staff:
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
            ly_q = _to_lilypond(melody, key, ts)
            jp_a = _to_jianpu(melody, key, ts, with_staff=True)
            parts.append(
                f"## [2分]\n"
                f"将下列五线谱译为简谱（{_JIANPU_KEY[key]}）：\n"
                f"```lilypond\n{ly_q}\n```\n"
                f"> 行数: 1\n"
                f"> 答案:\n"
                f"```jianpu\n{jp_a}\n```\n"
            )

    return "\n".join(parts)
