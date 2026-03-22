/**
 * API 路由 v2
 */

const express = require('express');
const {
  createDownload,
  getInfo,
  getStatus,
  getHistory,
  getSystemStatus,
  deleteTask
} = require('../controllers/download');

const router = express.Router();

// 创建下载任务
router.post('/download', createDownload);

// 获取视频信息（不下载）
router.get('/info', getInfo);

// 查询任务状态
router.get('/status/:taskId', getStatus);

// 获取历史记录
router.get('/history', getHistory);

// 删除任务
router.delete('/tasks/:taskId', deleteTask);

// 系统状态
router.get('/system/status', getSystemStatus);

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    code: 0,
    data: {
      status: 'ok',
      version: '1.2.0'
    }
  });
});

module.exports = router;
