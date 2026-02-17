"""应用配置模块。"""

import os
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent

# 数据目录
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = DATA_DIR / "outputs"
TEMPLATE_DIR = BASE_DIR / "templates"

# 确保目录存在
for d in [DATA_DIR, UPLOAD_DIR, OUTPUT_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# AI API 配置（向后兼容旧的单一配置）
AI_PROVIDER = os.getenv("AI_PROVIDER", "anthropic")
AI_API_BASE = os.getenv("AI_API_BASE", "https://api.gptsapi.net")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "claude-sonnet-4-5-20250929")

# 多模型配置：从 AI_MODELS 环境变量读取多组 API 配置
AI_MODELS: dict[str, dict] = {}
for _name in os.getenv("AI_MODELS", "").split(","):
    _name = _name.strip()
    if not _name:
        continue
    _prefix = _name.upper()
    AI_MODELS[_name] = {
        "provider": os.getenv(f"{_prefix}_PROVIDER", "openai"),
        "api_base": os.getenv(f"{_prefix}_API_BASE", ""),
        "api_key": os.getenv(f"{_prefix}_API_KEY", ""),
        "model": os.getenv(f"{_prefix}_MODEL", ""),
        "label": os.getenv(f"{_prefix}_LABEL", _name),
    }

# 向后兼容：如果没配 AI_MODELS，用旧的单一配置
if not AI_MODELS:
    AI_MODELS["default"] = {
        "provider": AI_PROVIDER,
        "api_base": AI_API_BASE,
        "api_key": AI_API_KEY,
        "model": AI_MODEL,
        "label": AI_MODEL,
    }

DEFAULT_MODEL = list(AI_MODELS.keys())[0]

# 邮件配置
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.qq.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")

# JWT 配置
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

# 数据库
DATABASE_URL = str(DATA_DIR / "exam_factory.db")

# 限制
MAX_FILE_SIZE_MB = 20
MAX_DAILY_USES = 9999

# 内置题库
QUIZ_BANK_DIR = BASE_DIR / "app" / "modes" / "music_history" / "quiz_bank"

# LaTeX 相关
LATEX_TEMPLATE_DIR = BASE_DIR / "latex_templates"
MD2LATEX_SCRIPT = BASE_DIR / "scripts" / "md2latex.py"
FONT_SETTINGS_ILY = LATEX_TEMPLATE_DIR / "font-settings.ily"
