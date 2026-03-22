/**
 * 下载控制器 v2
 * 
 * 改进：
 * 1. 使用 yt-dlp v2 的实时进度
 * 2. 支持封面和字幕
 * 3. 支持 getInfo 预览
 * 4. 修复 extractAudio 使用 fluent-ffmpeg
 * 5. 平台扩展：bilibili, kuaishou
 */

const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const ytdlp = require('../services/yt-dlp');
const asr = require('../services/asr');
const { validateInput } = require('../utils/validator');
const { executeWithRetry, downloadWithLimit, getLimiterStatus } = require('../utils/limiter');
const path = require('path');
const fs = require('fs');

/**
 * 创建下载任务
 */
async function createDownload(req, res) {
  try {
    const validation = validateInput(req.body);
    if (!validation.valid) {
      return res.json({ code: 400, message: validation.message });
    }

    const { url, platform, needAsr = false } = req.body;

    const limitStatus = getLimiterStatus();
    if (limitStatus.queued >= 10) {
      return res.json({ code: 429, message: '任务队列已满，请稍后再试' });
    }

    // 平台自动识别
    const detectedPlatform = detectPlatform(url);
    const finalPlatform = platform || detectedPlatform || 'auto';

    const taskId = uuidv4();
    const task = {
      taskId,
      url: url.trim(),
      platform: finalPlatform,
      needAsr,
      status: 'pending',
      progress: 0,
      createdAt: Date.now()
    };

    store.save(task);

    // 异步执行下载
    processDownload(taskId, url, needAsr).catch(err => {
      console.error(`[task] ${taskId} failed:`, err);
      store.update(taskId, {
        status: 'error',
        progress: 0,
        error: err.message
      });
    });

    res.json({
      code: 0,
      data: {
        taskId,
        status: 'pending',
        platform: finalPlatform
      }
    });
  } catch (e) {
    console.error('[createDownload] Error:', e);
    res.json({ code: 500, message: e.message });
  }
}

/**
 * 获取视频信息（不下载）
 */
async function getInfo(req, res) {
  try {
    const { url } = req.query;
    if (!url) {
      return res.json({ code: 400, message: '请提供 url 参数' });
    }

    const info = await ytdlp.getInfo(url);
    res.json({ code: 0, data: info });
  } catch (e) {
    res.json({ code: 500, message: e.message });
  }
}

/**
 * 处理下载任务（异步）
 */
async function processDownload(taskId, url, needAsr) {
  try {
    // 1. 解析阶段
    store.update(taskId, { status: 'parsing', progress: 5 });

    // 2. 下载阶段（带实时进度）
    store.update(taskId, { status: 'downloading', progress: 10 });

    const result = await downloadWithLimit(async () => {
      return await executeWithRetry(async () => {
        return await ytdlp.download(url, taskId, (percent, speed, eta) => {
          store.update(taskId, {
            status: 'downloading',
            progress: percent,
            speed,
            eta
          });
        });
      });
    });

    store.update(taskId, {
      status: 'completed',
      progress: 100,
      title: result.title,
      filePath: result.filePath,
      ext: result.ext,
      thumbnailUrl: result.thumbnailUrl,
      subtitleFiles: result.subtitleFiles || [],
      duration: result.duration,
      downloadUrl: `/download/${path.basename(result.filePath)}`
    });

    // 3. ASR（可选）
    if (needAsr) {
      store.update(taskId, { status: 'asr', progress: 100 });

      try {
        const audioPath = path.join(
          path.dirname(result.filePath),
          `${taskId}.mp3`
        );

        // 提取音频
        await ytdlp.extractAudio(result.filePath, audioPath);

        // ASR 转录
        const text = await asr.transcribe(audioPath);

        store.update(taskId, {
          status: 'completed',
          asrText: text
        });

        // 清理音频文件
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
      } catch (asrError) {
        console.error(`[ASR] ${taskId} failed:`, asrError);
        store.update(taskId, {
          asrError: asrError.message
        });
      }
    }

    console.log(`[task] ${taskId} completed: ${result.title}`);
  } catch (error) {
    console.error(`[task] ${taskId} failed:`, error);
    store.update(taskId, {
      status: 'error',
      error: error.message
    });
  }
}

/**
 * 平台自动识别
 */
function detectPlatform(url) {
  const patterns = {
    douyin: /douyin\.com|douyin\.cn|iesdouyin\.com/,
    tiktok: /tiktok\.com|tiktok\.cn/,
    x: /twitter\.com|x\.com/,
    youtube: /youtube\.com|youtu\.be/,
    bilibili: /bilibili\.com|b23\.tv/,
    kuaishou: /kuaishou\.com|v\.kuaishou\.com/
  };

  for (const [platform, pattern] of Object.entries(patterns)) {
    if (pattern.test(url)) {
      return platform;
    }
  }

  return null;
}

/**
 * 查询任务状态
 */
function getStatus(req, res) {
  const { taskId } = req.params;
  const task = store.get(taskId);

  if (!task) {
    return res.json({ code: 404, message: '任务不存在' });
  }

  res.json({
    code: 0,
    data: {
      taskId: task.taskId,
      url: task.url,
      status: task.status,
      progress: task.progress || 0,
      title: task.title,
      duration: task.duration,
      platform: task.platform,
      speed: task.speed,
      eta: task.eta,
      thumbnailUrl: task.thumbnailUrl,
      downloadUrl: task.downloadUrl,
      subtitleFiles: task.subtitleFiles || [],
      asrText: task.asrText,
      asrError: task.asrError,
      error: task.error,
      createdAt: task.createdAt
    }
  });
}

/**
 * 获取历史记录
 */
function getHistory(req, res) {
  const { limit = 50, offset = 0 } = req.query;
  const allTasks = store.list();
  const tasks = allTasks.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json({
    code: 0,
    data: {
      tasks,
      total: allTasks.length
    }
  });
}

/**
 * 获取系统状态
 */
function getSystemStatus(req, res) {
  const limiterStatus = getLimiterStatus();
  const tasks = store.list();

  res.json({
    code: 0,
    data: {
      version: '1.2.0',
      concurrency: limiterStatus,
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t =>
        t.status === 'pending' || t.status === 'parsing' ||
        t.status === 'downloading' || t.status === 'asr'
      ).length
    }
  });
}

/**
 * 删除任务
 */
function deleteTask(req, res) {
  const { taskId } = req.params;
  const task = store.get(taskId);

  if (!task) {
    return res.json({ code: 404, message: '任务不存在' });
  }

  store.removeWithFiles(taskId);

  res.json({ code: 0, message: '删除成功' });
}

module.exports = {
  createDownload,
  getInfo,
  getStatus,
  getHistory,
  getSystemStatus,
  deleteTask,
  detectPlatform
};
