"""题目生成器调度器 — 管理可计算题型与 AI 题型的分发。"""

from typing import Callable

from ..knowledge.data import CHINESE_NUMS
from .simple import generate_terms, generate_note_names
from .pitch import generate_intervals, generate_chords, generate_scales
from .keys import generate_interval_keys, generate_chord_keys
from .rhythm import generate_rhythm

# ---------------------------------------------------------------------------
# 可程序化生成的题型 → 生成函数
# ---------------------------------------------------------------------------
COMPUTABLE_GENERATORS: dict[str, Callable[..., str]] = {
    "terms": generate_terms,
    "note_names": generate_note_names,
    "intervals": generate_intervals,
    "chords": generate_chords,
    "scales": generate_scales,
    "interval_keys": generate_interval_keys,
    "chord_keys": generate_chord_keys,
    "rhythm": generate_rhythm,
}

# 需要 AI 生成的题型
AI_TYPES = {"choice", "melody", "jianpu"}

# 大题标题映射
SECTION_TITLES: dict[str, str] = {
    "terms": "术语与记号",
    "note_names": "音名标记",
    "intervals": "音程构成",
    "chords": "和弦构成",
    "scales": "音阶写作",
    "interval_keys": "音程调性判断",
    "chord_keys": "和弦调性判断",
    "choice": "选择题",
    "melody": "旋律调性分析",
    "jianpu": "简谱五线谱互译",
    "rhythm": "音值组合",
}


def generate_computable_sections(
    selected_types: list[str],
    difficulty: str = "中级",
    generation_params: dict | None = None,
) -> tuple[str, list[str]]:
    """生成所有可计算题型的 Markdown。

    遍历 selected_types 中的全部题型，可计算的直接生成，
    不可计算的跳过并收集到返回列表中。

    Args:
        selected_types: 用户选择的全部题型 key 列表（保持顺序）
        difficulty: 难度级别
        generation_params: 额外参数（如 choice 题数等）

    Returns:
        (已生成的 Markdown 文本, 仍需 AI 生成的题型 key 列表)
    """
    computed_sections: list[str] = []
    needs_ai: list[str] = []

    for key in selected_types:
        if key in COMPUTABLE_GENERATORS:
            generator = COMPUTABLE_GENERATORS[key]
            md = generator(
                section_num="",
                difficulty=difficulty,
                generation_params=generation_params or {},
            )
            computed_sections.append(md)
        else:
            needs_ai.append(key)

    computed_md = "\n\n".join(computed_sections)
    return computed_md, needs_ai
