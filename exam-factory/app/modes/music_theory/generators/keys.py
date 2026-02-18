"""音程调性判断 / 和弦调性判断 题目生成器。"""

import random

from ..knowledge.data import (
    INTERVALS,
    EXAM_TRIAD_TYPES,
    EXAM_SEVENTH_TYPES,
    CHORD_TYPES,
    CHINESE_NUMS,
)
from ..knowledge.theory import (
    Note,
    build_interval,
    build_chord,
    name_interval,
    identify_chord,
    find_keys_for_interval,
    find_keys_for_chord,
)


# ---------------------------------------------------------------------------
# 用于出题的根音池
# ---------------------------------------------------------------------------
_ROOTS = [
    Note("C", 0, 4), Note("D", 0, 4), Note("E", 0, 4),
    Note("F", 0, 4), Note("G", 0, 4), Note("A", 0, 4), Note("B", 0, 3),
    Note("C", 1, 4), Note("E", -1, 4), Note("F", 1, 4),
    Note("A", -1, 4), Note("B", -1, 4), Note("D", -1, 4),
]

# 适合出调性判断题的音程（结果数量适中，不会太多也不会太少）
_KEY_INTERVALS = [
    "大二度", "小二度", "大三度", "小三度",
    "纯四度", "纯五度", "大六度", "小六度",
    "大七度", "小七度", "增四度", "减五度", "增二度",
]


# ---------------------------------------------------------------------------
# 音程调性判断
# ---------------------------------------------------------------------------
def generate_interval_keys(
    section_num: str,
    n: int = 5,
    difficulty: str = "中级",
    **kwargs,
) -> str:
    """生成音程调性判断题的完整 Markdown。

    Args:
        section_num: 大题编号
        n: 题目数量（默认 5）
        difficulty: 难度级别
    """
    questions: list[tuple[Note, Note, str, list[dict]]] = []
    used: set[tuple[str, int, str, int]] = set()

    for _ in range(n):
        for _attempt in range(100):
            root = random.choice(_ROOTS)
            interval = random.choice(_KEY_INTERVALS)
            combo = (root.letter, root.accidental, interval)
            if (root.letter, root.accidental, interval, 0) in used:
                continue
            try:
                target = build_interval(root, interval)
                keys = find_keys_for_interval(root, target)
                # 确保至少有 2 个调能找到此音程（否则题目太简单）
                if len(keys) >= 2:
                    used.add((root.letter, root.accidental, interval, 0))
                    questions.append((root, target, interval, keys))
                    break
            except ValueError:
                continue

    score_each = 10 // n if n > 0 else 2
    md_parts = [f"# 音程调性判断\n"]

    for i, (note1, note2, interval, keys) in enumerate(questions):
        # LilyPond 谱例
        lily = "\n".join([
            "```lilypond",
            "{",
            "  \\clef treble",
            "  \\omit Staff.TimeSignature",
            f"  <{note1.to_lilypond()} {note2.to_lilypond()}>1",
            "}",
            "```",
        ])

        # 答案
        answer_parts = [
            f"{k['key']} {k['degrees']}级" for k in keys
        ]
        answer_str = "，".join(answer_parts)

        md_parts.extend([
            f"## [{score_each}分]",
            "判断下列音程可能属于哪些自然/和声调式，写出调名和音级：",
            lily,
            "> 行数: 3",
            f"> 答案: {answer_str}",
            "",
        ])

    return "\n".join(md_parts)


# ---------------------------------------------------------------------------
# 和弦调性判断
# ---------------------------------------------------------------------------
def generate_chord_keys(
    section_num: str,
    n: int = 5,
    difficulty: str = "中级",
    **kwargs,
) -> str:
    """生成和弦调性判断题的完整 Markdown。

    Args:
        section_num: 大题编号
        n: 题目数量（默认 5）
        difficulty: 难度级别
    """
    if difficulty == "初级":
        chord_pool = EXAM_TRIAD_TYPES
    else:
        chord_pool = EXAM_TRIAD_TYPES + EXAM_SEVENTH_TYPES

    # 非高级难度避免重升/重降号
    acc_limit = 2 if difficulty == "高级" else 1

    questions: list[tuple[list[Note], str, list[dict]]] = []
    used: set[tuple[str, int, str]] = set()

    for _ in range(n):
        for _attempt in range(100):
            root = random.choice(_ROOTS)
            chord_type = random.choice(chord_pool)
            combo = (root.letter, root.accidental, chord_type)
            if combo in used:
                continue
            try:
                chord_notes = build_chord(root, chord_type)
                if any(abs(note.accidental) > acc_limit
                       for note in chord_notes):
                    continue
                keys = find_keys_for_chord(chord_notes)
                if len(keys) >= 1:
                    used.add(combo)
                    questions.append((chord_notes, chord_type, keys))
                    break
            except ValueError:
                continue

    score_each = 10 // n if n > 0 else 2
    md_parts = [f"# 和弦调性判断\n"]

    for i, (chord_notes, chord_type, keys) in enumerate(questions):
        # LilyPond 谱例（和弦用尖括号）
        notes_lily = " ".join(note.to_lilypond() for note in chord_notes)
        lily = "\n".join([
            "```lilypond",
            "{",
            "  \\clef treble",
            "  \\omit Staff.TimeSignature",
            f"  <{notes_lily}>1",
            "}",
            "```",
        ])

        # 答案
        answer_parts = [
            f"{k['key']} {k['degree']}级" for k in keys
        ]
        answer_str = "，".join(answer_parts)

        md_parts.extend([
            f"## [{score_each}分]",
            "判断下列和弦可能属于哪些自然/和声调式，写出调名和级数：",
            lily,
            "> 行数: 3",
            f"> 答案: {answer_str}",
            "",
        ])

    return "\n".join(md_parts)
