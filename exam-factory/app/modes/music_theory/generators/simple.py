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

# 谱号 lily 名 → 配置的快速查找
_CLEF_BY_LILY: dict[str, dict] = {c["lily"]: c for c in _CLEF_CONFIGS}


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
def _filter_clefs(clef_keys: list[str] | None) -> list[dict]:
    """根据用户选择的谱号 key 筛选配置。

    Args:
        clef_keys: LilyPond 谱号名列表（如 ["treble", "bass"]），
                   None 或空列表返回全部。

    Returns:
        筛选后的谱号配置列表。
    """
    if not clef_keys:
        return _CLEF_CONFIGS
    filtered = [_CLEF_BY_LILY[k] for k in clef_keys if k in _CLEF_BY_LILY]
    return filtered or _CLEF_CONFIGS


def _pick_notes(
    n: int,
    used: set[tuple[str, int, int]],
    clef_configs: list[dict] | None = None,
) -> list[tuple[dict, list[Note]]]:
    """为多种谱号随机选音。

    所有可用谱号都会出现（题数不够时按题数上限）。

    Args:
        n: 总题数
        used: 已使用音符集合（会被修改）
        clef_configs: 可用的谱号配置列表（None 用全部）

    Returns:
        [(clef_cfg, [Note, ...]), ...]
    """
    configs = clef_configs or _CLEF_CONFIGS
    # 所有可用谱号都要出现，题数不够时才减少
    num_clefs = min(len(configs), n)
    chosen_clefs = random.sample(configs, num_clefs)

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
# 音名标记 — LilyPond 谱例生成（共用）
# ---------------------------------------------------------------------------
_NOTES_PER_LINE = 5


def _flatten_clef_groups(
    clef_groups: list[tuple[dict, list[Note]]],
) -> list[tuple[dict, Note]]:
    """将 [(clef_cfg, [Note, ...]), ...] 展平为 [(clef_cfg, Note), ...]。"""
    flat: list[tuple[dict, Note]] = []
    for clef_cfg, notes in clef_groups:
        for note in notes:
            flat.append((clef_cfg, note))
    return flat


def _build_lily_block(
    flat_notes: list[tuple[dict, Note]],
    note_offset: int = 0,
) -> list[str]:
    """生成单个 LilyPond 块，多谱号内联切换，每音一小节。

    每行最多 _NOTES_PER_LINE 个音符，用 \\noBreak / \\break 控制换行。

    Args:
        flat_notes: [(clef_cfg, Note), ...] 展平的音符列表
        note_offset: 编号起始偏移（用于反向题接续编号）

    Returns:
        LilyPond 代码行列表（含 ```lilypond 围栏）
    """
    total = len(flat_notes)
    if total == 0:
        return []

    lines: list[str] = [
        "```lilypond",
        "{",
        "  \\omit Staff.TimeSignature",
        "  \\omit Score.BarNumber",
    ]
    current_clef: str | None = None

    for idx, (clef_cfg, note) in enumerate(flat_notes):
        note_num = note_offset + idx + 1

        # 谱号切换
        if clef_cfg["lily"] != current_clef:
            lines.append(f"  \\clef {clef_cfg['lily']}")
            current_clef = clef_cfg["lily"]

        # 音符（全音符 = 一小节）
        lines.append(
            f'  {note.to_lilypond()}1'
            f'^\\markup {{ \\small "({note_num})" }}'
        )

        # 换行控制：不在最后一个音符后加
        if idx < total - 1:
            if note_num % _NOTES_PER_LINE == 0:
                lines.append("  \\break")
            else:
                lines.append("  \\noBreak")

    lines.extend(["}", "```", ""])
    return lines


# ---------------------------------------------------------------------------
# 音名标记 — 正向（看谱写音名）
# ---------------------------------------------------------------------------
def _build_forward_notes(
    n: int,
    used: set[tuple[str, int, int]],
    clef_configs: list[dict] | None = None,
) -> str:
    """生成正向题：给五线谱音符，写出音名。

    每 _NOTES_PER_LINE 个音符拆为一组，
    每组生成独立五线谱 + 书写行，方便学生作答。

    Args:
        n: 题目数量
        used: 已使用音符集合
        clef_configs: 可用谱号（决定 max_clefs 上限）
    """
    configs = clef_configs or _CLEF_CONFIGS
    clef_groups = _pick_notes(n, used, clef_configs=configs)
    flat = _flatten_clef_groups(clef_groups)

    # 按 _NOTES_PER_LINE 拆分为多组
    chunks = [
        flat[i:i + _NOTES_PER_LINE]
        for i in range(0, len(flat), _NOTES_PER_LINE)
    ]

    sections: list[str] = []
    for chunk_idx, chunk in enumerate(chunks):
        offset = chunk_idx * _NOTES_PER_LINE
        lily = _build_lily_block(chunk, note_offset=offset)

        chunk_answers = [
            f"({offset + i + 1}) {note.to_pitch_name()}，{note.to_pitch_label()}"
            for i, (_, note) in enumerate(chunk)
        ]

        if chunk_idx == 0:
            parts = [
                "## [5分]",
                "写出下列各音的音名（用音组标记法）：",
                *lily,
                "> 行数: 1",
                "> 答案: " + " ".join(chunk_answers),
            ]
        else:
            parts = [
                "## [续]",
                *lily,
                "> 行数: 1",
                "> 答案: " + " ".join(chunk_answers),
            ]

        sections.append("\n".join(parts))

    return "\n\n".join(sections)


# ---------------------------------------------------------------------------
# 音名标记 — 反向（看音名写谱）
# ---------------------------------------------------------------------------
def _build_reverse_notes(
    n: int,
    used: set[tuple[str, int, int]],
    clef_configs: list[dict] | None = None,
) -> str:
    """生成反向题：给音名，在五线谱上写出音符。

    按谱号分组，每 _NOTES_PER_LINE 个音符拆为一组，
    每组生成题目文本 + 空白五线谱，方便学生书写。

    Args:
        n: 题目数量
        used: 已使用音符集合
        clef_configs: 可用谱号（决定 max_clefs 上限）
    """
    configs = clef_configs or _CLEF_CONFIGS
    clef_groups = _pick_notes(n, used, clef_configs=configs)

    sections: list[str] = []
    note_global_idx = 0
    is_first = True

    for clef_cfg, notes in clef_groups:
        # 每个谱号内按 _NOTES_PER_LINE 拆分
        for chunk_start in range(0, len(notes), _NOTES_PER_LINE):
            chunk_notes = notes[chunk_start:chunk_start + _NOTES_PER_LINE]

            # 题目文本：列出音名
            items: list[str] = []
            flat_chunk: list[tuple[dict, Note]] = []
            for note in chunk_notes:
                note_global_idx += 1
                items.append(f"({note_global_idx}) {note.to_pitch_label()}")
                flat_chunk.append((clef_cfg, note))

            question_line = f"{clef_cfg['name']}：{'　'.join(items)}"

            # 答案五线谱
            offset = note_global_idx - len(chunk_notes)
            answer_lily = _build_lily_block(flat_chunk, note_offset=offset)

            if is_first:
                parts = [
                    "## [5分]",
                    "在五线谱上写出指定音：",
                    "",
                    question_line,
                    "",
                    "> 五线谱: 1",
                    "> 答案:",
                    *answer_lily,
                ]
                is_first = False
            else:
                parts = [
                    "## [续]",
                    question_line,
                    "",
                    "> 五线谱: 1",
                    "> 答案:",
                    *answer_lily,
                ]

            sections.append("\n".join(parts))

    return "\n\n".join(sections)


# ---------------------------------------------------------------------------
# 音名标记 — 主入口
# ---------------------------------------------------------------------------
def generate_note_names(section_num: str, n: int = 0, **kwargs) -> str:
    """生成音名标记题（正向 + 反向）。

    正向：给五线谱音符，写出音名（含中文音组说明）。
    反向：给音名，在五线谱上写出音符。

    通过 generation_params 读取用户配置：
        - note_names_forward_n: 正向题数（默认 5）
        - note_names_reverse_n: 反向题数（默认 5）
        - note_names_clefs: 可用谱号列表（默认全部）

    Args:
        section_num: 大题编号
        n: 总题数（已弃用，由 forward_n + reverse_n 决定）
    """
    gen_params = kwargs.get("generation_params", {})
    n_forward = gen_params.get("note_names_forward_n", 5)
    n_reverse = gen_params.get("note_names_reverse_n", 5)
    clef_keys = gen_params.get("note_names_clefs", None)

    # 筛选可用谱号
    clef_configs = _filter_clefs(clef_keys)

    used: set[tuple[str, int, int]] = set()
    sections: list[str] = ["# 音名标记\n"]

    if n_forward > 0:
        sections.append(_build_forward_notes(n_forward, used, clef_configs))

    if n_reverse > 0:
        if n_forward > 0:
            sections.append("")
        sections.append(_build_reverse_notes(n_reverse, used, clef_configs))

    return "\n".join(sections)
