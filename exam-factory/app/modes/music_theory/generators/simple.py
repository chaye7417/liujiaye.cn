"""术语与记号 / 音名标记 题目生成器。"""

import random

from ..knowledge.data import MUSIC_TERMS, LETTERS, CHINESE_NUMS
from ..knowledge.theory import Note


# ---------------------------------------------------------------------------
# 可用于出题的根音池
# ---------------------------------------------------------------------------
_TREBLE_ROOTS = [
    Note("C", 0, 4), Note("D", 0, 4), Note("E", 0, 4),
    Note("F", 0, 4), Note("G", 0, 4), Note("A", 0, 4), Note("B", 0, 4),
    Note("C", 1, 4), Note("D", -1, 4), Note("E", -1, 4),
    Note("F", 1, 4), Note("A", -1, 4), Note("B", -1, 4),
    Note("G", 0, 3), Note("A", 0, 3), Note("B", 0, 3),
    Note("C", 0, 5), Note("D", 0, 5), Note("E", 0, 5),
    Note("F", 1, 5), Note("B", -1, 3),
]

_BASS_ROOTS = [
    Note("C", 0, 3), Note("D", 0, 3), Note("E", 0, 3),
    Note("F", 0, 3), Note("G", 0, 3), Note("A", 0, 2), Note("B", 0, 2),
    Note("C", 1, 3), Note("E", -1, 3), Note("F", 1, 3),
    Note("A", -1, 2), Note("B", -1, 2), Note("D", -1, 3),
    Note("G", 0, 2), Note("F", 0, 2),
]


# ---------------------------------------------------------------------------
# 术语与记号
# ---------------------------------------------------------------------------
def generate_terms(section_num: str, n: int = 5, **kwargs) -> str:
    """生成术语与记号题的完整 Markdown。

    Args:
        section_num: 大题编号（中文数字，如 "一"）
        n: 题目数量
    """
    terms = list(MUSIC_TERMS.items())
    selected = random.sample(terms, min(n, len(terms)))

    question_items = []
    answer_items = []
    for i, (term, meaning) in enumerate(selected, 1):
        question_items.append(f"({i}) {term}")
        answer_items.append(f"({i}) {meaning}")

    md_parts = [
        f"# {section_num}、术语与记号\n",
        "## [5分]",
        "写出下列音乐记号或术语的中文含义：",
        "　".join(question_items),
        f"> 行数: {n}",
        "> 答案: " + " ".join(answer_items),
    ]
    return "\n".join(md_parts)


# ---------------------------------------------------------------------------
# 音名标记
# ---------------------------------------------------------------------------
def generate_note_names(section_num: str, n: int = 5, **kwargs) -> str:
    """生成音名标记题的完整 Markdown（含 LilyPond 谱例）。

    Args:
        section_num: 大题编号（中文数字）
        n: 题目数量
    """
    # 混合高低音谱号：前半高音谱号，后半低音谱号
    treble_n = (n + 1) // 2
    bass_n = n - treble_n

    treble_notes = random.sample(_TREBLE_ROOTS, min(treble_n, len(_TREBLE_ROOTS)))
    bass_notes = random.sample(_BASS_ROOTS, min(bass_n, len(_BASS_ROOTS)))

    # 生成高音谱号部分
    lily_parts = [
        "```lilypond",
        "{",
        "  \\clef treble",
        "  \\omit Staff.TimeSignature",
        "  \\omit Staff.BarLine",
    ]
    for note in treble_notes:
        lily_parts.append(f"  {note.to_lilypond()}1")
    lily_parts.append("}")
    lily_parts.append("```")

    # 生成低音谱号部分
    if bass_notes:
        lily_parts.append("")
        lily_parts.append("```lilypond")
        lily_parts.append("{")
        lily_parts.append("  \\clef bass")
        lily_parts.append("  \\omit Staff.TimeSignature")
        lily_parts.append("  \\omit Staff.BarLine")
        for note in bass_notes:
            lily_parts.append(f"  {note.to_lilypond()}1")
        lily_parts.append("}")
        lily_parts.append("```")

    # 答案
    all_notes = treble_notes + bass_notes
    answer_items = [
        f"({i+1}) {note.to_chinese()}" for i, note in enumerate(all_notes)
    ]

    md_parts = [
        f"# {section_num}、音名标记\n",
        "## [5分]",
        "写出下列各音的音名：",
        *lily_parts,
        f"> 行数: {n}",
        "> 答案: " + " ".join(answer_items),
    ]
    return "\n".join(md_parts)
