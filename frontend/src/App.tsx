import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  Download, CheckCircle2, XCircle, Loader2,
  Video, FileText, Image as ImageIcon, Mic, Languages,
  Trash2, ChevronDown, ChevronUp, Clock, Copy, Check,
  X, Smartphone, Link, Zap,
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

export default function App() {
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState('douyin')
  const [selected, setSelected] = useState<Set<Opt>>(new Set(['video']))
  const [task, setTask] = useState<Task | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [mode, setMode] = useState<'single' | 'batch'>('single')

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

  const handleSubmit = async () => {
    if (!url.trim()) { setError('请输入链接'); return }
    setLoading(true); setError('')
    try {
      const r = await axios.post(`${API}/download`, {
        url: url.trim(), platform,
        needAsr: selected.has('asr'),
        options: [...selected].map(o => o === 'copy' ? 'copywriting' : o),
      }, { timeout: 120000 })
      setTask(r.data.data); setUrl('')
    } catch (e: any) {
      setError(e.code === 'ECONNABORTED' ? '请求超时，请重试' : (e.response?.data?.message || '下载失败'))
    } finally { setLoading(false) }
  }

  const toggle = (o: Opt) => {
    setSelected(prev => { const n = new Set(prev); n.has(o) && n.size > 1 ? n.delete(o) : n.add(o); return n })
  }
  const del = async (id: string) => {
    try { await axios.delete(`${API}/tasks/${id}`); fetchHistory(); if (task?.taskId === id) setTask(null) } catch {}
  }
  const clip = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000) } catch {}
  }

  const isWorking = (s: string) => ['pending','parsing','processing','downloading','asr'].includes(s)
  const statusLabel = (s: string) =>
    ({ pending:'排队中', parsing:'解析中', processing:'处理中', downloading:'下载中', asr:'语音识别中', completed:'✅ 完成', error:'❌ 失败' }[s] || s)
  const fmtTime = (t: string | number) => {
    const d = new Date(t)
    return d.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
  }

  const platforms = [
    { id:'douyin', label:'抖音', emoji:'🎵' },
    { id:'tiktok', label:'TikTok', emoji:'🎶' },
    { id:'youtube', label:'YouTube', emoji:'▶️' },
    { id:'x', label:'X', emoji:'𝕏' },
  ]

  const opts: { id:Opt; label:string; icon:typeof Video }[] = [
    { id:'video', label:'视频', icon:Video },
    { id:'copy', label:'文案', icon:FileText },
    { id:'cover', label:'封面', icon:ImageIcon },
    { id:'asr', label:'原声', icon:Mic },
    { id:'sub', label:'字幕', icon:Languages },
  ]

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col max-w-[440px] mx-auto">

      {/* ── 顶栏 ── */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FF6B35] rounded-2xl flex items-center justify-center">
            <Download className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">小电驴</h1>
            <p className="text-[11px] text-[#666] -mt-0.5">多平台内容下载</p>
          </div>
        </div>
        <button onClick={() => setShowHistory(!showHistory)} className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center">
          <Clock className="w-[18px] h-[18px] text-[#888]" />
        </button>
      </div>

      <div className="flex-1 px-5 pb-6 space-y-5">

        {/* ── 平台选择 ── */}
        <div className="flex bg-[#1a1a1a] rounded-2xl p-1.5 gap-1">
          {platforms.map(p => (
            <button key={p.id} onClick={() => setPlatform(p.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition-all
                ${platform === p.id ? 'bg-[#FF6B35] text-white shadow-lg shadow-orange-500/25' : 'text-[#666] hover:text-[#999]'}`}>
              <span className="text-base">{p.emoji}</span>{p.label}
            </button>
          ))}
        </div>

        {/* ── 下载模式 ── */}
        <div className="flex gap-2">
          {(['single','batch'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all
                ${mode === m ? 'bg-[#222] text-white border border-[#333]' : 'text-[#555] border border-transparent'}`}>
              {m === 'single' ? '单个视频下载' : '批量下载'}
            </button>
          ))}
        </div>

        {/* ── 链接输入 ── */}
        <div>
          <label className="text-sm font-medium text-[#ccc] mb-2 block">视频链接</label>
          <div className="relative">
            <input type="text" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="粘贴链接，自动识别平台"
              className="w-full pl-4 pr-12 py-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl text-[15px] text-white placeholder-[#444] outline-none focus:border-[#FF6B35]/50 transition" />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#FF6B35] rounded-lg flex items-center justify-center">
              <Link className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* ── 下载选项 ── */}
        <div>
          <label className="text-sm font-medium text-[#ccc] mb-2.5 block">选择下载内容</label>
          <div className="grid grid-cols-5 gap-2">
            {opts.map(o => {
              const Icon = o.icon
              const on = selected.has(o.id)
              return (
                <button key={o.id} onClick={() => toggle(o.id)}
                  className={`flex flex-col items-center gap-2 py-4 rounded-2xl text-sm transition-all
                    ${on ? 'bg-[#FF6B35]/10 border-2 border-[#FF6B35]/50 text-[#FF6B35]' : 'bg-[#1a1a1a] border-2 border-[#1a1a1a] text-[#666] hover:border-[#333]'}`}>
                  <Icon className="w-5 h-5" />
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 保存位置 ── */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#1a1a1a] rounded-2xl">
          <span className="text-sm text-[#999]">保存至</span>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#FF6B35]" />
            <span className="text-sm font-medium text-white">手机相册</span>
          </div>
        </div>

        {/* ── 错误 ── */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-400">
            <XCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {/* ── 下载按钮 ── */}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-base bg-[#FF6B35] hover:bg-[#e85d2a] active:scale-[0.98] disabled:bg-[#333] disabled:text-[#666] transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-orange-500/20">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {loading ? '处理中...' : '开始下载'}
        </button>

        {/* ── 任务状态 ── */}
        {task && (
          <div className="p-5 bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#888]">下载进度</span>
              <button onClick={() => setTask(null)}><X className="w-4 h-4 text-[#555]" /></button>
            </div>

            <div className="flex items-center gap-2.5">
              {task.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
              {task.status === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
              {isWorking(task.status) && <Loader2 className="w-5 h-5 text-[#FF6B35] animate-spin" />}
              <span className="text-sm text-[#ccc]">{statusLabel(task.status)}</span>
            </div>

            {isWorking(task.status) && (
              <div className="w-full h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#FF6B35] to-[#ff8f5e] rounded-full transition-all duration-500"
                  style={{ width: `${task.progress}%` }} />
              </div>
            )}

            {task.title && <p className="text-sm text-[#999] leading-relaxed">{task.title}</p>}

            {/* 图文结果 */}
            {task.isNote && task.imageFiles?.length > 0 && (
              <div>
                <p className="text-xs text-[#666] mb-2">共 {task.imageFiles.length} 张图片</p>
                <div className="grid grid-cols-3 gap-2">
                  {task.imageFiles.map((img) => (
                    <a key={img.filename} href={img.url} download className="block">
                      <img src={img.url} alt="" className="w-full aspect-square object-cover rounded-xl bg-[#222]" loading="lazy" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 视频下载 */}
            {task.status === 'completed' && task.downloadUrl && (
              <a href={task.downloadUrl} download
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-semibold bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition">
                <Download className="w-4 h-4" /> 下载视频文件
              </a>
            )}

            {/* 封面 */}
            {task.status === 'completed' && task.coverUrl && (
              <a href={task.coverUrl} download
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm bg-[#222] border border-[#333] text-[#aaa] hover:text-white transition">
                <ImageIcon className="w-4 h-4" /> 下载封面
              </a>
            )}

            {/* 文案 */}
            {task.status === 'completed' && task.copyText && (
              <div className="p-4 bg-[#222] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#666] font-medium">文案</span>
                  <button onClick={() => clip(task.copyText!, 'copy')} className="text-xs text-[#555] hover:text-white">
                    {copied === 'copy' ? <><Check className="w-3 h-3 inline" /> 已复制</> : <><Copy className="w-3 h-3 inline" /> 复制</>}
                  </button>
                </div>
                <p className="text-sm text-[#aaa] whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed">{task.copyText}</p>
              </div>
            )}

            {/* 字幕 */}
            {task.status === 'completed' && task.subtitleFiles?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {task.subtitleFiles.map(s => (
                  <a key={s.filename} href={s.url} download={s.filename}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-[#222] border border-[#333] text-[#aaa] hover:text-white transition">
                    <Languages className="w-3.5 h-3.5" />{s.filename}
                  </a>
                ))}
              </div>
            )}

            {/* ASR */}
            {task.asrText && (
              <div className="p-4 bg-[#222] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#666] font-medium">语音转文字</span>
                  <button onClick={() => clip(task.asrText!, 'asr')} className="text-xs text-[#555] hover:text-white">
                    {copied === 'asr' ? <><Check className="w-3 h-3 inline" /> 已复制</> : <><Copy className="w-3 h-3 inline" /> 复制</>}
                  </button>
                </div>
                <p className="text-sm text-[#aaa] whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">{task.asrText}</p>
              </div>
            )}

            {task.status === 'error' && task.error && (
              <p className="text-sm text-red-400 leading-relaxed">{task.error}</p>
            )}
          </div>
        )}
      </div>

      {/* ── 底部历史 ── */}
      <div className="shrink-0 border-t border-[#1a1a1a]">
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm text-[#555]">
          <span className="flex items-center gap-2 font-medium">
            <Clock className="w-4 h-4" /> 下载历史
            {history.length > 0 && <span className="bg-[#222] px-2 py-0.5 rounded-lg text-xs">{history.length}</span>}
          </span>
          {showHistory ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        {showHistory && (
          <div className="max-h-64 overflow-y-auto border-t border-[#1a1a1a]">
            {history.length === 0
              ? <p className="py-10 text-center text-sm text-[#444]">暂无下载记录</p>
              : history.map(item => (
                <div key={item.taskId} className="flex items-center gap-3 px-5 py-3 border-b border-[#1a1a1a] last:border-0">
                  {item.thumbnailUrl
                    ? <img src={item.thumbnailUrl} alt="" className="w-12 h-8 object-cover rounded-lg shrink-0" />
                    : <div className="w-12 h-8 rounded-lg bg-[#222] flex items-center justify-center shrink-0"><Video className="w-4 h-4 text-[#444]" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#aaa] truncate">{item.title || '未命名'}</p>
                    <p className="text-xs text-[#555]">{item.platform || ''} · {fmtTime(item.createdAt)}</p>
                  </div>
                  <button onClick={() => del(item.taskId)}><Trash2 className="w-4 h-4 text-[#444] hover:text-red-400" /></button>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
