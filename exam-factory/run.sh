#!/bin/bash
# 试卷工厂启动脚本

set -e

# 加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 启动应用
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
