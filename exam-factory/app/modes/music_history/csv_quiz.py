"""CSV 题库处理模块 - 解析 CSV、随机选题、打乱选项、生成 Markdown。"""

import csv
import io
import random
from typing import Optional


def parse_csv_questions(csv_text: str) -> list[dict]:
    """解析 CSV 文本为题目列表。

    支持格式：
    - 三选项：题号,问题,选项A,选项B,选项C,正确答案[,题源,难度]
    - 四选项：题号,问题,选项A,选项B,选项C,选项D,正确答案[,题源,难度]

    Args:
        csv_text: CSV 格式的文本内容

    Returns:
        题目字典列表，每个字典包含 question, options, answer 等字段

    Raises:
        ValueError: CSV 格式不正确
    """
    questions: list[dict] = []
    reader = csv.reader(io.StringIO(csv_text))

    header: list[str] = []
    for row in reader:
        # 跳过空行
        if not row or not any(cell.strip() for cell in row):
            continue

        # 检测表头行（包含"问题"和"选项"关键字）
        joined = "".join(row)
        if "问题" in joined and "选项" in joined:
            header = row
            continue

        # 至少需要 6 列（题号, 问题, A, B, C, 答案）
        if len(row) < 6:
            continue

        # 判断是三选项还是四选项
        # 四选项格式：题号,问题,A,B,C,D,答案,...
        # 三选项格式：题号,问题,A,B,C,答案,...
        has_four_options = len(row) >= 7 and row[6].strip().upper() in ("A", "B", "C", "D")

        if has_four_options:
            q = {
                "question": row[1].strip(),
                "options": [
                    row[2].strip(),
                    row[3].strip(),
                    row[4].strip(),
                    row[5].strip(),
                ],
                "answer": row[6].strip().upper(),
            }
            if len(row) > 7:
                q["source"] = row[7].strip()
            if len(row) > 8:
                q["difficulty"] = row[8].strip()
        else:
            q = {
                "question": row[1].strip(),
                "options": [
                    row[2].strip(),
                    row[3].strip(),
                    row[4].strip(),
                ],
                "answer": row[5].strip().upper(),
            }
            if len(row) > 6:
                q["source"] = row[6].strip()
            if len(row) > 7:
                q["difficulty"] = row[7].strip()

        # 过滤无效题目
        if q["question"] and all(o for o in q["options"]):
            questions.append(q)

    return questions


def shuffle_options(question: dict) -> dict:
    """打乱选项顺序，更新正确答案字母。

    Args:
        question: 包含 options 和 answer 的题目字典

    Returns:
        新的题目字典，选项已打乱，答案字母已更新
    """
    q = question.copy()
    options = list(q["options"])
    answer_letter = q["answer"]
    answer_idx = ord(answer_letter) - ord("A")

    # 获取正确答案文本
    if 0 <= answer_idx < len(options):
        correct_text = options[answer_idx]
    else:
        return q  # 答案索引无效，不打乱

    # 打乱选项
    random.shuffle(options)

    # 找到正确答案的新位置
    new_idx = options.index(correct_text)
    new_letter = chr(ord("A") + new_idx)

    q["options"] = options
    q["answer"] = new_letter
    return q


def select_questions(
    questions: list[dict],
    count: Optional[int] = None,
) -> list[dict]:
    """随机选择指定数量的题目。

    Args:
        questions: 全部题目列表
        count: 选题数量，0 或 None 表示全部

    Returns:
        选中的题目列表
    """
    if not count or count <= 0 or count >= len(questions):
        selected = list(questions)
        random.shuffle(selected)
        return selected

    return random.sample(questions, count)


def format_questions_markdown(
    selected: list[dict],
    points: int = 2,
    title: str = "音乐史选择题",
) -> str:
    """将已选择的题目列表格式化为 Markdown。

    Args:
        selected: 经过选择和打乱后的题目列表
        points: 每题分值
        title: 试卷标题

    Returns:
        Markdown 格式的试卷文本
    """
    lines: list[str] = [
        "---",
        f"title: {title}",
        "---",
        "",
        "# 选择题",
        "",
    ]

    for q in selected:
        lines.append(f"## [{points}分]")
        lines.append(q["question"])
        for i, opt in enumerate(q["options"]):
            letter = chr(ord("A") + i)
            lines.append(f"- {letter}. {opt}")
        lines.append(f"> 答案: {q['answer']}")
        lines.append("")

    total = len(selected) * points
    lines.append(f"<!-- 共 {len(selected)} 题，满分 {total} 分 -->")

    return "\n".join(lines)


def format_questions_latex_csv(selected: list[dict]) -> str:
    """将已选择的题目列表格式化为 LaTeX datatool 兼容的 CSV。

    输出格式：正确答案始终在选项A列，LaTeX 模板负责随机打乱选项。

    Args:
        selected: 经过选择的题目列表（不需要预先打乱选项）

    Returns:
        CSV 格式字符串，datatool 可直接加载
    """
    lines: list[str] = ["题号,问题,选项A,选项B,选项C,正确答案"]

    for i, q in enumerate(selected, 1):
        answer_idx = ord(q["answer"]) - ord("A")
        options = list(q["options"])

        # 将正确答案移到第一个位置（选项A）
        if 0 <= answer_idx < len(options):
            correct = options.pop(answer_idx)
            options.insert(0, correct)

        # 确保恰好 3 个选项
        while len(options) < 3:
            options.append("")
        options = options[:3]

        # CSV 字段用双引号包裹，内部双引号转义
        def esc(s: str) -> str:
            return '"' + s.replace('"', '""') + '"'

        fields = [str(i), esc(q["question"])] + [esc(o) for o in options] + ["A"]
        lines.append(",".join(fields))

    return "\n".join(lines)


def csv_to_markdown(csv_text: str, params: dict) -> str:
    """CSV 文本转标准 Markdown 试卷格式。

    Args:
        csv_text: CSV 格式的文本内容
        params: 参数字典，支持：
            - question_count: 选题数量（0 = 全部）
            - shuffle: 是否打乱选项（默认 True）
            - points_per_question: 每题分值（默认 2）
            - title: 试卷标题

    Returns:
        Markdown 格式的试卷文本
    """
    questions = parse_csv_questions(csv_text)
    if not questions:
        raise ValueError("CSV 中未找到有效题目，请检查格式")

    count = params.get("question_count", 0)
    do_shuffle = params.get("shuffle", True)
    points = params.get("points_per_question", 2)
    title = params.get("title", "音乐史选择题")

    # 选题
    selected = select_questions(questions, count)

    # 打乱选项
    if do_shuffle:
        selected = [shuffle_options(q) for q in selected]

    # 生成 Markdown
    lines: list[str] = [
        "---",
        f"title: {title}",
        "---",
        "",
        "# 选择题",
        "",
    ]

    for q in selected:
        lines.append(f"## [{points}分]")
        lines.append(q["question"])
        for i, opt in enumerate(q["options"]):
            letter = chr(ord("A") + i)
            lines.append(f"- {letter}. {opt}")
        lines.append(f"> 答案: {q['answer']}")
        lines.append("")

    total = len(selected) * points
    lines.append(f"<!-- 共 {len(selected)} 题，满分 {total} 分 -->")

    return "\n".join(lines)
