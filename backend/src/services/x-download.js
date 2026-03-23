/**
 * X/Twitter 视频下载器（不依赖 yt-dlp）
 * 
 * 通过 vxtwitter.com API 解析推文，提取视频直链
 * 不需要登录 cookies
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

function httpGet(rawUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 15000;
    let url;
    try { url = new URL(rawUrl); } catch { return reject(new Error('Invalid URL')); }
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        ...(options.headers || {})
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return httpGet(res.headers.location, options).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      if (options.responseType === 'arraybuffer') {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      } else {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf-8'), finalUrl: url.href }));
      }
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * 从 X/Twitter URL 提取 tweet ID
 */
function extractTweetId(url) {
  // x.com/user/status/123 or twitter.com/user/status/123 or x.com/i/status/123
  const m = url.match(/(?:twitter\.com|x\.com)\/(?:i\/)?(?:\w+\/)?status\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * 通过 vxtwitter API 解析推文
 */
async function parseTweet(url) {
  const tweetId = extractTweetId(url);
  if (!tweetId) throw new Error('无法解析推文链接');

  // 先解析重定向拿到完整 URL（包含用户名）
  let fullUrl;
  try {
    const res = await httpGet(url);
    fullUrl = res.finalUrl || url;
  } catch { fullUrl = url; }

  // 提取用户名和 ID
  const match = fullUrl.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/);
  const username = match ? match[1] : 'i';
  const id = match ? match[2] : tweetId;

  // vxtwitter API（多个镜像）
  const apis = [
    `https://api.vxtwitter.com/${username}/status/${id}`,
    `https://api.fxtwitter.com/${username}/status/${id}`,
  ];

  let lastError;
  for (const apiUrl of apis) {
    try {
      const res = await httpGet(apiUrl, { timeout: 10000 });
      const data = JSON.parse(res.body);

      const result = {
        tweetId: id,
        author: username,
        title: data.text || data.tweet?.text || '',
        tweetUrl: data.tweetURL || fullUrl,
        videoUrl: '',
        videoUrls: [],
        coverUrl: '',
        images: [],
      };

      // 提取视频 - media_extended 格式
      const media = data.media_extended || data.media || [];
      for (const m of media) {
        if (m.type === 'video') {
          result.videoUrls.push({
            url: m.url,
            type: m.type,
            width: m.width || 0,
            height: m.height || 0,
          });
        }
        if (m.type === 'image') {
          result.images.push(m.url);
        }
      }

      // 提取视频 - videos 格式（vxtwitter）
      const videos = data.videos || [];
      for (const v of videos) {
        result.videoUrls.push({
          url: v.url,
          type: v.type || 'video',
          bitrate: v.bitrate || 0,
        });
      }

      // 选择最高清视频
      if (result.videoUrls.length > 0) {
        // 按分辨率/码率排序，取最高
        result.videoUrls.sort((a, b) => (b.width || b.bitrate || 0) - (a.width || a.bitrate || 0));
        result.videoUrl = result.videoUrls[0].url;
      }

      // 封面
      if (!result.coverUrl && data.tweet?.card) {
        result.coverUrl = data.tweet.card.binding_values?.thumbnail_image_original?.url || '';
      }
      if (!result.coverUrl && result.videoUrls[0]?.thumbnail_url) {
        result.coverUrl = result.videoUrls[0].thumbnail_url;
      }

      if (result.videoUrls.length === 0 && result.images.length === 0) {
        throw new Error('该推文没有视频或图片');
      }

      return result;
    } catch (e) {
      lastError = e;
      console.log(`[x-download] ${apiUrl} failed:`, e.message);
    }
  }

  throw new Error(`推文解析失败: ${lastError?.message || '未知错误'}`);
}

/**
 * 下载 X/Twitter 视频
 */
async function downloadX(url, taskId, onProgress) {
  const downloadDir = path.join(__dirname, '../../downloads');
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

  if (onProgress) onProgress(5);

  const info = await parseTweet(url);
  if (onProgress) onProgress(25);

  const result = {
    title: `${info.author}: ${info.title.substring(0, 80)}`,
    duration: 0,
    thumbnailUrl: '',
    subtitleFiles: [],
  };

  // 下载封面
  if (info.coverUrl) {
    try {
      const buf = await httpGet(info.coverUrl, { responseType: 'arraybuffer', timeout: 10000 });
      const coverPath = path.join(downloadDir, `${taskId}_thumb.jpg`);
      fs.writeFileSync(coverPath, buf);
      result.thumbnailUrl = `/download/${taskId}_thumb.jpg`;
    } catch {}
  }

  // 下载视频
  if (info.videoUrl) {
    if (onProgress) onProgress(30, '下载视频');
    const buf = await httpGet(info.videoUrl, { responseType: 'arraybuffer', timeout: 120000 });
    const filename = `${taskId}.mp4`;
    const filepath = path.join(downloadDir, filename);
    fs.writeFileSync(filepath, buf);
    result.filePath = filepath;
    result.ext = 'mp4';
    result.downloadUrl = `/download/${filename}`;
    if (onProgress) onProgress(100);
    return result;
  }

  // 下载图片
  if (info.images.length > 0) {
    result.isNote = true;
    result.images = [];
    for (let i = 0; i < info.images.length; i++) {
      try {
        const buf = await httpGet(info.images[i], { responseType: 'arraybuffer', timeout: 30000 });
        const filename = `${taskId}_${i + 1}.jpg`;
        const filepath = path.join(downloadDir, filename);
        fs.writeFileSync(filepath, buf);
        result.images.push({ filename, path: filepath, url: `/download/${filename}` });
      } catch (e) {
        console.error(`[x-download] image ${i + 1} failed:`, e.message);
      }
      if (onProgress) onProgress(25 + Math.round((i + 1) / info.images.length * 70));
    }
    result.ext = 'images';
    if (onProgress) onProgress(100);
    return result;
  }

  throw new Error('没有可下载的媒体');
}

function isXUrl(url) {
  return /twitter\.com|x\.com/.test(url);
}

module.exports = { downloadX, parseTweet, isXUrl };
