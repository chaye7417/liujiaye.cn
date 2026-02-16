# 试卷工厂 - 项目说明

## 项目简介

上传 Word/PDF 试卷文件 → AI 自动识别题目结构 → 生成排版精美的 LaTeX PDF（试题卷 + 答案卷）。

## 线上地址

| 项目 | 值 |
|------|----|
| **个人主页** | https://www.liujiaye.cn |
| **试卷工厂** | https://www.liujiaye.cn/workspace |
| **CircleBeats** | https://www.liujiaye.cn/circlebeats/ |
| **域名** | www.liujiaye.cn（阿里云 DNS，ICP 备案：冀ICP备2025114703号-1） |
| **服务器** | 腾讯云 Ubuntu 22.04（2核 4G），IP: 81.70.28.90 |
| **SSH** | `ssh ubuntu@81.70.28.90` |
| **SSL 证书** | 阿里云购买，存放 `/etc/nginx/ssl/liujiaye.cn.{pem,key}` |
| **服务器项目路径** | 试卷工厂: `/home/ubuntu/exam-factory`，主站: `/home/ubuntu/website` |
| **GitHub** | [exam-factory](https://github.com/chaye7417/exam-factory) / [liujiaye.cn](https://github.com/chaye7417/liujiaye.cn) |

## 技术栈

| 层 | 技术 |
|----|------|
| **后端** | FastAPI + Uvicorn |
| **前端** | Jinja2 模板 + 原生 JS |
| **数据库** | SQLite（aiosqlite 异步） |
| **AI** | DeepSeek / Anthropic API（流式 SSE） |
| **PDF 生成** | Markdown → LaTeX → XeLaTeX 编译 |
| **反向代理** | Nginx |
| **进程管理** | systemd（exam-factory.service） |

## 项目结构

```
试卷工厂/
├── app/                    # 后端核心
│   ├── main.py             # FastAPI 路由（上传、SSE 解析、PDF 生成、下载）
│   ├── ai_service.py       # AI API 调用（支持 Anthropic / OpenAI 格式，流式）
│   ├── pdf_generator.py    # MD → LaTeX → PDF 编译（试题卷 + 答案卷）
│   ├── file_parser.py      # 文件解析（docx / pdf / txt / md → 纯文本）
│   ├── auth.py             # 邮箱验证码登录 + JWT
│   ├── database.py         # SQLite 初始化 + 连接
│   └── config.py           # 配置项（环境变量读取）
│
├── scripts/
│   └── md2latex.py         # Markdown 试卷 → LaTeX 转换器
│
├── templates/              # Jinja2 页面模板
│   ├── base.html           # 基础布局
│   ├── index.html          # 首页
│   ├── login.html          # 登录页
│   └── workspace.html      # 工作台（上传→AI解析→编辑→下载）
│
├── static/css/style.css    # 全局样式
│
├── latex_templates/        # LaTeX 模板文件
│   ├── main-template.tex   # 主文件模板（编译入口）
│   ├── styles.sty          # 样式包（题目、选择题、答题区、五线谱等）
│   ├── NWBUV-B006-Horz.png # 页面装饰背景
│   ├── blank staff.pdf     # 五线谱空白谱表
│   ├── blank staff2.pdf    # 短谱表
│   └── piano staff.pdf     # 钢琴大谱表
│
├── data/                   # 运行时数据（.gitignore 排除）
│   ├── uploads/            # 用户上传的文件 + 提取的原始文本
│   ├── outputs/            # 生成的 LaTeX 工作目录和 PDF
│   └── exam_factory.db     # SQLite 数据库
│
├── .env                    # 环境变量（不提交，含 API Key）
├── .env.example            # 环境变量模板
├── requirements.txt        # Python 依赖
├── deploy.sh               # 一键部署脚本
└── run.sh                  # 本地启动脚本
```

## 用户流程（4 步）

1. **上传文件** → `POST /api/upload` → 返回 task_id
2. **AI 解析** → `GET /api/tasks/{id}/parse` → SSE 流式返回 Markdown
3. **编辑内容** → 用户修改 Markdown，确认后提交
4. **生成 PDF** → `POST /api/tasks/{id}/generate-pdf` → SSE 进度条 → 下载试题卷 + 答案卷

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload` | 上传文件，提取文本，创建任务 |
| GET | `/api/tasks/{id}/parse` | SSE 流式 AI 解析 |
| POST | `/api/tasks/{id}/update-markdown` | 保存编辑后的 Markdown |
| POST | `/api/tasks/{id}/generate-pdf` | SSE 生成试题卷+答案卷 PDF |
| GET | `/api/tasks/{id}/download?type=exam\|answer` | 下载 PDF |
| POST | `/api/auth/send-code` | 发送验证码 |
| POST | `/api/auth/login` | 验证码登录 |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/me` | 获取当前用户信息 |

## 数据库表

| 表 | 说明 |
|----|------|
| `users` | 用户（id, email） |
| `verify_codes` | 验证码（email, code, used） |
| `usage_log` | 使用日志（user_id, action） |
| `tasks` | 任务（user_id, title, school, theme, markdown_content, status） |

任务状态流转：`pending` → `draft`（AI 解析完成）→ `done`（PDF 生成完成）

## 关键配置（.env）

```bash
# AI API（当前使用 DeepSeek）
AI_PROVIDER=openai          # openai 或 anthropic
AI_API_BASE=https://api.deepseek.com
AI_API_KEY=sk-xxx
AI_MODEL=deepseek-chat

# 邮件验证码（暂未启用，get_current_user 临时放行）
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=

# JWT
JWT_SECRET=随机字符串
```

## 部署

```bash
# 一键部署（本地改完代码后执行）
./deploy.sh "描述改了什么"

# 手动部署
git add -A && git commit -m "xxx" && git push
ssh ubuntu@81.70.28.90 "cd /home/ubuntu/exam-factory && git pull && sudo systemctl restart exam-factory"
```

## 服务器运维

```bash
# 查看服务状态
ssh ubuntu@81.70.28.90 "sudo systemctl status exam-factory"

# 查看实时日志
ssh ubuntu@81.70.28.90 "sudo journalctl -u exam-factory -f"

# 重启服务
ssh ubuntu@81.70.28.90 "sudo systemctl restart exam-factory"

# Nginx 配置
ssh ubuntu@81.70.28.90 "cat /etc/nginx/sites-available/exam-factory"
```

## 已知问题 / TODO

- 邮箱验证未启用（`get_current_user` 临时返回 guest 用户）
- 没有 HTTPS（需要域名 + Let's Encrypt）
- AI 输入文本超过 15000 字符会被截断
- 每日使用限制 10 次（`MAX_DAILY_USES`）

