/**
 * yt-dlp 下载服务封装 v2
 * 
 * 修复项：
 * 1. 用 spawn 替代 execFile，支持实时进度推送
 * 2. 修复 filePath const 赋值 bug
 * 3. 支持封面提取
 * 4. 支持字幕提取
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

// 下载目录
const DOWNLOAD_DIR = path.join(__dirname, '../../downloads');

// 确保下载目录存在
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

/**
 * 使用 yt-dlp 下载视频（支持实时进度）
 * @param {string} url 视频链接
 * @param {string} taskId 任务 ID
 * @param {function} onProgress 进度回调 (percent: number, speed: string, eta: string) => void
 * @returns {Promise<{title: string, filePath: string, ext: string, thumbnailUrl: string, duration: number}>}
 */
function download(url, taskId, onProgress) {
  return new Promise((resolve, reject) => {
    const outputTemplate = path.join(DOWNLOAD_DIR, `${taskId}.%(ext)s`);
    const thumbnailPath = path.join(DOWNLOAD_DIR, `${taskId}_thumb.jpg`);

    const args = [
      '--no-warnings',
      '--newline',              // 每行输出用于解析进度
      '--progress',             // 启用进度输出
      '--ignore-errors',
      '--retries', '3',
      '--fragment-retries', '3',
      '--socket-timeout', '30',
      '--no-check-certificates',
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--write-thumbnail',      // 下载封面
      '--write-auto-subs',      // 下载自动字幕
      '--sub-langs', 'zh-Hans,zh-Hant,en',
      '--sub-format', 'srt',
      '--no-check-certificates',
      '--output', outputTemplate,
      '--merge-output-format', 'mp4',
      url
    ];

    console.log(`[yt-dlp] Starting download: ${url} (taskId: ${taskId})`);

    let title = '';
    let duration = 0;
    let ext = 'mp4';
    let thumbnailUrl = '';
    let stderr = '';

    const proc = spawn('yt-dlp', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        // 解析标题
        const titleMatch = line.match(/^\[info\] Title: (.+)$/);
        if (titleMatch) title = titleMatch[1];

        // 解析时长
        const durationMatch = line.match(/^\[info\] Duration: (\d+):(\d+):(\d+)/);
        if (durationMatch) {
          duration = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseInt(durationMatch[3]);
        }
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      const lines = data.toString().split('\n');
      for (const line of lines) {
        // 解析下载进度行（yt-dlp --progress 格式）
        // 格式: [download]  45.2% of ~123.45MiB at 5.67MiB/s ETA 00:15
        const progressMatch = line.match(/\[download\]\s+([\d.]+)%.*?at\s+([\d.]+\w+\/s).*?ETA\s+(\S+)/);
        if (progressMatch && onProgress) {
          const percent = parseFloat(progressMatch[1]);
          const speed = progressMatch[2];
          const eta = progressMatch[3];
          // 映射到 0-90 的范围（留 10 给后续处理）
          onProgress(Math.round(percent * 0.9), speed, eta);
        }

        // 解析合并进度
        const mergeMatch = line.match(/\[Merger\]\s+Merging formats/i);
        if (mergeMatch && onProgress) {
          onProgress(92, '', '');
        }

        const subtitleMatch = line.match(/\[info\] Writing video subtitles/i);
        if (subtitleMatch && onProgress) {
          onProgress(95, '', '');
        }
      }
    });

    proc.on('close', (code) => {
      if (code !== 0 && !fs.existsSync(path.join(DOWNLOAD_DIR, `${taskId}.mp4`))) {
        // 尝试查找任何生成的文件
        const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(taskId) && !f.includes('_thumb'));
        if (files.length === 0) {
          console.error(`[yt-dlp] Error (code ${code}): ${stderr}`);
          reject(new Error(`yt-dlp download failed: ${stderr.substring(0, 500)}`));
          return;
        }
      }

      // 查找实际下载的视频文件
      let filePath;
      const videoFiles = fs.readdirSync(DOWNLOAD_DIR).filter(
        f => f.startsWith(taskId) && !f.includes('_thumb') && !f.endsWith('.srt') && !f.endsWith('.vtt')
      );

      if (videoFiles.length > 0) {
        const actualFile = videoFiles[0];
        ext = path.extname(actualFile).slice(1);
        filePath = path.join(DOWNLOAD_DIR, actualFile);
      } else {
        reject(new Error('Downloaded file not found'));
        return;
      }

      // 查找封面
      if (fs.existsSync(thumbnailPath)) {
        thumbnailUrl = `/download/${taskId}_thumb.jpg`;
      }

      // 查找字幕
      const subtitleFiles = fs.readdirSync(DOWNLOAD_DIR).filter(
        f => f.startsWith(taskId) && (f.endsWith('.srt') || f.endsWith('.vtt'))
      );

      console.log(`[yt-dlp] Download complete: ${filePath}`);

      if (onProgress) onProgress(100, '', '');

      resolve({
        title: title || 'unknown',
        filePath,
        ext,
        thumbnailUrl,
        subtitleFiles: subtitleFiles.map(f => ({
          filename: f,
          path: path.join(DOWNLOAD_DIR, f),
          url: `/download/${f}`
        })),
        duration
      });
    });

    proc.on('error', (err) => {
      console.error(`[yt-dlp] Spawn error: ${err.message}`);
      reject(new Error(`yt-dlp not found or failed to start: ${err.message}`));
    });
  });
}

/**
 * 仅获取视频信息（不下载）
 * @param {string} url
 * @returns {Promise<{title: string, duration: number, thumbnail: string, formats: Array}>}
 */
function getInfo(url) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-warnings',
      url
    ];

    let stdout = '';
    let stderr = '';

    const proc = spawn('yt-dlp', args);
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp info failed: ${stderr.substring(0, 500)}`));
        return;
      }
      try {
        const info = JSON.parse(stdout);
        resolve({
          title: info.title || 'unknown',
          description: info.description || '',
          duration: info.duration || 0,
          thumbnail: info.thumbnail || '',
          uploader: info.uploader || '',
          uploadDate: info.upload_date || '',
          viewCount: info.view_count || 0,
          formats: (info.formats || []).map(f => ({
            formatId: f.format_id,
            ext: f.ext,
            resolution: f.resolution || `${f.width}x${f.height}`,
            filesize: f.filesize || f.filesize_approx || 0,
            format: f.format || ''
          }))
        });
      } catch (e) {
        reject(new Error(`Failed to parse yt-dlp output: ${e.message}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * 提取音频为 MP3（使用 fluent-ffmpeg，更可靠）
 */
function extractAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(new Error(`FFmpeg audio extraction failed: ${err.message}`)))
      .run();
  });
}

function getDownloadPath(taskId, ext = 'mp4') {
  return path.join(DOWNLOAD_DIR, `${taskId}.${ext}`);
}

module.exports = { download, getInfo, extractAudio, getDownloadPath, DOWNLOAD_DIR };
