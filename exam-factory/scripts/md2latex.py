#!/usr/bin/env python3
"""
md2latex.py - Markdown 试卷转 LaTeX 转换脚本

将标准化的 Markdown 试卷文件转换为 LaTeX 格式，
配合 exam-paper-maker skill 的 styles.sty 使用。

用法:
    python md2latex.py input.md -o output.tex
    python md2latex.py input.md -o output.tex --show-answer
    python md2latex.py *.md -o content/  # 批量转换
"""

import argparse
import re
import sys
from pathlib import Path
from typing import Optional


def parse_yaml_header(content: str) -> tuple[dict, str]:
    """
    解析 YAML 头部元数据。

    Args:
        content: Markdown 文件内容

    Returns:
        (metadata_dict, remaining_content)
    """
    metadata = {}

    # 匹配 YAML 头部 (--- ... ---)
    yaml_pattern = r'^---\s*\n(.*?)\n---\s*\n'
    match = re.match(yaml_pattern, content, re.DOTALL)

    if match:
        yaml_content = match.group(1)
        remaining = content[match.end():]

        # 简单解析 YAML (key: value 格式)
        for line in yaml_content.strip().split('\n'):
            line = line.strip()
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip()
                # 去掉引号包裹
                if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                    value = value[1:-1]
                # 处理布尔值
                if value.lower() == 'true':
                    value = True
                elif value.lower() == 'false':
                    value = False
                metadata[key] = value

        return metadata, remaining

    return metadata, content


def parse_sections(content: str) -> list[dict]:
    """
    按 # 标题分割为 sections。

    Args:
        content: 去除 YAML 头部后的内容

    Returns:
        [{'title': '选择题', 'content': '...'}, ...]
    """
    sections = []

    # 按 # 标题分割 (只匹配一级标题)
    section_pattern = r'^#\s+(.+?)$'
    parts = re.split(section_pattern, content, flags=re.MULTILINE)

    # parts: ['前导内容', '标题1', '内容1', '标题2', '内容2', ...]
    if len(parts) > 1:
        for i in range(1, len(parts), 2):
            title = parts[i].strip()
            content_part = parts[i + 1] if i + 1 < len(parts) else ''
            sections.append({
                'title': title,
                'content': content_part.strip()
            })

    return sections


def parse_questions(section_content: str) -> list[dict]:
    """
    解析 section 中的题目。

    Args:
        section_content: section 的内容

    Returns:
        [{'points': 5, 'stem': '题目内容', 'options': [...], 'answer': '...', ...}, ...]
    """
    questions = []

    # 按 ## 标题分割题目
    # 匹配格式: ## Q1 [5分] 或 ## 1. [5分] 或 ## [5分]
    question_pattern = r'^##\s+(?:Q?\d*\.?\s*)?\[(\d+)分\]'
    parts = re.split(question_pattern, section_content, flags=re.MULTILINE)

    # parts: ['前导', '分数1', '内容1', '分数2', '内容2', ...]
    for i in range(1, len(parts), 2):
        points = int(parts[i])
        content = parts[i + 1] if i + 1 < len(parts) else ''

        question = parse_single_question(content.strip(), points)
        questions.append(question)

    return questions


def parse_single_question(content: str, points: int) -> dict:
    """
    解析单个题目的内容。

    Args:
        content: 题目内容
        points: 分值

    Returns:
        {'points': 5, 'stem': '...', 'type': 'choice/short/essay', ...}
    """
    question = {
        'points': points,
        'stem': '',
        'type': 'short',  # 默认类型
        'options': [],
        'answer': '',
        'answer_num': 0,
        'lines': 0,
        'staff_lines': 0,
        'piano_staff': 0,
        'essay_box': None,
        'essay_items': []
    }

    lines = content.split('\n')
    stem_lines = []
    in_essay_box = False
    essay_items = []

    for line in lines:
        line_stripped = line.strip()

        # 解析选择题选项 (- A. 内容)
        option_match = re.match(r'^-\s*([A-D])\.\s*(.+)$', line_stripped)
        if option_match:
            question['type'] = 'choice'
            question['options'].append(option_match.group(2))
            continue

        # 解析答案 (> 答案: 内容)
        answer_match = re.match(r'^>\s*答案[:：]\s*(.+)$', line_stripped)
        if answer_match:
            answer_content = answer_match.group(1).strip()
            question['answer'] = answer_content
            # 如果是选择题，解析答案字母对应的数字
            if question['type'] == 'choice' and len(answer_content) == 1:
                answer_letter = answer_content.upper()
                if answer_letter in 'ABCD':
                    question['answer_num'] = ord(answer_letter) - ord('A') + 1
            continue

        # 解析行数 (> 行数: n)
        lines_match = re.match(r'^>\s*行数[:：]\s*(\d+)$', line_stripped)
        if lines_match:
            question['lines'] = int(lines_match.group(1))
            continue

        # 解析五线谱 (> 五线谱: n)
        staff_match = re.match(r'^>\s*五线谱[:：]\s*(\d+)$', line_stripped)
        if staff_match:
            question['staff_lines'] = int(staff_match.group(1))
            continue

        # 解析钢琴谱 (> 钢琴谱: n)
        piano_match = re.match(r'^>\s*钢琴谱[:：]\s*(\d+)$', line_stripped)
        if piano_match:
            question['piano_staff'] = int(piano_match.group(1))
            continue

        # 解析要求框 (> 要求框: 标题)
        essaybox_match = re.match(r'^>\s*要求框[:：]\s*(.+)$', line_stripped)
        if essaybox_match:
            question['type'] = 'essay'
            question['essay_box'] = essaybox_match.group(1).strip()
            in_essay_box = True
            continue

        # 解析要求框内容 (> - 要求1)
        if in_essay_box:
            item_match = re.match(r'^>\s*-\s*(.+)$', line_stripped)
            if item_match:
                essay_items.append(item_match.group(1).strip())
                continue
            elif line_stripped.startswith('>'):
                continue  # 跳过空的引用行
            else:
                in_essay_box = False  # 退出要求框

        # 普通内容作为题干
        if line_stripped and not line_stripped.startswith('>'):
            stem_lines.append(line_stripped)

    question['stem'] = '\n'.join(stem_lines)
    question['essay_items'] = essay_items

    return question


def convert_markdown_formatting(text: str) -> str:
    """
    转换 Markdown 格式为 LaTeX 格式。

    Args:
        text: 包含 Markdown 格式的文本

    Returns:
        转换后的文本
    """
    # 加粗: **text** -> \textbf{text}
    text = re.sub(r'\*\*(.+?)\*\*', r'\\textbf{\1}', text)

    # 斜体: *text* -> \textit{text} (注意不要匹配 **)
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'\\textit{\1}', text)

    # 行内代码: `code` -> \texttt{code}
    text = re.sub(r'`(.+?)`', r'\\texttt{\1}', text)

    return text


def escape_latex(text) -> str:
    """
    转义 LaTeX 特殊字符并转换 Markdown 格式。

    Args:
        text: 原始文本（字符串或其他类型）

    Returns:
        转义后的文本
    """
    if not isinstance(text, str):
        text = str(text)

    # 先处理 Markdown 格式，保护转换后的 LaTeX 命令
    # 使用占位符保护 \textbf, \textit, \texttt
    md_placeholders = []

    def protect_md(match):
        idx = len(md_placeholders)
        md_placeholders.append(match.group(0))
        return f'\x01MD{idx}\x01'

    # 保护加粗
    text = re.sub(r'\*\*(.+?)\*\*', protect_md, text)
    # 保护斜体
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', protect_md, text)
    # 保护行内代码
    text = re.sub(r'`(.+?)`', protect_md, text)

    # 先处理已经转义的字符，避免重复转义
    placeholders = {
        r'\_': '\x00UNDERSCORE\x00',
        r'\&': '\x00AMPERSAND\x00',
        r'\%': '\x00PERCENT\x00',
        r'\$': '\x00DOLLAR\x00',
        r'\#': '\x00HASH\x00',
        r'\{': '\x00LBRACE\x00',
        r'\}': '\x00RBRACE\x00',
    }

    # 保护已转义的字符
    for escaped, placeholder in placeholders.items():
        text = text.replace(escaped, placeholder)

    # LaTeX 特殊字符
    special_chars = {
        '&': r'\&',
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
        '^': r'\textasciicircum{}',
    }

    for char, escaped in special_chars.items():
        text = text.replace(char, escaped)

    # 恢复已转义的字符
    for escaped, placeholder in placeholders.items():
        text = text.replace(placeholder, escaped)

    # 恢复 Markdown 格式并转换为 LaTeX
    for idx, original in enumerate(md_placeholders):
        placeholder = f'\x01MD{idx}\x01'
        # 转换 Markdown 为 LaTeX
        converted = original
        # 加粗
        converted = re.sub(r'\*\*(.+?)\*\*', r'\\textbf{\1}', converted)
        # 斜体
        converted = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'\\textit{\1}', converted)
        # 行内代码
        converted = re.sub(r'`(.+?)`', r'\\texttt{\1}', converted)
        text = text.replace(placeholder, converted)

    return text


def generate_latex(metadata: dict, sections: list[dict],
                   show_answer: bool = False,
                   is_subfile: bool = True) -> str:
    """
    生成 LaTeX 代码。

    Args:
        metadata: YAML 头部元数据
        sections: 解析后的 sections
        show_answer: 是否显示答案
        is_subfile: 是否生成子文件格式

    Returns:
        LaTeX 代码字符串
    """
    lines = []

    # 文件头
    if is_subfile:
        lines.append(r'% 由 md2latex.py 自动生成')
        lines.append(r'\documentclass[../main.tex]{subfiles}')
        lines.append(r'\begin{document}')
        lines.append('')

        # 本地设置
        lines.append(r'\localshowanswer{%s}' % ('true' if show_answer else 'false'))
        lines.append(r'\localshowquestion{true}')
        lines.append('')

    # 学校名称（放在子文件中，不修改 main.tex）
    if 'school' in metadata:
        lines.append(r'\setschool{%s}' % escape_latex(metadata['school']))

    # 主题色
    if 'theme' in metadata:
        lines.append(r'\setthemecolor{%s}' % metadata['theme'])

    if 'school' in metadata or 'theme' in metadata:
        lines.append('')

    # 试卷头部
    if 'title' in metadata:
        lines.append(r'\testheader{%s}' % escape_latex(metadata['title']))
        lines.append('')

    # 生成各 section
    for section in sections:
        lines.append(r'\section{%s}' % escape_latex(section['title']))
        lines.append('')

        questions = parse_questions(section['content'])

        if questions:
            lines.append(r'\begin{questions}')

            for q in questions:
                lines.extend(generate_question_latex(q))

            lines.append(r'\end{questions}')
            lines.append('')

    # 文件尾
    if is_subfile:
        lines.append(r'\end{document}')

    return '\n'.join(lines)


def generate_question_latex(q: dict) -> list[str]:
    """
    生成单个题目的 LaTeX 代码。

    Args:
        q: 题目字典

    Returns:
        LaTeX 代码行列表
    """
    lines = []

    # 题目开始
    lines.append(r'  \item \points{%d}' % q['points'])

    # 要求框（如果有）
    if q['essay_box']:
        lines.append(r'  \begin{essaybox}{%s}' % escape_latex(q['essay_box']))
        for item in q['essay_items']:
            lines.append(r'    \item %s' % escape_latex(item))
        lines.append(r'  \end{essaybox}')
        lines.append('')

    # 题干
    if q['stem']:
        stem_escaped = escape_latex(q['stem'])
        # 处理多行题干
        stem_lines = stem_escaped.split('\n')
        lines.append(r'  \question{%s}' % stem_lines[0])
        for extra_line in stem_lines[1:]:
            if extra_line.strip():
                lines.append(r'  %s' % extra_line)

    # 选择题选项
    if q['type'] == 'choice' and len(q['options']) == 4:
        options = [escape_latex(opt) for opt in q['options']]
        lines.append(r'  \choice{%s}{%s}{%s}{%s}{%d}' % (
            options[0], options[1], options[2], options[3], q['answer_num']
        ))

    # 答题区域
    if q['lines'] > 0:
        lines.append(r'  \answerlines{%d}' % q['lines'])

    if q['staff_lines'] > 0:
        lines.append(r'  \stafflines{%d}' % q['staff_lines'])

    if q['piano_staff'] > 0:
        lines.append(r'  \pianostaff{%d}' % q['piano_staff'])

    # 答案
    if q['answer'] and q['type'] != 'choice':
        answer_escaped = escape_latex(q['answer'])
        lines.append(r'  \answer{%s}' % answer_escaped)

    lines.append('')

    return lines


def convert_file(input_path: Path, output_path: Path,
                 show_answer: bool = False,
                 school: Optional[str] = None,
                 theme: Optional[str] = None) -> bool:
    """
    转换单个文件。

    Args:
        input_path: 输入 Markdown 文件路径
        output_path: 输出 LaTeX 文件路径
        show_answer: 是否显示答案
        school: 学校名称（覆盖 MD 中的设置）
        theme: 主题色（覆盖 MD 中的设置）

    Returns:
        是否成功
    """
    try:
        # 读取输入文件
        content = input_path.read_text(encoding='utf-8')

        # 解析
        metadata, remaining = parse_yaml_header(content)
        sections = parse_sections(remaining)

        # 命令行参数覆盖元数据
        if show_answer:
            metadata['show_answer'] = True
        if school:
            metadata['school'] = school
        if theme:
            metadata['theme'] = theme

        # 生成 LaTeX
        latex = generate_latex(
            metadata,
            sections,
            show_answer=metadata.get('show_answer', False)
        )

        # 写入输出文件
        output_path.write_text(latex, encoding='utf-8')

        print(f'✓ 转换成功: {input_path} -> {output_path}')
        return True

    except Exception as e:
        print(f'✗ 转换失败: {input_path} - {e}', file=sys.stderr)
        return False


def update_main_tex(main_path: Path, subfile_path: Path) -> bool:
    """
    更新 main.tex，仅添加子文件引用（不修改其他配置）。

    学校名称和主题色在子文件中设置，不修改 main.tex。

    Args:
        main_path: main.tex 文件路径
        subfile_path: 子文件路径

    Returns:
        是否成功
    """
    try:
        content = main_path.read_text(encoding='utf-8')

        # 计算相对路径（去掉 .tex 后缀）
        subfile_name = subfile_path.stem
        subfile_dir = subfile_path.parent.name
        subfile_ref = f'{subfile_dir}/{subfile_name}'

        # 检查是否已经引用了该子文件
        subfile_pattern = rf'\\subfile\{{{subfile_ref}\}}'
        if re.search(subfile_pattern, content):
            print(f'  子文件已存在于 main.tex: {subfile_ref}')
            return True

        # 移除示例子文件引用
        content = re.sub(r'\\subfile\{content/exam1\}\n?', '', content)
        content = re.sub(r'\\subfile\{content/exam2\}\n?', '', content)
        content = re.sub(r'%\s*\\subfile\{content/exam3\}.*\n?', '', content)
        content = re.sub(r'%\s*Add more subfiles.*\n?', '', content)

        # 在 \end{document} 前添加子文件引用
        end_doc = r'\end{document}'
        new_subfile = f'\\subfile{{{subfile_ref}}}\n\n{end_doc}'
        content = content.replace(end_doc, new_subfile)
        print(f'  添加子文件引用: {subfile_ref}')

        # 写回文件
        main_path.write_text(content, encoding='utf-8')
        print(f'✓ 更新 main.tex 成功')
        return True

    except Exception as e:
        print(f'✗ 更新 main.tex 失败: {e}', file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(
        description='将标准化 Markdown 试卷转换为 LaTeX 格式',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  %(prog)s exam.md -o exam.tex
  %(prog)s exam.md -o exam.tex --show-answer
  %(prog)s exam.md -o exam.tex --school "学校名称" --update-main main.tex
  %(prog)s *.md -o content/
        '''
    )

    parser.add_argument('input', nargs='+', help='输入 Markdown 文件')
    parser.add_argument('-o', '--output', required=True,
                        help='输出文件或目录')
    parser.add_argument('--show-answer', action='store_true',
                        help='显示答案')
    parser.add_argument('--theme', help='主题色 (十六进制)')
    parser.add_argument('--school', help='学校名称')
    parser.add_argument('--update-main', metavar='MAIN_TEX',
                        help='自动更新 main.tex（添加子文件引用和学校名称）')

    args = parser.parse_args()

    input_files = [Path(f) for f in args.input]
    output = Path(args.output)

    # 检查输入文件
    for f in input_files:
        if not f.exists():
            print(f'错误: 文件不存在 - {f}', file=sys.stderr)
            sys.exit(1)

    # 批量转换模式
    if len(input_files) > 1 or output.is_dir():
        # 输出必须是目录
        output.mkdir(parents=True, exist_ok=True)

        success = 0
        for input_file in input_files:
            output_file = output / input_file.with_suffix('.tex').name
            if convert_file(input_file, output_file, args.show_answer,
                          args.school, args.theme):
                success += 1
                # 更新 main.tex（仅添加子文件引用）
                if args.update_main:
                    update_main_tex(Path(args.update_main), output_file)

        print(f'\n转换完成: {success}/{len(input_files)} 个文件')

    else:
        # 单文件转换
        input_file = input_files[0]
        output_file = output if output.suffix == '.tex' else output / input_file.with_suffix('.tex').name

        if not convert_file(input_file, output_file, args.show_answer,
                          args.school, args.theme):
            sys.exit(1)

        # 更新 main.tex（仅添加子文件引用）
        if args.update_main:
            update_main_tex(Path(args.update_main), output_file)


if __name__ == '__main__':
    main()
