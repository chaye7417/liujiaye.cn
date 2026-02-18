"""乐理知识库 — 音符、音程、和弦、音阶的计算引擎。"""

from .theory import (
    Note,
    build_interval,
    name_interval,
    build_chord,
    build_chord_from_member,
    identify_chord,
    build_scale,
    find_keys_for_interval,
    find_keys_for_chord,
)
from .data import (
    LETTERS,
    LETTER_SEMITONES,
    INTERVALS,
    CHORD_TYPES,
    SCALE_PATTERNS,
    MUSIC_TERMS,
    ROMAN_NUMERALS,
    CHINESE_NUMS,
    STANDARD_MAJOR_TONICS,
    STANDARD_MINOR_TONICS,
)

__all__ = [
    "Note",
    "build_interval",
    "name_interval",
    "build_chord",
    "build_chord_from_member",
    "identify_chord",
    "build_scale",
    "find_keys_for_interval",
    "find_keys_for_chord",
    "LETTERS",
    "LETTER_SEMITONES",
    "INTERVALS",
    "CHORD_TYPES",
    "SCALE_PATTERNS",
    "MUSIC_TERMS",
    "ROMAN_NUMERALS",
    "CHINESE_NUMS",
    "STANDARD_MAJOR_TONICS",
    "STANDARD_MINOR_TONICS",
]
