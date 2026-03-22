import { useState, useEffect } from 'react'
import axios from 'axios'
import '../index.css'

const API = '/api'

interface Task {
  taskId: string
  status: string
  progress: number
  title?: string
  platform?: string
  downloadUrl?: string
  asrText?: string
  error?: string
}

const PLATFORMS = [
  { id: 'auto', label: '自动识别' },
  { id: 'douyin', label: '抖音' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'x', label: 'X (Twitter)' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'bilibili', label: 'B站' },
  { id: 'kuaishou', label: '快手' },
]

function App() {
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState('auto')
  const [needAsr, setNeedAsr] = useState(false)
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!task || task.status === 'completed' || task.status === 'error') return
    const timer = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/status/${task.taskId}`)
        const t = res.data.data
        if (t) setTask(t)
      } catch {}
    }, 3000)
    return () => clearInterval(timer)
  }, [task])

  const handleSubmit = async () => {
    if (!url.trim()) { setError('请输入视频链接'); return }
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API}/download`, { url: url.trim(), platform, needAsr })
      setTask(res.data.data)
      setUrl('')
    } catch (e: any) {
      setError(e.response?.data?.message || '创建任务失败')
    } finally {
      setLoading(false)
    }
  }

  const statusIcon = () => {
    switch (task?.status) {
      case 'processing':
      case 'downloading':
      case 'asr':
        return <div className="w-5 h-5 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
      case 'completed':
        return <span className="text-2xl">✅</span>
      case 'error':
        return <span className="text-2xl">❌</span>
      default:
        return <span className="text-2xl">⏳</span>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#FF6B35] to-orange-400 text-white shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold">🛵 小电驴</h1>
          <p className="text-orange-100 text-sm mt-1">多平台视频下载 + 语音转文字</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* 输入卡片 */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">📥 下载视频</h2>

          <div className="mb-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="粘贴视频分享链接..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none text-gray-800"
            />
          </div>

          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    platform === p.id
                      ? 'bg-[#FF6B35] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer mb-5">
            <input
              type="checkbox"
              checked={needAsr}
              onChange={(e) => setNeedAsr(e.target.checked)}
              className="w-4 h-4 accent-[#FF6B35]"
            />
            <span className="text-sm text-gray-600">🎤 语音转文字</span>
          </label>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white bg-[#FF6B35] hover:bg-orange-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ 处理中...' : '🚀 开始下载'}
          </button>
        </div>

        {/* 任务状态 */}
        {task && (
          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">📊 任务状态</h3>
              <button onClick={() => setTask(null)} className="text-gray-400 text-xl">✕</button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              {statusIcon()}
              <span className="text-sm text-gray-600">
                {task.status === 'processing' && '处理中...'}
                {task.status === 'downloading' && '下载中...'}
                {task.status === 'asr' && '语音转文字中...'}
                {task.status === 'completed' && '完成'}
                {task.status === 'error' && '失败'}
              </span>
            </div>

            {(task.status === 'processing' || task.status === 'downloading' || task.status === 'asr') && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>进度</span>
                  <span>{task.progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${task.progress}%` }} />
                </div>
              </div>
            )}

            {task.title && <p className="text-sm text-gray-700 mb-3">📎 {task.title}</p>}

            {task.status === 'completed' && task.downloadUrl && (
              <a
                href={task.downloadUrl}
                download
                className="block w-full text-center bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition"
              >
                📥 下载视频
              </a>
            )}

            {task.status === 'error' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {task.error || '下载失败，请稍后重试'}
              </div>
            )}

            {task.asrText && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-800 mb-2">🎤 语音转文字</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.asrText}</p>
              </div>
            )}
          </div>
        )}

        {/* 使用说明 */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">📖 使用说明</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>1️⃣ 粘贴视频分享链接</p>
            <p>2️⃣ 选择平台（或自动识别）</p>
            <p>3️⃣ 可选：开启语音转文字</p>
            <p>4️⃣ 点击下载，等待完成</p>
          </div>
          <div className="mt-3 p-3 bg-orange-50 rounded-lg text-xs text-orange-600">
            ⚠️ 请尊重版权，仅供个人学习使用
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-gray-400 text-xs">
        小电驴 v1.2.0 · Powered by yt-dlp
      </footer>
    </div>
  )
}

export default App
