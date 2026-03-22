# API 文档

## 基础 URL

```
http://your-server:3000/api
```

## 端点

### POST `/download`

创建一个新的下载任务。

**请求体:**
```json
{
  "url": "https://v.douyin.com/abcdef",
  "platform": "douyin",
  "needAsr": false
}
```

**参数:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | string | 是 | 视频链接 |
| `platform` | string | 是 | `douyin` \| `tiktok` \| `x` \| `youtube` |
| `needAsr` | boolean | 否 | 是否需要语音转文字，默认 `false` |

**响应:**
```json
{
  "code": 0,
  "data": {
    "taskId": "a1b2c3d4-xxxx",
    "status": "processing"
  }
}
```

---

### GET `/status/:taskId`

查询任务状态。

**响应 (处理中):**
```json
{
  "code": 0,
  "data": {
    "taskId": "a1b2c3d4-xxxx",
    "status": "processing",
    "progress": 50
  }
}
```

**响应 (完成):**
```json
{
  "code": 0,
  "data": {
    "taskId": "a1b2c3d4-xxxx",
    "status": "done",
    "title": "视频标题",
    "duration": 123,
    "downloadUrl": "/download/a1b2c3d4-xxxx.mp4",
    "asrText": "语音转文字结果..."
  }
}
```

**响应 (失败):**
```json
{
  "code": 1,
  "message": "下载失败: 链接无效或视频不存在"
}
```

---

### GET `/download/:filename`

下载处理好的视频文件。

---

### GET `/health`

健康检查。

**响应:**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

## 错误码

| code | 说明 |
|------|------|
| 0 | 成功 |
| 1 | 错误 |
| 400 | 参数错误 |
| 404 | 任务不存在 |
| 500 | 服务器错误 |
