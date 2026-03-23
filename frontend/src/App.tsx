import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  Download, Loader2, CheckCircle2, XCircle,
  Video, FileText, Image, Mic, Languages,
  Trash2, ChevronDown, ChevronUp, Clock,
  Copy, Check, History, X, Link2, Smartphone
} from 'lucide-react'

const API = '/api'

interface Task {
  taskId: string
  status: string
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

interface HistoryItem {
  taskId: string
  status: string
  title?: string
  platform?: string
  thumbnailUrl?: string
  createdAt: string
}

type Option = 'video' | 'copy' | 'cover' | 'asr' | 'subtitle'

const OPTIONS: { id: Option; label: string; icon: typeof Video; desc: string }[] = [
  { id: 'video', label: '视频', icon: Video, desc: 'MP4' },
  { id: 'copy', label: '文案', icon: FileText, desc: 'TXT' },
  { id: 'cover', label: '封面', icon: Image, desc: 'JPG' },
  { id: 'asr', label: '语音转文字', icon: Mic, desc: 'ASR' },
  { id: 'subtitle', label: '字幕', icon: Languages, desc: 'SRT' },
]

export default function App() {
  const [url, setUrl] = useState('')
  const [opts, setOpts] = useState<Set<Option>>(new Set(['video']))
  const [task, setTask] = useState<Task | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tip, setTip] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [copiedId, setCopiedId] = useState('')

  const toggle = (o: Option) => setOpts(p => {
    const n = new Set(p)
    n.has(o) && n.size > 1 ? n.delete(o) : n.add(o)
    return n
  })

  const poll = useCallback(() => {
    if (!task || task.status === 'completed' || task.status === 'error') return
    const t = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API}/status/${task.taskId}`, { timeout: 30000 })
        if (data.data) {
          setTask(data.data)
          if (data.data.status === 'completed' || data.data.status === 'error') {
            clearInterval(t)
            fetchHistory()
          }
        }
      } catch {}
    }, 2000)
    return () => clearInterval(t)
  }, [task])
  useEffect(poll, [poll])

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/history`, { timeout: 15000 })
      setHistory(Array.isArray(data.data) ? data.data : [])
    } catch {}
  }, [])
  useEffect(() => { fetchHistory() }, [fetchHistory])

  const submit = async () => {
    if (!url.trim()) return setError('请粘贴视频链接')
    setLoading(true)
    setError('')
    setTip('正在连接服务器...')
    try {
      const { data } = await axios.post(`${API}/download`, {
        url: url.trim(),
        platform: 'auto',
        needAsr: opts.has('asr'),
      }, { timeout: 120000 })
      setTask(data.data)
      setUrl('')
      setTip('')
    } catch (e: any) {
      setTip('')
      if (e.code === 'ECONNABORTED') setError('服务器超时，请稍后再试')
      else setError(e.response?.data?.message || '请求失败，请检查链接')
    } finally { setLoading(false) }
  }

  const del = async (id: string) => {
    try { await axios.delete(`${API}/tasks/${id}`, { timeout: 10000 }); fetchHistory() } catch {}
    if (task?.taskId === id) setTask(null)
  }

  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(''), 2000) } catch {}
  }

  const isActive = (s: string) => ['pending','parsing','processing','downloading','asr'].includes(s)
  const statusLabel = (s: string) => ({
    pending:'排队中',parsing:'解析中',processing:'处理中',downloading:'下载中',asr:'语音识别中',completed:'已完成',error:'失败'
  }[s] || s)

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a] text-white max-w-md mx-auto flex flex-col">

      {/* 头部 */}
      <div className="sticky top-0 z-10 bg-[#0f0f0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-sm">🛵</div>
            <span className="text-[15px] font-semibold tracking-tight">小电驴</span>
            <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">v1.0</span>
          </div>
          <button onClick={() => setShowHistory(!showHistory)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
            <History className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* 主区域 */}
      <div className="flex-1 px-5 py-5 space-y-5">

        {/* 输入框 */}
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
            <Link2 className="w-4 h-4 text-gray-500" />
          </div>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="粘贴视频链接，自动识别平台"
            className="w-full pl-10 pr-4 py-3.5 bg-white/[0.06] border border-white/[0.08] rounded-2xl text-sm text-white placeholder-gray-600 outline-none focus:border-orange-500/50 focus:bg-white/[0.08] transition-all"
          />
        </div>

        {/* 提示文字 */}
        {tip && <p className="text-xs text-orange-400/80 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />{tip}</p>}

        {/* 下载选项 */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium">下载内容</p>
          <div className="flex flex-wrap gap-2">
            {OPTIONS.map(o => {
              const Icon = o.icon
              const on = opts.has(o.id)
              return (
                <button key={o.id} onClick={() => toggle(o.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    on ? 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30'
                       : 'bg-white/[0.04] text-gray-500 hover:text-gray-300 hover:bg-white/[0.07]'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {o.label}
                  <span className="text-[10px] opacity-50">{o.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 保存位置 */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.04] rounded-xl border border-white/[0.06]">
          <Smartphone className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-400">保存至</span>
          <span className="text-xs text-white ml-auto">手机相册</span>
        </div>

        {/* 错误 */}
        {error && (
          <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/15 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* 下载按钮 */}
        <button onClick={submit} disabled={loading}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm bg-gradient-to-r from-orange-500 to-pink-500 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-40 disabled:shadow-none transition-all flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {loading ? '处理中...' : '开始下载'}
        </button>

        {/* 任务状态卡片 */}
        {task && (
          <div className="bg-white/[0.04] rounded-2xl border border-white/[0.06] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                {task.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
                {isActive(task.status) && <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />}
                <span className="text-xs text-gray-300">{statusLabel(task.status)}</span>
              </div>
              <button onClick={() => setTask(null)}><X className="w-4 h-4 text-gray-600 hover:text-gray-400" /></button>
            </div>

            {isActive(task.status) && (
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(task.progress, 5)}%` }} />
              </div>
            )}

            {task.title && <p className="text-xs text-gray-400 truncate">{task.title}</p>}

            {task.status === 'completed' && task.downloadUrl && (
              <a href={task.downloadUrl} download target="_blank"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium bg-green-500/15 text-green-400 ring-1 ring-green-500/20 hover:bg-green-500/25 transition">
                <Download className="w-4 h-4" /> 保存到手机
              </a>
            )}

            {task.status === 'completed' && task.subtitleFiles?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {task.subtitleFiles.map(s => (
                  <a key={s.filename} href={s.url} download={s.filename}
                    className="text-[11px] px-2 py-1 rounded-lg bg-white/5 text-gray-400 hover:text-white transition">{s.filename}</a>
                ))}
              </div>
            )}

            {task.asrText && (
              <div className="p-3 bg-white/[0.03] rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-gray-500 flex items-center gap-1"><Mic className="w-3 h-3" />识别结果</span>
                  <button onClick={() => copy(task.asrText!, 'asr')}
                    className="text-[11px] text-gray-600 hover:text-white flex items-center gap-0.5">
                    {copiedId === 'asr' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedId === 'asr' ? '已复制' : '复制'}
                  </button>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap max-h-28 overflow-y-auto">{task.asrText}</p>
              </div>
            )}

            {task.status === 'error' && task.error && (
              <p className="text-xs text-red-400/80">{task.error}</p>
            )}
          </div>
        )}
      </div>

      {/* 底部历史 */}
      <div className="border-t border-white/5">
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> 下载历史
            {history.length > 0 && <span className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">{history.length}</span>}
          </span>
          {showHistory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        {showHistory && (
          <div className="max-h-56 overflow-y-auto">
            {!history.length
              ? <p className="text-center text-xs text-gray-700 py-6">暂无记录</p>
              : history.map(i => (
                <div key={i.taskId} className="flex items-center gap-3 px-5 py-2.5 border-t border-white/5 hover:bg-white/[0.02]">
                  <div className="w-10 h-7 rounded bg-white/5 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {i.thumbnailUrl ? <img src={i.thumbnailUrl} className="w-full h-full object-cover" /> : <Video className="w-3.5 h-3.5 text-gray-700" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 truncate">{i.title || '未命名'}</p>
                    <p className="text-[10px] text-gray-700">{i.platform} · {new Date(i.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                  <button onClick={() => del(i.taskId)}><Trash2 className="w-3.5 h-3.5 text-gray-700 hover:text-red-400 transition" /></button>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
