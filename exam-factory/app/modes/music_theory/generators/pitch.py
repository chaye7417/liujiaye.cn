"""音程构成 / 和弦构成 / 音阶写作 题目生成器。"""

import random
from typing import Optional

from ..knowledge.data import (
    INTERVALS,
    CHORD_TYPES,
    CHORD_MEMBER_NAMES,
    EXAM_TRIAD_TYPES,
    EXAM_SEVENTH_TYPES,
    EXAM_SCALE_TYPES_BASIC,
    EXAM_SCALE_TYPES_INTERMEDIATE,
    EXAM_SCALE_TYPES_ADVANCED,
    SCALE_PATTERNS,
    CHINESE_NUMS,
)
from ..knowledge.theory import Note, build_interval, build_chord_from_member, build_scale


# ---------------------------------------------------------------------------
# 根音池（按难度分级）
# ---------------------------------------------------------------------------
_ROOTS_BASIC = [
    Note("C", 0, 4), Note("D", 0, 4), Note("E", 0, 4),
    Note("F", 0, 4), Note("G", 0, 4), Note("A", 0, 3), Note("B", 0, 3),
    Note("F", 0, 3), Note("G", 0, 3),
    Note("B", -1, 4), Note("E", -1, 4), Note("F", 1, 4),
]

_ROOTS_INTERMEDIATE = _ROOTS_BASIC + [
    Note("C", 1, 4), Note("A", -1, 4), Note("D", -1, 4),
    Note("G", -1, 4), Note("A", 0, 4), Note("B", 0, 4),
    Note("D", 0, 3), Note("E", 0, 3),
    Note("B", -1, 3), Note("A", -1, 3),
]

_ROOTS_ADVANCED = _ROOTS_INTERMEDIATE + [
    Note("G", 1, 4), Note("D", 1, 4), Note("A", 1, 3),
    Note("E", 1, 4), Note("C", -1, 4), Note("F", -1, 4),
]

# 音程池（按难度分级）
_INTERVALS_BASIC = [
    "纯四度", "纯五度", "大二度", "小二度", "大三度", "小三度",
    "大六度", "小六度", "纯八度",
]

_INTERVALS_INTERMEDIATE = _INTERVALS_BASIC + [
    "大七度", "小七度", "增四度", "减五度", "增二度",
]

_INTERVALS_ADVANCED = _INTERVALS_INTERMEDIATE + [
    "增五度", "减三度", "增六度", "减七度", "增三度",
]

# 音阶主音池（按难度分级）
_SCALE_TONICS_BASIC = [
    Note("C", 0, 4), Note("G", 0, 4), Note("D", 0, 4),
    Note("F", 0, 4), Note("B", -1, 4), Note("E", -1, 4),
    Note("A", 0, 4),
]

_SCALE_TONICS_INTERMEDIATE = _SCALE_TONICS_BASIC + [
    Note("A", -1, 4), Note("E", 0, 4), Note("B", 0, 3),
    Note("D", -1, 4), Note("F", 1, 4),
]

_SCALE_TONICS_ADVANCED = _SCALE_TONICS_INTERMEDIATE + [
    Note("G", -1, 4), Note("C", 1, 4), Note("G", 1, 3),
]


def _get_roots(difficulty: str) -> list[Note]:
    """根据难度返回根音池。"""
    if difficulty == "高级":
        return _ROOTS_ADVANCED
    elif difficulty == "中级":
        return _ROOTS_INTERMEDIATE
    return _ROOTS_BASIC


def _get_intervals(difficulty: str) -> list[str]:
    """根据难度返回音程池。"""
    if difficulty == "高级":
        return _INTERVALS_ADVANCED
    elif difficulty == "中级":
        return _INTERVALS_INTERMEDIATE
    return _INTERVALS_BASIC


# ---------------------------------------------------------------------------
# 音程构成
# ---------------------------------------------------------------------------
def generate_intervals(
    section_num: str,
    n: int = 10,
    difficulty: str = "中级",
    **kwargs,
) -> str:
    """生成音程构成题的完整 Markdown（含 LilyPond 谱例 + 答案）。

    Args:
        section_num: 大题编号
        n: 音程数量（默认 10）
        difficulty: 难度级别
    """
    root_pool = _get_roots(difficulty)
    interval_pool = _get_intervals(difficulty)
    half = n // 2

    questions: list[tuple[Note, str, Note]] = []
    used_combos: set[tuple[str, int, str]] = set()

    for _ in range(n):
        for _attempt in range(50):
            root = random.choice(root_pool)
            interval = random.choice(interval_pool)
            combo = (root.letter, root.accidental, interval)
            if combo in used_combos:
                continue
            try:
                target = build_interval(root, interval)
                used_combos.add(combo)
                questions.append((root, interval, target))
                break
            except ValueError:
                continue

    # LilyPond
    lily_lines = [
        "```lilypond",
        "{",
        "  \\clef treble",
        "  \\omit Staff.TimeSignature",
        "  \\omit Staff.BarLine",
    ]
    for i, (root, interval, _) in enumerate(questions):
        lily_lines.append(
            f'  {root.to_lilypond()}1^\\markup {{ \\small "{interval}" }}'
        )
        if i == half - 1 and n > 5:
            lily_lines.append('  \\bar "" \\break')
    lily_lines.append("}")
    lily_lines.append("```")

    # 答案
    answers = [
        f"({i+1}) {root.to_lilypond()}-{target.to_lilypond()}"
        for i, (root, _, target) in enumerate(questions)
    ]

    md_parts = [
        f"# {section_num}、音程构成\n",
        "## [10分]",
        "以下列音为根音构成指定音程：",
        *lily_lines,
        "> 五线谱: 2",
        "> 答案: " + " ".join(answers),
    ]
    return "\n".join(md_parts)


# ---------------------------------------------------------------------------
# 和弦构成
# ---------------------------------------------------------------------------
def generate_chords(
    section_num: str,
    n: int = 10,
    difficulty: str = "中级",
    **kwargs,
) -> str:
    """生成和弦构成题的完整 Markdown。

    Args:
        section_num: 大题编号
        n: 和弦数量（默认 10）
        difficulty: 难度级别
    """
    root_pool = _get_roots(difficulty)

    # 确定可用和弦类型和成员位置
    if difficulty == "初级":
        chord_pool = EXAM_TRIAD_TYPES
        member_pool = [0, 1, 2]  # 根音、三音、五音
    elif difficulty == "中级":
        chord_pool = EXAM_TRIAD_TYPES + EXAM_SEVENTH_TYPES
        member_pool = [0, 1, 2, 3]
    else:
        chord_pool = EXAM_TRIAD_TYPES + EXAM_SEVENTH_TYPES
        member_pool = [0, 1, 2, 3]

    questions: list[tuple[Note, int, str, list[Note]]] = []
    used: set[tuple[str, int, str, int]] = set()

    for _ in range(n):
        for _attempt in range(80):
            given = random.choice(root_pool)
            chord_type = random.choice(chord_pool)
            is_seventh = len(CHORD_TYPES[chord_type]) == 3
            max_member = 3 if is_seventh else 2
            member_idx = random.choice([m for m in member_pool if m <= max_member])
            combo = (given.letter, given.accidental, chord_type, member_idx)
            if combo in used:
                continue
            try:
                chord_notes = build_chord_from_member(given, member_idx, chord_type)
                # 验证所有音的变化音在合理范围
                if all(-2 <= n.accidental <= 2 for n in chord_notes):
                    used.add(combo)
                    questions.append((given, member_idx, chord_type, chord_notes))
                    break
            except ValueError:
                continue

    # LilyPond（每行 2 个，共 5 行）
    lily_lines = [
        "```lilypond",
        "{",
        "  \\clef treble",
        "  \\omit Staff.TimeSignature",
        "  \\omit Staff.BarLine",
    ]
    for i, (given, member_idx, chord_type, _) in enumerate(questions):
        member_name = CHORD_MEMBER_NAMES[member_idx]
        label = f"以此音为{member_name}构成{chord_type}"
        lily_lines.append(
            f'  {given.to_lilypond()}1^\\markup {{ \\small "{label}" }}'
        )
        if i % 2 == 1 and i < len(questions) - 1:
            lily_lines.append('  \\bar "" \\break')
    lily_lines.append("}")
    lily_lines.append("```")

    # 答案
    answers = []
    for i, (_, _, _, chord_notes) in enumerate(questions):
        notes_str = "-".join(n.to_lilypond() for n in chord_notes)
        answers.append(f"({i+1}) {notes_str}")

    rows = (n + 1) // 2
    md_parts = [
        f"# {section_num}、和弦构成\n",
        "## [10分]",
        "以下列音为指定音构成和弦：",
        *lily_lines,
        f"> 五线谱: {rows}",
        "> 答案: " + " ".join(answers),
    ]
    return "\n".join(md_parts)


# ---------------------------------------------------------------------------
# 音阶写作
# ---------------------------------------------------------------------------
def _scale_display_name(tonic: Note, scale_type: str) -> str:
    """生成音阶题目的显示名称，如 'bE宫五声调式'。"""
    pentatonic = {"宫调式", "商调式", "角调式", "徵调式", "羽调式"}
    if scale_type in pentatonic:
        mode_name = scale_type[0]  # 宫/商/角/徵/羽
        return f"{tonic.to_chinese()}{mode_name}五声调式"
    return f"{tonic.to_chinese()}{scale_type}"


def generate_scales(
    section_num: str,
    n: int = 5,
    difficulty: str = "中级",
    **kwargs,
) -> str:
    """生成音阶写作题的完整 Markdown。

    Args:
        section_num: 大题编号
        n: 音阶数量（默认 5）
        difficulty: 难度级别
    """
    if difficulty == "高级":
        scale_pool = EXAM_SCALE_TYPES_ADVANCED
        tonic_pool = _SCALE_TONICS_ADVANCED
    elif difficulty == "中级":
        scale_pool = EXAM_SCALE_TYPES_INTERMEDIATE
        tonic_pool = _SCALE_TONICS_INTERMEDIATE
    else:
        scale_pool = EXAM_SCALE_TYPES_BASIC
        tonic_pool = _SCALE_TONICS_BASIC

    questions: list[tuple[Note, str, list[Note]]] = []
    used: set[tuple[str, int, str]] = set()

    # 非高级难度避免重升/重降号
    acc_limit = 2 if difficulty == "高级" else 1

    for _ in range(n):
        for _attempt in range(50):
            tonic = random.choice(tonic_pool)
            scale_type = random.choice(scale_pool)
            combo = (tonic.letter, tonic.accidental, scale_type)
            if combo in used:
                continue
            try:
                scale_notes = build_scale(tonic, scale_type)
                if all(-acc_limit <= note.accidental <= acc_limit
                       for note in scale_notes):
                    used.add(combo)
                    questions.append((tonic, scale_type, scale_notes))
                    break
            except ValueError:
                continue

    # 每个音阶一道题
    md_parts = [f"# {section_num}、音阶写作\n"]
    score_each = 10 // n if n > 0 else 2

    for i, (tonic, scale_type, scale_notes) in enumerate(questions):
        display = _scale_display_name(tonic, scale_type)
        is_melodic = "旋律" in scale_type

        if is_melodic:
            question_text = f"写出{display}音阶（上下行）"
        else:
            question_text = f"写出{display}音阶（上行）"

        # 答案：LilyPond 音符序列
        notes_lily = " ".join(note.to_lilypond() for note in scale_notes)

        if is_melodic:
            # 旋律小调下行 = 自然小调
            down_scale = build_scale(tonic, "自然小调")
            down_notes = list(reversed(down_scale))
            # 去掉第一个音（与上行最后一个音重复）
            down_lily = " ".join(note.to_lilypond() for note in down_notes[1:])
            notes_lily = notes_lily + " " + down_lily

        md_parts.extend([
            f"## [{score_each}分]",
            question_text,
            "> 五线谱: 1",
            f"> 答案: {notes_lily}",
            "",
        ])

    return "\n".join(md_parts)
