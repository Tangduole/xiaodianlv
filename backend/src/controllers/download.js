/**
 * 下载控制器 v3
 * 
 * v3 改进：
 * 1. 自动识别平台（前端驱动，后端兼容）
 * 2. 支持 options 数组：video/copywriting/cover/asr/subtitle
 * 3. 支持 saveTarget: phone/pc
 * 4. 支持 copywriting（提取描述）、cover（封面下载）、subtitle（字幕下载）
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

    let { url, platform, needAsr = false, options = ['video'], saveTarget = 'phone' } = req.body;

    // 从分享文本中提取 URL
    const { extractUrl } = require('../utils/validator');
    const extracted = extractUrl(url);
    if (extracted) url = extracted;

    // 平台自动识别
    const detectedPlatform = detectPlatform(url);
    const finalPlatform = platform || detectedPlatform || 'auto';

    // 兼容：前端 'audio' 选项
    const normalizedOptions = (Array.isArray(options) ? options : [options]).map(
      o => o === 'asr' ? 'audio' : o
    );

    const wantsAsr = needAsr;

    const limitStatus = getLimiterStatus();
    if (limitStatus.queued >= 10) {
      return res.json({ code: 429, message: '任务队列已满，请稍后再试' });
    }

    const taskId = uuidv4();
    const task = {
      taskId,
      url: url.trim(),
      platform: finalPlatform,
      needAsr: wantsAsr,
      options: normalizedOptions,
      saveTarget,
      status: 'pending',
      progress: 0,
      createdAt: Date.now()
    };

    store.save(task);

    // 抖音链接：走专用下载器（不依赖 yt-dlp）
    const { isDouyinUrl } = require('../services/douyin');
    if (isDouyinUrl(url)) {
      processDouyin(taskId, url, wantsAsr, normalizedOptions).catch(err => {
        console.error(`[task] ${taskId} douyin failed:`, err);
        store.update(taskId, { status: 'error', progress: 0, error: err.message });
      });
      return res.json({ code: 0, data: { taskId, status: 'pending', platform: finalPlatform } });
    }

    // 异步执行下载
    processDownload(taskId, url, wantsAsr, normalizedOptions).catch(err => {
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
async function processDownload(taskId, url, needAsr, options = ['video']) {
  try {
    const wantsVideo = options.includes('video');
    const wantsCopywriting = options.includes('copywriting');
    const wantsCover = options.includes('cover');
    const wantsAudio = options.includes('audio');
    const wantsSubtitle = options.includes('subtitle');

    // 1. 解析阶段
    store.update(taskId, { status: 'parsing', progress: 5 });

    let result = null;

    // 2. 需要实际下载的情况
    if (wantsVideo || wantsCover || wantsSubtitle || wantsAudio || needAsr) {
      store.update(taskId, { status: 'downloading', progress: 10 });

      result = await downloadWithLimit(async () => {
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

      const update = {
        status: 'completed',
        progress: 100,
        title: result.title,
        duration: result.duration,
        thumbnailUrl: result.thumbnailUrl,
      };

      // 视频下载链接
      if (wantsVideo) {
        update.filePath = result.filePath;
        update.ext = result.ext;
        update.downloadUrl = `/download/${path.basename(result.filePath)}`;
      }

      // 封面
      if (wantsCover && result.thumbnailUrl) {
        update.coverUrl = result.thumbnailUrl;
      }

      // 原声音频
      if (wantsAudio) {
        try {
          const audioPath = path.join(path.dirname(result.filePath), `${taskId}_audio.mp3`);
          await ytdlp.extractAudio(result.filePath, audioPath);
          update.audioUrl = `/download/${path.basename(audioPath)}`;
        } catch (audioErr) {
          console.error(`[audio] ${taskId} extract failed:`, audioErr);
        }
      }

      // 字幕
      if (wantsSubtitle && result.subtitleFiles && result.subtitleFiles.length > 0) {
        update.subtitleFiles = result.subtitleFiles;
      }

      store.update(taskId, update);
    } else if (wantsCopywriting) {
      // 仅文案：获取信息不下载
      const info = await ytdlp.getInfo(url);
      store.update(taskId, {
        status: 'completed',
        progress: 100,
        title: info.title,
        duration: info.duration,
        copyText: info.description || `标题: ${info.title}`,
      });
    }

    // 3. ASR（可选）
    if (needAsr && result) {
      store.update(taskId, { status: 'asr', progress: 100 });

      try {
        const audioPath = path.join(
          path.dirname(result.filePath),
          `${taskId}.mp3`
        );
        await ytdlp.extractAudio(result.filePath, audioPath);
        const text = await asr.transcribe(audioPath);

        store.update(taskId, {
          status: 'completed',
          asrText: text
        });

        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      } catch (asrError) {
        console.error(`[ASR] ${taskId} failed:`, asrError);
        store.update(taskId, { asrError: asrError.message });
      }
    }

    console.log(`[task] ${taskId} completed`);
  } catch (error) {
    console.error(`[task] ${taskId} failed:`, error);
    store.update(taskId, { status: 'error', error: error.message });
  }
}

/**
 * 处理抖音下载（视频/图文，不依赖 yt-dlp）
 */
async function processDouyin(taskId, url, needAsr, options = ['video']) {
  try {
    const { downloadDouyin } = require('../services/douyin');

    store.update(taskId, { status: 'parsing', progress: 5 });

    const result = await downloadDouyin(url, taskId, (percent, msg) => {
      store.update(taskId, {
        status: percent < 30 ? 'parsing' : 'downloading',
        progress: percent
      });
    });

    const update = {
      status: 'completed',
      progress: 100,
      title: result.title,
      thumbnailUrl: result.thumbnailUrl,
    };

    if (result.isNote && result.images) {
      update.isNote = true;
      update.imageFiles = result.images;
    }
    if (result.downloadUrl) {
      update.filePath = result.filePath;
      update.ext = result.ext;
      update.downloadUrl = result.downloadUrl;
    }
    if (result.audioUrl) {
      update.audioUrl = result.audioUrl;
    }

    store.update(taskId, update);
    console.log(`[task] ${taskId} douyin completed (images=${result.images?.length || 0}, video=${!!result.downloadUrl})`);
  } catch (error) {
    console.error(`[task] ${taskId} douyin failed:`, error);
    store.update(taskId, { status: 'error', error: error.message });
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
      copyText: task.copyText,
      coverUrl: task.coverUrl,
      audioUrl: task.audioUrl,
      imageFiles: task.imageFiles,
      isNote: task.isNote,
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
      version: '2.0.0',
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
