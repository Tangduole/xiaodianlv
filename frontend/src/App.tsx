import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  Download, CheckCircle2, XCircle, Loader2,
  Video, FileText, Image as ImageIcon, Mic, Languages,
  Trash2, ChevronDown, ChevronUp, Clock, Copy, Check,
  X, Smartphone, FolderOpen, Upload, Zap,
} from 'lucide-react'

const API = '/api'

// ─── Types ───
interface Task {
  taskId: string; status: string; progress: number
  title?: string; platform?: string; thumbnailUrl?: string
  downloadUrl?: string; asrText?: string; copyText?: string
  coverUrl?: string; imageFiles?: Array<{ filename: string; url: string }>
  subtitleFiles?: Array<{ filename: string; url: string }>
  error?: string; createdAt: string | number
}
interface HistoryItem {
  taskId: string; status: string; title?: string
  platform?: string; thumbnailUrl?: string; createdAt: string | number
}

// ─── Auto-detect platform ───
function detectPlatform(url: string): string {
  if (/douyin\.com|iesdouyin\.com/i.test(url)) return 'douyin'
  if (/tiktok\.com/i.test(url)) return 'tiktok'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/twitter\.com|x\.com/i.test(url)) return 'x'
  return ''
}

// ─── Config ───
const PLATFORMS = [
  { id: 'douyin', label: '抖音', emoji: '🎵' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎶' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'x', label: 'X', emoji: '𝕏' },
]
const OPTIONS: { id: string; label: string; icon: typeof Video }[] = [
  { id: 'video', label: '视频', icon: Video },
  { id: 'copywriting', label: '文案', icon: FileText },
  { id: 'cover', label: '封面', icon: ImageIcon },
  { id: 'asr', label: '原声', icon: Mic },
  { id: 'subtitle', label: '字幕', icon: Languages },
]

// ─── App ───
export default function App() {
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState('auto')
  const [selected, setSelected] = useState<Set<string>>(new Set(['video']))
  const [task, setTask] = useState<Task | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Polling
  useEffect(() => {
    if (!task || task.status === 'completed' || task.status === 'error') return
    const t = setInterval(async () => {
      try {
        const r = await axios.get(`${API}/status/${task.taskId}`)
        if (r.data.data) {
          setTask(r.data.data)
          if (['completed', 'error'].includes(r.data.data.status)) { clearInterval(t); fetchHistory() }
        }
      } catch { }
    }, 2000)
    return () => clearInterval(t)
  }, [task])

  const fetchHistory = useCallback(async () => {
    try { const r = await axios.get(`${API}/history`); setHistory(Array.isArray(r.data.data) ? r.data.data : []) } catch { }
  }, [])
  useEffect(() => { fetchHistory() }, [fetchHistory])

  // Submit
  const handleSubmit = async () => {
    if (!url.trim()) { setError('请输入视频链接'); return }
    setLoading(true); setError('')
    try {
      const r = await axios.post(`${API}/download`, {
        url: url.trim(), platform: platform === 'auto' ? detectPlatform(url) || 'auto' : platform,
        needAsr: selected.has('asr'), options: [...selected],
      }, { timeout: 120000 })
      setTask(r.data.data); setUrl('')
    } catch (e: any) {
      setError(e.code === 'ECONNABORTED' ? '请求超时，请重试' : (e.response?.data?.message || '下载失败'))
    } finally { setLoading(false) }
  }

  const toggle = (o: string) => setSelected(prev => { const n = new Set(prev); n.has(o) && n.size > 1 ? n.delete(o) : n.add(o); return n })
  const del = async (id: string) => { try { await axios.delete(`${API}/tasks/${id}`); fetchHistory(); if (task?.taskId === id) setTask(null) } catch { } }
  const clip = async (text: string, id: string) => { try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000) } catch { } }

  const isWorking = (s: string) => ['pending', 'parsing', 'processing', 'downloading', 'asr'].includes(s)
  const statusLabel = (s: string) => ({ pending: '排队中', parsing: '解析中', downloading: '下载中', asr: '语音识别中', completed: '✅ 完成', error: '❌ 失败' }[s] || s)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col items-center px-4 py-6 relative overflow-hidden">

      {/* ── 光晕装饰 ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Header ── */}
      <div className="relative z-10 w-full max-w-md flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">小电驴</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">多平台视频下载工具</p>
          </div>
        </div>
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-10 h-10 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 flex items-center justify-center hover:bg-slate-700/50">
          <Clock className="w-[18px] h-[18px] text-slate-400" />
        </button>
      </div>

      {/* ── Main Card ── */}
      <div className="relative z-10 w-full max-w-md bg-slate-800/50 backdrop-blur-sm rounded-3xl p-5 border border-slate-700/50 space-y-5">

        {/* 平台选择 */}
        <div>
          <label className="text-xs text-slate-400 font-medium mb-2 block">选择平台</label>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setPlatform('auto')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all
                ${platform === 'auto' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25' : 'bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:text-slate-200'}`}>
              🎯 自动识别
            </button>
            {PLATFORMS.map(p => (
              <button key={p.id} onClick={() => setPlatform(p.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all
                  ${platform === p.id ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25' : 'bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:text-slate-200'}`}>
                <span>{p.emoji}</span>{p.label}
              </button>
            ))}
          </div>
        </div>

        {/* URL 输入 */}
        <div>
          <label className="text-xs text-slate-400 font-medium mb-2 block">视频链接</label>
          <div className="relative">
            <input type="text" value={url} onChange={e => { setUrl(e.target.value); if (platform === 'auto') setPlatform(detectPlatform(e.target.value) || 'auto') }}
              placeholder="粘贴链接，自动识别平台..."
              className="w-full pl-4 pr-4 py-3.5 bg-slate-900/60 border border-slate-600/40 rounded-2xl text-sm text-white placeholder-slate-500 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all" />
          </div>
        </div>

        {/* 下载选项 */}
        <div>
          <label className="text-xs text-slate-400 font-medium mb-2 block">选择下载内容</label>
          <div className="grid grid-cols-5 gap-2">
            {OPTIONS.map(o => {
              const Icon = o.icon; const on = selected.has(o.id)
              return (
                <button key={o.id} onClick={() => toggle(o.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl text-xs transition-all
                    ${on ? 'bg-orange-500/15 border border-orange-500/40 text-orange-400 shadow-md shadow-orange-500/10' : 'bg-slate-900/40 border border-slate-600/30 text-slate-500 hover:text-slate-300 hover:border-slate-500/50'}`}>
                  <Icon className="w-[18px] h-[18px]" />{o.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 保存至 */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/40 rounded-2xl border border-slate-600/30">
          <span className="text-xs text-slate-400">保存至</span>
          <div className="flex items-center gap-2 text-sm text-white">
            <Smartphone className="w-4 h-4 text-orange-400" />
            <span>手机相册</span>
            <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
          </div>
        </div>

        {/* Cookie 上传 */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/40 rounded-2xl border border-slate-600/30">
          <div className="flex items-center gap-2">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-400">上传 Cookie</span>
            <span className="text-[10px] text-slate-600 bg-slate-700/50 px-1.5 py-0.5 rounded">可选</span>
          </div>
          <span className="text-[11px] text-slate-600">未上传</span>
        </div>

        {/* 错误 */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400">
            <XCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {/* 下载按钮 */}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.97] disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-orange-500/25">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {loading ? '处理中...' : '开始下载'}
        </button>

        {/* 任务状态 */}
        {task && (
          <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-600/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">下载进度</span>
              <button onClick={() => setTask(null)}><X className="w-4 h-4 text-slate-600 hover:text-slate-300" /></button>
            </div>
            <div className="flex items-center gap-2">
              {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {task.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
              {isWorking(task.status) && <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />}
              <span className="text-xs text-slate-300">{statusLabel(task.status)}</span>
            </div>
            {isWorking(task.status) && (
              <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500" style={{ width: `${task.progress}%` }} />
              </div>
            )}
            {task.title && <p className="text-xs text-slate-400 leading-relaxed">{task.title}</p>}

            {/* 图文 */}
            {task.isNote && task.imageFiles?.length > 0 && (
              <div>
                <p className="text-[11px] text-slate-500 mb-2">共 {task.imageFiles.length} 张图片</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {task.imageFiles.map(img => (
                    <a key={img.filename} href={img.url} download><img src={img.url} alt="" className="w-full aspect-square object-cover rounded-xl bg-slate-800" loading="lazy" /></a>
                  ))}
                </div>
              </div>
            )}
            {/* 视频 */}
            {task.status === 'completed' && task.downloadUrl && (
              <a href={task.downloadUrl} download className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all">
                <Download className="w-4 h-4" /> 下载视频文件
              </a>
            )}
            {/* 封面 */}
            {task.status === 'completed' && task.coverUrl && (
              <a href={task.coverUrl} download className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-xs bg-slate-700/30 border border-slate-600/30 text-slate-400 hover:text-white transition-all">
                <ImageIcon className="w-3.5 h-3.5" /> 下载封面
              </a>
            )}
            {/* 文案 */}
            {task.status === 'completed' && task.copyText && (
              <div className="p-3 bg-slate-900/60 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500 font-medium">文案</span>
                  <button onClick={() => clip(task.copyText!, 'copy')} className="text-[10px] text-slate-500 hover:text-orange-400 transition">
                    {copied === 'copy' ? <><Check className="w-3 h-3 inline" /> 已复制</> : <><Copy className="w-3 h-3 inline" /> 复制</>}
                  </button>
                </div>
                <p className="text-xs text-slate-400 whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed">{task.copyText}</p>
              </div>
            )}
            {/* 字幕 */}
            {task.status === 'completed' && task.subtitleFiles?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {task.subtitleFiles.map(s => (
                  <a key={s.filename} href={s.url} download={s.filename} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] bg-slate-700/30 border border-slate-600/30 text-slate-400 hover:text-white transition-all">
                    <Languages className="w-3 h-3" />{s.filename}
                  </a>
                ))}
              </div>
            )}
            {/* ASR */}
            {task.asrText && (
              <div className="p-3 bg-slate-900/60 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500 font-medium">语音转文字</span>
                  <button onClick={() => clip(task.asrText!, 'asr')} className="text-[10px] text-slate-500 hover:text-orange-400 transition">
                    {copied === 'asr' ? <><Check className="w-3 h-3 inline" /> 已复制</> : <><Copy className="w-3 h-3 inline" /> 复制</>}
                  </button>
                </div>
                <p className="text-xs text-slate-400 whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">{task.asrText}</p>
              </div>
            )}
            {task.status === 'error' && task.error && <p className="text-xs text-red-400">{task.error}</p>}
          </div>
        )}
      </div>

      {/* ── 底部历史 ── */}
      <div className="relative z-10 w-full max-w-md mt-4">
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-2 py-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> 下载历史
            {history.length > 0 && <span className="bg-slate-700/50 px-1.5 py-0.5 rounded text-[10px]">{history.length}</span>}
          </span>
          {showHistory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        {showHistory && (
          <div className="max-h-56 overflow-y-auto border-t border-slate-700/30">
            {history.length === 0
              ? <p className="py-10 text-center text-xs text-slate-600">暂无下载记录</p>
              : history.map(item => (
                <div key={item.taskId} className="flex items-center gap-3 px-2 py-2.5 border-b border-slate-800/50 last:border-0">
                  {item.thumbnailUrl
                    ? <img src={item.thumbnailUrl} alt="" className="w-11 h-7 object-cover rounded-lg shrink-0" />
                    : <div className="w-11 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0"><Video className="w-3.5 h-3.5 text-slate-600" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 truncate">{item.title || '未命名'}</p>
                    <p className="text-[10px] text-slate-600">{item.platform || ''} · {new Date(item.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <button onClick={() => del(item.taskId)}><Trash2 className="w-3.5 h-3.5 text-slate-600 hover:text-red-400" /></button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
