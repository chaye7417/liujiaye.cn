"""AI 服务模块 - 调用 LLM API 将文件内容转换为标准试卷 Markdown。"""

import asyncio
import json
import logging
import re
from typing import AsyncGenerator

import httpx
from app.config import AI_API_BASE, AI_API_KEY, AI_MODEL, AI_PROVIDER

logger = logging.getLogger(__name__)

MAX_INPUT_CHARS = 15000


def _clean_markdown(text: str) -> str:
    """去掉 AI 返回中可能包裹的代码块标记。"""
    text = re.sub(r'^```(?:markdown|md)?\s*\n', '', text.strip())
    text = re.sub(r'\n```\s*$', '', text.strip())
    return text.strip()


# 导出给 main.py 使用
clean_markdown = _clean_markdown

SYSTEM_PROMPT = """你是一个试卷格式化专家。用户会给你一份试卷的原始文本内容，你需要将其转换为标准的 Markdown 格式。

## 输出格式要求

必须严格按照以下格式输出，不要添加任何额外说明：

```
---
title: 试卷标题（从内容中提取）
---

# 第一大题的题型名称（如：选择题）

## [分数分]
题目内容？
- A. 选项A
- B. 选项B
- C. 选项C
- D. 选项D
> 答案: B

# 第二大题的题型名称（如：简答题）

## [分数分]
题目内容？
> 行数: 3
> 答案: 答案内容

# 第三大题的题型名称（如：综合题）

## [分数分]
> 要求框: 任务标题
> - 要求 1
> - 要求 2

题目内容？
> 行数: 15
> 答案: 参考答案
```

## 规则

1. **题目格式**：每题用 `## [n分]` 开头，n 是分值
2. **选择题**：必须有 A/B/C/D 四个选项，格式 `- A. 内容`
3. **简答题**：用 `> 行数: n` 指定答题行数（根据题目难度估算：简单题 2-3 行，中等 4-6 行，复杂 8-15 行）
4. **综合大题**：可以用 `> 要求框: 标题` 加要求列表（仅用于最后的大题）
5. **答案**：每题必须有 `> 答案: 内容`
6. **分值**：如果原文有分值就用原文的，没有的话根据题型合理分配
7. **题型分组**：相同题型的题放在同一个 `#` 标题下
8. **不要编造**：忠实还原原始内容，不要添加或修改题目
9. **标题**：从试卷内容中提取标题放到 YAML 头部的 title 字段

## 音乐类试题特殊格式

如果遇到需要五线谱答题的题目：
- 普通五线谱：`> 五线谱: n`（n 为谱表行数）
- 钢琴大谱表：`> 钢琴谱: n`（n 为谱表组数）
"""


async def stream_ai_chunks(file_content: str) -> AsyncGenerator[str, None]:
    """异步生成器，逐片段 yield AI 返回的文本。

    Args:
        file_content: 提取的试卷文本

    Yields:
        AI 生成的文本片段
    """
    if len(file_content) > MAX_INPUT_CHARS:
        logger.warning("文本过长 (%d)，截断至 %d", len(file_content), MAX_INPUT_CHARS)
        file_content = file_content[:MAX_INPUT_CHARS] + "\n\n[... 内容过长已截断 ...]"

    user_content = f"请将以下试卷内容转换为标准 Markdown 格式：\n\n{file_content}"

    if AI_PROVIDER == "openai":
        url = f"{AI_API_BASE}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {AI_API_KEY}",
            "Content-Type": "application/json",
        }
        body = {
            "model": AI_MODEL,
            "max_tokens": 8000,
            "stream": True,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
        }
    else:
        url = f"{AI_API_BASE}/v1/messages"
        headers = {
            "x-api-key": AI_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        body = {
            "model": AI_MODEL,
            "max_tokens": 8000,
            "stream": True,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": user_content}],
        }

    logger.info("AI [%s] 流式请求，模型: %s，长度: %d", AI_PROVIDER, AI_MODEL, len(file_content))

    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
        async with client.stream("POST", url, headers=headers, json=body) as response:
            if response.status_code in (502, 503, 504, 529):
                raise RuntimeError(f"AI API 暂时不可用 ({response.status_code})，请稍后重试")
            if response.status_code != 200:
                error_body = await response.aread()
                raise RuntimeError(
                    f"AI API 错误 ({response.status_code}): "
                    f"{error_body.decode('utf-8', errors='replace')[:300]}"
                )

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    event = json.loads(data_str)
                except json.JSONDecodeError:
                    continue

                # Anthropic SSE
                if "type" in event:
                    etype = event["type"]
                    if etype == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            yield delta["text"]
                    elif etype == "error":
                        err = event.get("error", {})
                        raise RuntimeError(f"AI 错误: {err.get('message', str(err))}")

                # OpenAI SSE (DeepSeek 等)
                elif "choices" in event:
                    for choice in event["choices"]:
                        content = choice.get("delta", {}).get("content")
                        if content:
                            yield content


async def parse_to_markdown(file_content: str) -> str:
    """非流式版本，收集所有片段返回完整 Markdown。"""
    chunks: list[str] = []
    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            chunks = []
            async for chunk in stream_ai_chunks(file_content):
                chunks.append(chunk)
            result = "".join(chunks)
            if not result.strip():
                raise RuntimeError("AI 返回了空内容")
            return _clean_markdown(result)
        except RuntimeError as e:
            if "暂时不可用" in str(e) and attempt < max_retries:
                await asyncio.sleep(5 * (attempt + 1))
                continue
            raise
        except httpx.TimeoutException:
            if attempt < max_retries:
                await asyncio.sleep(5 * (attempt + 1))
                continue
            raise RuntimeError("AI API 请求超时，请稍后重试")
