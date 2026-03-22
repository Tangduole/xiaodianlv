# 小电驴 - 视频下载工具 P-001

> 一个支持多平台视频下载 + 语音转文字的 Web/PWA 工具

## 功能

- ✅ 抖音 / TikTok 视频下载
- ✅ X (Twitter) 视频下载
- ✅ YouTube 视频下载
- ✅ B站视频下载
- ✅ 快手视频下载
- ✅ 自动平台识别
- ✅ 实时下载进度显示
- ✅ 视频封面下载 + 预览
- ✅ 字幕下载 (SRT)
- ✅ 语音转文字 (ASR) - 本地 Faster Whisper
- ✅ 历史记录（持久化存储）
- ✅ 文件自动清理（24小时过期）
- ✅ 并发控制 + 错误重试

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS + Vite
- **后端**: Node.js + Express
- **下载核心**: yt-dlp + ffmpeg
- **ASR**: Faster Whisper (本地) / 云端 API (待实现)
- **存储**: JSON 文件持久化

## 项目结构

```
P-001-xiaodianlv/
├── frontend/              # 前端 (React + TS + Tailwind)
│   ├── src/App.tsx       # 主页面（下载 + 历史）
│   ├── lib/api.ts        # API 封装
│   └── index.css         # Tailwind 样式
├── backend/              # 后端 (Node.js + Express)
│   ├── src/
│   │   ├── app.js        # 服务器入口
│   │   ├── controllers/  # 控制器
│   │   │   └── download.js
│   │   ├── services/     # 核心服务
│   │   │   ├── yt-dlp.js # yt-dlp 封装（实时进度）
│   │   │   └── asr.js    # ASR 语音转文字
│   │   ├── routes/       # API 路由
│   │   ├── utils/        # 工具（验证、限流、重试）
│   │   └── store.js      # 任务持久化存储
│   ├── data/             # 任务数据（自动生成）
│   └── downloads/        # 下载文件（自动生成）
├── scripts/
│   └── asr-transcribe.py # Whisper ASR 脚本
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 快速开始

### 依赖

```bash
# 系统依赖
sudo apt install yt-dlp ffmpeg python3 python3-pip
pip install faster-whisper

# Node.js 18+
node -v  # v18+
```

### 后端启动

```bash
cd backend
npm install
npm run dev   # 开发模式 (nodemon)
# 或
npm start     # 生产模式
```

### 前端启动

```bash
cd frontend
npm install
npm run dev   # 开发模式
npm run build # 构建
```

### Docker 部署

```bash
docker build -t xiaodianlv .
docker run -p 3000:3000 xiaodianlv
```

## API 文档

详见 [docs/api.md](./docs/api.md)

## 版本历史

### v1.2.0 (2026-03-22)
- 🔧 yt-dlp 实时进度（spawn 替代 execFile）
- 🔧 JSON 文件持久化存储
- 🔧 validator bug 修复
- ✨ 前端历史记录集成
- ✨ 封面预览 + 字幕下载
- ✨ B站/快手平台支持
- ✨ 文件自动清理（24h 过期）

### v1.0.0
- 初始版本：基础下载 + ASR

## 许可证

MIT
