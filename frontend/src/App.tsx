import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  Download, CheckCircle2, XCircle, Loader2,
  Video, FileText, Image as ImageIcon, Mic, Languages,
  Trash2, ChevronDown, ChevronUp, Clock, Copy, Check,
  X, Smartphone, Link, Upload, FolderOpen,
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
    try { const r = await axios.get(`${API}/history`); setHistory(Array.isArray(r.data.data) ? r.data.data : []) } catch {}
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
      setError(e.code === 'ECONNABORTED' ? '请求超时' : (e.response?.data?.message || '下载失败'))
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
    ({ pending:'排队中', parsing:'解析中', downloading:'下载中', asr:'语音识别中', completed:'✅ 完成', error:'❌ 失败' }[s] || s)
  const fmtTime = (t: string | number) => new Date(t).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })

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
    <div className="min-h-screen bg-[#111] text-white flex flex-col max-w-[440px] mx-auto">

      {/* ── 标题栏 ── */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛵</span>
          <span className="text-lg font-bold">小电驴</span>
        </div>
        <button onClick={() => setShowHistory(!showHistory)} className="text-[#666] hover:text-white">
          <Clock className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 px-4 pb-4 space-y-3.5">

        {/* ── 平台选择 Tabs ── */}
        <div className="flex bg-[#1a1a1a] rounded-2xl p-1 gap-1">
          {platforms.map(p => (
            <button key={p.id} onClick={() => setPlatform(p.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all
                ${platform === p.id
                  ? 'bg-[#FF6B35] text-white'
                  : 'text-[#555] hover:text-[#888]'}`}>
              <span>{p.emoji}</span>{p.label}
            </button>
          ))}
        </div>

        {/* ── 单个/批量 Tabs ── */}
        <div className="flex gap-2">
          <button onClick={() => setMode('single')}
            className={`flex-1 py-2 rounded-xl text-sm transition
              ${mode === 'single' ? 'bg-[#1e1e1e] text-white border border-[#333]' : 'text-[#555]'}`}>
            单个视频下载
          </button>
          <button onClick={() => setMode('batch')}
            className={`flex-1 py-2 rounded-xl text-sm transition
              ${mode === 'batch' ? 'bg-[#1e1e1e] text-white border border-[#333]' : 'text-[#555]'}`}>
            批量下载
          </button>
        </div>

        {/* ── 输入框 ── */}
        <div>
          <label className="text-xs text-[#777] mb-1.5 block">粘贴链接</label>
          <div className="flex gap-2">
            <input type="text" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="在此粘贴视频链接..."
              className="flex-1 px-3.5 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm text-white placeholder-[#444] outline-none focus:border-[#FF6B35]/50 transition" />
            <button className="px-4 py-2.5 bg-[#FF6B35] rounded-xl text-sm font-medium text-white hover:bg-orange-600 transition">
              解析
            </button>
          </div>
        </div>

        {/* ── 下载选项 ── */}
        <div>
          <label className="text-xs text-[#777] mb-1.5 block">选择下载内容</label>
          <div className="grid grid-cols-5 gap-1.5">
            {opts.map(o => {
              const Icon = o.icon
              const on = selected.has(o.id)
              return (
                <button key={o.id} onClick={() => toggle(o.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs transition-all
                    ${on
                      ? 'bg-[#FF6B35]/10 border border-[#FF6B35]/40 text-[#FF6B35]'
                      : 'bg-[#1a1a1a] border border-[#222] text-[#666] hover:border-[#333]'}`}>
                  <Icon className="w-4 h-4" />
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 保存至 ── */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
          <span className="text-xs text-[#777]">保存至</span>
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-[#FF6B35]" />
            <span className="text-sm text-white">手机相册</span>
            <FolderOpen className="w-3 h-3 text-[#555] ml-1" />
          </div>
        </div>

        {/* ── Cookie 上传 ── */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
          <div className="flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5 text-[#666]" />
            <span className="text-xs text-[#777]">上传 Cookie</span>
            <span className="text-[10px] text-[#444]">可选</span>
          </div>
          <span className="text-xs text-[#444]">未上传</span>
        </div>

        {/* ── 错误 ── */}
        {error && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
            <XCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </div>
        )}

        {/* ── 开始下载按钮 ── */}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-3.5 rounded-2xl font-bold text-sm bg-[#FF6B35] hover:bg-[#e85d2a] active:scale-[0.98] disabled:bg-[#333] disabled:text-[#666] transition-all flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {loading ? '处理中...' : '开始下载'}
        </button>

        {/* ── 任务状态 ── */}
        {task && (
          <div className="p-4 bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#666]">下载进度</span>
              <button onClick={() => setTask(null)}><X className="w-3.5 h-3.5 text-[#555]" /></button>
            </div>
            <div className="flex items-center gap-2">
              {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
              {task.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
              {isWorking(task.status) && <Loader2 className="w-4 h-4 text-[#FF6B35] animate-spin" />}
              <span className="text-xs text-[#ccc]">{statusLabel(task.status)}</span>
            </div>
            {isWorking(task.status) && (
              <div className="w-full h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div className="h-full bg-[#FF6B35] rounded-full transition-all duration-500" style={{ width: `${task.progress}%` }} />
              </div>
            )}
            {task.title && <p className="text-xs text-[#888] leading-relaxed">{task.title}</p>}
            {task.isNote && task.imageFiles?.length > 0 && (
              <div>
                <p className="text-[11px] text-[#666] mb-2">共 {task.imageFiles.length} 张图片</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {task.imageFiles.map(img => (
                    <a key={img.filename} href={img.url} download><img src={img.url} alt="" className="w-full aspect-square object-cover rounded-lg bg-[#222]" loading="lazy" /></a>
                  ))}
                </div>
              </div>
            )}
            {task.status === 'completed' && task.downloadUrl && (
              <a href={task.downloadUrl} download className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition">
                <Download className="w-4 h-4" /> 下载视频文件
              </a>
            )}
            {task.status === 'completed' && task.coverUrl && (
              <a href={task.coverUrl} download className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs bg-[#222] border border-[#333] text-[#aaa] hover:text-white transition">
                <ImageIcon className="w-3.5 h-3.5" /> 下载封面
              </a>
            )}
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
            {task.status === 'completed' && task.subtitleFiles?.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {task.subtitleFiles.map(s => (
                  <a key={s.filename} href={s.url} download={s.filename} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] bg-[#222] border border-[#333] text-[#aaa] hover:text-white transition">
                    <Languages className="w-3 h-3" />{s.filename}
                  </a>
                ))}
              </div>
            )}
            {task.asrText && (
              <div className="p-3 bg-[#222] rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-[#666]">语音转文字</span>
                  <button onClick={() => clip(task.asrText!, 'asr')} className="text-[10px] text-[#555] hover:text-white">
                    {copied === 'asr' ? <><Check className="w-3 h-3 inline" /> 已复制</> : <><Copy className="w-3 h-3 inline" /> 复制</>}
                  </button>
                </div>
                <p className="text-xs text-[#aaa] whitespace-pre-wrap max-h-28 overflow-y-auto">{task.asrText}</p>
              </div>
            )}
            {task.status === 'error' && task.error && <p className="text-xs text-red-400">{task.error}</p>}
          </div>
        )}
      </div>

      {/* ── 底部历史 ── */}
      <div className="shrink-0 border-t border-[#1a1a1a]">
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs text-[#555]">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> 下载历史
            {history.length > 0 && <span className="bg-[#1e1e1e] px-1.5 py-0.5 rounded text-[10px]">{history.length}</span>}
          </span>
          {showHistory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        {showHistory && (
          <div className="max-h-56 overflow-y-auto border-t border-[#1a1a1a]">
            {history.length === 0
              ? <p className="py-8 text-center text-xs text-[#444]">暂无下载记录</p>
              : history.map(item => (
                <div key={item.taskId} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1a1a1a] last:border-0">
                  {item.thumbnailUrl
                    ? <img src={item.thumbnailUrl} alt="" className="w-11 h-7 object-cover rounded-lg shrink-0" />
                    : <div className="w-11 h-7 rounded-lg bg-[#222] flex items-center justify-center shrink-0"><Video className="w-3.5 h-3.5 text-[#444]" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#aaa] truncate">{item.title || '未命名'}</p>
                    <p className="text-[10px] text-[#555]">{item.platform || ''} · {fmtTime(item.createdAt)}</p>
                  </div>
                  <button onClick={() => del(item.taskId)}><Trash2 className="w-3.5 h-3.5 text-[#444] hover:text-red-400" /></button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
