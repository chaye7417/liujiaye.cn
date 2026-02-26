"""预设头像配置。"""

from typing import Optional

PRESET_AVATARS: list[dict] = [
    {"id": 1, "emoji": "😊", "bg": "#FF6B6B", "label": "开心"},
    {"id": 2, "emoji": "🎵", "bg": "#4ECDC4", "label": "音乐"},
    {"id": 3, "emoji": "📚", "bg": "#45B7D1", "label": "学习"},
    {"id": 4, "emoji": "🎮", "bg": "#96CEB4", "label": "游戏"},
    {"id": 5, "emoji": "🌟", "bg": "#FFEAA7", "label": "星星"},
    {"id": 6, "emoji": "🎨", "bg": "#DDA0DD", "label": "艺术"},
    {"id": 7, "emoji": "🔥", "bg": "#FF7675", "label": "火焰"},
    {"id": 8, "emoji": "🌊", "bg": "#74B9FF", "label": "海浪"},
    {"id": 9, "emoji": "🍀", "bg": "#00B894", "label": "幸运"},
    {"id": 10, "emoji": "🎯", "bg": "#6C5CE7", "label": "目标"},
    {"id": 11, "emoji": "🐱", "bg": "#FDCB6E", "label": "猫咪"},
    {"id": 12, "emoji": "🚀", "bg": "#E17055", "label": "火箭"},
]


def get_avatar_by_id(avatar_id: int) -> Optional[dict]:
    """根据 ID 获取头像配置。

    Args:
        avatar_id: 头像 ID

    Returns:
        头像配置字典，未找到返回 None
    """
    for avatar in PRESET_AVATARS:
        if avatar["id"] == avatar_id:
            return avatar
    return None
