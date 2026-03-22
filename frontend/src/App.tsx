import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  Download, Mic, CheckCircle2, XCircle, Loader2,
  Video, FileText, ImageIcon, Languages,
  Trash2, ChevronDown, ChevronUp, Clock,
  Copy, Check, History, Minus, X, Search,
  FolderOpen, Smartphone,
} from 'lucide-react'

const API = '/api'

interface Task {
  taskId: string
  status: 'pending' | 'parsing' | 'processing' | 'downloading' | 'asr' | 'completed' | 'error'
  progress: number
  title?: string
  platform?: string
  thumbnailUrl?: string
  downloadUrl?: string
  asrText?: string
  subtitleFiles?: Array<{ filename: string; url: string }>
  error?: string
  createdAt: string
}

interface HistoryTask {
  taskId: string
  status: string
  title?: string
  platform?: string
  thumbnailUrl?: string
  createdAt: string
}

type Platform = 'douyin' | 'tiktok' | 'youtube' | 'x'
type DownloadOption = 'video' | 'copywriting' | 'cover' | 'asr' | 'subtitle'

const PLATFORMS: { id: Platform; label: string; icon: string }[] = [
  { id: 'douyin', label: '抖音', icon: '🎵' },
  { id: 'tiktok', label: 'TikTok', icon: '🎶' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
  { id: 'x', label: 'X', icon: '𝕏' },
]

const OPTIONS: { id: DownloadOption; label: string; icon: typeof Video }[] = [
  { id: 'video', label: '视频', icon: Video },
  { id: 'copywriting', label: '文案', icon: FileText },
  { id: 'cover', label: '封面', icon: ImageIcon },
  { id: 'asr', label: '语音转文字', icon: Mic },
  { id: 'subtitle', label: '字幕', icon: Languages },
]

function App() {
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState<Platform>('douyin')
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [selectedOptions, setSelectedOptions] = useState<Set<DownloadOption>>(new Set(['video']))
  const [task, setTask] = useState<Task | null>(null)
  const [history, setHistory] = useState<HistoryTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const toggleOption = (o: DownloadOption) => {
    setSelectedOptions(prev => {
      const next = new Set(prev)
      if (next.has(o)) { if (next.size > 1) next.delete(o) } else next.add(o)
      return next
    })
  }

  useEffect(() => {
    if (!task || task.status === 'completed' || task.status === 'error') return
    const t = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/status/${task.taskId}`)
        const d = res.data.data
        if (d) {
          setTask(d)
          if (d.status === 'completed' || d.status === 'error') { clearInterval(t); fetchHistory() }
        }
      } catch {}
    }, 2000)
    return () => clearInterval(t)
  }, [task])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/history`)
      setHistory(Array.isArray(res.data.data) ? res.data.data : [])
    } catch {}
  }, [])
  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleSubmit = async () => {
    if (!url.trim()) { setError('请输入视频链接'); return }
    if (selectedOptions.size === 0) { setError('请至少选择一个下载项'); return }
    setLoading(true); setError('')
    try {
      const res = await axios.post(`${API}/download`, {
        url: url.trim(),
        platform,
        needAsr: selectedOptions.has('asr'),
      })
      setTask(res.data.data)
      setUrl('')
    } catch (e: any) {
      setError(e.response?.data?.message || '创建任务失败')
    } finally { setLoading(false) }
  }

  const handleDelete = async (taskId: string) => {
    try {
      await axios.delete(`${API}/tasks/${taskId}`)
      fetchHistory()
      if (task?.taskId === taskId) setTask(null)
    } catch {}
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id); setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  const isActive = (s: string) => ['pending','parsing','processing','downloading','asr'].includes(s)
  const statusText = (s: string) => ({
    pending:'等待中',parsing:'解析中',processing:'处理中',
    downloading:'下载中',asr:'语音识别中',completed:'已完成',error:'失败',
  }[s] || s)

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col max-w-md mx-auto relative">

      {/* ===== 标题栏 ===== */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛵</span>
          <span className="font-bold text-base">小电驴</span>
        </div>
        <div className="flex items-center gap-4 text-gray-500">
          <button onClick={() => setShowHistory(!showHistory)}><History className="w-[18px] h-[18px]" /></button>
          <Minus className="w-[18px] h-[18px]" />
          <X className="w-[18px] h-[18px]" />
        </div>
      </div>

      {/* ===== 平台选择 Tabs ===== */}
      <div className="px-4 mb-3">
        <div className="flex bg-[#161b22] rounded-xl p-1">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                platform === p.id
                  ? 'bg-[#FF6B35] text-white shadow-lg shadow-orange-500/20'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="text-xs">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== 下载模式 Tabs ===== */}
      <div className="px-4 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('single')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
              mode === 'single'
                ? 'bg-white/10 text-white border border-white/10'
                : 'text-gray-500 border border-transparent'
            }`}
          >
            单个视频下载
          </button>
          <button
            onClick={() => setMode('batch')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
              mode === 'batch'
                ? 'bg-white/10 text-white border border-white/10'
                : 'text-gray-500 border border-transparent'
            }`}
          >
            批量下载
          </button>
        </div>
      </div>

      {/* ===== 主体内容 ===== */}
      <div className="flex-1 px-4 space-y-4">

        {/* 粘贴链接输入 */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">粘贴链接</label>
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="在此粘贴视频链接..."
              className="w-full px-4 py-3 bg-[#161b22] border border-[#30363d] rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:border-[#FF6B35] transition"
            />
          </div>
        </div>

        {/* 下载选项 */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">选择下载内容</label>
          <div className="flex flex-wrap gap-2">
            {OPTIONS.map((opt) => {
              const Icon = opt.icon
              const active = selectedOptions.has(opt.id)
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleOption(opt.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                    active
                      ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#FF6B35]'
                      : 'bg-[#161b22] border-[#30363d] text-gray-500 hover:text-gray-300 hover:border-[#484f58]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 保存至 */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">下载至</label>
          <div className="flex items-center gap-2 px-4 py-3 bg-[#161b22] border border-[#30363d] rounded-xl">
            <Smartphone className="w-4 h-4 text-[#FF6B35]" />
            <span className="text-sm text-white">手机相册</span>
            <span className="text-xs text-gray-600 ml-auto">默认</span>
          </div>
        </div>

        {/* 错误 */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* 下载按钮 */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-bold text-sm bg-[#FF6B35] hover:bg-orange-600 disabled:bg-[#30363d] disabled:text-gray-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {loading ? '处理中...' : '开始下载'}
        </button>

        {/* 任务状态 */}
        {task && (
          <div className="p-4 bg-[#161b22] rounded-xl border border-[#30363d] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">任务状态</span>
              <button onClick={() => setTask(null)} className="text-gray-600 hover:text-gray-400"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex items-center gap-2">
              {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
              {task.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
              {isActive(task.status) && <Loader2 className="w-4 h-4 text-[#FF6B35] animate-spin" />}
              <span className="text-xs text-gray-300">{statusText(task.status)}</span>
              {task.platform && <span className="text-[10px] text-gray-600 ml-1">· {task.platform}</span>}
            </div>

            {isActive(task.status) && (
              <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                <div className="h-full bg-[#FF6B35] rounded-full transition-all duration-500" style={{ width: `${task.progress}%` }} />
              </div>
            )}

            {task.title && <p className="text-xs text-gray-400 truncate">{task.title}</p>}

            {task.status === 'completed' && task.downloadUrl && (
              <a href={task.downloadUrl} download className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium bg-green-500/15 border border-green-500/25 text-green-400 hover:bg-green-500/25 transition">
                <Download className="w-4 h-4" /> 下载视频文件
              </a>
            )}

            {task.status === 'completed' && task.subtitleFiles?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {task.subtitleFiles.map((sub) => (
                  <a key={sub.filename} href={sub.url} download={sub.filename}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] bg-[#21262d] border border-[#30363d] text-gray-400 hover:text-white transition">
                    <Languages className="w-3 h-3" />{sub.filename}
                  </a>
                ))}
              </div>
            )}

            {task.asrText && (
              <div className="p-3 bg-[#21262d] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Mic className="w-3 h-3" /> 语音识别结果</span>
                  <button onClick={() => handleCopy(task.asrText!, 'asr')} className="text-[10px] text-gray-500 hover:text-white">
                    {copiedId === 'asr' ? <Check className="w-3 h-3 inline" /> : <Copy className="w-3 h-3 inline" />}
                    {copiedId === 'asr' ? '已复制' : '复制'}
                  </button>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">{task.asrText}</p>
              </div>
            )}

            {task.status === 'error' && task.error && (
              <p className="text-xs text-red-400">{task.error}</p>
            )}
          </div>
        )}
      </div>

      {/* ===== 底部折叠历史 ===== */}
      <div className="border-t border-[#21262d] mt-4">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs text-gray-500 hover:text-gray-300 transition"
        >
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> 下载历史
            {history.length > 0 && <span className="bg-[#21262d] px-1.5 py-0.5 rounded text-[10px]">{history.length}</span>}
          </span>
          {showHistory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>

        {showHistory && (
          <div className="max-h-60 overflow-y-auto border-t border-[#21262d]">
            {history.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-600">暂无下载记录</div>
            ) : (
              history.map((item) => (
                <div key={item.taskId} className="flex items-center gap-3 px-4 py-3 border-b border-[#21262d] last:border-0 hover:bg-[#161b22] transition">
                  <div className="flex-shrink-0">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" className="w-12 h-8 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-8 rounded bg-[#21262d] flex items-center justify-center">
                        <Video className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 truncate">{item.title || '未命名'}</p>
                    <p className="text-[10px] text-gray-600">{item.platform} · {new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <button onClick={() => handleDelete(item.taskId)}>
                    <Trash2 className="w-3.5 h-3.5 text-gray-600 hover:text-red-400 transition" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
