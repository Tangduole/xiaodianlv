# 小电驴 Dockerfile
# 多阶段构建

# 阶段 1: 构建前端
FROM node:18-alpine as frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# 阶段 2: 后端 + 全栈
FROM python:3.11-slim as final

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    ffmpeg \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 安装 yt-dlp
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod a+x /usr/local/bin/yt-dlp

# 安装 faster-whisper
RUN pip install --no-cache-dir faster-whisper

WORKDIR /app

# 复制后端
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --production
WORKDIR /app

# 复制后端源码
COPY backend/src ./backend/src

# 复制构建好的前端
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 复制脚本
COPY scripts ./scripts

# 暴露端口
EXPOSE 3000

# 启动
CMD ["node", "backend/src/app.js"]
