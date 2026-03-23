/**
 * 抖音图文(note)下载服务
 * 
 * 抖音 /note/ 路径的图文作品，yt-dlp 不支持
 * 通过抓取页面 API 获取图片列表
 */

const axios = require('axios');

/**
 * 获取抖音 redirect 后的真实 URL
 */
async function resolveUrl(shortUrl) {
  try {
    const res = await axios.get(shortUrl, {
      maxRedirects: 5,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
      }
    });
    return res.request.res.responseUrl || shortUrl;
  } catch (e) {
    // 手动从 error 获取重定向 URL
    if (e.response && e.response.request && e.response.request.res) {
      return e.response.request.res.responseUrl || shortUrl;
    }
    return shortUrl;
  }
}

/**
 * 从抖音页面提取 aweme_id
 */
function extractAwemeId(url) {
  // /note/7618008136192932346
  let match = url.match(/\/note\/(\d+)/);
  if (match) return match[1];
  // /video/7486945365568488246
  match = url.match(/\/video\/(\d+)/);
  if (match) return match[1];
  return null;
}

/**
 * 下载抖音图文作品
 * @param {string} url 抖音链接
 * @param {string} taskId 任务 ID
 * @param {function} onProgress 进度回调
 * @returns {Promise<{title, images: Array, thumbnailUrl, duration}>}
 */
async function downloadDouyinNote(url, taskId, onProgress) {
  if (onProgress) onProgress(5);

  // 1. 解析短链接
  const resolvedUrl = await resolveUrl(url);
  const awemeId = extractAwemeId(resolvedUrl);
  
  if (!awemeId) {
    throw new Error('无法解析抖音作品 ID');
  }

  if (onProgress) onProgress(15);

  // 2. 通过 API 获取作品详情
  const apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${awemeId}`;
  
  let data;
  try {
    const res = await axios.get(apiUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://www.douyin.com/',
        'Accept': 'application/json',
      }
    });
    data = res.data;
  } catch (e) {
    // 尝试移动端 API
    try {
      const mApiUrl = `https://www.iesdouyin.com/share/video/${awemeId}`;
      const res = await axios.get(mApiUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
        }
      });
      // 从页面提取 JSON 数据
      const jsonMatch = res.data.match(/window\._ROUTER_DATA\s*=\s*(\{.+?\})\s*<\/script>/s);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[1]);
      }
    } catch (e2) {
      // 最后尝试：直接抓取页面 HTML
      try {
        const res = await axios.get(resolvedUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
          }
        });
        // 尝试从 RENDER_DATA 提取
        const renderMatch = res.data.match(/self\.__pace_f\.push\(\[.*?"(\{\\?"aweme_id.*?\})".*?\]\)/s);
        if (renderMatch) {
          const parsed = JSON.parse(renderMatch[1].replace(/\\"/g, '"').replace(/\\\\"/g, '"'));
          data = parsed;
        } else {
          // 从 script 标签提取
          const scriptMatch = res.data.match(/<script[^>]*id="RENDER_DATA"[^>]*>(.*?)<\/script>/s);
          if (scriptMatch) {
            data = JSON.parse(decodeURIComponent(scriptMatch[1]));
          }
        }
      } catch (e3) {
        throw new Error('无法获取抖音作品详情，可能需要登录或作品已被删除');
      }
    }
  }

  if (onProgress) onProgress(40);

  // 3. 从返回数据中提取图片和标题
  const awemeDetail = data?.aweme_detail || data?.detail || data;
  const desc = awemeDetail?.desc || awemeDetail?.title || '抖音图文作品';
  const images = [];
  
  // 从不同数据结构中提取图片 URL
  const imageList = awemeDetail?.images || 
                    awemeDetail?.image_list || 
                    awemeDetail?.aweme_info?.images ||
                    [];
  
  for (const img of imageList) {
    const urlList = img?.url_list || img?.urlList || [];
    if (urlList.length > 0) {
      // 优先取最高质量（最后一个通常是原图）
      images.push(urlList[urlList.length - 1]);
    }
  }

  if (images.length === 0) {
    // 可能是视频而不是图文
    const videoUrl = awemeDetail?.video?.play_addr?.url_list?.[0] ||
                     awemeDetail?.video?.bit_rate?.[0]?.play_addr?.url_list?.[0];
    if (videoUrl) {
      throw new Error('这是一个视频作品，不是图文。视频下载请使用普通视频链接。');
    }
    throw new Error('未能提取到图片，作品可能已被删除或需要登录查看');
  }

  if (onProgress) onProgress(60);

  // 4. 下载图片到本地
  const fs = require('fs');
  const path = require('path');
  const downloadDir = path.join(__dirname, '../../downloads');
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

  const downloadedImages = [];
  for (let i = 0; i < images.length; i++) {
    try {
      const imgRes = await axios.get(images[i], {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
          'Referer': 'https://www.douyin.com/'
        }
      });
      const filename = `${taskId}_${i + 1}.jpg`;
      const filepath = path.join(downloadDir, filename);
      fs.writeFileSync(filepath, imgRes.data);
      downloadedImages.push({
        filename,
        path: filepath,
        url: `/download/${filename}`
      });
    } catch (imgErr) {
      console.error(`[douyin-note] Image ${i + 1} download failed:`, imgErr.message);
    }
    if (onProgress) onProgress(60 + Math.round((i + 1) / images.length * 35));
  }

  const thumbnailUrl = downloadedImages.length > 0 ? downloadedImages[0].url : '';

  if (onProgress) onProgress(100);

  return {
    title: desc,
    images: downloadedImages,
    thumbnailUrl,
    duration: 0,
    ext: 'note',
    isNote: true
  };
}

/**
 * 检测是否是抖音图文链接
 */
function isDouyinNote(url) {
  return /douyin\.com\/note\//.test(url);
}

module.exports = { downloadDouyinNote, isDouyinNote, resolveUrl, extractAwemeId };
