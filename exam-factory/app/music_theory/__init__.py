"""乐理出题 — 题型 prompt 汇总。

自动从同目录下的各题型模块中收集 PROMPT 和 SCORE，
对外导出 QUESTION_TYPE_PROMPTS 和 QUESTION_TYPE_SCORES。

新增题型只需在此目录下新建 .py 文件，定义 PROMPT 和 SCORE 即可。
"""

import importlib
import pkgutil
from pathlib import Path

_pkg_path = str(Path(__file__).parent)

QUESTION_TYPE_PROMPTS: dict[str, str] = {}
QUESTION_TYPE_SCORES: dict[str, float] = {}

for _finder, _name, _ispkg in pkgutil.iter_modules([_pkg_path]):
    _mod = importlib.import_module(f"{__name__}.{_name}")
    if hasattr(_mod, "PROMPT") and hasattr(_mod, "SCORE"):
        QUESTION_TYPE_PROMPTS[_name] = _mod.PROMPT
        QUESTION_TYPE_SCORES[_name] = _mod.SCORE
