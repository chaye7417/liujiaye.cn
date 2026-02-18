#!/bin/bash
# 试卷工厂 一键部署脚本
# 用法: ./deploy.sh "提交信息"
set -e

SERVER="ubuntu@81.70.28.90"
REMOTE_DIR="/home/ubuntu/exam-factory"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MSG="${1:-update}"

echo ">>> 部署试卷工厂..."

# 1. 提交到 liujiaye.cn 仓库
echo ">>> 提交代码..."
cd "$REPO_DIR"
git add -A
git commit -m "$MSG" 2>/dev/null || echo "    (无新更改需要提交)"
git push

# 2. rsync 到服务器
echo ">>> 同步文件到服务器..."
rsync -avz --delete \
    --exclude '.git' \
    --exclude '.env' \
    --exclude 'data/' \
    --exclude 'venv/' \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude '.DS_Store' \
    "$SCRIPT_DIR/" "$SERVER:$REMOTE_DIR/"

# 3. 安装新依赖（如果 requirements.txt 有变化）
echo ">>> 检查依赖..."
ssh "$SERVER" "cd $REMOTE_DIR && source venv/bin/activate && pip install -r requirements.txt -q"

# 4. 重启服务
echo ">>> 重启服务..."
ssh "$SERVER" "sudo systemctl restart exam-factory"

# 5. 验证
sleep 2
ssh "$SERVER" "sudo systemctl is-active exam-factory"

echo ">>> 部署完成!"
