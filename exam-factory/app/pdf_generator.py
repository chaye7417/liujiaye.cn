"""PDF 生成模块 - MD -> LaTeX -> PDF，支持 LilyPond 乐谱条件编译。"""

import asyncio
import os
import re
import shutil
import stat
from pathlib import Path

from app.config import OUTPUT_DIR, LATEX_TEMPLATE_DIR, MD2LATEX_SCRIPT, FONT_SETTINGS_ILY, UPLOAD_DIR

# 可用的 LilyPond 音乐字体配置
MUSIC_FONTS: dict[str, dict] = {
    "gonville": {
        "label": "Gonville（传统手刻）",
        "music": "gonville",
        "brace": "gonville",
        "layout": "",
    },
    "emmentaler": {
        "label": "Emmentaler（LilyPond 默认）",
        "music": "emmentaler",
        "brace": "emmentaler",
        "layout": "",
    },
    "profondo": {
        "label": "Profondo（现代清晰）",
        "music": "profondo",
        "brace": "profondo",
        "layout": (
            "\\layout {\n"
            "  \\override Staff.StaffSymbol.thickness = #1.2\n"
            "  \\override Staff.Stem.thickness = #1.6\n"
            "  \\override Staff.Beam.beam-thickness = #0.55\n"
            "  \\override Staff.Tie.thickness = #1.5\n"
            "  \\override Staff.Slur.thickness = #1.5\n"
            "  \\override Staff.PhrasingSlur.thickness = #1.5\n"
            "}\n"
        ),
    },
    "cadence": {
        "label": "Cadence（优雅圆润）",
        "music": "cadence",
        "brace": "cadence",
        "layout": "",
    },
    "lilyjazz": {
        "label": "LilyJazz（手写爵士）",
        "music": "lilyjazz",
        "brace": "lilyjazz",
        "layout": (
            "\\layout {\n"
            "  \\override Score.Hairpin.thickness = #2\n"
            "  \\override Score.Stem.thickness = #2\n"
            "  \\override Staff.Tie.line-thickness = #2\n"
            "  \\override Staff.Slur.thickness = #3\n"
            "  \\override Staff.PhrasingSlur.thickness = #3\n"
            "  \\override Staff.BarLine.hair-thickness = #4\n"
            "  \\override Staff.BarLine.thick-thickness = #8\n"
            "}\n"
        ),
    },
    "beethoven": {
        "label": "Beethoven（古典风格）",
        "music": "beethoven",
        "brace": "beethoven",
        "layout": "",
    },
}

DEFAULT_MUSIC_FONT = "gonville"


def _generate_font_settings_ily(music_font: str = DEFAULT_MUSIC_FONT) -> str:
    """根据字体名称生成 font-settings.ily 内容。

    Args:
        music_font: 字体 key（gonville / emmentaler / profondo 等）

    Returns:
        LilyPond .ily 文件内容
    """
    cfg = MUSIC_FONTS.get(music_font, MUSIC_FONTS[DEFAULT_MUSIC_FONT])
    lines = [
        f'% LilyPond 字体设置 - {cfg["label"] if "label" in cfg else music_font}',
        "\\paper {",
        "  indent = 0",
        "  ragged-right = ##f",
        "  line-width = 15.8\\cm",
        "  system-system-spacing = #'((basic-distance . 24) (padding . 6))",
        "  #(define fonts",
        "    (set-global-fonts",
        f'      #:music "{cfg["music"]}"',
        f'      #:brace "{cfg["brace"]}"',
        "      #:factor (/ staff-height pt 20)",
        "    ))",
        "}",
        "",
    ]
    if cfg.get("layout"):
        lines.append(cfg["layout"])
    return "\n".join(lines)


def _has_lilypond(tex_content: str) -> bool:
    """检测 LaTeX 内容中是否包含 LilyPond 环境或文件引用。

    Args:
        tex_content: LaTeX 文件内容

    Returns:
        是否包含 \\begin{lilypond} 或 \\lilypondfile
    """
    return r'\begin{lilypond}' in tex_content or r'\lilypondfile' in tex_content


def _create_lilypond_wrapper(work_dir: Path) -> Path:
    """创建 LilyPond 包装脚本，去掉 -dgs-load-fonts 标志。

    Ghostscript 10.x 与 LilyPond 2.24 的 -dgs-load-fonts 不兼容，
    会导致 EPS→PDF 转换失败。此包装脚本过滤掉该标志。

    Args:
        work_dir: 工作目录

    Returns:
        包装脚本路径
    """
    wrapper = work_dir / "lilypond-wrapper.sh"
    wrapper.write_text(
        '#!/bin/bash\n'
        'args=()\n'
        'for arg in "$@"; do\n'
        '    [ "$arg" != "-dgs-load-fonts" ] && args+=("$arg")\n'
        'done\n'
        'exec lilypond "${args[@]}"\n',
        encoding="utf-8",
    )
    wrapper.chmod(wrapper.stat().st_mode | stat.S_IEXEC)
    return wrapper


async def _compile_with_lilypond(
    work_dir: Path,
    main_tex: Path,
    music_font: str = DEFAULT_MUSIC_FONT,
) -> Path:
    """使用 lilypond-book + xelatex 编译包含乐谱的 LaTeX。

    流程：
    1. 生成 font-settings.ily（根据用户选择的字体）
    2. 运行 lilypond-book --output=lilypond-out --pdf main.tex
    3. 复制样式文件和资源到 lilypond-out
    4. 在 lilypond-out 中运行 xelatex 两遍
    5. 将 PDF 复制回预期位置

    Args:
        work_dir: 工作目录
        main_tex: main.tex 路径
        music_font: 音乐字体名称

    Returns:
        生成的 PDF 路径

    Raises:
        RuntimeError: 编译失败
    """
    lilypond_out = work_dir / "lilypond-out"
    lilypond_out.mkdir(exist_ok=True)

    # 动态生成 font-settings.ily
    ily_dest = work_dir / "font-settings.ily"
    ily_dest.write_text(_generate_font_settings_ily(music_font), encoding="utf-8")

    # 创建 LilyPond 包装脚本（兼容 Ghostscript 10.x）
    wrapper = _create_lilypond_wrapper(work_dir)

    # 运行 lilypond-book
    proc = await asyncio.create_subprocess_exec(
        "lilypond-book",
        "--output=lilypond-out",
        "--pdf",
        f"--process={wrapper}",
        str(main_tex.name),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(work_dir),
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        error_msg = stderr.decode(errors="replace")
        raise RuntimeError(f"lilypond-book 失败:\n{error_msg[-2000:]}")

    # 复制所有需要的资源到 lilypond-out 目录
    for f in work_dir.iterdir():
        if f.name in ("lilypond-out",):
            continue
        dest = lilypond_out / f.name
        if f.is_file() and not dest.exists():
            shutil.copy2(f, dest)

    # 在 lilypond-out 中运行 xelatex 两遍
    out_main_tex = lilypond_out / main_tex.name
    for _ in range(2):
        proc = await asyncio.create_subprocess_exec(
            "xelatex",
            "-interaction=nonstopmode",
            "-output-directory", str(lilypond_out),
            str(out_main_tex),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(lilypond_out),
        )
        stdout, stderr = await proc.communicate()

    out_pdf = lilypond_out / "main.pdf"
    if not out_pdf.exists():
        log_content = stdout.decode(errors="replace")
        raise RuntimeError(f"XeLaTeX 编译失败（LilyPond 模式）:\n{log_content[-2000:]}")

    # 复制 PDF 回工作目录
    final_pdf = work_dir / "main.pdf"
    shutil.copy2(out_pdf, final_pdf)
    return final_pdf


async def _compile_music_history(
    task_id: int,
    title: str,
    theme: str,
    show_answer: bool,
    variant: str,
    shuffle: bool = True,
) -> Path:
    """使用旧模板编译音乐史选择题 PDF。

    旧模板通过 datatool 直接读取 CSV，自动编号、随机打乱选项、
    记录答案到 .answers 文件，排版更专业。

    Args:
        task_id: 任务 ID
        title: 试卷标题
        theme: 主题色（HTML hex，不含 #）
        show_answer: 是否为答案卷
        variant: 'exam' 或 'answer'
        shuffle: 是否随机打乱选项

    Returns:
        生成的 PDF 路径

    Raises:
        RuntimeError: 编译失败
    """
    mh_template_dir = LATEX_TEMPLATE_DIR / "music_history"
    work_dir = OUTPUT_DIR / str(task_id) / variant
    work_dir.mkdir(parents=True, exist_ok=True)

    # 复制模板文件到工作目录
    for f in mh_template_dir.iterdir():
        if f.is_file() and f.name != ".DS_Store":
            shutil.copy2(f, work_dir / f.name)

    # 复制准备好的 CSV 到工作目录
    quiz_csv_src = UPLOAD_DIR / f"{task_id}_quiz.csv"
    quiz_csv_dest = work_dir / "quiz_data.csv"
    if quiz_csv_src.exists():
        shutil.copy2(quiz_csv_src, quiz_csv_dest)
    else:
        raise RuntimeError("题库 CSV 文件不存在，请重新提交")

    if not show_answer:
        # === 编译试题卷 ===
        tex_path = work_dir / "question_paper.tex"
        tex_content = tex_path.read_text(encoding="utf-8")

        # 替换配置变量
        tex_content = tex_content.replace(
            r"\newcommand{\mycsvfile}{temp_随机选择题.csv}",
            r"\newcommand{\mycsvfile}{quiz_data.csv}",
        )
        tex_content = tex_content.replace(
            r"\newcommand{\mytitle}{选择题试卷}",
            rf"\newcommand{{\mytitle}}{{{title}}}",
        )
        tex_content = tex_content.replace(
            r"\definecolor{mycolor}{HTML}{4e9b86}",
            rf"\definecolor{{mycolor}}{{HTML}}{{{theme}}}",
        )
        # 关闭答案页面（单独生成）、保留写入答案文件
        tex_content = tex_content.replace(
            r"\setboolean{showdaan}{true}",
            r"\setboolean{showdaan}{false}",
        )
        # 打乱选项控制
        if not shuffle:
            tex_content = tex_content.replace(
                r"\setboolean{shuffleoptions}{true}",
                r"\setboolean{shuffleoptions}{false}",
            )
        # 关闭水印、题源标签、难度辣椒
        tex_content = tex_content.replace(
            r"\setboolean{showwatermark}{true}",
            r"\setboolean{showwatermark}{false}",
        )
        tex_content = tex_content.replace(
            r"\setboolean{showtiyuan}{true}",
            r"\setboolean{showtiyuan}{false}",
        )
        tex_content = tex_content.replace(
            r"\setboolean{shownandu}{true}",
            r"\setboolean{shownandu}{false}",
        )

        tex_path.write_text(tex_content, encoding="utf-8")

        # XeLaTeX 编译两遍（页码引用需要）
        main_tex = tex_path
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

        pdf_path = work_dir / "question_paper.pdf"
        if not pdf_path.exists():
            log_content = stdout.decode(errors="replace")
            raise RuntimeError(f"试题卷编译失败:\n{log_content[-2000:]}")

        # 重命名为 main.pdf（下载端点期望的文件名）
        final_pdf = work_dir / "main.pdf"
        shutil.copy2(pdf_path, final_pdf)
        return final_pdf

    else:
        # === 编译答案卷 ===
        # 需要先从 exam 目录复制 .answers 文件
        exam_dir = OUTPUT_DIR / str(task_id) / "exam"
        answers_file = exam_dir / "question_paper.answers"
        if not answers_file.exists():
            raise RuntimeError("答案文件不存在，请先生成试题卷")

        shutil.copy2(answers_file, work_dir / "question_paper.answers")

        tex_path = work_dir / "answer_sheet.tex"
        tex_content = tex_path.read_text(encoding="utf-8")

        # 替换配置变量
        tex_content = tex_content.replace(
            r"\newcommand{\mytitle}{选择题试卷}",
            rf"\newcommand{{\mytitle}}{{{title}}}",
        )
        tex_content = tex_content.replace(
            r"\definecolor{mycolor}{HTML}{4e9b86}",
            rf"\definecolor{{mycolor}}{{HTML}}{{{theme}}}",
        )
        tex_content = tex_content.replace(
            r"\newcommand{\myanswersfile}{选择题排版模板.answers}",
            r"\newcommand{\myanswersfile}{question_paper.answers}",
        )
        # 关闭水印
        tex_content = tex_content.replace(
            r"\setboolean{showwatermark}{true}",
            r"\setboolean{showwatermark}{false}",
        )

        tex_path.write_text(tex_content, encoding="utf-8")

        main_tex = tex_path
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

        pdf_path = work_dir / "answer_sheet.pdf"
        if not pdf_path.exists():
            log_content = stdout.decode(errors="replace")
            raise RuntimeError(f"答案卷编译失败:\n{log_content[-2000:]}")

        final_pdf = work_dir / "main.pdf"
        shutil.copy2(pdf_path, final_pdf)
        return final_pdf


async def _preprocess_jianpu(markdown: str, work_dir: Path) -> str:
    """预处理 Markdown 中的 jianpu 代码块：转为 .ly 文件供 lilypond-book 编译。

    检测 ```jianpu ... ``` 代码块，通过 jianpu-ly 转换为独立的 LilyPond
    文件，然后用 [LILYPONDFILE:filename.ly] 标记替换原代码块。
    md2latex.py 会将标记转为 \\lilypondfile 命令，由 lilypond-book 统一编译。

    Args:
        markdown: 原始 Markdown 内容
        work_dir: 工作目录（.ly 文件输出位置）

    Returns:
        替换后的 Markdown 内容
    """
    pattern = re.compile(r'```jianpu\s*\n(.*?)```', re.DOTALL)
    matches = list(pattern.finditer(markdown))
    if not matches:
        return markdown

    result = markdown
    # 从后往前替换，避免偏移量变化
    for i, match in enumerate(reversed(matches)):
        idx = len(matches) - 1 - i
        jianpu_text = match.group(1).strip()
        name = f"jianpu_{idx}"

        # 尝试转换，若失败则修复后重试一次
        ly_content = await _run_jianpu_ly(jianpu_text, name, work_dir)

        # 后处理 .ly：启用 tagline="" 去掉 LilyPond 水印
        ly_content = ly_content.replace(
            '% \\header { tagline="" }',
            '\\header { tagline="" }',
        )
        ly_file = work_dir / f"{name}.ly"
        ly_file.write_text(ly_content, encoding="utf-8")

        # 替换 markdown 中的 jianpu 代码块为 lilypondfile 标记
        result = result[:match.start()] + f"[LILYPONDFILE:{name}.ly]" + result[match.end():]

    return result


async def _run_jianpu_ly(jianpu_text: str, name: str, work_dir: Path) -> str:
    """运行 jianpu-ly 转换，失败时自动修复后重试。

    常见 AI 错误：末尾小节不完整。修复策略：
    1. 确保末尾有小节线 |
    2. 如仍失败，截掉最后一个不完整小节

    Args:
        jianpu_text: jianpu-ly 源码
        name: 文件名前缀
        work_dir: 工作目录

    Returns:
        转换后的 LilyPond 代码

    Raises:
        RuntimeError: 修复后仍无法转换
    """
    async def try_convert(text: str) -> tuple[int, str, str]:
        input_file = work_dir / f"{name}.txt"
        input_file.write_text(text, encoding="utf-8")
        proc = await asyncio.create_subprocess_exec(
            "jianpu-ly", str(input_file),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        return proc.returncode, stdout.decode(errors="replace"), stderr.decode(errors="replace")

    # 第一次尝试
    rc, stdout, stderr = await try_convert(jianpu_text)
    if rc == 0:
        return stdout

    # 修复尝试 1：确保末尾有 |
    fixed = jianpu_text.rstrip()
    if not fixed.endswith("|"):
        fixed += " |"
        rc, stdout, stderr = await try_convert(fixed)
        if rc == 0:
            return stdout

    # 修复尝试 2：删掉最后一个不完整小节（从最后一个 | 截断）
    last_bar = fixed.rfind("|", 0, len(fixed) - 1)
    if last_bar > 0:
        truncated = fixed[:last_bar + 1]
        rc, stdout, stderr = await try_convert(truncated)
        if rc == 0:
            return stdout

    raise RuntimeError(
        f"jianpu-ly 转换失败（已尝试自动修复）:\n{stderr[-1000:]}"
    )


async def _compile_single(
    task_id: int,
    markdown_content: str,
    title: str,
    school: str,
    theme: str,
    show_answer: bool,
    variant: str,
    mode: str = "format",
    music_font: str = DEFAULT_MUSIC_FONT,
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
        mode: 模式（format / generate / music_theory）
        music_font: 音乐字体名称

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

    # 预处理 jianpu 代码块（转为 .ly 文件 + [LILYPONDFILE:...] 标记）
    markdown_body = await _preprocess_jianpu(markdown_body, work_dir)

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
        raise RuntimeError(f"MD->LaTeX 转换失败: {stderr.decode()}")

    # 检测是否需要 LilyPond 编译
    # 读取生成的 exam.tex 检查是否包含 lilypond 环境
    exam_tex = content_dir / "exam.tex"
    use_lilypond = False
    if exam_tex.exists():
        tex_content = exam_tex.read_text(encoding="utf-8")
        use_lilypond = _has_lilypond(tex_content)

    if use_lilypond:
        # 乐理模式：将内容直接写入 main.tex（lilypond-book 不跟踪 subfile）
        main_content = main_tex.read_text(encoding="utf-8")

        # 移除 \usepackage{subfiles} 和 \subfile{...} 引用
        main_content = main_content.replace(r'\usepackage{subfiles}', '% subfiles disabled for lilypond-book')
        main_content = re.sub(r'\\subfile\{[^}]+\}\n?', '', main_content)

        # 在 \end{document} 前插入 exam.tex 的内容
        # exam.tex 是 subfile 格式，需要提取 \begin{document} 和 \end{document} 之间的内容
        exam_body_match = re.search(
            r'\\begin\{document\}(.*?)\\end\{document\}',
            tex_content, re.DOTALL,
        )
        if exam_body_match:
            exam_body = exam_body_match.group(1)
        else:
            exam_body = tex_content

        main_content = main_content.replace(
            r'\end{document}',
            f'{exam_body}\n\\end{{document}}',
        )

        main_tex.write_text(main_content, encoding="utf-8")

        # 使用 lilypond-book 编译
        return await _compile_with_lilypond(work_dir, main_tex, music_font)
    else:
        # 标准流程：XeLaTeX 编译（两次）
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
    mode: str = "format",
    music_font: str = DEFAULT_MUSIC_FONT,
) -> tuple[Path, Path]:
    """生成试题卷和答案卷。

    Args:
        task_id: 任务 ID
        markdown_content: Markdown 内容
        title: 试卷标题
        school: 学校名称
        theme: 主题色
        mode: 模式
        music_font: 音乐字体名称

    Returns:
        (试题卷路径, 答案卷路径)
    """
    exam_pdf = await _compile_single(
        task_id, markdown_content, title, school, theme,
        show_answer=False, variant="exam", mode=mode, music_font=music_font,
    )
    answer_pdf = await _compile_single(
        task_id, markdown_content, title, school, theme,
        show_answer=True, variant="answer", mode=mode, music_font=music_font,
    )
    return exam_pdf, answer_pdf
