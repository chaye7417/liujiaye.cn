"""出题模式统一入口。

对外提供与旧 prompts.py 兼容的接口，供 ai_service.py 使用。
"""

from app.modes.format import SYSTEM_PROMPT as FORMAT_PROMPT
from app.modes.format import build_user_content as build_format_user_content
from app.modes.generate import SYSTEM_PROMPT as GENERATE_PROMPT
from app.modes.generate import build_user_content as build_generate_user_content
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
