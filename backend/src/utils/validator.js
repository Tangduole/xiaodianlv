/**
 * 输入验证工具 v2
 * 
 * 修复：
 * 1. case 'x' || 'twitter' 逻辑错误 → case 'x': case 'twitter':
 * 2. 新增 bilibili、kuaishou 平台验证
 * 3. 放宽自动识别时的 URL 验证（短链接、分享链接）
 */

const ALLOWED_PLATFORMS = new Set(['douyin', 'tiktok', 'x', 'twitter', 'youtube', 'bilibili', 'kuaishou', 'auto']);

/**
 * 验证视频链接格式
 */
function validateUrl(url, platform) {
  if (!url || typeof url !== 'string') {
    return { valid: false, message: '链接不能为空' };
  }

  url = url.trim();

  if (url.length > 2048) {
    return { valid: false, message: '链接过长' };
  }

  // 检查 URL 格式（允许短链接不带协议）
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      new URL(url);
    } catch (e) {
      return { valid: false, message: '链接格式不正确' };
    }
  }

  // 如果指定了平台，检查对应格式
  if (platform && platform !== 'auto') {
    switch (platform) {
      case 'douyin':
        if (!url.includes('douyin.com') && !url.includes('douyin.cn') &&
            !url.includes('iesdouyin.com')) {
          return { valid: false, message: '抖音链接格式不正确' };
        }
        break;
      case 'tiktok':
        if (!url.includes('tiktok.com') && !url.includes('tiktok.cn')) {
          return { valid: false, message: 'TikTok 链接格式不正确' };
        }
        break;
      case 'x':
      case 'twitter':
        if (!url.includes('twitter.com') && !url.includes('x.com')) {
          return { valid: false, message: 'X (Twitter) 链接格式不正确' };
        }
        break;
      case 'youtube':
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
          return { valid: false, message: 'YouTube 链接格式不正确' };
        }
        break;
      case 'bilibili':
        if (!url.includes('bilibili.com') && !url.includes('b23.tv')) {
          return { valid: false, message: 'B站链接格式不正确' };
        }
        break;
      case 'kuaishou':
        if (!url.includes('kuaishou.com') && !url.includes('v.kuaishou.com')) {
          return { valid: false, message: '快手链接格式不正确' };
        }
        break;
    }
  }

  return { valid: true };
}

/**
 * 验证平台
 */
function validatePlatform(platform) {
  if (!platform || platform === 'auto') {
    return { valid: true };
  }

  if (!ALLOWED_PLATFORMS.has(platform.toLowerCase())) {
    return { valid: false, message: `不支持的平台: ${platform}` };
  }

  return { valid: true };
}

/**
 * 完整验证
 */
function validateInput(data) {
  const { url, platform } = data;

  const urlResult = validateUrl(url, platform);
  if (!urlResult.valid) return urlResult;

  const platformResult = validatePlatform(platform);
  if (!platformResult.valid) return platformResult;

  return { valid: true };
}

module.exports = {
  validateInput,
  validateUrl,
  validatePlatform,
  ALLOWED_PLATFORMS
};
