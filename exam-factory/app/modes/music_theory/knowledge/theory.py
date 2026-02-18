"""乐理计算引擎 — 音符、音程、和弦、音阶的构建与分析。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .data import (
    LETTERS,
    LETTER_SEMITONES,
    INTERVALS,
    INTERVAL_REVERSE,
    CHORD_TYPES,
    CHORD_REVERSE,
    SCALE_PATTERNS,
    KEY_SCALE_TYPES,
    ROMAN_NUMERALS,
    STANDARD_MAJOR_TONICS,
    STANDARD_MINOR_TONICS,
)

# ---------------------------------------------------------------------------
# LilyPond 转换常量
# ---------------------------------------------------------------------------
_ACC_TO_LILY = {-2: "eses", -1: "es", 0: "", 1: "is", 2: "isis"}
_ACC_TO_CHINESE = {-2: "bb", -1: "b", 0: "", 1: "#", 2: "×"}
_ACC_TO_LATEX = {-2: r"\accflat\accflat ", -1: r"\accflat ", 0: "", 1: r"\accsharp ", 2: "×"}

# Unicode 上下标数字（替代 \textsuperscript/\textsubscript，避免字体上下文被破坏）
_SUPERSCRIPTS = {1: "¹", 2: "²", 3: "³"}
_SUBSCRIPTS = {1: "₁", 2: "₂"}

_PITCH_GROUPS = {
    0: "大字二组", 1: "大字一组", 2: "大字组",
    3: "小字组", 4: "小字一组", 5: "小字二组", 6: "小字三组",
}


# ---------------------------------------------------------------------------
# Note 类
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Note:
    """音符，支持升降号运算和多种格式输出。

    Attributes:
        letter: 音名字母 C/D/E/F/G/A/B
        accidental: 升降号 (-2=bb, -1=b, 0=还原, +1=#, +2=×)
        octave: 八度 (4 = 中央 C 所在八度)
    """

    letter: str
    accidental: int = 0
    octave: int = 4

    # ------ 数值转换 ------

    def abs_semitone(self) -> int:
        """绝对半音值（含八度）。"""
        return self.octave * 12 + LETTER_SEMITONES[self.letter] + self.accidental

    def pitch_class(self) -> int:
        """音级类 0-11（不含八度）。"""
        return (LETTER_SEMITONES[self.letter] + self.accidental) % 12

    def letter_index(self) -> int:
        """字母序号 0-6。"""
        return LETTERS.index(self.letter)

    # ------ 格式输出 ------

    def to_lilypond(self) -> str:
        """转 LilyPond 绝对音高表示，如 ``cis'`` / ``bes,``。"""
        name = self.letter.lower() + _ACC_TO_LILY[self.accidental]
        if self.octave > 3:
            name += "'" * (self.octave - 3)
        elif self.octave < 3:
            name += "," * (3 - self.octave)
        return name

    def to_chinese(self, latex: bool = True) -> str:
        """转音名表示。

        Args:
            latex: True 用 LaTeX 音乐符号（\\sharp \\flat），
                   False 用 ASCII（# b）
        """
        acc = _ACC_TO_LATEX if latex else _ACC_TO_CHINESE
        return f"{acc[self.accidental]}{self.letter}"

    def to_key_name(self, scale_desc: str, latex: bool = True) -> str:
        """转调名表示，如 ``\\sharp f和声小调``。

        Args:
            scale_desc: 调式描述，含 "小" 字则用小写字母
            latex: True 用 LaTeX 音乐符号
        """
        acc = _ACC_TO_LATEX if latex else _ACC_TO_CHINESE
        letter = self.letter.lower() if "小" in scale_desc else self.letter
        return f"{acc[self.accidental]}{letter}{scale_desc}"

    def to_pitch_name(self) -> str:
        r"""转中国音组标记。

        变化记号用 LaTeX 命令（\sharp \flat），
        上下标用 Unicode 字符（¹²³ / ₁₂），避免 \textsuperscript 破坏字体上下文。

        体系：
            octave 0 → 大字二组  C₂
            octave 1 → 大字一组  C₁
            octave 2 → 大字组    C
            octave 3 → 小字组    c
            octave 4 → 小字一组  c¹
            octave 5 → 小字二组  c²
            octave 6 → 小字三组  c³
        """
        acc = _ACC_TO_LATEX[self.accidental]
        if self.octave >= 3:
            letter = self.letter.lower()
            group = self.octave - 3
            if group == 0:
                return f"{acc}{letter}"
            sup = _SUPERSCRIPTS.get(group, str(group))
            return f"{acc}{letter}{sup}"
        else:
            letter = self.letter
            group = 2 - self.octave
            if group == 0:
                return f"{acc}{letter}"
            sub = _SUBSCRIPTS.get(group, str(group))
            return f"{acc}{letter}{sub}"

    def pitch_group_name(self) -> str:
        """返回中国音组名称，如 '小字一组'。"""
        return _PITCH_GROUPS.get(self.octave, "")

    def to_pitch_label(self) -> str:
        r"""返回中文音组标记，如 '小字一组\sharp c'。"""
        group = _PITCH_GROUPS.get(self.octave, "")
        acc = _ACC_TO_LATEX[self.accidental]
        letter = self.letter.lower() if self.octave >= 3 else self.letter
        return f"{group}{acc}{letter}"

    def matches(self, other: Note) -> bool:
        """忽略八度比较音名和升降号。"""
        return self.letter == other.letter and self.accidental == other.accidental


# ---------------------------------------------------------------------------
# 音程
# ---------------------------------------------------------------------------
def build_interval(
    root: Note,
    interval_name: str,
    direction: str = "up",
) -> Note:
    """以 root 为基础构成指定音程。

    Args:
        root: 起始音
        interval_name: 音程名称（如 "大三度"）
        direction: "up"=向上, "down"=向下

    Returns:
        目标音符

    Raises:
        ValueError: 音程名称无效或结果超出合理范围
    """
    if interval_name not in INTERVALS:
        raise ValueError(f"未知音程: {interval_name}")

    letter_dist, semitone_dist = INTERVALS[interval_name]

    if direction == "up":
        target_letter_idx = (root.letter_index() + letter_dist) % 7
        crosses_octave = (root.letter_index() + letter_dist) >= 7
        target_octave = root.octave + (1 if crosses_octave else 0)
        desired_abs = root.abs_semitone() + semitone_dist
    else:
        target_letter_idx = (root.letter_index() - letter_dist) % 7
        crosses_octave = (root.letter_index() - letter_dist) < 0
        target_octave = root.octave - (1 if crosses_octave else 0)
        desired_abs = root.abs_semitone() - semitone_dist

    target_letter = LETTERS[target_letter_idx]
    target_base_abs = target_octave * 12 + LETTER_SEMITONES[target_letter]
    target_acc = desired_abs - target_base_abs

    if not (-2 <= target_acc <= 2):
        raise ValueError(
            f"音程 {interval_name} 从 {root.to_chinese(latex=False)} "
            f"{'向上' if direction == 'up' else '向下'} "
            f"产生了超范围的变化音: {target_acc}"
        )

    return Note(target_letter, target_acc, target_octave)


def name_interval(note1: Note, note2: Note) -> Optional[str]:
    """判断两音构成的音程名称。

    Args:
        note1: 下方音
        note2: 上方音

    Returns:
        音程名称，如 "大三度"；无法识别时返回 None
    """
    letter_dist = (note2.letter_index() - note1.letter_index()) % 7
    semitone_dist = note2.abs_semitone() - note1.abs_semitone()

    # 处理跨八度（取模到 0-12）
    if semitone_dist < 0:
        semitone_dist += 12
    if semitone_dist > 12:
        semitone_dist %= 12

    return INTERVAL_REVERSE.get((letter_dist, semitone_dist))


# ---------------------------------------------------------------------------
# 和弦
# ---------------------------------------------------------------------------
def build_chord(root: Note, chord_type: str) -> list[Note]:
    """以 root 为根音构成和弦。

    Args:
        root: 根音
        chord_type: 和弦类型（如 "大三和弦"）

    Returns:
        和弦音列表 [root, 3rd, 5th, (7th)]
    """
    if chord_type not in CHORD_TYPES:
        raise ValueError(f"未知和弦类型: {chord_type}")

    notes = [root]
    for interval_name in CHORD_TYPES[chord_type]:
        notes.append(build_interval(root, interval_name))
    return notes


def build_chord_from_member(
    given_note: Note,
    member_index: int,
    chord_type: str,
) -> list[Note]:
    """以指定和弦成员音为基础构建完整和弦。

    Args:
        given_note: 已知音符
        member_index: 该音在和弦中的位置 (0=根音, 1=三音, 2=五音, 3=七音)
        chord_type: 和弦类型

    Returns:
        完整和弦音列表
    """
    if chord_type not in CHORD_TYPES:
        raise ValueError(f"未知和弦类型: {chord_type}")

    intervals = CHORD_TYPES[chord_type]

    if member_index == 0:
        # 给的就是根音
        return build_chord(given_note, chord_type)

    # 根音 = given_note 向下走对应音程
    interval_from_root = intervals[member_index - 1]
    root = build_interval(given_note, interval_from_root, direction="down")

    return build_chord(root, chord_type)


def identify_chord(notes: list[Note]) -> Optional[str]:
    """识别和弦类型。

    Args:
        notes: 和弦音列表（从根音开始）

    Returns:
        和弦类型名称；无法识别时返回 None
    """
    if len(notes) < 3:
        return None

    root = notes[0]
    interval_names = []
    for note in notes[1:]:
        name = name_interval(root, note)
        if name is None:
            return None
        interval_names.append(name)

    return CHORD_REVERSE.get(tuple(interval_names))


# ---------------------------------------------------------------------------
# 音阶
# ---------------------------------------------------------------------------
def build_scale(tonic: Note, scale_type: str) -> list[Note]:
    """构建音阶。

    Args:
        tonic: 主音
        scale_type: 音阶类型（如 "自然大调"、"宫调式"）

    Returns:
        音阶音符列表（含首尾八度）
    """
    if scale_type not in SCALE_PATTERNS:
        raise ValueError(f"未知音阶类型: {scale_type}")

    pattern = SCALE_PATTERNS[scale_type]
    notes = [tonic]
    current = tonic

    for semitone_step, letter_step in pattern:
        next_letter_idx = (current.letter_index() + letter_step) % 7
        next_letter = LETTERS[next_letter_idx]
        crosses_octave = (current.letter_index() + letter_step) >= 7
        next_octave = current.octave + (1 if crosses_octave else 0)

        current_abs = current.abs_semitone()
        desired_abs = current_abs + semitone_step
        next_base_abs = next_octave * 12 + LETTER_SEMITONES[next_letter]
        next_acc = desired_abs - next_base_abs

        current = Note(next_letter, next_acc, next_octave)
        notes.append(current)

    return notes


# ---------------------------------------------------------------------------
# 调性查找
# ---------------------------------------------------------------------------
def find_keys_for_interval(note1: Note, note2: Note) -> list[dict]:
    """查找包含此音程的所有调式。

    检查自然大调、和声大调、自然小调、和声小调。

    Args:
        note1: 音程下方音
        note2: 音程上方音

    Returns:
        [{"key": "C自然大调", "degrees": "Ⅰ-Ⅲ"}, ...]
    """
    letter_dist = (note2.letter_index() - note1.letter_index()) % 7
    results: list[dict] = []

    scale_tonic_pairs = [
        ("自然大调", STANDARD_MAJOR_TONICS),
        ("和声大调", STANDARD_MAJOR_TONICS),
        ("自然小调", STANDARD_MINOR_TONICS),
        ("和声小调", STANDARD_MINOR_TONICS),
    ]

    for scale_desc, tonic_list in scale_tonic_pairs:
        for letter, acc in tonic_list:
            tonic = Note(letter, acc, 4)
            scale = build_scale(tonic, scale_desc)
            scale_notes = scale[:-1]  # 去掉八度重复音
            n = len(scale_notes)

            for i in range(n):
                j = (i + letter_dist) % n
                if (scale_notes[i].matches(note1)
                        and scale_notes[j].matches(note2)):
                    deg1 = ROMAN_NUMERALS[i]
                    deg2 = ROMAN_NUMERALS[j]
                    key_name = tonic.to_key_name(scale_desc)
                    results.append({
                        "key": key_name,
                        "degrees": f"{deg1}-{deg2}",
                    })

    return results


def find_keys_for_chord(notes: list[Note]) -> list[dict]:
    """查找包含此和弦的所有调式。

    Args:
        notes: 和弦音符列表（从根音开始，3 或 4 个音）

    Returns:
        [{"key": "C自然大调", "degree": "Ⅰ"}, ...]
    """
    is_seventh = len(notes) == 4
    note_letters = [(n.letter, n.accidental) for n in notes]
    results: list[dict] = []

    scale_tonic_pairs = [
        ("自然大调", STANDARD_MAJOR_TONICS),
        ("和声大调", STANDARD_MAJOR_TONICS),
        ("自然小调", STANDARD_MINOR_TONICS),
        ("和声小调", STANDARD_MINOR_TONICS),
    ]

    for scale_desc, tonic_list in scale_tonic_pairs:
        for letter, acc in tonic_list:
            tonic = Note(letter, acc, 4)
            scale = build_scale(tonic, scale_desc)
            scale_notes = scale[:-1]  # 7 个音

            if len(scale_notes) != 7:
                continue  # 五声调式跳过

            for i in range(7):
                # 在音阶上叠置三度构建和弦
                chord_indices = [i, (i + 2) % 7, (i + 4) % 7]
                if is_seventh:
                    chord_indices.append((i + 6) % 7)

                chord_letters = [
                    (scale_notes[idx].letter, scale_notes[idx].accidental)
                    for idx in chord_indices
                ]

                if chord_letters == note_letters:
                    key_name = tonic.to_key_name(scale_desc)
                    results.append({
                        "key": key_name,
                        "degree": ROMAN_NUMERALS[i],
                    })

    return results
