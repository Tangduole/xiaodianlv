/**
 * ASR 语音转文字服务
 * 支持两种模式：
 * 1. 本地 Faster Whisper
 * 2. 云端 API (Volcengine / Minimax / 等)
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// 配置
const CONFIG = {
  mode: process.env.ASR_MODE || 'local', // local | volcengine | ...
  modelSize: process.env.WHISPER_MODEL || 'base', // tiny | base | small | medium | large-v3
  language: process.env.ASR_LANGUAGE || 'zh'
};

/**
 * 使用本地 faster-whisper 转文字
 */
function transcribeLocal(audioPath) {
  return new Promise((resolve, reject) => {
    // 这里调用 faster-whisper 的 python 脚本
    const scriptPath = path.join(__dirname, '../../../scripts/asr-transcribe.py');
    
    const args = [
      scriptPath,
      '--model', CONFIG.modelSize,
      '--language', CONFIG.language,
      audioPath
    ];

    console.log(`[ASR] Starting local transcription: ${audioPath}`);

    execFile('python3', args, (error, stdout, stderr) => {
      if (error) {
        console.error(`[ASR] Error: ${error.message}`);
        reject(error);
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result.text);
      } catch (e) {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * 占位：云端 ASR 实现
 */
async function transcribeCloud(audioPath) {
  throw new Error('Cloud ASR not implemented yet');
}

/**
 * 主入口
 */
async function transcribe(audioPath) {
  if (CONFIG.mode === 'local') {
    return transcribeLocal(audioPath);
  } else {
    return transcribeCloud(audioPath);
  }
}

module.exports = { transcribe, CONFIG };
