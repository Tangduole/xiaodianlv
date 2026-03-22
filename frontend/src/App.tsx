import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import {
  Download,
  Link2,
  Mic,
  CheckCircle2,
  XCircle,
  Loader2,
  Video,
  FileText,
  ImageIcon,
  Languages,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Check,
  History,
  Minus,
  X,
  Search,
  FolderOpen,
  Smartphone,
  Zap,
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
  copyText?: string
  coverUrl?: string
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

type DownloadOption = 'video' | 'copywriting' | 'cover' | 'asr' | 'subtitle'

const OPTIONS: { id: DownloadOption; label: string; icon: typeof Video }[] = [
  { id: 'video', label: '视频', icon: Video },
  { id: 'copywriting', label: '文案', icon: FileText },
  { id: 'cover', label: '封面', icon: ImageIcon },
  { id: 'asr', label: '语音转文字', icon: Mic },
  { id: 'subtitle', label: '字幕', icon: Languages },
]

function App() {
  const [url, setUrl] = useState('')
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Set<DownloadOption>>(new Set(['video']))
  const [saveTarget, setSaveTarget] = useState<'phone' | 'pc'>('phone')
  const [task, setTask] = useState<Task | null>(null)
  const [history, setHistory] = useState<HistoryTask[]>([])
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [previewInfo, setPreviewInfo] = useState<any>(null)

  const detectPlatformLocal = (u: string): string | null => {
    const m: Record<string, RegExp> = {
      '抖音': /douyin\.com|douyin\.cn|iesdouyin\.com/,
      'TikTok': /tiktok\.com/,
      'X': /twitter\.com|x\.com/,
      'YouTube': /youtube\.com|youtu\.be/,
      'B站': /bilibili\.com|b23\.tv/,
      '快手': /kuaishou\.com/,
    }
    for (const [n, p] of Object.entries(m)) { if (p.test(u)) return n }
    return null
  }

  const handleUrlChange = (v: string) => {
    setUrl(v)
    setDetectedPlatform(detectPlatformLocal(v))
    if (!v.trim()) { setPreviewInfo(null); setDetectedPlatform(null) }
  }

  const handleParse = async () => {
    if (!url.trim()) return
    setParsing(true)
    setError('')
    try {
      const res = await axios.get(`${API}/info?url=${encodeURIComponent(url.trim())}`)
      setPreviewInfo(res.data.data)
    } catch {
      setPreviewInfo(null)
    } finally {
      setParsing(false)
    }
  }

  const toggleOption = (o: DownloadOption) => {
    setSelectedOptions(prev => {
      const next = new Set(prev)
      if (next.has(o)) { if (next.size > 1) next.delete(o) }
      else next.add(o)
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
          if (d.status === 'completed' || d.status === 'error') {
            clearInterval(t)
            fetchHistory()
          }
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
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API}/download`, {
        url: url.trim(),
        platform: detectedPlatform || 'auto',
        needAsr: selectedOptions.has('asr'),
      })
      setTask(res.data.data)
      setUrl('')
      setPreviewInfo(null)
      setDetectedPlatform(null)
    } catch (e: any) {
      setError(e.response?.data?.message || '创建任务失败')
    } finally {
      setLoading(false)
    }
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
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  const isActive = (s: string) => ['pending','parsing','processing','downloading','asr'].includes(s)

  const statusText = (s: string) => ({
    pending:'等待中',parsing:'解析中',processing:'处理中',
    downloading:'下载中',asr:'语音识别中',completed:'已完成',error:'失败',
  }[s] || s)

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col max-w-md mx-auto">

      {/* ===== 标题栏 ===== */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#16213e] border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛵</span>
          <span className="font-bold text-sm">小电驴</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4 text-gray-400" />
          </button>
          <Minus className="w-4 h-4 text-gray-400" />
          <X className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* ===== 主体 ===== */}
      <div className="flex-1 px-4 py-4 space-y-4">

        {/* 链接输入 + 解析按钮 */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="粘贴链接 自动识别平台"
              className="w-full px-3 py-2.5 bg-[#0f3460] border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-[#FF6B35] transition"
            />
            {detectedPlatform && url && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                {detectedPlatform}
              </span>
            )}
          </div>
          <button
            onClick={handleParse}
            disabled={parsing || !url.trim()}
            className="px-4 py-2.5 bg-[#FF6B35] hover:bg-orange-600 disabled:bg-gray-600 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap"
          >
            {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            解析
          </button>
        </div>

        {/* 预览卡片 */}
        {previewInfo && (
          <div className="flex gap-3 p-3 bg-[#16213e] rounded-xl border border-white/5">
            {previewInfo.thumbnail ? (
              <img src={previewInfo.thumbnail} alt="" className="w-24 h-16 object-cover rounded-lg flex-shrink-0" />
            ) : (
              <div className="w-24 h-16 rounded-lg bg-[#0f3460] flex items-center justify-center flex-shrink-0">
                <Video className="w-6 h-6 text-gray-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/90 line-clamp-2">{previewInfo.title}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                {previewInfo.duration > 0 && <span>{Math.floor(previewInfo.duration/60)}:{String(Math.floor(previewInfo.duration%60)).padStart(2,'0')}</span>}
                {detectedPlatform && <span>· {detectedPlatform}</span>}
              </div>
            </div>
          </div>
        )}

        {/* 五个下载选项 */}
        <div className="flex gap-1.5 flex-wrap">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = selectedOptions.has(opt.id)
            return (
              <button
                key={opt.id}
                onClick={() => toggleOption(opt.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  active
                    ? 'bg-[#FF6B35] border-[#FF6B35] text-white'
                    : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                <Icon className="w-3 h-3" />
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* 保存位置 */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 whitespace-nowrap">保存至</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSaveTarget('phone')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                saveTarget === 'phone'
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'border-white/5 text-gray-500'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              手机相册
            </button>
            <button
              onClick={() => setSaveTarget('pc')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                saveTarget === 'pc'
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'border-white/5 text-gray-500'
              }`}
            >
              <FolderOpen className="w-3 h-3" />
              电脑文件夹
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* 开始下载按钮 */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm bg-[#FF6B35] hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {loading ? '处理中...' : '开始下载'}
        </button>

        {/* 任务状态 */}
        {task && (
          <div className="p-4 bg-[#16213e] rounded-xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">任务进度</span>
              <button onClick={() => setTask(null)}><X className="w-3.5 h-3.5 text-gray-500" /></button>
            </div>

            {/* 状态行 */}
            <div className="flex items-center gap-2">
              {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
              {task.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
              {isActive(task.status) && <Loader2 className="w-4 h-4 text-[#FF6B35] animate-spin" />}
              <span className="text-xs text-gray-300">{statusText(task.status)}</span>
              {task.platform && <span className="text-[10px] text-gray-600">· {task.platform}</span>}
            </div>

            {/* 进度条 */}
            {isActive(task.status) && (
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FF6B35] rounded-full transition-all duration-500"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            )}

            {/* 视频信息 */}
            {task.title && (
              <p className="text-xs text-gray-400 truncate">{task.title}</p>
            )}

            {/* 完成操作 */}
            {task.status === 'completed' && task.downloadUrl && (
              <a
                href={task.downloadUrl}
                download
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition"
              >
                <Download className="w-4 h-4" />
                下载视频文件
              </a>
            )}

            {/* 字幕下载 */}
            {task.status === 'completed' && task.subtitleFiles?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {task.subtitleFiles.map((sub) => (
                  <a
                    key={sub.filename}
                    href={sub.url}
                    download={sub.filename}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] bg-white/5 border border-white/10 text-gray-400 hover:text-white transition"
                  >
                    <Languages className="w-3 h-3" />
                    {sub.filename}
                  </a>
                ))}
              </div>
            )}

            {/* ASR 结果 */}
            {task.asrText && (
              <div className="p-3 bg-white/5 rounded-lg">
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

            {/* 错误 */}
            {task.status === 'error' && task.error && (
              <p className="text-xs text-red-400">{task.error}</p>
            )}
          </div>
        )}
      </div>

      {/* ===== 底部折叠历史 ===== */}
      <div className="border-t border-white/5">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs text-gray-500 hover:text-gray-300 transition"
        >
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            下载历史
            {history.length > 0 && <span className="bg-white/5 px-1.5 py-0.5 rounded">{history.length}</span>}
          </span>
          {showHistory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>

        {showHistory && (
          <div className="max-h-60 overflow-y-auto border-t border-white/5">
            {history.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-600">暂无下载记录</div>
            ) : (
              history.map((item) => (
                <div key={item.taskId} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                  <div className="flex-shrink-0">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" className="w-12 h-8 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-8 rounded bg-white/5 flex items-center justify-center">
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
