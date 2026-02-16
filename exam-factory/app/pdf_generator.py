"""PDF 生成模块 - MD → LaTeX → PDF。"""

import asyncio
import re
import shutil
from pathlib import Path

from app.config import OUTPUT_DIR, LATEX_TEMPLATE_DIR, MD2LATEX_SCRIPT


async def _compile_single(
    task_id: int,
    markdown_content: str,
    title: str,
    school: str,
    theme: str,
    show_answer: bool,
    variant: str,
) -> Path:
    """编译单个 PDF 变体（试题卷或答案卷）。

    Args:
        task_id: 任务 ID
        markdown_content: Markdown 内容
        title: 试卷标题
        school: 学校名称
        theme: 主题色
        show_answer: 是否显示答案
        variant: 'exam' 或 'answer'

    Returns:
        生成的 PDF 路径

    Raises:
        RuntimeError: 编译失败
    """
    work_dir = OUTPUT_DIR / str(task_id) / variant
    work_dir.mkdir(parents=True, exist_ok=True)
    content_dir = work_dir / "content"
    content_dir.mkdir(exist_ok=True)

    # 去掉 AI 返回的 YAML frontmatter，用用户元数据替换
    markdown_body = re.sub(
        r'^---\s*\n.*?\n---\s*\n', '', markdown_content, count=1, flags=re.DOTALL
    )
    md_with_meta = f'---\ntitle: "{title}"\nschool: "{school}"\ntheme: {theme}\n---\n\n{markdown_body}\n'

    md_path = content_dir / "exam.md"
    md_path.write_text(md_with_meta, encoding="utf-8")

    # 复制 LaTeX 模板
    for f in LATEX_TEMPLATE_DIR.iterdir():
        if f.name != ".DS_Store":
            dest = work_dir / f.name
            if f.is_file():
                shutil.copy2(f, dest)

    main_template = work_dir / "main-template.tex"
    main_tex = work_dir / "main.tex"
    if main_template.exists():
        shutil.copy2(main_template, main_tex)

    # 答案卷：修改 main.tex 中的全局 showanswer 开关
    if show_answer and main_tex.exists():
        tex_content = main_tex.read_text(encoding="utf-8")
        tex_content = tex_content.replace(
            r"\setboolean{showanswer}{false}",
            r"\setboolean{showanswer}{true}",
        )
        main_tex.write_text(tex_content, encoding="utf-8")

    # md2latex 转换
    cmd_convert = [
        "python3", str(MD2LATEX_SCRIPT),
        str(md_path),
        "-o", str(content_dir / "exam.tex"),
        "--update-main", str(main_tex),
    ]
    if show_answer:
        cmd_convert.append("--show-answer")

    proc = await asyncio.create_subprocess_exec(
        *cmd_convert,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"MD→LaTeX 转换失败: {stderr.decode()}")

    # XeLaTeX 编译（两次）
    for _ in range(2):
        proc = await asyncio.create_subprocess_exec(
            "xelatex",
            "-interaction=nonstopmode",
            "-output-directory", str(work_dir),
            str(main_tex),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(work_dir),
        )
        stdout, stderr = await proc.communicate()

    pdf_path = work_dir / "main.pdf"
    if not pdf_path.exists():
        log_content = stdout.decode(errors="replace")
        raise RuntimeError(f"XeLaTeX 编译失败:\n{log_content[-2000:]}")

    return pdf_path


async def generate_both_pdfs(
    task_id: int,
    markdown_content: str,
    title: str,
    school: str = "",
    theme: str = "4e9b86",
) -> tuple[Path, Path]:
    """生成试题卷和答案卷。

    Args:
        task_id: 任务 ID
        markdown_content: Markdown 内容
        title: 试卷标题
        school: 学校名称
        theme: 主题色

    Returns:
        (试题卷路径, 答案卷路径)
    """
    exam_pdf = await _compile_single(
        task_id, markdown_content, title, school, theme,
        show_answer=False, variant="exam",
    )
    answer_pdf = await _compile_single(
        task_id, markdown_content, title, school, theme,
        show_answer=True, variant="answer",
    )
    return exam_pdf, answer_pdf
