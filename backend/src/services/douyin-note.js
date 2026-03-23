/**
 * 抖音图文(note)下载服务
 * 
 * 抖音 /note/ 路径的图文作品，yt-dlp 不支持
 * 通过 HTTP 抓取页面，提取图片列表
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * HTTP GET 请求（用 Node 内置模块，不依赖 axios）
 */
function httpGet(rawUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 15000;
    const url = new URL(rawUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://www.douyin.com/',
        ...options.headers
      }
    }, (res) => {
      // 跟随重定向
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return httpGet(res.headers.location, options).then(resolve).catch(reject);
      }
      
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      
      if (options.responseType === 'arraybuffer') {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      } else {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({
          body: Buffer.concat(chunks).toString('utf-8'),
          finalUrl: url.href
        }));
      }
    });
    
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

/**
 * 从抖音页面提取 aweme_id
 */
function extractAwemeId(url) {
  let match = url.match(/\/note\/(\d+)/);
  if (match) return match[1];
  match = url.match(/\/video\/(\d+)/);
  if (match) return match[1];
  return null;
}

/**
 * 下载抖音图文作品
 */
async function downloadDouyinNote(url, taskId, onProgress) {
  const fs = require('fs');
  const path = require('path');
  
  if (onProgress) onProgress(5);
  
  // 1. 解析短链接获取真实 URL
  let resolvedUrl;
  try {
    const res = await httpGet(url);
    resolvedUrl = res.finalUrl || url;
  } catch {
    resolvedUrl = url;
  }
  
  const awemeId = extractAwemeId(resolvedUrl);
  if (!awemeId) {
    throw new Error('无法解析作品 ID');
  }
  if (onProgress) onProgress(15);
  
  // 2. 尝试多种方式获取作品数据
  let desc = '抖音图文作品';
  let imageUrls = [];
  
  // 方式 1: 移动端分享页面
  try {
    const res = await httpGet(`https://www.iesdouyin.com/share/video/${awemeId}`);
    const body = res.body;
    
    // 从 _ROUTER_DATA 提取
    const routerMatch = body.match(/self\.__pace_f\.push\(\[\s*\d+,\s*"[^"]*?",\s*(\{.*?\})\s*\]\)/s);
    if (routerMatch) {
      try {
        const raw = routerMatch[1].replace(/\\x22/g, '"').replace(/\\u002F/g, '/').replace(/\\"/g, '"');
        const data = JSON.parse(raw);
        desc = data?.aweme?.detail?.desc || data?.desc || desc;
        const imgs = data?.aweme?.detail?.images || data?.images || [];
        imageUrls = imgs.map(img => {
          const urls = img?.url_list || [];
          return urls[urls.length - 1] || urls[0] || '';
        }).filter(Boolean);
      } catch {}
    }
    
    // 从 RENDER_DATA 提取
    if (imageUrls.length === 0) {
      const renderMatch = body.match(/<script[^>]*id="RENDER_DATA"[^>]*>(.*?)<\/script>/s);
      if (renderMatch) {
        try {
          const decoded = decodeURIComponent(renderMatch[1]);
          const data = JSON.parse(decoded);
          const detail = data?.aweme?.detail || data?.detail || {};
          desc = detail?.desc || desc;
          const imgs = detail?.images || [];
          imageUrls = imgs.map(img => {
            const urls = img?.url_list || [];
            return urls[urls.length - 1] || urls[0] || '';
          }).filter(Boolean);
        } catch {}
      }
    }
  } catch (e) {
    console.log('[douyin-note] share page failed:', e.message);
  }
  
  // 方式 2: 直接抓取 PC 页面
  if (imageUrls.length === 0) {
    try {
      const res = await httpGet(resolvedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Cookie': 'ttwid=1'
        }
      });
      const body = res.body;
      
      // 尝试从 _ROUTER_DATA 提取
      const matches = body.matchAll(/self\.__pace_f\.push\(\[\s*\d+,\s*"[^"]*?",\s*(\{.*?\})\s*\]\)/gs);
      for (const m of matches) {
        try {
          const raw = m[1].replace(/\\x22/g, '"').replace(/\\u002F/g, '/').replace(/\\"/g, '"');
          const data = JSON.parse(raw);
          if (data?.aweme?.detail) {
            const detail = data.aweme.detail;
            desc = detail.desc || desc;
            const imgs = detail.images || [];
            imageUrls = imgs.map(img => {
              const urls = img?.url_list || [];
              return urls[urls.length - 1] || urls[0] || '';
            }).filter(Boolean);
            break;
          }
        } catch {}
      }
    } catch (e) {
      console.log('[douyin-note] PC page failed:', e.message);
    }
  }
  
  if (onProgress) onProgress(40);
  
  if (imageUrls.length === 0) {
    throw new Error('无法提取图片。可能原因：1) 作品已被删除 2) 需要登录才能查看 3) 不是图文作品');
  }
  
  // 3. 下载图片
  const downloadDir = path.join(__dirname, '../../downloads');
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });
  
  const downloadedImages = [];
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const buf = await httpGet(imageUrls[i], { responseType: 'arraybuffer', timeout: 30000 });
      const filename = `${taskId}_${i + 1}.jpg`;
      const filepath = path.join(downloadDir, filename);
      fs.writeFileSync(filepath, buf);
      downloadedImages.push({ filename, path: filepath, url: `/download/${filename}` });
    } catch (e) {
      console.error(`[douyin-note] image ${i + 1} failed:`, e.message);
    }
    if (onProgress) onProgress(40 + Math.round((i + 1) / imageUrls.length * 55));
  }
  
  if (onProgress) onProgress(100);
  
  return {
    title: desc,
    images: downloadedImages,
    thumbnailUrl: downloadedImages.length > 0 ? downloadedImages[0].url : '',
    duration: 0,
    ext: 'note',
    isNote: true
  };
}

function isDouyinNote(url) {
  return /douyin\.com\/note\//.test(url);
}

module.exports = { downloadDouyinNote, isDouyinNote };
