import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  Download, Link2, CheckCircle2, XCircle, Loader2,
  Video, FileText, Image as ImageIcon, Mic, Languages,
  Trash2, ChevronDown, ChevronUp, Clock, Copy, Check,
  X, Zap, AlertCircle, ArrowDown,
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

const OPTIONS: { id: string; label: string; desc: string; icon: typeof Video }[] = [
  { id: 'video', label: '视频下载', desc: 'MP4', icon: Video },
  { id: 'copywriting', label: '文案提取', desc: 'TXT', icon: FileText },
  { id: 'cover', label: '视频封面', desc: 'JPG', icon: ImageIcon },
  { id: 'asr', label: '语音转文字', desc: 'TXT', icon: Mic },
  { id: 'subtitle', label: '字幕下载', desc: 'SRT', icon: Languages },
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
      } catch { /* ignore */ }
    }, 2000)
    return () => clearInterval(t)
  }, [task])

  const fetchHistory = useCallback(async () => {
    try { const r = await axios.get(`${API}/history`); setHistory(Array.isArray(r.data.data) ? r.data.data : []) } catch { /* ignore */ }
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
    try { await axios.delete(`${API}/tasks/${id}`); fetchHistory(); if (task?.taskId === id) setTask(null) } catch { /* ignore */ }
  }
  const clip = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000) } catch { /* ignore */ }
  }

  const isWorking = (s: string) => ['pending', 'parsing', 'processing', 'downloading', 'asr'].includes(s)
  const statusLabel = (s: string) => ({ pending: '排队中', parsing: '解析中', downloading: '下载中', asr: '语音识别中', completed: '已完成', error: '失败' }[s] || s)
  const platformLabel = (id: string) => PLATFORMS.find(p => p.id === id)?.label || ''
  const platformIcon = (id: string) => PLATFORMS.find(p => p.id === id)?.icon || '🔗'

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* 背景装饰 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-orange-500/[0.07] blur-[120px]" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-amber-500/[0.05] blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-orange-500/[0.03] blur-[150px]" />
        {/* 网格纹理 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.015)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative z-10">
        {/* ── Header ── */}
        <header className="max-w-xl mx-auto px-5 pt-14 pb-6 text-center">
          {/* Logo */}
          <div className="inline-flex items-center gap-3 mb-5">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Zap className="w-7 h-7 text-white" fill="white" fillOpacity="0.2" />
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 opacity-20 blur-sm -z-10" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">小电驴</h1>
              <p className="text-xs text-slate-500 font-medium">Multi-platform Downloader</p>
            </div>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed">
            粘贴链接，一键下载视频、文案、封面
          </p>
        </header>

        <main className="max-w-xl mx-auto px-5 pb-12 space-y-4">

          {/* ── 输入区 ── */}
          <section className="bg-white/[0.04] backdrop-blur-xl rounded-3xl p-5 border border-white/[0.06] shadow-2xl">
            {/* URL 输入 */}
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-orange-400 transition-colors">
                <Link2 className="w-[18px] h-[18px]" />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="粘贴视频链接，自动识别平台..."
                className="w-full pl-11 pr-24 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl focus:border-orange-500/40 focus:bg-white/[0.06] outline-none text-white text-[15px] transition-all placeholder:text-slate-600"
              />
              {detected && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 text-orange-300 text-[11px] font-medium rounded-lg border border-orange-500/15 animate-in fade-in">
                  <span>{platformIcon(detected)}</span>
                  <span>{platformLabel(detected)}</span>
                </div>
              )}
            </div>

            {/* 下载选项卡片 */}
            <div className="mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {OPTIONS.map(o => {
                  const Icon = o.icon
                  const on = selected.has(o.id)
                  return (
                    <button key={o.id} onClick={() => toggle(o.id)}
                      className={`relative flex items-start gap-2.5 p-3 rounded-xl text-left transition-all duration-200 ${
                        on
                          ? 'bg-orange-500/10 border border-orange-500/20'
                          : 'bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]'
                      }`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                        on ? 'bg-orange-500 shadow-md shadow-orange-500/30' : 'bg-white/[0.06]'
                      }`}>
                        <Icon className={`w-4 h-4 transition-colors ${on ? 'text-white' : 'text-slate-500'}`} />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <div className={`text-[13px] font-semibold leading-tight transition-colors ${on ? 'text-white' : 'text-slate-400'}`}>
                          {o.label}
                        </div>
                        <div className={`text-[10px] mt-0.5 font-medium ${on ? 'text-orange-300/70' : 'text-slate-600'}`}>
                          {o.desc}
                        </div>
                      </div>
                      {on && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mt-4 flex items-center gap-2.5 px-4 py-3 bg-red-500/[0.08] border border-red-500/15 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-300/90 text-sm">{error}</p>
                <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* 下载按钮 */}
            <button
              onClick={handleSubmit}
              disabled={loading || !url.trim()}
              className="mt-5 w-full relative py-3.5 rounded-2xl font-bold text-white text-[15px] bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400 hover:shadow-lg hover:shadow-orange-500/25 disabled:opacity-30 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98] overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2.5">
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /><span>处理中...</span></>
                ) : (
                  <><ArrowDown className="w-5 h-5" /><span>开始下载</span></>
                )}
              </span>
            </button>

            {/* 平台标签 */}
            <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
              {PLATFORMS.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-600">
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </span>
              ))}
            </div>
          </section>

          {/* ── 任务状态 ── */}
          {task && (
            <section className="bg-white/[0.04] backdrop-blur-xl rounded-2xl p-5 border border-white/[0.06] shadow-xl space-y-4 animate-in slide-in-from-bottom-2">
              {/* 标题栏 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    task.status === 'completed' ? 'bg-emerald-400' :
                    task.status === 'error' ? 'bg-red-400' :
                    'bg-orange-400 animate-pulse'
                  }`} />
                  <span className="text-sm font-semibold text-slate-300">
                    {statusLabel(task.status)}
                  </span>
                </div>
                <button onClick={() => setTask(null)} className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
                  <X className="w-4 h-4 text-slate-600 hover:text-slate-300" />
                </button>
              </div>

              {/* 进度条 */}
              {isWorking(task.status) && (
                <div className="space-y-1.5">
                  <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(task.progress, 2)}%` }}
                    />
                  </div>
                  <p className="text-right text-[11px] text-slate-600">{task.progress}%</p>
                </div>
              )}

              {/* 视频标题 */}
              {task.title && (
                <div className="flex items-start gap-2.5">
                  {task.thumbnailUrl ? (
                    <img src={task.thumbnailUrl} alt="" className="w-16 h-10 object-cover rounded-lg flex-shrink-0 bg-white/[0.04]" />
                  ) : (
                    <div className="w-16 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                      <Video className="w-5 h-5 text-slate-700" />
                    </div>
                  )}
                  <p className="text-sm text-slate-400 leading-snug line-clamp-2">{task.title}</p>
                </div>
              )}

              {/* 图文下载 */}
              {task.isNote && task.imageFiles && task.imageFiles.length > 0 && (
                <div>
                  <p className="text-[11px] text-slate-500 mb-2 font-medium">共 {task.imageFiles.length} 张图片</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {task.imageFiles.map(img => (
                      <a key={img.filename} href={img.url} download className="block">
                        <img src={img.url} alt="" className="w-full aspect-square object-cover rounded-xl bg-white/[0.04] hover:opacity-80 transition-opacity" loading="lazy" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 下载按钮组 */}
              {task.status === 'completed' && (
                <div className="space-y-2">
                  {task.downloadUrl && (
                    <a href={task.downloadUrl} download className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15 transition-all">
                      <Download className="w-4 h-4" />下载视频文件
                    </a>
                  )}
                  {task.coverUrl && (
                    <a href={task.coverUrl} download className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-medium bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all">
                      <ImageIcon className="w-3.5 h-3.5" />下载封面
                    </a>
                  )}
                </div>
              )}

              {/* 文案 */}
              {task.status === 'completed' && task.copyText && (
                <div className="p-3.5 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-slate-500 font-medium">文案</span>
                    <button onClick={() => clip(task.copyText!, 'copy')} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-orange-400 transition-colors">
                      {copied === 'copy' ? <><Check className="w-3 h-3" />已复制</> : <><Copy className="w-3 h-3" />复制</>}
                    </button>
                  </div>
                  <p className="text-[13px] text-slate-400 whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto">{task.copyText}</p>
                </div>
              )}

              {/* 字幕 */}
              {task.status === 'completed' && task.subtitleFiles && task.subtitleFiles.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {task.subtitleFiles.map(s => (
                    <a key={s.filename} href={s.url} download={s.filename} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-white transition-all">
                      <Languages className="w-3 h-3" />{s.filename}
                    </a>
                  ))}
                </div>
              )}

              {/* ASR */}
              {task.asrText && (
                <div className="p-3.5 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-slate-500 font-medium">语音转文字</span>
                    <button onClick={() => clip(task.asrText!, 'asr')} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-orange-400 transition-colors">
                      {copied === 'asr' ? <><Check className="w-3 h-3" />已复制</> : <><Copy className="w-3 h-3" />复制</>}
                    </button>
                  </div>
                  <p className="text-[13px] text-slate-400 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{task.asrText}</p>
                </div>
              )}

              {/* 错误信息 */}
              {task.status === 'error' && task.error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/[0.06] border border-red-500/10 rounded-xl">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300/80">{task.error}</p>
                </div>
              )}
            </section>
          )}

          {/* ── 下载历史 ── */}
          <section>
            <button onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-white/[0.03] rounded-2xl border border-white/[0.05] text-sm hover:bg-white/[0.05] transition-all">
              <span className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="font-medium">下载历史</span>
                {history.length > 0 && (
                  <span className="bg-white/[0.06] px-2 py-0.5 rounded-md text-[11px] text-slate-500 font-medium">{history.length}</span>
                )}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>

            {showHistory && (
              <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                {history.length === 0 ? (
                  <div className="py-12 text-center">
                    <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">暂无下载记录</p>
                  </div>
                ) : history.map(item => (
                  <div key={item.taskId} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" className="w-14 h-9 object-cover rounded-lg flex-shrink-0 bg-white/[0.04]" />
                    ) : (
                      <div className="w-14 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                        <Video className="w-4 h-4 text-slate-700" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-slate-400 truncate font-medium">{item.title || '未命名'}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {platformIcon(item.platform || '')} {platformLabel(item.platform || '')}
                        {' · '}
                        {new Date(item.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button onClick={() => del(item.taskId)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors group">
                      <Trash2 className="w-3.5 h-3.5 text-slate-700 group-hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── 使用方法 ── */}
          <section className="bg-white/[0.02] rounded-2xl p-5 border border-white/[0.04]">
            <h3 className="text-[13px] font-semibold text-slate-400 mb-3">使用方法</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { step: '1', text: '复制视频链接' },
                { step: '2', text: '粘贴到输入框' },
                { step: '3', text: '选择下载内容' },
                { step: '4', text: '点击开始下载' },
              ].map(item => (
                <div key={item.step} className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                    {item.step}
                  </span>
                  <span className="text-[12px] text-slate-500">{item.text}</span>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* ── Footer ── */}
        <footer className="text-center pb-8">
          <p className="text-[11px] text-slate-700">小电驴 v1.0 · 仅供个人学习使用</p>
        </footer>
      </div>
    </div>
  )
}
