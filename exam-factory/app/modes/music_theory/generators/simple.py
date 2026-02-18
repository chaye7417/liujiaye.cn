"""术语与记号 / 音名标记 题目生成器。"""

import random

from ..knowledge.data import MUSIC_TERMS, LETTERS, CHINESE_NUMS
from ..knowledge.theory import Note


# ---------------------------------------------------------------------------
# 谱号配置：谱号名称、LilyPond 指令、适用音符池
# ---------------------------------------------------------------------------
_CLEF_CONFIGS: list[dict] = [
    {
        "name": "高音谱号",
        "lily": "treble",
        "notes": [
            Note("C", 0, 4), Note("D", 0, 4), Note("E", 0, 4),
            Note("F", 0, 4), Note("G", 0, 4), Note("A", 0, 4), Note("B", 0, 4),
            Note("C", 1, 4), Note("D", -1, 4), Note("E", -1, 4),
            Note("F", 1, 4), Note("A", -1, 4), Note("B", -1, 4),
            Note("G", 0, 3), Note("A", 0, 3), Note("B", 0, 3),
            Note("C", 0, 5), Note("D", 0, 5), Note("E", 0, 5),
            Note("F", 0, 5), Note("G", 0, 5),
            Note("F", 1, 5), Note("B", -1, 3),
        ],
    },
    {
        "name": "低音谱号",
        "lily": "bass",
        "notes": [
            Note("C", 0, 3), Note("D", 0, 3), Note("E", 0, 3),
            Note("F", 0, 3), Note("G", 0, 3), Note("A", 0, 2), Note("B", 0, 2),
            Note("C", 1, 3), Note("E", -1, 3), Note("F", 1, 3),
            Note("A", -1, 2), Note("B", -1, 2), Note("D", -1, 3),
            Note("G", 0, 2), Note("F", 0, 2), Note("C", 0, 2),
            Note("D", 0, 2), Note("E", 0, 2),
        ],
    },
    {
        "name": "中音谱号",
        "lily": "alto",
        "notes": [
            Note("C", 0, 3), Note("D", 0, 3), Note("E", 0, 3),
            Note("F", 0, 3), Note("G", 0, 3), Note("A", 0, 3), Note("B", 0, 3),
            Note("C", 0, 4), Note("D", 0, 4), Note("E", 0, 4),
            Note("F", 0, 4), Note("G", 0, 4), Note("A", 0, 4),
            Note("F", 1, 3), Note("B", -1, 3), Note("C", 1, 4),
            Note("E", -1, 4), Note("A", -1, 3),
        ],
    },
    {
        "name": "次中音谱号",
        "lily": "tenor",
        "notes": [
            Note("B", 0, 2), Note("C", 0, 3), Note("D", 0, 3),
            Note("E", 0, 3), Note("F", 0, 3), Note("G", 0, 3),
            Note("A", 0, 3), Note("B", 0, 3),
            Note("C", 0, 4), Note("D", 0, 4), Note("E", 0, 4),
            Note("F", 1, 3), Note("B", -1, 2), Note("E", -1, 3),
            Note("A", -1, 3),
        ],
    },
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
        f"# 术语与记号\n",
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
def generate_note_names(section_num: str, n: int = 0, **kwargs) -> str:
    """生成音名标记题的完整 Markdown（含多种谱号 LilyPond 谱例）。

    随机选择 2-4 种谱号，每种谱号出若干音，总题数随机 5-10。
    答案使用中国音组标记体系（大字组/小字组 + 上下标）。

    Args:
        section_num: 大题编号
        n: 题目数量（0 表示随机 5-10）
    """
    if n <= 0:
        n = random.randint(5, 10)

    # 随机选 2-4 种谱号
    num_clefs = random.randint(2, min(4, len(_CLEF_CONFIGS)))
    chosen_clefs = random.sample(_CLEF_CONFIGS, num_clefs)

    # 给每种谱号分配题数
    base_per_clef = n // num_clefs
    remainder = n % num_clefs
    clef_counts = [base_per_clef] * num_clefs
    for i in range(remainder):
        clef_counts[i] += 1
    random.shuffle(clef_counts)

    # 为每种谱号选音
    clef_groups: list[tuple[dict, list[Note]]] = []
    used: set[tuple[str, int, int]] = set()

    for clef_cfg, count in zip(chosen_clefs, clef_counts):
        pool = clef_cfg["notes"]
        selected_notes: list[Note] = []
        for _ in range(count):
            for _attempt in range(50):
                note = random.choice(pool)
                key = (note.letter, note.accidental, note.octave)
                if key not in used:
                    used.add(key)
                    selected_notes.append(note)
                    break
        if selected_notes:
            clef_groups.append((clef_cfg, selected_notes))

    # 生成 LilyPond 谱例（每种谱号一行）
    lily_parts: list[str] = []
    all_notes: list[Note] = []
    note_idx = 0

    for clef_cfg, notes in clef_groups:
        lily_parts.extend([
            "```lilypond",
            "{",
            f"  \\clef {clef_cfg['lily']}",
            "  \\omit Staff.TimeSignature",
            "  \\omit Staff.BarLine",
        ])
        for note in notes:
            note_idx += 1
            lily_parts.append(
                f'  {note.to_lilypond()}1'
                f'^\\markup {{ \\small "({note_idx})" }}'
            )
            all_notes.append(note)
        lily_parts.extend(["}", "```", ""])

    # 答案（中国音组标记）
    answer_items = [
        f"({i+1}) {note.to_pitch_name()}" for i, note in enumerate(all_notes)
    ]

    md_parts = [
        f"# 音名标记\n",
        "## [5分]",
        "写出下列各音的音名（用音组标记法）：",
        *lily_parts,
        f"> 行数: {n}",
        "> 答案: " + " ".join(answer_items),
    ]
    return "\n".join(md_parts)
