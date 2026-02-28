"""调号映射与音级常量。"""

from typing import Dict, Tuple

# 大调调号名 → spnmn 写法
MAJOR_KEY_MAP: Dict[str, str] = {
    "C": "1=C",
    "G": "1=G",
    "D": "1=D",
    "A": "1=A",
    "E": "1=E",
    "B": "1=B",
    "F#": "1=#F",
    "G-": "1=bG",
    "F": "1=F",
    "B-": "1=bB",
    "E-": "1=bE",
    "A-": "1=bA",
    "D-": "1=bD",
    "C#": "1=#C",
    "C-": "1=bC",
}

# 小调调号名 → spnmn 写法
MINOR_KEY_MAP: Dict[str, str] = {
    "A": "6=A",
    "E": "6=E",
    "B": "6=B",
    "F#": "6=#F",
    "C#": "6=#C",
    "G#": "6=#G",
    "D#": "6=#D",
    "D": "6=D",
    "G": "6=G",
    "C": "6=C",
    "F": "6=F",
    "B-": "6=bB",
    "E-": "6=bE",
    "A-": "6=bA",
}

# 大调音阶的 pitch class 间隔模板（半音）
MAJOR_SCALE_INTERVALS: Tuple[int, ...] = (0, 2, 4, 5, 7, 9, 11)

# 参考八度（中央 C 区域）
REFERENCE_OCTAVE: int = 4

# 每拍的 quarterLength
QUARTER_NOTE_QL: float = 1.0
