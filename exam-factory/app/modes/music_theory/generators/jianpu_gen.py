"""简谱五线谱互译题 — 程序化旋律生成。

生成节拍 100% 正确的 jianpu-ly 代码和 LilyPond 代码，
支持 24 个调、3 个难度级别、自动谱号选择。
"""

import random

# ---------------------------------------------------------------------------
# 音高计算
# ---------------------------------------------------------------------------
_LETTERS = ["c", "d", "e", "f", "g", "a", "b"]
_LETTER_SEMI = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}
_MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
_MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]


def _ly_oct(octave: int) -> str:
    """八度数字 → LilyPond 八度标记 (3=无, 4=', 2=,)。"""
    if octave == 3:
        return ""
    return "'" * (octave - 3) if octave > 3 else "," * (3 - octave)


def _compute_scale(
    tonic_letter: str, tonic_acc: str, tonic_octave: int, intervals: list[int],
) -> list[tuple[str, int]]:
    """计算音阶 7 个音 → [(ly_name, octave), ...]。"""
    tonic_idx = _LETTERS.index(tonic_letter)
    acc_val = {"": 0, "is": 1, "es": -1}.get(tonic_acc, 0)
    tonic_abs = tonic_octave * 12 + _LETTER_SEMI[tonic_letter] + acc_val

    result: list[tuple[str, int]] = []
    for degree, interval in enumerate(intervals):
        target = tonic_abs + interval
        letter = _LETTERS[(tonic_idx + degree) % 7]
        base = _LETTER_SEMI[letter]
        octave = round((target - base) / 12)
        diff = target - (octave * 12 + base)
        suffix = {0: "", 1: "is", -1: "es", 2: "isis", -2: "eses"}[diff]
        result.append((letter + suffix, octave))
    return result


def _build_pool(
    scale: list[tuple[str, int]], is_minor: bool,
) -> list[tuple[str, str]]:
    """构建 11 音符池 (jianpu_name, ly_absolute_note)。"""
    if is_minor:
        jp = ["3,", "4,", "5,", "6", "7", "1", "2", "3", "4", "5", "6'"]
    else:
        jp = ["5,", "6,", "7,", "1", "2", "3", "4", "5", "6", "7", "1'"]
    low_degs = [4, 5, 6]
    pool: list[tuple[str, str]] = []
    for i, deg in enumerate(low_degs):
        n, o = scale[deg]
        pool.append((jp[i], n + _ly_oct(o - 1)))
    for i in range(7):
        n, o = scale[i]
        pool.append((jp[i + 3], n + _ly_oct(o)))
    n, o = scale[0]
    pool.append((jp[10], n + _ly_oct(o + 1)))
    return pool


# ---------------------------------------------------------------------------
# 24 调定义 (key_id, jianpu_key, ly_key_cmd, letter, acc, octave, is_minor)
# ---------------------------------------------------------------------------
_KEY_DEFS: list[tuple[str, str, str, str, str, int, bool]] = [
    # 高音谱号统一八度 4，低音谱号由 _bass_octave() 计算
    ("C",   "1=C",  r"\key c \major",   "c", "",   4, False),
    ("bD",  "1=bD", r"\key des \major", "d", "es", 4, False),
    ("D",   "1=D",  r"\key d \major",   "d", "",   4, False),
    ("bE",  "1=bE", r"\key ees \major", "e", "es", 4, False),
    ("E",   "1=E",  r"\key e \major",   "e", "",   4, False),
    ("F",   "1=F",  r"\key f \major",   "f", "",   4, False),
    ("bG",  "1=bG", r"\key ges \major", "g", "es", 4, False),
    ("G",   "1=G",  r"\key g \major",   "g", "",   4, False),
    ("bA",  "1=bA", r"\key aes \major", "a", "es", 4, False),
    ("A",   "1=A",  r"\key a \major",   "a", "",   4, False),
    ("bB",  "1=bB", r"\key bes \major", "b", "es", 4, False),
    ("B",   "1=B",  r"\key b \major",   "b", "",   4, False),
    ("am",  "6=A",  r"\key a \minor",   "a", "",   4, True),
    ("dm",  "6=D",  r"\key d \minor",   "d", "",   4, True),
    ("gm",  "6=G",  r"\key g \minor",   "g", "",   4, True),
    ("cm",  "6=C",  r"\key c \minor",   "c", "",   4, True),
    ("fm",  "6=F",  r"\key f \minor",   "f", "",   4, True),
    ("bbm", "6=bB", r"\key bes \minor", "b", "es", 4, True),
    ("bem", "6=bE", r"\key ees \minor", "e", "es", 4, True),
    ("em",  "6=E",  r"\key e \minor",   "e", "",   4, True),
    ("bm",  "6=B",  r"\key b \minor",   "b", "",   4, True),
    ("#fm", "6=#F", r"\key fis \minor", "f", "is", 4, True),
    ("#cm", "6=#C", r"\key cis \minor", "c", "is", 4, True),
    ("#gm", "6=#G", r"\key gis \minor", "g", "is", 4, True),
]

# 构建运行时查找表
KEYS: list[str] = []
_JIANPU_KEY: dict[str, str] = {}
_LY_KEY_CMD: dict[str, str] = {}
_NP: dict[str, list[tuple[str, str]]] = {}
_IS_MINOR: dict[str, bool] = {}
_KEY_DEF_MAP: dict[str, tuple] = {}

for _def in _KEY_DEFS:
    _kid = _def[0]
    KEYS.append(_kid)
    _JIANPU_KEY[_kid] = _def[1]
    _LY_KEY_CMD[_kid] = _def[2]
    _IS_MINOR[_kid] = _def[6]
    _KEY_DEF_MAP[_kid] = _def
    _s = _compute_scale(_def[3], _def[4], _def[5],
                        _MINOR_INTERVALS if _def[6] else _MAJOR_INTERVALS)
    _NP[_kid] = _build_pool(_s, _def[6])

MAJOR_KEYS = [k for k in KEYS if not _IS_MINOR[k]]
MINOR_KEYS = [k for k in KEYS if _IS_MINOR[k]]
_TONIC = 3
_POOL_SIZE = 11


def _bass_octave(letter: str) -> int:
    """低音谱号的主音八度: c/d/e/f → 3, g/a/b → 2。"""
    return 3 if letter in ("c", "d", "e", "f") else 2


def _get_pool(key: str, clef: str = "treble") -> list[tuple[str, str]]:
    """获取音符池（高音谱号用预计算，低音谱号重新计算八度）。"""
    if clef == "treble":
        return _NP[key]
    _, _, _, let, acc, _, is_minor = _KEY_DEF_MAP[key]
    scale = _compute_scale(
        let, acc, _bass_octave(let),
        _MINOR_INTERVALS if is_minor else _MAJOR_INTERVALS,
    )
    return _build_pool(scale, is_minor)


# ---------------------------------------------------------------------------
# 节奏型（按难度分级，累进包含）
# ---------------------------------------------------------------------------
# 基础节奏型（初级）
_P4_B = [[1,1,1,1], [2,1,1], [1,1,2], [1,2,1], [2,2], [3,1], [1,3]]
_P3_B = [[1,1,1], [2,1], [1,2]]
# 中级追加（含八分、附点）
_P4_M = [
    [1,0.5,0.5,1,1], [0.5,0.5,1,1,1], [1,1,0.5,0.5,1], [1,1,1,0.5,0.5],
    [1.5,0.5,1,1], [1,1,1.5,0.5],
]
_P3_M = [[1,0.5,0.5,1], [0.5,0.5,1,1], [1.5,0.5,1]]
_P2_M = [[1,1], [0.5,0.5,1], [1,0.5,0.5], [0.5,0.5,0.5,0.5], [1.5,0.5]]
# 高级追加（含十六分、附点八分）
_P4_A = [
    [0.25,0.25,0.5,1,1,1], [1,0.25,0.25,0.5,1,1], [1,1,0.25,0.25,0.5,1],
    [0.75,0.25,1,1,1], [1,1,0.75,0.25,1],
    [0.5,0.5,0.5,0.5,1,1], [0.5,0.5,0.25,0.25,0.5,1,1],
]
_P3_A = [[0.25,0.25,0.5,1,1], [1,0.25,0.25,0.5,1], [0.75,0.25,1,1]]
_P2_A = [
    [0.25,0.25,0.5,1], [1,0.25,0.25,0.5], [0.75,0.25,1],
    [0.25,0.25,0.25,0.25,1],
]
_P68 = [
    [1.5,1.5], [0.5,0.5,0.5,0.5,0.5,0.5], [1,0.5,1,0.5],
    [1.5,0.5,0.5,0.5], [0.5,0.5,0.5,1.5], [1,0.5,0.5,1], [0.5,1,0.5,1],
]

# 汇总（累进）
_PATTERNS: dict[str, dict[str, list]] = {
    "初级": {"4/4": _P4_B, "3/4": _P3_B},
    "中级": {"4/4": _P4_B + _P4_M, "3/4": _P3_B + _P3_M, "2/4": _P2_M},
    "高级": {
        "4/4": _P4_B + _P4_M + _P4_A, "3/4": _P3_B + _P3_M + _P3_A,
        "2/4": _P2_M + _P2_A, "6/8": _P68,
    },
}
# 末小节节奏（各拍号通用）
_LAST: dict[str, list] = {
    "4/4": [[1,1,1,1], [1,3], [1,1,2], [2,2]],
    "3/4": [[1,1,1], [1,2], [3]],
    "2/4": [[1,1], [2], [0.5,0.5,1]],
    "6/8": [[1.5,1.5], [0.5,0.5,0.5,1.5], [3]],
}

# 可用调号（按难度）
_DIFF_KEYS: dict[str, list[str]] = {
    "初级": ["C", "G", "F", "D", "bB"],
    "中级": MAJOR_KEYS + ["am", "dm", "em", "gm"],
    "高级": KEYS,
}
# 可用拍号
_DIFF_TS: dict[str, list[str]] = {
    "初级": ["4/4", "3/4"],
    "中级": ["4/4", "3/4", "2/4"],
    "高级": ["4/4", "3/4", "2/4", "6/8"],
}

# ---------------------------------------------------------------------------
# 时值转换
# ---------------------------------------------------------------------------
_LY_DUR: dict[float, str] = {
    0.25: "16", 0.5: "8", 0.75: "8.", 1: "4", 1.5: "4.", 2: "2", 3: "2.", 4: "1",
}


def _fmt_jp(jp: str, dur: float) -> str:
    """jianpu 音符 + 时值。"""
    if dur == 0.25:
        return f"s{jp}"
    if dur == 0.5:
        return f"q{jp}"
    if dur == 0.75:
        return f"q{jp}."
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


_REST_JP: dict[float, str] = {0.25: "s0", 0.5: "q0", 1: "0"}


# ---------------------------------------------------------------------------
# 旋律生成
# ---------------------------------------------------------------------------
def _gen_melody(
    n_bars: int, time_sig: str, difficulty: str,
) -> list[list[tuple[int, float, bool]]]:
    """生成旋律（音符池索引 + 时值 + 是否休止）。"""
    pats = _PATTERNS.get(difficulty, _PATTERNS["中级"]).get(time_sig, _P4_B)
    last_pats = _LAST.get(time_sig, _LAST["4/4"])

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
            elif (0 < bi < n_bars - 1 and dur in _REST_JP
                  and random.random() < 0.1):
                bar.append((cur, dur, True))
            else:
                step = random.choice([-2, -1, -1, 0, 0, 1, 1, 2])
                cur = max(0, min(_POOL_SIZE - 1, cur + step))
                bar.append((cur, dur, False))
        bars.append(bar)
    return bars


# ---------------------------------------------------------------------------
# 输出格式
# ---------------------------------------------------------------------------
def _to_jianpu(
    bars: list[list[tuple[int, float, bool]]],
    key: str, ts: str,
    pool: list[tuple[str, str]],
    with_staff: bool = False,
    clef: str = "treble",
) -> str:
    """旋律 → jianpu-ly 代码。"""
    lines: list[str] = []
    if clef != "treble":
        lines.append(f"CLEF:{clef}")
    if with_staff:
        lines.append("WithStaff")
    lines.append(_JIANPU_KEY[key])
    lines.append(ts)
    bar_strs: list[str] = []
    for bar in bars:
        tokens: list[str] = []
        for idx, dur, rest in bar:
            if rest:
                tokens.append(_REST_JP.get(dur, "0"))
            else:
                tokens.append(_fmt_jp(pool[idx][0], dur))
        bar_strs.append(" ".join(tokens))
    lines.append(" | ".join(bar_strs) + " |")
    return "\n".join(lines)


def _to_lilypond(
    bars: list[list[tuple[int, float, bool]]],
    key: str, ts: str,
    pool: list[tuple[str, str]],
    clef: str = "treble",
) -> str:
    """旋律 → LilyPond 代码。"""
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
    clef_cmd = f"\\clef {clef} " if clef != "treble" else ""
    return (
        "{\n"
        f"  {clef_cmd}{_LY_KEY_CMD[key]} \\time {ts}\n"
        f"  {body}\n"
        "}"
    )


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
        difficulty: 难度级别（初级/中级/高级）
        generation_params: {jianpu_n: 题数, jianpu_bars: 每题小节数}

    Returns:
        Markdown 格式的完整大题
    """
    if difficulty not in _DIFF_KEYS:
        difficulty = "中级"

    params = generation_params or {}
    n_q = int(params.get("jianpu_n", 5))
    n_bars = int(params.get("jianpu_bars", 4))
    n_jp2staff = (n_q + 1) // 2

    avail_keys = _DIFF_KEYS[difficulty]
    avail_ts = _DIFF_TS[difficulty]
    bass_prob = 0.3 if difficulty == "高级" else 0.0

    key_pool = (avail_keys * ((n_q // len(avail_keys)) + 1))[:n_q]
    random.shuffle(key_pool)

    parts = ["# 简谱五线谱互译\n"]

    for i in range(n_q):
        key = key_pool[i]
        ts = random.choice(avail_ts)
        use_bass = random.random() < bass_prob
        clef = "bass" if use_bass else "treble"
        pool = _get_pool(key, clef)
        melody = _gen_melody(n_bars, ts, difficulty)

        if i < n_jp2staff:
            # 简谱 → 五线谱：答案只给五线谱
            clef_hint = "（低音谱号）" if use_bass else ""
            jp_q = _to_jianpu(melody, key, ts, pool, with_staff=False)
            ly_a = _to_lilypond(melody, key, ts, pool, clef)
            parts.append(
                f"## [2分]\n"
                f"将下列简谱译为五线谱{clef_hint}：\n"
                f"> 仅试题:\n"
                f"```jianpu\n{jp_q}\n```\n"
                f"> 五线谱: 1\n"
                f"> 答案:\n"
                f"```lilypond\n{ly_a}\n```\n"
            )
        else:
            # 五线谱 → 简谱：答案只给简谱
            ly_q = _to_lilypond(melody, key, ts, pool, clef)
            jp_a = _to_jianpu(melody, key, ts, pool, with_staff=False)
            parts.append(
                f"## [2分]\n"
                f"将下列五线谱译为简谱（{_JIANPU_KEY[key]}）：\n"
                f"> 仅试题:\n"
                f"```lilypond\n{ly_q}\n```\n"
                f"> 行数: 1\n"
                f"> 答案:\n"
                f"```jianpu\n{jp_a}\n```\n"
            )

    return "\n".join(parts)
