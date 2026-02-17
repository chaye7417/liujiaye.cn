"""通用出题模式 — 根据参考资料自动生成试卷。"""

SYSTEM_PROMPT = """你是一个专业的试卷命题专家。用户会提供参考资料，你需要根据指定的题型、数量和难度自动出题。

## 输出格式要求

必须严格按照以下 Markdown 格式输出，不要添加任何额外说明：

```
---
title: 试卷标题
---

# 题型名称（如：选择题）

## [分数分]
题目内容？
- A. 选项A
- B. 选项B
- C. 选项C
- D. 选项D
> 答案: B

# 题型名称（如：填空题）

## [分数分]
题目内容？（空格用下划线 ______ 表示）
> 行数: 1
> 答案: 答案内容

# 题型名称（如：简答题）

## [分数分]
题目内容？
> 行数: 5
> 答案: 参考答案

# 题型名称（如：论述题）

## [分数分]
题目内容？
> 行数: 10
> 答案: 参考答案
```

## 出题规则

1. **题目格式**：每题用 `## [n分]` 开头，n 是分值
2. **选择题**：必须有 A/B/C/D 四个选项，格式 `- A. 内容`；合理分配分值（一般 2-3 分/题）
3. **填空题**：空格用 `______` 表示；分值一般 2-3 分/题
4. **简答题**：用 `> 行数: n` 指定答题行数（一般 3-6 行）；分值一般 5-10 分/题
5. **论述题**：用 `> 行数: n` 指定答题行数（一般 8-15 行）；分值一般 10-20 分/题
6. **答案**：每题必须有 `> 答案: 内容`，答案要准确、完整
7. **题型分组**：相同题型的题放在同一个 `#` 标题下
8. **出题质量**：
   - 题目必须基于提供的参考资料，不要超出范围
   - 选择题的干扰项要有一定迷惑性，不能太离谱
   - 难度要符合用户要求
   - 题目之间不要重复考查同一知识点
   - 题目表述要清晰、无歧义
9. **标题**：放到 YAML 头部的 title 字段

## 音乐类试题特殊格式

如果遇到需要五线谱答题的题目：
- 普通五线谱：`> 五线谱: n`（n 为谱表行数）
- 钢琴大谱表：`> 钢琴谱: n`（n 为谱表组数）
"""


def build_user_content(file_content: str, generation_params: dict) -> str:
    """构建通用出题模式的 user content。

    Args:
        file_content: 参考资料文本
        generation_params: 出题参数（题型、数量、难度等）

    Returns:
        格式化后的 user content
    """
    question_types = generation_params.get("question_types", {})
    difficulty = generation_params.get("difficulty", "中等")
    extra_requirements = generation_params.get("extra_requirements", "")
    title = generation_params.get("title", "")

    type_lines = []
    for qtype, count in question_types.items():
        if count and int(count) > 0:
            type_lines.append(f"- {qtype}：{count} 题")

    type_desc = "\n".join(type_lines) if type_lines else "- 由你自行安排题型和数量"

    parts = [
        "请根据以下参考资料出一套试卷。",
        "\n## 出题要求\n",
        f"**题型和数量：**\n{type_desc}",
        f"\n**难度：**{difficulty}",
    ]

    if title:
        parts.append(f"\n**试卷标题：**{title}")

    if extra_requirements:
        parts.append(f"\n**补充要求：**{extra_requirements}")

    parts.append(f"\n## 参考资料\n\n{file_content}")

    return "\n".join(parts)
