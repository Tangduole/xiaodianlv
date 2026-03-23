/**
 * 抖音专用下载器（不依赖 yt-dlp）
 * 
 * 通过 iesdouyin.com 移动端页面解析视频/图文/封面
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
        'Referer': 'https://www.douyin.com/',
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
 * 从 iesdouyin.com 页面解析作品数据
 */
async function parseDouyinPage(url) {
  // 先解析短链接
  let resolvedUrl;
  try {
    const res = await httpGet(url);
    resolvedUrl = res.finalUrl || url;
  } catch { resolvedUrl = url; }

  // 提取 aweme_id
  let awemeId;
  const noteMatch = resolvedUrl.match(/\/note\/(\d+)/);
  const videoMatch = resolvedUrl.match(/\/video\/(\d+)/);
  if (noteMatch) awemeId = noteMatch[1];
  else if (videoMatch) awemeId = videoMatch[1];
  else {
    // 从短链接路径提取
    const pathMatch = resolvedUrl.match(/\/([a-zA-Z0-9]{8,})\/?$/);
    if (!pathMatch) throw new Error('无法解析作品 ID');
    // 跳转到 PC 获取 ID
    try {
      const pcRes = await httpGet(resolvedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
      });
      const pcUrl = pcRes.finalUrl || resolvedUrl;
      const pcNote = pcUrl.match(/\/note\/(\d+)/);
      const pcVideo = pcUrl.match(/\/video\/(\d+)/);
      awemeId = pcNote?.[1] || pcVideo?.[1];
    } catch {}
    if (!awemeId) throw new Error('无法解析作品 ID');
  }

  // 通过 iesdouyin.com 获取数据
  const shareUrl = `https://www.iesdouyin.com/share/video/${awemeId}`;
  const res = await httpGet(shareUrl);
  const html = res.body;

  // 提取 _ROUTER_DATA
  const routerIdx = html.indexOf('_ROUTER_DATA');
  if (routerIdx === -1) throw new Error('页面解析失败');

  const jsonStart = html.indexOf('{', routerIdx);
  let depth = 0, jsonEnd = jsonStart;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { jsonEnd = i + 1; break; } }
  }

  const raw = html.substring(jsonStart, jsonEnd);
  const data = JSON.parse(raw);

  // 提取作品信息
  const result = {
    awemeId,
    title: '',
    type: 'unknown', // video, note, image
    videoUrl: '',
    audioUrl: '',
    coverUrl: '',
    images: [],
    duration: 0,
  };

  // 递归搜索
  function search(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(search); return; }
    
    if (obj.desc && typeof obj.desc === 'string' && obj.desc.length > result.title.length) {
      result.title = obj.desc;
    }
    
    // 图片列表
    if (obj.images && Array.isArray(obj.images) && obj.images.length > 0) {
      result.type = 'note';
      for (const img of obj.images) {
        const urls = img?.url_list || [];
        if (urls.length > 0) result.images.push(urls[urls.length - 1]);
      }
    }

    // 视频播放地址
    if (obj.play_addr && obj.play_addr.url_list) {
      const urls = obj.play_addr.url_list;
      // 过滤 playwm（水印版），优先无水印
      const noWatermark = urls.find(u => !u.includes('playwm') && u.includes('video_id'));
      const playUrl = noWatermark || urls[0];
      if (playUrl && (playUrl.includes('.mp4') || playUrl.includes('video_id'))) {
        if (obj.bit_rate || obj.width > 0 || playUrl.includes('aweme')) {
          result.videoUrl = playUrl;
          result.type = 'video';
          result.duration = obj.duration || result.duration;
        }
      }
      // 音频
      if (obj.uri && obj.uri.includes('.mp3')) {
        result.audioUrl = obj.uri;
      }
    }

    // 高清视频
    if (obj.bit_rate && Array.isArray(obj.bit_rate)) {
      for (const br of obj.bit_rate) {
        if (br.play_addr?.url_list?.[0]) {
          result.videoUrl = br.play_addr.url_list[0];
          result.type = 'video';
          break;
        }
      }
    }

    // 封面
    if (obj.cover?.url_list?.[0] && !result.coverUrl) {
      result.coverUrl = obj.cover.url_list[0];
    }
    if (obj.origin_cover?.url_list?.[0] && !result.coverUrl) {
      result.coverUrl = obj.origin_cover.url_list[0];
    }
    if (obj.dynamic_cover?.url_list?.[0] && !result.coverUrl) {
      result.coverUrl = obj.dynamic_cover.url_list[0];
    }

    // 时长
    if (obj.duration && obj.duration > result.duration) {
      result.duration = obj.duration;
    }

    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') search(v);
    }
  }

  search(data);

  if (!result.title) result.title = '抖音作品';
  if (result.images.length === 0 && !result.videoUrl && !result.audioUrl) {
    throw new Error('无法提取媒体文件，可能需要登录查看');
  }

  return result;
}

/**
 * 下载抖音作品（统一入口）
 */
async function downloadDouyin(url, taskId, onProgress) {
  const downloadDir = path.join(__dirname, '../../downloads');
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

  if (onProgress) onProgress(5, '解析链接');

  const info = await parseDouyinPage(url);
  if (onProgress) onProgress(30, '获取作品信息');

  console.log(`[douyin] Parsed: type=${info.type}, title="${info.title.substring(0, 50)}", images=${info.images.length}, video=${!!info.videoUrl}`);

  const result = {
    title: info.title,
    duration: info.duration,
    thumbnailUrl: '',
    subtitleFiles: [],
    images: [],
    isNote: false,
  };

  // 1. 下载封面
  if (info.coverUrl) {
    try {
      const coverBuf = await httpGet(info.coverUrl, { responseType: 'arraybuffer', timeout: 15000 });
      const coverPath = path.join(downloadDir, `${taskId}_thumb.jpg`);
      fs.writeFileSync(coverPath, coverBuf);
      result.thumbnailUrl = `/download/${taskId}_thumb.jpg`;
    } catch (e) {
      console.log('[douyin] cover download failed:', e.message);
    }
  }

  // 2. 图文作品 → 下载图片
  if (info.images.length > 0) {
    result.isNote = true;
    for (let i = 0; i < info.images.length; i++) {
      try {
        const buf = await httpGet(info.images[i], { responseType: 'arraybuffer', timeout: 30000 });
        const filename = `${taskId}_${i + 1}.jpg`;
        const filepath = path.join(downloadDir, filename);
        fs.writeFileSync(filepath, buf);
        result.images.push({ filename, path: filepath, url: `/download/${filename}` });
      } catch (e) {
        console.error(`[douyin] image ${i + 1} failed:`, e.message);
      }
      if (onProgress) onProgress(30 + Math.round((i + 1) / info.images.length * 60), `下载图片 ${i + 1}/${info.images.length}`);
    }
    if (onProgress) onProgress(100, '完成');
    result.ext = 'note';
    return result;
  }

  // 3. 视频作品 → 下载视频
  if (info.videoUrl) {
    if (onProgress) onProgress(35, '下载视频');

    let videoBuf;
    try {
      videoBuf = await httpGet(info.videoUrl, { responseType: 'arraybuffer', timeout: 120000 });
    } catch (e) {
      // 备用：试试 playwm 链接
      if (info.videoUrl.includes('playwm')) {
        // playwm 需要去掉水印参数
        const cleanUrl = info.videoUrl.replace('playwm', 'play');
        try { videoBuf = await httpGet(cleanUrl, { responseType: 'arraybuffer', timeout: 120000 }); }
        catch {}
      }
      if (!videoBuf) throw new Error(`视频下载失败: ${e.message}`);
    }

    const filename = `${taskId}.mp4`;
    const filepath = path.join(downloadDir, filename);
    fs.writeFileSync(filepath, videoBuf);

    result.filePath = filepath;
    result.ext = 'mp4';
    result.downloadUrl = `/download/${filename}`;

    if (onProgress) onProgress(100, '完成');
    return result;
  }

  // 4. 纯音频（图文配乐）
  if (info.audioUrl) {
    if (onProgress) onProgress(35, '下载音频');
    const audioBuf = await httpGet(info.audioUrl, { responseType: 'arraybuffer', timeout: 60000 });
    const filename = `${taskId}.mp3`;
    const filepath = path.join(downloadDir, filename);
    fs.writeFileSync(filepath, audioBuf);
    result.filePath = filepath;
    result.ext = 'mp3';
    result.downloadUrl = `/download/${filename}`;
    result.audioUrl = result.downloadUrl;
    if (onProgress) onProgress(100, '完成');
    return result;
  }

  throw new Error('没有可下载的媒体文件');
}

function isDouyinUrl(url) {
  return /douyin\.com|iesdouyin\.com/.test(url);
}

module.exports = { downloadDouyin, parseDouyinPage, isDouyinUrl };
