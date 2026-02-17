"""出题模式统一入口。

四种模式各自独立为文件夹：
- format/         排版模式
- generate/       通用出题模式
- music_theory/   乐理出题模式
- music_history/  音乐史出题模式（CSV 题库）
"""

# 排版
from app.modes.format import SYSTEM_PROMPT as FORMAT_PROMPT
from app.modes.format import build_user_content as build_format_user_content

# 通用出题
from app.modes.generate import SYSTEM_PROMPT as GENERATE_PROMPT
from app.modes.generate import build_user_content as build_generate_user_content

# 乐理
from app.modes.music_theory import SYSTEM_PROMPT as MUSIC_THEORY_PROMPT
from app.modes.music_theory import build_user_content as build_music_theory_user_content

__all__ = [
    "FORMAT_PROMPT",
    "GENERATE_PROMPT",
    "MUSIC_THEORY_PROMPT",
    "build_format_user_content",
    "build_generate_user_content",
    "build_music_theory_user_content",
]
