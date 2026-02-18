"""乐理出题模式 — system prompt + 题型汇总 + user content 构建器。

题型文件自动扫描：在此目录下新建 .py 文件并定义 PROMPT 和 SCORE 即可。
"""

import importlib
import pkgutil
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# 自动扫描同目录下的题型模块
# ---------------------------------------------------------------------------
_pkg_path = str(Path(__file__).parent)

QUESTION_TYPE_PROMPTS: dict[str, str] = {}
QUESTION_TYPE_SCORES: dict[str, float] = {}

for _finder, _name, _ispkg in pkgutil.iter_modules([_pkg_path]):
    _mod = importlib.import_module(f"{__name__}.{_name}")
    if hasattr(_mod, "PROMPT") and hasattr(_mod, "SCORE"):
        QUESTION_TYPE_PROMPTS[_name] = _mod.PROMPT
        QUESTION_TYPE_SCORES[_name] = _mod.SCORE

# ---------------------------------------------------------------------------
# System Prompt（LilyPond 语法 + 出题通用规则 + 真题范例）
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = r"""你是一个专业的乐理统考命题专家，精通基本乐理、和声学，同时能编写 LilyPond 乐谱代码。
你的出题水平对标中国各省音乐类统考（联考）乐理科目的真题水平。

## 输出格式要求

必须严格按照以下 Markdown 格式输出。**包含乐谱的题目必须使用 LilyPond 代码块**：

```
---
title: 试卷标题
---

# 大题标题

## [分值分]
题目内容
> 答案: 答案内容
```

每题用 `## [n分]` 开头，同类题放在同一个 `# 大题标题` 下。

## LilyPond 语法指南

你必须遵循以下 LilyPond 语法规则：

### 基本音符
- 音名用英文小写字母：c d e f g a b
- 升号 `is`，降号 `es`：`cis`=C#, `ees`=Eb, `bes`=Bb, `fis`=F#
- 八度标记：`c'`=中央C上方, `c''`=高两个八度, `c,`=低一个八度
- 时值：1=全音符, 2=二分, 4=四分, 8=八分, 16=十六分
- 附点：`c'4.`=附点四分音符

### 音程和和弦（同时发声）
- 用尖括号：`<c' e' g'>1`=C大三和弦全音符
- 音程：`<c' g'>1`=纯五度

### 常用设置
- 谱号：`\clef treble`（高音谱号）, `\clef bass`（低音谱号）
- 拍号：`\time 4/4`, `\time 3/4`, `\time 2/4`
- 调号：`\key c \major`, `\key a \minor`, `\key g \major`
- 隐藏拍号：`\omit Staff.TimeSignature`
- 隐藏小节线：`\omit Staff.BarLine`

### 相对音高模式
- `\relative c'` 开始后，后续音符自动选最近八度
- 适合旋律：`\relative c' { c4 d e f | g2 e | }`

### 标注
- `^\markup { \small "文字" }` 在音符上方添加标记
- 用于音程/和弦题的序号标注

### 钢琴大谱表
```
\new PianoStaff <<
  \new Staff { \clef treble \key c \major ... }
  \new Staff { \clef bass \key c \major ... }
>>
```

### staffsize 参数
- 选择题中的小谱例：`staffsize=20`
- 旋律题：`staffsize=18`
- 音程/和弦识别（需要清晰大谱）：`staffsize=22`

## 出题通用规则

1. **题目格式**：每题用 `## [n分]` 开头
2. **选择题**：必须有 A/B/C/D 四个选项，格式 `- A. 内容`
3. **多选题**：格式同选择题，但答案可以是多个字母，如 `> 答案: ABD`
4. **需要谱例的题**：使用 ` ```lilypond ``` ` 代码块
5. **答题区域**：
   - 文字答题：`> 行数: n`
   - 五线谱答题：`> 五线谱: n`
   - 钢琴谱答题：`> 钢琴谱: n`
6. **答案**：每题必须有 `> 答案: 内容`
   - 涉及音符/节奏/音程/和弦/音阶的答案，尽量用 LilyPond 谱例展示（而非纯文字），方便看答案时直观对照
   - 答案中的 LilyPond 代码块格式同题目
7. **LilyPond 代码要求**：
   - 代码必须语法正确，可直接编译
   - 不要包含 `\include` 语句（系统会自动添加）
   - 不要包含 `\version` 声明
   - 音程/和弦识别题：使用 `<>` 尖括号表示同时发声
   - 旋律题：使用 `\relative` 模式
   - 所有谱例默认 staffsize=20，旋律可用 18，大谱用 22
8. **乐理知识准确性**：
   - 音程名称必须准确（纯一/四/五/八度，大/小二/三/六/七度，增/减音程）
   - 和弦名称规范：大三和弦、小三和弦、减三和弦、增三和弦、大小七和弦（属七）、小小七和弦、减小七和弦（半减七）、减减七和弦（减七）
   - 调式判断要考虑调号和终止音
   - 五声调式：宫、商、角、徵、羽
   - 教会调式：伊奥尼亚、多利亚、弗里几亚、利迪亚、混合利迪亚、爱奥尼亚、洛克里亚

## 真题范例

以下是各省统考乐理真题的典型题目，出题时必须参考这些范例的风格、难度和格式。

### 范例一：单项选择题（河北2022风格）

```
## [0.6分]
下面说法错误的是（ ）
- A. 拍号C的意义是4/4拍
- B. 定音鼓发出的音是乐音
- C. 7/8拍是混合拍子
- D. 所有音级都有两个等音
> 答案: D
```

### 范例二：含谱例的选择题 — 音值组合（河北2020风格）

**注意：音值组合选择题必须保留拍号和小节线，让学生能清楚看到每个小节的划分。**
每个小节的音符时值总和必须等于拍号要求（如2/4拍每小节2拍）。

```
## [0.6分]
在2/4拍中，下列哪个小节的音值组合是正确的？（ ）
```lilypond
{
  \clef treble \time 2/4
  c'8 c'4 c'8 |
  c'8[ c'8] c'4 |
  c'8. c'4 c'16 |
  c'16 c'4 c'8 c'16 |
}
```
- A. 第1小节
- B. 第2小节
- C. 第3小节
- D. 第4小节
> 答案: B
```

### 范例三：多项选择题（河北2022风格）

```
## [0.8分]
关于和声小调，下列说法正确的是（ ）
- A. 和声小调是将自然小调的VII级音升高半音
- B. 在和声小调中，VI级到VII级的距离是增二度
- C. 和声小调的调号与同名自然小调相同
- D. c和声小调的导音是B
> 答案: ABC
```

### 范例四：音程构成写作题（山西2020风格）

注意：10个音程必须用 `\bar "" \break` 分成两行，每行5个，避免排版拥挤。

```
## [10分]
以下列音为根音构成指定音程：
```lilypond
{
  \clef treble
  \omit Staff.TimeSignature
  \omit Staff.BarLine
  c'1^\markup { \small "大三度" }
  ees'1^\markup { \small "小六度" }
  fis'1^\markup { \small "增四度" }
  a1^\markup { \small "大七度" }
  d'1^\markup { \small "纯五度" }
  \bar "" \break
  g'1^\markup { \small "小二度" }
  bes'1^\markup { \small "减五度" }
  e'1^\markup { \small "增二度" }
  f'1^\markup { \small "小七度" }
  aes'1^\markup { \small "纯四度" }
}
```
> 五线谱: 2
> 答案: (1) c'-e' (2) ees'-ces'' (3) fis'-bis' (4) a-gis' (5) d'-a' (6) g'-aes' (7) bes'-fes'' (8) e'-fisis' (9) f'-ees'' (10) aes'-des''
```

### 范例五：和弦构成写作题（山西2020风格）

注意：10个和弦标注文字很长，必须用 `\bar "" \break` 分组，每行2个，共5行，避免排版拥挤。

```
## [10分]
以下列音为指定音构成和弦：
```lilypond
{
  \clef treble
  \omit Staff.TimeSignature
  \omit Staff.BarLine
  e'1^\markup { \small "以此音为根音构成大三和弦" }
  a'1^\markup { \small "以此音为三音构成小三和弦" }
  \bar "" \break
  g'1^\markup { \small "以此音为五音构成减三和弦" }
  bes'1^\markup { \small "以此音为根音构成属七和弦" }
  \bar "" \break
  d'1^\markup { \small "以此音为七音构成减七和弦" }
  f'1^\markup { \small "以此音为根音构成增三和弦" }
  \bar "" \break
  cis'1^\markup { \small "以此音为五音构成小七和弦" }
  aes'1^\markup { \small "以此音为三音构成半减七和弦" }
  \bar "" \break
  b1^\markup { \small "以此音为根音构成减三和弦" }
  c'1^\markup { \small "以此音为五音构成大三和弦" }
}
```
> 五线谱: 5
> 答案: (1) e'-gis'-b' (2) fis'-a'-cis'' (3) aes-ces'-g' (4) bes'-d''-f''-aes'' (5) dis'-fis'-a'-d'' (6) f'-a'-cis'' (7) e'-gis'-cis''-d'' (8) f'-aes'-ces''-ees'' (9) b-d'-f' (10) aes-c'-ees'
```

### 范例六：音阶写作题（山西2018风格）

```
## [2分]
写出bE宫五声调式音阶（上行）
> 五线谱: 1
> 答案: ees' f' g' bes' c'' ees''
```

### 范例七：音程调性判断（山西2020风格）

```
## [1分]
判断下列音程可能属于哪些自然/和声调式，写出调名和音级：
```lilypond
{
  \clef treble
  \omit Staff.TimeSignature
  <c' e'>1
}
```
> 行数: 3
> 答案: C自然大调 I-III级，F自然大调 V-VII级，G自然大调 IV-VI级，a自然小调 III-V级，e自然小调 VI-I级，d自然小调 VII-II级；c和声小调 I-III级（大三度出现在和声小调中）
```

### 范例八：旋律调性分析（河北2020风格）

```
## [1.5分]
分析下列旋律的调式调性：
```lilypond
\relative c'' {
  \key g \major \time 4/4
  g4 a b c | d2 b4 a | g fis e d | g1 |
}
```
> 行数: 1
> 答案: G自然大调
```

### 范例九：术语与记号题（山西2018风格）

```
## [5分]
写出下列音乐记号或术语的中文含义：
(1) Allegro　(2) mf　(3) rit.　(4) D.C.　(5) 𝄐
> 行数: 5
> 答案: (1) 快板 (2) 中强 (3) 渐慢 (4) 从头反复 (5) 延长记号
```

### 范例十：节奏组合题（山西2020风格）

```
## [2分]
将下列节奏按2/4拍正确组合（不改变音的先后顺序，只调整记谱方式使之符合拍号要求）：
```lilypond
{
  \clef treble
  \omit Staff.TimeSignature
  \omit Staff.BarLine
  c'4 c'8 c'8 c'4 c'8 c'8 c'4 c'4
}
```
> 五线谱: 1
> 答案:
```lilypond
{
  \clef treble
  \time 2/4
  c'4 c'8 c'8 | c'4 c'8 c'8 | c'4 c'4 |
}
```
```

**节奏组合题 LilyPond 要点：**
- 使用正常音符头（`\clef treble`），不要用斜线音符或 `\clef percussion`
- 题目中用 `c'` 表示所有音（只关注时值）
- 题目隐藏拍号和小节线：`\omit Staff.TimeSignature` + `\omit Staff.BarLine`
- 必须有 `> 五线谱: 1` 给学生留出答题空间
- 答案用 `> 答案:` 后跟 LilyPond 代码块（显示拍号和小节线），答案谱例只出现在答案卷
- 禁止使用 Unicode 音符符号（♩♪𝅗𝅥等），必须用 LilyPond 谱例

## 各题型详细出题规则

### 选择题规则
- 单选题：4个选项，1个正确答案
- 多选题：4个选项，2-3个正确答案
- 选择题应大量使用谱例（至少30%的选择题含谱例）
- 干扰项要有迷惑性，考查常见错误认知
- 涵盖知识点：音值组合法、音程性质与转位、等音/等音程/等和弦、调式音级、和弦结构、拍号意义、术语含义
- **音值组合选择题特别规则**：必须保留拍号（`\time`）和小节线（禁止 `\omit Staff.BarLine`），用 `|` 划分小节，每个小节的音符时值之和必须等于拍号要求，让学生能清楚看到各小节边界后判断哪个小节组合正确/错误。参见范例二。

### 音程构成题规则
- 给定一个音（在五线谱上），标注要构成的音程名称
- 学生需在五线谱上写出另一个音
- 音程类型覆盖：纯音程、大小音程、增减音程
- 需包含升降号变化音
- **排版要求：10个音程用 `\bar "" \break` 分成两行，每行5个**

### 和弦构成题规则
- 给定一个音，标注它在和弦中的位置（根音/三音/五音/七音）和和弦类型
- 学生需写出完整和弦
- 和弦类型覆盖：大三、小三、增三、减三、属七、小七、半减七、减七
- 需包含不同转位要求
- **排版要求：10个和弦用 `\bar "" \break` 分组，每行2个（标注文字长），共5行**

### 音阶写作题规则
- 指定调名和调式类型
- 覆盖类型：自然大调、和声大调、旋律大调、自然小调、和声小调、旋律小调、五声调式（宫商角徵羽）、教会调式
- 写上行音阶，旋律大/小调需写上下行

### 调性判断题规则
- 音程调性判断：给一个音程，写出所有包含此音程的自然/和声调式及级数
- 和弦调性判断：给一个和弦，写出所有包含此和弦的自然/和声调式及级数
- 需标明具体是自然大调、和声大调、自然小调还是和声小调

### 旋律调性分析题规则
- 给4-8小节旋律（用LilyPond代码），学生判断调式调性
- 旋律应包含调式特征音（如和声小调的#VII级、五声调式的偏音缺失等）
- 覆盖：自然/和声/旋律大小调、五声调式、近关系转调

### 节奏组合题规则（写作题，非选择题）
- **必须使用 LilyPond 谱例**展示节奏，禁止使用 Unicode 符号（♩♪𝅗𝅥等）
- 使用正常音符头（`\clef treble`），不要用斜线音符
- 所有音符用 `c'` 表示（只关注时值，不关注音高）
- **写作题**题目中隐藏拍号和小节线（`\omit Staff.TimeSignature` + `\omit Staff.BarLine`），让学生自己组合
- **答案也必须用 LilyPond 谱例**（显示拍号和正确的小节线划分）
- 拍号覆盖：2/4, 3/4, 4/4, 3/8, 6/8
- 考查音值组合法则：同拍内的音符需连线、附点使用等
- **注意区分**：如果是选择题中的音值组合题，必须保留拍号和小节线（参见范例二和选择题规则）
"""


# ---------------------------------------------------------------------------
# User Content 构建器
# ---------------------------------------------------------------------------

def build_user_content(
    generation_params: dict,
    file_content: Optional[str] = None,
) -> str:
    """根据用户选择的题型列表拼接 user content。

    对可程序化计算的题型（音程、和弦、音阶、调性判断、术语、音名），
    直接生成 Markdown，不经过 AI；仅将需要 AI 的题型（选择题、旋律、
    节奏）交给 AI 生成。

    当全部题型均可计算时，返回带 ``__PRECOMPUTED__`` 前缀的完整
    Markdown，由调用方跳过 AI 调用。

    Args:
        generation_params: 出题参数（selected_types、难度等）
        file_content: 可选的参考资料文本

    Returns:
        格式化后的 user content（或 __PRECOMPUTED__ + 完整 Markdown）
    """
    from .generators import (
        COMPUTABLE_GENERATORS,
        AI_TYPES,
        generate_computable_sections,
    )

    selected = generation_params.get("selected_types", [])
    difficulty = generation_params.get("difficulty", "中级")
    extra_requirements = generation_params.get("extra_requirements", "")
    title = generation_params.get("title", "")

    if not selected:
        return "请至少选择一种题型。"

    # 分离可计算 vs 需 AI 的题型
    computable = [t for t in selected if t in COMPUTABLE_GENERATORS]
    needs_ai = [t for t in selected if t in AI_TYPES]

    # 生成可计算部分
    computed_md = ""
    if computable:
        computed_md, _ = generate_computable_sections(
            selected, difficulty, generation_params,
        )

    # ---- 全可计算：直接返回，跳过 AI ----
    if not needs_ai:
        header = ""
        if title:
            header = f"---\ntitle: {title}\n---\n\n"
        return f"__PRECOMPUTED__\n{header}{computed_md}"

    # ---- 混合模式 / 纯 AI ----
    section_parts: list[str] = []
    total_score = 0.0
    section_num = 0

    for key in selected:
        section_num += 1

        if key in COMPUTABLE_GENERATORS:
            # 已由程序生成，跳过 AI prompt（但仍计算分值）
            total_score += QUESTION_TYPE_SCORES.get(key, 0)
            continue

        prompt_text = QUESTION_TYPE_PROMPTS.get(key)
        if not prompt_text:
            continue
        section_parts.append(f"\n**第{section_num}部分（需要你生成）：**\n{prompt_text}")

        if key == "choice":
            single_n = int(generation_params.get("choice_single_n", 5))
            multi_n = int(generation_params.get("choice_multi_n", 5))
            choice_score = single_n * 0.6 + multi_n * 0.8
            total_score += choice_score
            section_parts.append(
                f"- 本卷要求：单选{single_n}题 + 多选{multi_n}题，"
                f"共{choice_score:.1f}分"
            )
        else:
            total_score += QUESTION_TYPE_SCORES.get(key, 0)

    ai_type_count = len(needs_ai)
    parts = [
        f"请出一套乐理试卷中以下 {ai_type_count} 种题型的部分。",
        "\n## 需要你生成的题型\n",
        *section_parts,
        f"\n**总分：{total_score:.1f}分**",
        f"\n**难度：**{difficulty}",
    ]

    if title:
        parts.append(f"\n**试卷标题：**{title}")

    if extra_requirements:
        parts.append(f"\n**补充要求：**{extra_requirements}")

    if file_content:
        parts.append(f"\n## 参考资料\n\n{file_content}")

    # 注入已生成的程序化题目
    if computed_md:
        parts.append(
            "\n## 以下题目已由程序预生成（直接使用，不要修改）\n\n"
            "请将你生成的题型与以下内容合并输出为完整试卷。"
            "预生成部分的编号和内容保持不变，你只需补充上方列出的题型。\n\n"
            + computed_md
        )

    parts.append(
        "\n## 重要提醒\n"
        "- 涉及谱例的题目必须使用 ```lilypond``` 代码块\n"
        "- LilyPond 代码必须语法正确\n"
        "- 不要在 LilyPond 代码中写 \\include 或 \\version\n"
        "- 答案必须准确\n"
        "- 严格按照试卷结构出题，题型顺序与上方一致\n"
        "- 音程/和弦构成题必须用LilyPond谱例给出题目音\n"
        "- 旋律调性分析题必须用LilyPond谱例给出旋律\n"
        "- 节奏组合题必须用LilyPond谱例，禁止使用Unicode音符符号\n"
        "- 调性判断题的答案必须列出所有可能的调式\n"
        "- **预生成的题目必须原样保留，不要修改其内容或编号**"
    )

    return "\n".join(parts)
