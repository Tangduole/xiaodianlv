/**
 * 任务存储 v2 - JSON 文件持久化
 * 
 * 改进：
 * 1. 内存 + JSON 文件双写，重启不丢失
 * 2. 增加字段：thumbnailUrl, subtitleFiles, duration, url
 * 3. 文件清理联动
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const DOWNLOAD_DIR = path.join(__dirname, '../../downloads');

// 确保目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 内存缓存
const tasks = new Map();

// 启动时从文件加载
function loadFromFile() {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const data = fs.readFileSync(TASKS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      for (const task of parsed) {
        tasks.set(task.taskId, task);
      }
      console.log(`[store] Loaded ${tasks.size} tasks from disk`);
    }
  } catch (e) {
    console.error(`[store] Failed to load tasks: ${e.message}`);
  }
}

// 写入文件
function saveToFile() {
  try {
    const data = Array.from(tasks.values());
    fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[store] Failed to save tasks: ${e.message}`);
  }
}

// 节流写入（避免频繁 IO）
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveToFile();
  }, 1000);
}

function save(task) {
  tasks.set(task.taskId, task);
  scheduleSave();
  return task;
}

function get(taskId) {
  return tasks.get(taskId);
}

function list() {
  // 按创建时间倒序
  return Array.from(tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
}

function update(taskId, updates) {
  const task = tasks.get(taskId);
  if (task) {
    Object.assign(task, updates);
    scheduleSave();
    return task;
  }
  return null;
}

function remove(taskId) {
  const deleted = tasks.delete(taskId);
  if (deleted) scheduleSave();
  return deleted;
}

/**
 * 清理过期任务及其关联文件
 * @param {number} maxAgeMs 最大存活时间，默认 24 小时
 */
function cleanup(maxAgeMs = 86400000) {
  const now = Date.now();
  let count = 0;

  for (const [id, task] of tasks) {
    if ((task.status === 'completed' || task.status === 'error') && now - task.createdAt > maxAgeMs) {
      // 删除关联的下载文件
      try {
        const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(id));
        for (const file of files) {
          fs.unlinkSync(path.join(DOWNLOAD_DIR, file));
        }
      } catch (e) {
        console.error(`[cleanup] Failed to delete files for ${id}: ${e.message}`);
      }
      tasks.delete(id);
      count++;
    }
  }

  if (count > 0) {
    console.log(`[cleanup] Cleaned up ${count} expired tasks`);
    saveToFile();
  }
  return count;
}

/**
 * 删除任务及其所有关联文件
 */
function removeWithFiles(taskId) {
  const task = tasks.get(taskId);
  if (!task) return false;

  // 删除所有关联文件
  try {
    const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(taskId));
    for (const file of files) {
      fs.unlinkSync(path.join(DOWNLOAD_DIR, file));
    }
  } catch (e) {
    console.error(`[store] Failed to delete files for ${taskId}: ${e.message}`);
  }

  return remove(taskId);
}

// 启动时加载
loadFromFile();

// 定时清理（每 6 小时）
setInterval(() => cleanup(), 21600000);

// 首次启动时清理
cleanup();

module.exports = { save, get, list, update, remove, removeWithFiles, cleanup };
