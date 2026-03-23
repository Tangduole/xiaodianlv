import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  Download, CheckCircle2, XCircle, Loader2,
  Video, FileText, Image as ImageIcon, Mic, Languages,
  Trash2, ChevronDown, ChevronUp, Clock, Copy, Check,
  X, Smartphone, FolderOpen, Link, Zap,
} from 'lucide-react'

const API = '/api'

/* ─── types ─── */
interface Task {
  taskId: string
  status: string
  progress: number
  title?: string
  platform?: string
  thumbnailUrl?: string
  downloadUrl?: string
  asrText?: string
  copyText?: string
  coverUrl?: string
  imageFiles?: Array<{ filename: string; url: string }>
  subtitleFiles?: Array<{ filename: string; url: string }>
  error?: string
  createdAt: string | number
}

interface HistoryItem {
  taskId: string
  status: string
  title?: string
  platform?: string
  thumbnailUrl?: string
  createdAt: string | number
}

type Opt = 'video' | 'copy' | 'cover' | 'asr' | 'sub'
const OPTS: { id: Opt; label: string; icon: typeof Video; desc: string }[] = [
  { id: 'video', label: '视频', icon: Video, desc: '下载视频文件' },
  { id: 'copy', label: '文案', icon: FileText, desc: '提取标题/描述' },
  { id: 'cover', label: '封面', icon: ImageIcon, desc: '下载视频封面' },
  { id: 'asr', label: '原声', icon: Mic, desc: '语音转文字' },
  { id: 'sub', label: '字幕', icon: Languages, desc: '下载字幕文件' },
]

const PLATFORMS = [
  { id: 'auto', label: '自动识别', emoji: '🎯' },
  { id: 'douyin', label: '抖音', emoji: '🎵' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎶' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'x', label: 'X', emoji: '𝕏' },
]

function ts(t: string | number) {
  const d = new Date(t)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function App() {
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState('auto')
  const [selected, setSelected] = useState<Set<Opt>>(new Set(['video']))
  const [task, setTask] = useState<Task | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  /* ─── polling ─── */
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
    try {
      const r = await axios.get(`${API}/history`)
      setHistory(Array.isArray(r.data.data) ? r.data.data : [])
    } catch {}
  }, [])
  useEffect(() => { fetchHistory() }, [fetchHistory])

  /* ─── submit ─── */
  const handleSubmit = async () => {
    if (!url.trim()) { setError('请输入链接'); return }
    setLoading(true)
    setError('')
    try {
      const r = await axios.post(`${API}/download`, {
        url: url.trim(),
        platform,
        needAsr: selected.has('asr'),
        options: [...selected].map(o => o === 'copy' ? 'copywriting' : o),
      }, { timeout: 120000 })
      setTask(r.data.data)
      setUrl('')
    } catch (e: any) {
      setError(e.code === 'ECONNABORTED' ? '请求超时，请重试' : (e.response?.data?.message || '失败'))
    } finally { setLoading(false) }
  }

  const toggle = (o: Opt) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(o) && n.size > 1 ? n.delete(o) : n.add(o)
      return n
    })
  }

  const del = async (id: string) => {
    try { await axios.delete(`${API}/tasks/${id}`); fetchHistory(); if (task?.taskId === id) setTask(null) } catch {}
  }

  const clip = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000) } catch {}
  }

  const isWorking = (s: string) => ['pending', 'parsing', 'processing', 'downloading', 'asr'].includes(s)
  const statusLabel = (s: string) =>
    ({ pending: '排队中', parsing: '解析中', processing: '处理中', downloading: '下载中', asr: '语音识别中', completed: '✅ 完成', error: '❌ 失败' }[s] || s)

  return (
    <div className="min-h-screen bg-[#111] text-[#e4e4e7] flex flex-col max-w-[420px] mx-auto">

      {/* ── 顶栏 ── */}
      <div className="flex items-center justify-between px-4 h-12 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛵</span>
          <span className="font-semibold text-[15px]">小电驴</span>
        </div>
        <div className="flex items-center gap-4 text-[#555]">
          <button onClick={() => setShowHistory(!showHistory)}><Clock className="w-[17px] h-[17px]" /></button>
        </div>
      </div>

      <div className="flex-1 px-4 pb-4 space-y-3">

        {/* ── 平台选择 ── */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {PLATFORMS.map(p => (
            <button key={p.id} onClick={() => setPlatform(p.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition
                ${platform === p.id ? 'bg-[#FF6B35] text-white' : 'bg-[#1a1a1a] text-[#888] hover:text-[#ccc]'}`}>
              <span>{p.emoji}</span>{p.label}
            </button>
          ))}
        </div>

        {/* ── 输入框 ── */}
        <div className="relative">
          <input type="text" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="粘贴链接，自动识别平台"
            className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl text-sm text-white placeholder-[#555] outline-none focus:border-[#FF6B35]/60 transition pr-12" />
          <Link className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
        </div>

        {/* ── 下载选项 ── */}
        <div className="grid grid-cols-5 gap-1.5">
          {OPTS.map(o => {
            const Icon = o.icon
            const on = selected.has(o.id)
            return (
              <button key={o.id} onClick={() => toggle(o.id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl text-[11px] transition
                  ${on ? 'bg-[#FF6B35]/15 border border-[#FF6B35]/40 text-[#FF6B35]' : 'bg-[#1a1a1a] border border-transparent text-[#666]'}`}>
                <Icon className="w-[18px] h-[18px]" />
                {o.label}
              </button>
            )
          })}
        </div>

        {/* ── 保存位置 ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] rounded-xl">
          <Smartphone className="w-4 h-4 text-[#FF6B35] shrink-0" />
          <span className="text-xs text-[#aaa]">保存至</span>
          <span className="text-xs text-white ml-1">手机相册</span>
        </div>

        {/* ── 错误 ── */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
            <XCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </div>
        )}

        {/* ── 下载按钮 ── */}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm bg-[#FF6B35] hover:bg-[#e85d2a] disabled:bg-[#333] disabled:text-[#666] transition-all flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {loading ? '请求中...' : '开始下载'}
        </button>

        {/* ── 任务状态 ── */}
        {task && (
          <div className="p-4 bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#666]">任务状态</span>
              <button onClick={() => setTask(null)}><X className="w-3.5 h-3.5 text-[#555]" /></button>
            </div>

            {/* 状态 & 进度 */}
            <div className="flex items-center gap-2">
              {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
              {task.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
              {isWorking(task.status) && <Loader2 className="w-4 h-4 text-[#FF6B35] animate-spin" />}
              <span className="text-xs text-[#ccc]">{statusLabel(task.status)}</span>
            </div>
            {isWorking(task.status) && (
              <div className="w-full h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div className="h-full bg-[#FF6B35] rounded-full transition-all duration-500" style={{ width: `${task.progress}%` }} />
              </div>
            )}

            {task.title && <p className="text-xs text-[#888] leading-relaxed">{task.title}</p>}

            {/* 图文结果 */}
            {task.isNote && task.imageFiles?.length > 0 && (
              <div>
                <p className="text-[11px] text-[#666] mb-2">共 {task.imageFiles.length} 张图片</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {task.imageFiles.map((img) => (
                    <a key={img.filename} href={img.url} download className="block">
                      <img src={img.url} alt="" className="w-full aspect-square object-cover rounded-lg bg-[#222]" loading="lazy" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 视频下载 */}
            {task.status === 'completed' && task.downloadUrl && (
              <a href={task.downloadUrl} download
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition">
                <Download className="w-4 h-4" /> 下载视频
              </a>
            )}

            {/* 封面 */}
            {task.status === 'completed' && task.coverUrl && (
              <a href={task.coverUrl} download
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs bg-[#222] border border-[#333] text-[#aaa] hover:text-white transition">
                <ImageIcon className="w-3.5 h-3.5" /> 下载封面
              </a>
            )}

            {/* 文案 */}
            {task.status === 'completed' && task.copyText && (
              <div className="p-3 bg-[#222] rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-[#666]">文案</span>
                  <button onClick={() => clip(task.copyText!, 'copy')} className="text-[10px] text-[#555] hover:text-white">
                    {copied === 'copy' ? <><Check className="w-3 h-3 inline" /> 已复制</> : <><Copy className="w-3 h-3 inline" /> 复制</>}
                  </button>
                </div>
                <p className="text-xs text-[#aaa] whitespace-pre-wrap max-h-24 overflow-y-auto">{task.copyText}</p>
              </div>
            )}

            {/* 字幕 */}
            {task.status === 'completed' && task.subtitleFiles?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {task.subtitleFiles.map(s => (
                  <a key={s.filename} href={s.url} download={s.filename}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] bg-[#222] border border-[#333] text-[#aaa] hover:text-white transition">
                    <Languages className="w-3 h-3" />{s.filename}
                  </a>
                ))}
              </div>
            )}

            {/* ASR */}
            {task.asrText && (
              <div className="p-3 bg-[#222] rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-[#666]">语音转文字</span>
                  <button onClick={() => clip(task.asrText!, 'asr')} className="text-[10px] text-[#555] hover:text-white">
                    {copied === 'asr' ? <><Check className="w-3 h-3 inline" /> 已复制</> : <><Copy className="w-3 h-3 inline" /> 复制</>}
                  </button>
                </div>
                <p className="text-xs text-[#aaa] whitespace-pre-wrap max-h-32 overflow-y-auto">{task.asrText}</p>
              </div>
            )}

            {/* 错误 */}
            {task.status === 'error' && task.error && (
              <p className="text-xs text-red-400 leading-relaxed">{task.error}</p>
            )}
          </div>
        )}
      </div>

      {/* ── 底部历史 ── */}
      <div className="shrink-0 border-t border-[#1a1a1a]">
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs text-[#555]">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> 下载历史
            {history.length > 0 && <span className="bg-[#222] px-1.5 py-0.5 rounded text-[10px]">{history.length}</span>}
          </span>
          {showHistory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        {showHistory && (
          <div className="max-h-56 overflow-y-auto border-t border-[#1a1a1a]">
            {history.length === 0
              ? <p className="py-8 text-center text-xs text-[#444]">暂无记录</p>
              : history.map(item => (
                <div key={item.taskId} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1a1a1a] last:border-0">
                  {item.thumbnailUrl
                    ? <img src={item.thumbnailUrl} alt="" className="w-10 h-7 object-cover rounded shrink-0" />
                    : <div className="w-10 h-7 rounded bg-[#222] flex items-center justify-center shrink-0"><Video className="w-3.5 h-3.5 text-[#444]" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#aaa] truncate">{item.title || '未命名'}</p>
                    <p className="text-[10px] text-[#444]">{item.platform || ''} · {ts(item.createdAt)}</p>
                  </div>
                  <button onClick={() => del(item.taskId)}><Trash2 className="w-3.5 h-3.5 text-[#444] hover:text-red-400" /></button>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
