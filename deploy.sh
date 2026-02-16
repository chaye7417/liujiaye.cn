#!/bin/bash
# 一键部署脚本：提交 → 推送 → 服务器同步
set -e

SERVER="ubuntu@81.70.28.90"

echo "=== 1. 提交本地更改 ==="
git add -A
git commit -m "${1:-update: 部署更新}" || echo "没有新更改需要提交"

echo "=== 2. 推送到 GitHub ==="
git push origin master

echo "=== 3. 同步主页 + CircleBeats ==="
rsync -avz --delete --exclude='.git' website/ $SERVER:/home/ubuntu/website/

echo "=== 4. 同步试卷工厂 ==="
rsync -avz --delete \
    --exclude='.git' \
    --exclude='__pycache__' \
    --exclude='data' \
    --exclude='venv' \
    --exclude='.env' \
    exam-factory/ $SERVER:/home/ubuntu/exam-factory/

echo "=== 5. 重启试卷工厂服务 ==="
ssh $SERVER 'sudo systemctl restart exam-factory'

echo "=== 部署完成 ==="
