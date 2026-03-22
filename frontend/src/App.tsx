import { useState, useEffect, useCallback } from 'react'
import {
  type Task,
  type Platform,
  platformLabels,
  formatDuration,
  createDownload,
  getTaskStatus,
  getHistory,
  deleteTask,
} from '../lib/api'
import '../index.css'

const platforms: Platform[] = ['auto', 'douyin', 'tiktok', 'x', 'youtube', 'bilibili', 'kuaishou']

function App() {
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState<Platform>('auto')
  const [needAsr, setNeedAsr] = useState(false)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<Task[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [page, setPage] = useState<'home' | 'history'>('home')

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    try {
      const data = await getHistory(50, 0)
      setHistory(data.tasks)
    } catch {
      // 静默失败
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // 轮询当前任务状态
  useEffect(() => {
    if (!activeTask || activeTask.status === 'completed' || activeTask.status === 'error') return

    const interval = setInterval(async () => {
      try {
        const updated = await getTaskStatus(activeTask.taskId)
        setActiveTask(updated)
        if (updated.status === 'completed') {
          loadHistory() // 刷新历史
        }
        if (updated.status === 'completed' || updated.status === 'error') {
          clearInterval(interval)
        }
      } catch {
        // 静默
      }
    }, 1500)

    return () => clearInterval(interval)
  }, [activeTask, loadHistory])

  // 提交下载
  const handleSubmit = async () => {
    if (!url.trim()) {
      setError('请输入视频链接')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await createDownload({ url: url.trim(), platform, needAsr })
      setActiveTask({ taskId: result.taskId, url: url.trim(), platform: result.platform, needAsr, status: 'pending', progress: 0, createdAt: Date.now() })
      setUrl('')
      setPage('home')
    } catch (err: any) {
      setError(err.response?.data?.message || '创建任务失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除任务
  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId)
      setHistory(prev => prev.filter(t => t.taskId !== taskId))
      if (activeTask?.taskId === taskId) setActiveTask(null)
    } catch {
      // 静默
    }
  }

  // 重新打开历史任务
  const openHistoryTask = (task: Task) => {
    setActiveTask(task)
    setPage('home')
  }

  // 粘贴剪贴板
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
    } catch {
      // 剪贴板权限问题
    }
  }

  const statusConfig: Record<string, { icon: string; label: string; color: string }> = {
    pending: { icon: '⏳', label: '排队中', color: 'text-yellow-600' },
    parsing: { icon: '🔍', label: '解析中', color: 'text-blue-600' },
    downloading: { icon: '⬇️', label: '下载中', color: 'text-blue-600' },
    asr: { icon: '🎤', label: '语音识别中', color: 'text-purple-600' },
    completed: { icon: '✅', label: '完成', color: 'text-green-600' },
    error: { icon: '❌', label: '失败', color: 'text-red-600' },
  }

  const renderTaskCard = (task: Task) => {
    const status = statusConfig[task.status] || statusConfig.pending
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
        {/* 封面 + 信息 */}
        <div className="flex gap-4 mb-4">
          {task.thumbnailUrl && (
            <img
              src={task.thumbnailUrl}
              alt={task.title || '封面'}
              className="w-28 h-20 object-cover rounded-lg flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {task.title || '未知标题'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {task.platform && (
                <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded">
                  {platformLabels[task.platform] || task.platform}
                </span>
              )}
              {task.duration && (
                <span className="text-xs text-gray-500">{formatDuration(task.duration)}</span>
              )}
            </div>
          </div>
          <div className={`${status.color} text-lg`}>{status.icon}</div>
        </div>

        {/* 进度条 */}
        {(task.status === 'downloading' || task.status === 'parsing') && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{status.label}</span>
              <span>{task.progress}%{task.speed ? ` · ${task.speed}` : ''}{task.eta ? ` · ETA ${task.eta}` : ''}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="h-full bg-[#FF6B35] rounded-full transition-all duration-500"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        )}

        {task.status === 'asr' && (
          <div className="flex items-center gap-2 text-sm text-purple-600 mb-3">
            <span className="inline-block w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            语音转文字处理中...
          </div>
        )}

        {/* 下载按钮 */}
        {task.status === 'completed' && task.downloadUrl && (
          <div className="flex gap-2">
            <a
              href={task.downloadUrl}
              download
              className="flex-1 text-center bg-[#FF6B35] hover:bg-[#E55A2B] text-white font-medium py-2.5 rounded-xl transition text-sm"
            >
              📥 下载视频
            </a>
            {task.subtitleFiles && task.subtitleFiles.length > 0 && (
              <div className="relative group">
                <button className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition text-sm">
                  💬 字幕
                </button>
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[120px] hidden group-hover:block z-10">
                  {task.subtitleFiles.map((sub) => (
                    <a
                      key={sub.filename}
                      href={sub.url}
                      download={sub.filename}
                      className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                    >
                      {sub.filename}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 错误信息 */}
        {task.status === 'error' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {task.error || '下载失败'}
          </div>
        )}

        {/* ASR 结果 */}
        {task.asrText && (
          <details className="mt-3">
            <summary className="text-sm text-purple-600 cursor-pointer hover:text-purple-700">
              🎤 语音转文字结果
            </summary>
            <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">
              {task.asrText}
            </p>
          </details>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#FF6B35] to-orange-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🛵 小电驴</h1>
              <p className="text-orange-100 text-sm mt-0.5">多平台视频下载 + 语音转文字</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage('home')}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${page === 'home' ? 'bg-white/20' : 'hover:bg-white/10'}`}
              >
                下载
              </button>
              <button
                onClick={() => { setPage('history'); loadHistory() }}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${page === 'history' ? 'bg-white/20' : 'hover:bg-white/10'}`}
              >
                📋 历史
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {page === 'home' && (
          <>
            {/* 输入卡片 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">📥 下载视频</h2>

              {/* 链接输入 */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="粘贴视频分享链接..."
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent outline-none text-sm"
                  />
                  <button
                    onClick={handlePaste}
                    className="px-3 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition text-sm"
                    title="粘贴"
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* 平台选择 */}
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {platforms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPlatform(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        platform === p
                          ? 'bg-[#FF6B35] text-white shadow'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {platformLabels[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* ASR 选项 */}
              <label className="flex items-center gap-2 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={needAsr}
                  onChange={(e) => setNeedAsr(e.target.checked)}
                  className="w-4 h-4 text-[#FF6B35] rounded"
                />
                <span className="text-sm text-gray-700">🎤 语音转文字 (ASR)</span>
              </label>

              {/* 错误提示 */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* 提交按钮 */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className={`w-full py-3 rounded-xl font-semibold text-white transition text-sm ${
                  loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#FF6B35] hover:bg-[#E55A2B] shadow-lg'
                }`}
              >
                {loading ? '提交中...' : '🚀 开始下载'}
              </button>
            </div>

            {/* 当前任务 */}
            {activeTask && renderTaskCard(activeTask)}
          </>
        )}

        {page === 'history' && (
          <>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">📋 下载历史</h2>
            {history.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                <p className="text-4xl mb-3">📭</p>
                <p>暂无下载记录</p>
              </div>
            ) : (
              <div>
                {history.map((task) => (
                  <div key={task.taskId} className="relative group">
                    <div
                      className="cursor-pointer"
                      onClick={() => openHistoryTask(task)}
                    >
                      {renderTaskCard(task)}
                    </div>
                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(task.taskId) }}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition text-xs"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* 使用说明（首页底部） */}
        {page === 'home' && !activeTask && (
          <div className="bg-white/80 rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">📖 使用说明</h3>
            <div className="space-y-2 text-xs text-gray-500">
              <p>1. 粘贴视频分享链接</p>
              <p>2. 选择平台（或自动识别）</p>
              <p>3. 可选：勾选语音转文字</p>
              <p>4. 点击下载，等待完成</p>
            </div>
            <div className="mt-3 p-2 bg-orange-50 rounded-lg text-xs text-orange-600">
              ⚠️ 请尊重版权，仅供个人学习使用
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-gray-400 text-xs">
        小电驴 v1.2.0 | Powered by yt-dlp + Whisper
      </footer>
    </div>
  )
}

export default App
