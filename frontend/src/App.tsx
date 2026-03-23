import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  Download, Link2, CheckCircle2, XCircle, Loader2,
  Video, FileText, Image as ImageIcon, Mic, Languages,
  Trash2, ChevronDown, Clock, Copy, Check,
  X, Zap, AlertCircle, ExternalLink,
} from 'lucide-react'

const API = '/api'

interface Task {
  taskId: string; status: string; progress: number
  title?: string; platform?: string; thumbnailUrl?: string
  downloadUrl?: string; asrText?: string; copyText?: string
  coverUrl?: string; isNote?: boolean
  imageFiles?: Array<{ filename: string; url: string }>
  subtitleFiles?: Array<{ filename: string; url: string }>
  error?: string; createdAt: string | number
}
interface HistoryItem {
  taskId: string; status: string; title?: string
  platform?: string; thumbnailUrl?: string; createdAt: string | number
}

const PLATFORMS = [
  { id: 'douyin', label: '抖音', icon: '📱' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
  { id: 'x', label: 'X / Twitter', icon: '🐦' },
  { id: 'bilibili', label: 'Bilibili', icon: '📺' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
]

const OPTIONS: { id: string; label: string; icon: typeof Video }[] = [
  { id: 'video', label: '视频', icon: Video },
  { id: 'copywriting', label: '文案', icon: FileText },
  { id: 'cover', label: '封面', icon: ImageIcon },
  { id: 'asr', label: '原声', icon: Mic },
  { id: 'subtitle', label: '字幕', icon: Languages },
]

function detectPlatform(url: string): string {
  if (/douyin\.com|iesdouyin\.com/i.test(url)) return 'douyin'
  if (/tiktok\.com/i.test(url)) return 'tiktok'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/twitter\.com|x\.com/i.test(url)) return 'x'
  if (/bilibili\.com|b23\.tv/i.test(url)) return 'bilibili'
  if (/instagram\.com/i.test(url)) return 'instagram'
  return ''
}

export default function App() {
  const [url, setUrl] = useState('')
  const [detected, setDetected] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(['video']))
  const [task, setTask] = useState<Task | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Poll task status
  useEffect(() => {
    if (!task || task.status === 'completed' || task.status === 'error') return
    const t = setInterval(async () => {
      try {
        const r = await axios.get(`${API}/status/${task.taskId}`)
        if (r.data.data) {
          setTask(r.data.data)
          if (['completed', 'error'].includes(r.data.data.status)) { clearInterval(t); fetchHistory() }
        }
      } catch {}
    }, 2000)
    return () => clearInterval(t)
  }, [task])

  const fetchHistory = useCallback(async () => {
    try { const r = await axios.get(`${API}/history`); setHistory(Array.isArray(r.data.data) ? r.data.data : []) } catch {}
  }, [])
  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleUrlChange = (value: string) => {
    setUrl(value)
    setDetected(value.trim() ? detectPlatform(value) : '')
  }

  const handleSubmit = async () => {
    if (!url.trim()) { setError('请输入视频链接'); return }
    setLoading(true); setError('')
    try {
      const r = await axios.post(`${API}/download`, {
        url: url.trim(), platform: detected || 'auto',
        needAsr: selected.has('asr'), options: [...selected],
      }, { timeout: 120000 })
      setTask(r.data.data); setUrl(''); setDetected('')
    } catch (e: any) {
      setError(e.code === 'ECONNABORTED' ? '请求超时，请重试' : (e.response?.data?.message || '下载失败'))
    } finally { setLoading(false) }
  }

  const toggle = (o: string) => setSelected(prev => {
    const n = new Set(prev)
    n.has(o) && n.size > 1 ? n.delete(o) : n.add(o)
    return n
  })
  const del = async (id: string) => {
    try { await axios.delete(`${API}/tasks/${id}`); fetchHistory(); if (task?.taskId === id) setTask(null) } catch {}
  }
  const clip = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 3000) } catch {}
  }

  const isWorking = (s: string) => ['pending', 'parsing', 'processing', 'downloading', 'asr'].includes(s)
  const statusLabel = (s: string) => ({ pending: '排队中', parsing: '解析中', downloading: '下载中', asr: '语音识别中', completed: '完成', error: '失败' }[s] || s)
  const platformLabel = (id: string) => PLATFORMS.find(p => p.id === id)?.label || ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* 背景光晕 - 与闪电下载器一致，颜色换为橙色 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-amber-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative">
        {/* Header - 与闪电下载器布局完全一致 */}
        <header className="max-w-2xl mx-auto px-6 pt-16 pb-8 text-center">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold text-white">小电驴</h1>
              <p className="text-xs text-slate-400">Multi-platform Downloader</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            粘贴链接 → 一键下载 · 支持多平台视频/图文
          </p>
        </header>

        {/* Main Card - 与闪电下载器布局完全一致 */}
        <main className="max-w-2xl mx-auto px-6 pb-10">
          <div className="bg-slate-800/60 backdrop-blur-sm rounded-3xl p-6 border border-slate-700/60 shadow-xl">

            {/* URL 输入 - 与闪电下载器一致 */}
            <div className="mb-5">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Link2 className="w-5 h-5" />
                </div>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="粘贴视频链接..."
                  className="w-full pl-12 pr-12 py-4 bg-slate-900/60 border-2 border-slate-600/50 rounded-2xl focus:ring-4 focus:ring-orange-500/15 focus:border-orange-500/70 outline-none text-white text-base transition-all placeholder:text-slate-500"
                />
                {detected && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-orange-500/15 text-orange-300 text-xs rounded-lg border border-orange-500/20">
                    {platformLabel(detected) || detected}
                  </div>
                )}
              </div>
            </div>

            {/* 支持平台 - 与闪电下载器一致 */}
            <div className="mb-5">
              <p className="text-xs text-slate-500 mb-2">支持平台</p>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => (
                  <span key={p.id} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700/40 text-slate-400 text-xs rounded-lg">
                    <span>{p.icon}</span>
                    <span>{p.label}</span>
                  </span>
                ))}
                <span className="px-2.5 py-1.5 bg-slate-700/40 text-slate-500 text-xs rounded-lg">
                  + 更多
                </span>
              </div>
            </div>

            {/* 下载选项 - 与闪电下载器风格一致 */}
            <div className="mb-5">
              <p className="text-xs text-slate-500 mb-2">下载内容</p>
              <div className="flex flex-wrap gap-1.5">
                {OPTIONS.map(o => {
                  const Icon = o.icon; const on = selected.has(o.id)
                  return (
                    <button key={o.id} onClick={() => toggle(o.id)}
                      className={`flex items-center gap-1 px-3 py-2 text-xs rounded-lg transition-all
                        ${on ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30' : 'bg-slate-700/40 text-slate-500 border border-transparent hover:text-slate-300'}`}>
                      <Icon className="w-3.5 h-3.5" />{o.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 错误提示 - 与闪电下载器一致 */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* 下载按钮 - 与闪电下载器一致 */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-white text-base bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-[0.98]"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" />处理中...</>
              ) : (
                <><Zap className="w-5 h-5" />开始下载</>
              )}
            </button>

            <p className="mt-3 text-center text-xs text-slate-500">
              支持 YouTube / TikTok / 抖音 / X / Bilibili 等平台
            </p>
          </div>

          {/* 任务状态 */}
          {task && (
            <div className="mt-5 bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/60 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Download className="w-4 h-4 text-orange-400" /> 下载进度
                </h3>
                <button onClick={() => setTask(null)}><X className="w-4 h-4 text-slate-500 hover:text-slate-300" /></button>
              </div>

              <div className="flex items-center gap-2">
                {task.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {task.status === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
                {isWorking(task.status) && <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />}
                <span className="text-sm text-slate-300">{statusLabel(task.status)}</span>
              </div>

              {isWorking(task.status) && (
                <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500" style={{ width: `${task.progress}%` }} />
                </div>
              )}

              {task.title && <p className="text-sm text-slate-400">{task.title}</p>}

              {/* 图文 */}
              {task.isNote && task.imageFiles?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">共 {task.imageFiles.length} 张图片</p>
                  <div className="grid grid-cols-3 gap-2">
                    {task.imageFiles.map(img => (
                      <a key={img.filename} href={img.url} download><img src={img.url} alt="" className="w-full aspect-square object-cover rounded-xl bg-slate-800" loading="lazy" /></a>
                    ))}
                  </div>
                </div>
              )}

              {/* 视频下载 */}
              {task.status === 'completed' && task.downloadUrl && (
                <a href={task.downloadUrl} download className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all">
                  <Download className="w-4 h-4" /> 下载视频文件
                </a>
              )}

              {/* 封面 */}
              {task.status === 'completed' && task.coverUrl && (
                <a href={task.coverUrl} download className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs bg-slate-700/30 border border-slate-600/30 text-slate-400 hover:text-white transition-all">
                  <ImageIcon className="w-3.5 h-3.5" /> 下载封面
                </a>
              )}

              {/* 文案 */}
              {task.status === 'completed' && task.copyText && (
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">文案</span>
                    <button onClick={() => clip(task.copyText!, 'copy')} className="text-xs text-slate-500 hover:text-orange-400 transition">
                      {copied === 'copy' ? <><Check className="w-3 h-3 inline" /> 已复制</> : <><Copy className="w-3 h-3 inline" /> 复制</>}
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 whitespace-pre-wrap max-h-28 overflow-y-auto">{task.copyText}</p>
                </div>
              )}

              {/* 字幕 */}
              {task.status === 'completed' && task.subtitleFiles?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {task.subtitleFiles.map(s => (
                    <a key={s.filename} href={s.url} download={s.filename} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-slate-700/30 border border-slate-600/30 text-slate-400 hover:text-white transition-all">
                      <Languages className="w-3 h-3" />{s.filename}
                    </a>
                  ))}
                </div>
              )}

              {/* ASR */}
              {task.asrText && (
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">语音转文字</span>
                    <button onClick={() => clip(task.asrText!, 'asr')} className="text-xs text-slate-500 hover:text-orange-400 transition">
                      {copied === 'asr' ? <><Check className="w-3 h-3 inline" /> 已复制</> : <><Copy className="w-3 h-3 inline" /> 复制</>}
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 whitespace-pre-wrap max-h-32 overflow-y-auto">{task.asrText}</p>
                </div>
              )}

              {task.status === 'error' && task.error && <p className="text-sm text-red-400">{task.error}</p>}
            </div>
          )}

          {/* 使用方法 - 与闪电下载器一致 */}
          <div className="mt-5 bg-slate-800/30 rounded-2xl p-5 border border-slate-700/30">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-orange-400" />
              使用方法
            </h3>
            <div className="space-y-2.5 text-sm text-slate-400">
              <div className="flex items-start gap-2">
                <span className="text-orange-400 font-bold text-xs mt-0.5">1</span>
                <p>复制任意平台的视频链接</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-400 font-bold text-xs mt-0.5">2</span>
                <p>粘贴到上方输入框，自动识别平台</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-400 font-bold text-xs mt-0.5">3</span>
                <p>选择需要下载的内容（视频/文案/封面等）</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-400 font-bold text-xs mt-0.5">4</span>
                <p>点击「开始下载」即可</p>
              </div>
            </div>
          </div>

          {/* 下载历史 - 与闪电下载器风格一致 */}
          <div className="mt-5">
            <button onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between px-5 py-3 bg-slate-800/30 rounded-2xl border border-slate-700/30 text-sm text-slate-400 hover:text-slate-300 transition">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" /> 下载历史
                {history.length > 0 && <span className="bg-slate-700/50 px-2 py-0.5 rounded text-xs">{history.length}</span>}
              </span>
              {showHistory ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            {showHistory && (
              <div className="mt-2 max-h-56 overflow-y-auto bg-slate-800/30 rounded-2xl border border-slate-700/30">
                {history.length === 0
                  ? <p className="py-10 text-center text-sm text-slate-600">暂无下载记录</p>
                  : history.map(item => (
                    <div key={item.taskId} className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/20 last:border-0">
                      {item.thumbnailUrl
                        ? <img src={item.thumbnailUrl} alt="" className="w-12 h-8 object-cover rounded-lg shrink-0" />
                        : <div className="w-12 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0"><Video className="w-4 h-4 text-slate-600" /></div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-400 truncate">{item.title || '未命名'}</p>
                        <p className="text-xs text-slate-600">{item.platform || ''} · {new Date(item.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <button onClick={() => del(item.taskId)}><Trash2 className="w-4 h-4 text-slate-600 hover:text-red-400" /></button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </main>

        {/* Footer - 与闪电下载器一致 */}
        <footer className="text-center py-8 text-slate-600 text-xs">
          <p>小电驴 v1.0 · 仅供个人学习使用</p>
        </footer>
      </div>
    </div>
  )
}
