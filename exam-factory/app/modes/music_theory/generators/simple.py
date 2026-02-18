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
# 音名标记 — 辅助函数
# ---------------------------------------------------------------------------
def _pick_notes(
    n: int,
    used: set[tuple[str, int, int]],
    max_clefs: int = 4,
) -> list[tuple[dict, list[Note]]]:
    """为多种谱号随机选音。

    Args:
        n: 总题数
        used: 已使用音符集合（会被修改）
        max_clefs: 最多使用几种谱号

    Returns:
        [(clef_cfg, [Note, ...]), ...]
    """
    num_clefs = random.randint(1, min(max_clefs, len(_CLEF_CONFIGS)))
    chosen_clefs = random.sample(_CLEF_CONFIGS, num_clefs)

    base = n // num_clefs
    remainder = n % num_clefs
    counts = [base] * num_clefs
    for i in range(remainder):
        counts[i] += 1
    random.shuffle(counts)

    groups: list[tuple[dict, list[Note]]] = []
    for clef_cfg, count in zip(chosen_clefs, counts):
        pool = clef_cfg["notes"]
        selected: list[Note] = []
        for _ in range(count):
            for _attempt in range(50):
                note = random.choice(pool)
                key = (note.letter, note.accidental, note.octave)
                if key not in used:
                    used.add(key)
                    selected.append(note)
                    break
        if selected:
            groups.append((clef_cfg, selected))
    return groups


# ---------------------------------------------------------------------------
# 音名标记 — 正向（看谱写音名）
# ---------------------------------------------------------------------------
def _build_forward_notes(n: int, used: set[tuple[str, int, int]]) -> str:
    """生成正向题：给五线谱音符，写出音名。"""
    clef_groups = _pick_notes(n, used, max_clefs=4)

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

    answer_items = [
        f"({i+1}) {note.to_pitch_name()}，{note.to_pitch_label()}"
        for i, note in enumerate(all_notes)
    ]

    actual_n = len(all_notes)
    parts = [
        "## [5分]",
        "写出下列各音的音名（用音组标记法）：",
        *lily_parts,
        f"> 行数: {actual_n}",
        "> 答案: " + " ".join(answer_items),
    ]
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# 音名标记 — 反向（看音名写谱）
# ---------------------------------------------------------------------------
def _build_reverse_notes(n: int, used: set[tuple[str, int, int]]) -> str:
    """生成反向题：给音名，在五线谱上写出音符。"""
    clef_groups = _pick_notes(n, used, max_clefs=3)

    question_lines: list[str] = []
    blank_lily: list[str] = []
    answer_lily: list[str] = []
    note_idx = 0

    for clef_cfg, notes in clef_groups:
        # 题目：列出音名
        items: list[str] = []
        start_idx = note_idx
        for note in notes:
            note_idx += 1
            items.append(f"({note_idx}) {note.to_pitch_label()}")
        question_lines.append(f"{clef_cfg['name']}：{'　'.join(items)}")

        # 空白五线谱（带谱号，spacer rests 占位）
        spacers = " ".join(["s1"] * len(notes))
        blank_lily.extend([
            "```lilypond",
            "{",
            f"  \\clef {clef_cfg['lily']}",
            "  \\omit Staff.TimeSignature",
            "  \\omit Staff.BarLine",
            f"  {spacers}",
            "}",
            "```",
            "",
        ])

        # 答案五线谱
        answer_lily.extend([
            "```lilypond",
            "{",
            f"  \\clef {clef_cfg['lily']}",
            "  \\omit Staff.TimeSignature",
            "  \\omit Staff.BarLine",
        ])
        for j, note in enumerate(notes):
            answer_lily.append(
                f'  {note.to_lilypond()}1'
                f'^\\markup {{ \\small "({start_idx + j + 1})" }}'
            )
        answer_lily.extend(["}", "```", ""])

    parts = [
        "## [5分]",
        "在下列谱号的五线谱上写出指定音：",
        "",
        *question_lines,
        "",
        *blank_lily,
        "> 答案:",
        *answer_lily,
    ]
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# 音名标记 — 主入口
# ---------------------------------------------------------------------------
def generate_note_names(section_num: str, n: int = 0, **kwargs) -> str:
    """生成音名标记题（正向 + 反向）。

    正向：给五线谱音符，写出音名（含中文音组说明）。
    反向：给音名，在五线谱上写出音符。

    Args:
        section_num: 大题编号
        n: 总题数（0 表示随机 6-12）
    """
    if n <= 0:
        n = random.randint(6, 12)

    n_forward = max(3, (n + 1) // 2)
    n_reverse = max(2, n - n_forward)

    used: set[tuple[str, int, int]] = set()

    forward_md = _build_forward_notes(n_forward, used)
    reverse_md = _build_reverse_notes(n_reverse, used)

    return "\n".join(["# 音名标记\n", forward_md, "", reverse_md])
