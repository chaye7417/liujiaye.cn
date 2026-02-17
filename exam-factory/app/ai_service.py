"""AI 服务模块 - 调用 LLM API，支持三种模式：排版、通用出题、乐理出题。"""

import asyncio
import json
import logging
import re
from typing import AsyncGenerator, Optional

import httpx
from app.config import AI_MODELS, DEFAULT_MODEL
from app.modes import (
    FORMAT_PROMPT,
    GENERATE_PROMPT,
    MUSIC_THEORY_PROMPT,
    build_format_user_content,
    build_generate_user_content,
    build_music_theory_user_content,
)

logger = logging.getLogger(__name__)

MAX_INPUT_CHARS = 15000

# mode → system prompt 映射
_MODE_PROMPTS = {
    "format": FORMAT_PROMPT,
    "generate": GENERATE_PROMPT,
    "music_theory": MUSIC_THEORY_PROMPT,
}


def _clean_markdown(text: str) -> str:
    """去掉 AI 返回中可能包裹的代码块标记。"""
    text = re.sub(r'^```(?:markdown|md)?\s*\n', '', text.strip())
    text = re.sub(r'\n```\s*$', '', text.strip())
    return text.strip()


# 导出给 main.py 使用
clean_markdown = _clean_markdown


def _build_user_content(
    mode: str,
    file_content: Optional[str],
    generation_params: Optional[dict],
) -> str:
    """根据 mode 构建 user content。

    Args:
        mode: 模式（format / generate / music_theory）
        file_content: 文件文本内容
        generation_params: 出题参数

    Returns:
        构建好的 user content 字符串
    """
    if mode == "generate":
        return build_generate_user_content(
            file_content or "",
            generation_params or {},
        )
    elif mode == "music_theory":
        return build_music_theory_user_content(
            generation_params or {},
            file_content,
        )
    else:
        return build_format_user_content(file_content or "")


def _get_model_config(model_key: Optional[str] = None) -> dict:
    """获取指定模型的配置。

    Args:
        model_key: 模型 key，为 None 时使用默认模型

    Returns:
        模型配置字典
    """
    key = model_key or DEFAULT_MODEL
    if key not in AI_MODELS:
        key = DEFAULT_MODEL
    return AI_MODELS[key]


async def stream_ai_chunks(
    file_content: Optional[str] = None,
    mode: str = "format",
    generation_params: Optional[dict] = None,
    model_key: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """异步生成器，逐片段 yield AI 返回的文本。

    Args:
        file_content: 提取的试卷文本（排版/通用出题必填，乐理可选）
        mode: 模式（format / generate / music_theory）
        generation_params: 出题参数（通用出题/乐理模式使用）
        model_key: AI 模型 key（对应 AI_MODELS 中的 key）

    Yields:
        AI 生成的文本片段
    """
    if file_content and len(file_content) > MAX_INPUT_CHARS:
        logger.warning("文本过长 (%d)，截断至 %d", len(file_content), MAX_INPUT_CHARS)
        file_content = file_content[:MAX_INPUT_CHARS] + "\n\n[... 内容过长已截断 ...]"

    cfg = _get_model_config(model_key)
    provider = cfg["provider"]
    api_base = cfg["api_base"]
    api_key = cfg["api_key"]
    model = cfg["model"]

    system_prompt = _MODE_PROMPTS.get(mode, FORMAT_PROMPT)
    user_content = _build_user_content(mode, file_content, generation_params)

    # 出题模式需要更多 token（DeepSeek 上限 8192）
    max_tokens = 8192 if mode in ("generate", "music_theory") else 8000

    if provider == "openai":
        url = f"{api_base}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "max_tokens": max_tokens,
            "stream": True,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
        }
    else:
        url = f"{api_base}/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "max_tokens": max_tokens,
            "stream": True,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_content}],
        }

    logger.info(
        "AI [%s] 流式请求，模式: %s，模型: %s，内容长度: %d",
        provider, mode, model, len(user_content),
    )

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


async def extract_exam_info(text: str, model_key: Optional[str] = None) -> dict:
    """从试卷文本中快速提取标题和学校名称。

    Args:
        text: 试卷原始文本
        model_key: AI 模型 key（默认使用第一个可用模型）

    Returns:
        {"title": "...", "school": "..."}
    """
    cfg = _get_model_config(model_key)
    provider = cfg["provider"]
    api_base = cfg["api_base"]
    api_key = cfg["api_key"]
    model = cfg["model"]

    prompt = (
        "从以下试卷文本中提取信息，只返回JSON，不要返回其他任何内容：\n"
        '{"title": "试卷标题", "school": "学校名称"}\n'
        "如果无法确定，对应字段留空字符串。\n\n"
        + text[:800]
    )

    if provider == "openai":
        url = f"{api_base}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "max_tokens": 100,
            "messages": [{"role": "user", "content": prompt}],
        }
    else:
        url = f"{api_base}/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "max_tokens": 100,
            "messages": [{"role": "user", "content": prompt}],
        }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            response = await client.post(url, headers=headers, json=body)
            if response.status_code != 200:
                return {"title": "", "school": ""}

            data = response.json()
            if provider == "openai":
                content = data["choices"][0]["message"]["content"]
            else:
                content = data["content"][0]["text"]

            # 提取 JSON
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                result = json.loads(match.group())
                return {
                    "title": result.get("title", ""),
                    "school": result.get("school", ""),
                }
    except Exception as e:
        logger.warning("提取试卷信息失败: %s", e)

    return {"title": "", "school": ""}


async def parse_to_markdown(
    file_content: str,
    mode: str = "format",
    generation_params: Optional[dict] = None,
    model_key: Optional[str] = None,
) -> str:
    """非流式版本，收集所有片段返回完整 Markdown。

    Args:
        file_content: 文件文本内容
        mode: 模式
        generation_params: 出题参数
        model_key: AI 模型 key

    Returns:
        完整的 Markdown 文本
    """
    chunks: list[str] = []
    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            chunks = []
            async for chunk in stream_ai_chunks(file_content, mode, generation_params, model_key):
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
