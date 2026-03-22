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
  Sparkles,
  Smartphone,
  FolderOpen,
  Zap,
  Clock,
  Copy,
  Check
} from 'lucide-react'

const API = '/api'

interface Task {
  taskId: string
  status: 'pending' | 'parsing' | 'processing' | 'downloading' | 'asr' | 'completed' | 'error'
  progress: number
  title?: string
  platform?: string
  thumbnail?: string
  thumbnailUrl?: string
  downloadUrl?: string
  asrText?: string
  subtitleFiles?: Array<{ filename: string; url: string }>
  copyText?: string
  coverUrl?: string
  error?: string
  createdAt: string
  speed?: string
  eta?: string
}

interface HistoryTask {
  taskId: string
  status: string
  title?: string
  platform?: string
  thumbnail?: string
  thumbnailUrl?: string
  createdAt: string
}

// 下载选项类型
type DownloadOption = 'video' | 'copywriting' | 'cover' | 'asr' | 'subtitle'

interface OptionConfig {
  id: DownloadOption
  label: string
  desc: string
  icon: typeof Video
  color: string
  bg: string
  border: string
  activeBg: string
  activeBorder: string
}

const DOWNLOAD_OPTIONS: OptionConfig[] = [
  {
    id: 'video',
    label: '视频',
    desc: '下载视频文件',
    icon: Video,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
    activeBg: 'bg-orange-500',
    activeBorder: 'border-orange-500',
  },
  {
    id: 'copywriting',
    label: '文案',
    desc: '提取视频文案',
    icon: FileText,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    activeBg: 'bg-blue-500',
    activeBorder: 'border-blue-500',
  },
  {
    id: 'cover',
    label: '封面',
    desc: '下载视频封面',
    icon: ImageIcon,
    color: 'text-pink-500',
    bg: 'bg-pink-50',
    border: 'border-pink-100',
    activeBg: 'bg-pink-500',
    activeBorder: 'border-pink-500',
  },
  {
    id: 'asr',
    label: '语音转文字',
    desc: 'AI 提取语音',
    icon: Mic,
    color: 'text-purple-500',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    activeBg: 'bg-purple-500',
    activeBorder: 'border-purple-500',
  },
  {
    id: 'subtitle',
    label: 'YouTube字幕',
    desc: '中文 SRT 字幕',
    icon: Languages,
    color: 'text-green-500',
    bg: 'bg-green-50',
    border: 'border-green-100',
    activeBg: 'bg-green-500',
    activeBorder: 'border-green-500',
  },
]

function App() {
  const [url, setUrl] = useState('')
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Set<DownloadOption>>(new Set(['video']))
  const [saveTarget, setSaveTarget] = useState<'phone' | 'pc' | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [history, setHistory] = useState<HistoryTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [previewInfo, setPreviewInfo] = useState<any>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // URL 输入时自动识别平台
  const handleUrlChange = (value: string) => {
    setUrl(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setDetectedPlatform(null)
      setPreviewInfo(null)
      return
    }

    // 本地自动识别平台
    const platform = detectPlatformLocal(value)
    setDetectedPlatform(platform)

    // Debounce 调后端获取详细信息
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/info?url=${encodeURIComponent(value.trim())}`)
        setPreviewInfo(res.data.data)
      } catch {
        setPreviewInfo(null)
      }
    }, 800)
  }

  // 本地平台识别
  const detectPlatformLocal = (url: string): string | null => {
    const patterns: Record<string, RegExp> = {
      '抖音': /douyin\.com|douyin\.cn|iesdouyin\.com/,
      'TikTok': /tiktok\.com|tiktok\.cn/,
      'X': /twitter\.com|x\.com/,
      'YouTube': /youtube\.com|youtu\.be/,
      'B站': /bilibili\.com|b23\.tv/,
      '快手': /kuaishou\.com|v\.kuaishou\.com/,
      '小红书': /xiaohongshu\.com|xhslink\.com/,
      'Instagram': /instagram\.com/,
    }
    for (const [name, pattern] of Object.entries(patterns)) {
      if (pattern.test(url)) return name
    }
    return null
  }

  // 切换下载选项
  const toggleOption = (option: DownloadOption) => {
    setSelectedOptions(prev => {
      const next = new Set(prev)
      if (next.has(option)) {
        if (next.size > 1) next.delete(option)
      } else {
        next.add(option)
      }
      return next
    })
  }

  // 轮询任务状态
  useEffect(() => {
    if (!task || task.status === 'completed' || task.status === 'error') return

    const timer = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/status/${task.taskId}`)
        const t = res.data.data
        if (t) {
          setTask(t)
          if (t.status === 'completed' || t.status === 'error') {
            clearInterval(timer)
            fetchHistory()
          }
        }
      } catch (err) {
        console.error('轮询失败:', err)
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [task])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/history`)
      const data = res.data.data
      setHistory(Array.isArray(data) ? data : (data.tasks || []))
    } catch (err) {
      console.error('获取历史失败:', err)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleSubmit = async () => {
    if (!url.trim()) {
      setError('请输入视频链接')
      return
    }
    if (selectedOptions.size === 0) {
      setError('请至少选择一个下载项')
      return
    }
    if (!saveTarget) {
      setError('请选择保存位置')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${API}/download`, {
        url: url.trim(),
        options: Array.from(selectedOptions),
        saveTarget,
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
    if (!confirm('确定要删除这个任务吗？')) return
    try {
      await axios.delete(`${API}/tasks/${taskId}`)
      fetchHistory()
      if (task?.taskId === taskId) setTask(null)
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* ignore */ }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />
      case 'processing': case 'downloading': case 'asr': case 'parsing':
        return <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
      default: return <div className="w-5 h-5 rounded-full bg-gray-200" />
    }
  }

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '等待中', parsing: '解析中', processing: '处理中',
      downloading: '下载中', asr: '语音识别中', completed: '已完成', error: '失败',
    }
    return map[status] || status
  }

  const isActive = (status: string) => {
    return ['pending', 'parsing', 'processing', 'downloading', 'asr'].includes(status)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-gray-50">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-orange-400 to-pink-500" />
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 mb-4">
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-white/90 text-sm font-medium">AI 加持 · 极速下载</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">🛵 小电驴</h1>
          <p className="text-white/80 text-lg">粘贴链接，自动识别平台</p>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full">
            <path fill="url(#hg)" d="M0,20 C360,60 720,0 1080,20 C1260,30 1380,10 1440,20 L1440,60 L0,60 Z" />
            <defs>
              <linearGradient id="hg" x1="0" y1="0" x2="1440" y2="0">
                <stop offset="0%" stopColor="#FFF7ED" />
                <stop offset="100%" stopColor="#F9FAFB" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* 主输入卡片 */}
        <div className="bg-white rounded-3xl shadow-lg shadow-orange-100/50 p-6 border border-orange-100">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">下载视频</h2>
              <p className="text-sm text-gray-500">粘贴链接，自动识别平台</p>
            </div>
          </div>

          {/* 输入框 + 平台标签 */}
          <div className="mb-5">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Link2 className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="粘贴视频分享链接..."
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-orange-100 focus:border-orange-400 outline-none text-gray-800 text-base transition-all"
              />
              {/* 自动识别平台标签 */}
              {detectedPlatform && url && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 rounded-full px-3 py-1 text-sm font-medium">
                  <Zap className="w-3.5 h-3.5" />
                  {detectedPlatform}
                </div>
              )}
            </div>
          </div>

          {/* 视频预览卡 */}
          {previewInfo && (
            <div className="mb-5 p-4 bg-gray-50 rounded-2xl flex gap-4">
              {previewInfo.thumbnail && (
                <img src={previewInfo.thumbnail} alt="" className="w-28 h-20 object-cover rounded-xl flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm line-clamp-2">{previewInfo.title}</p>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                  {previewInfo.duration > 0 && (
                    <span>{Math.floor(previewInfo.duration / 60)}:{String(Math.floor(previewInfo.duration % 60)).padStart(2, '0')}</span>
                  )}
                  {previewInfo.uploader && <span>· {previewInfo.uploader}</span>}
                </div>
              </div>
            </div>
          )}

          {/* 五个下载选项 */}
          <div className="mb-5">
            <div className="text-sm font-medium text-gray-700 mb-3">选择下载内容</div>
            <div className="grid grid-cols-5 gap-2">
              {DOWNLOAD_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const active = selectedOptions.has(opt.id)
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                      active
                        ? `${opt.activeBg} border-transparent shadow-lg`
                        : `${opt.bg} ${opt.border}`
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${active ? 'text-white' : opt.color}`} />
                    <span className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-700'}`}>
                      {opt.label}
                    </span>
                    <span className={`text-[10px] leading-tight text-center ${active ? 'text-white/80' : 'text-gray-400'}`}>
                      {opt.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 下载目录选择 */}
          <div className="mb-5">
            <div className="text-sm font-medium text-gray-700 mb-3">保存位置</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSaveTarget('phone')}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                  saveTarget === 'phone'
                    ? 'bg-orange-500 border-orange-500 shadow-lg shadow-orange-200'
                    : 'bg-gray-50 border-gray-100 hover:border-orange-200'
                }`}
              >
                <Smartphone className={`w-6 h-6 ${saveTarget === 'phone' ? 'text-white' : 'text-gray-500'}`} />
                <div className="text-left">
                  <div className={`text-sm font-semibold ${saveTarget === 'phone' ? 'text-white' : 'text-gray-800'}`}>
                    手机相册
                  </div>
                  <div className={`text-xs ${saveTarget === 'phone' ? 'text-white/70' : 'text-gray-400'}`}>
                    自动保存到手机
                  </div>
                </div>
              </button>
              <button
                onClick={() => setSaveTarget('pc')}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                  saveTarget === 'pc'
                    ? 'bg-blue-500 border-blue-500 shadow-lg shadow-blue-200'
                    : 'bg-gray-50 border-gray-100 hover:border-blue-200'
                }`}
              >
                <FolderOpen className={`w-6 h-6 ${saveTarget === 'pc' ? 'text-white' : 'text-gray-500'}`} />
                <div className="text-left">
                  <div className={`text-sm font-semibold ${saveTarget === 'pc' ? 'text-white' : 'text-gray-800'}`}>
                    电脑文件夹
                  </div>
                  <div className={`text-xs ${saveTarget === 'pc' ? 'text-white/70' : 'text-gray-400'}`}>
                    选择保存路径
                  </div>
                </div>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || selectedOptions.size === 0}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r from-[#FF6B35] via-orange-500 to-pink-500 hover:shadow-xl hover:shadow-orange-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" />处理中...</>
            ) : (
              <><Download className="w-5 h-5" />开始下载</>
            )}
          </button>
        </div>

        {/* 当前任务进度 */}
        {task && (
          <div className="bg-white rounded-3xl shadow-lg shadow-orange-100/50 p-6 border border-orange-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-800">📊 任务进度</h3>
              <button
                onClick={() => setTask(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 状态卡 */}
            <div className={`p-4 rounded-2xl mb-5 ${
              task.status === 'completed' ? 'bg-green-50 border border-green-200' :
              task.status === 'error' ? 'bg-red-50 border border-red-200' :
              'bg-orange-50 border border-orange-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  task.status === 'completed' ? 'bg-green-500' :
                  task.status === 'error' ? 'bg-red-500' :
                  'bg-gradient-to-br from-[#FF6B35] to-orange-500'
                }`}>
                  {task.status === 'completed' && <CheckCircle2 className="w-6 h-6 text-white" />}
                  {task.status === 'error' && <XCircle className="w-6 h-6 text-white" />}
                  {isActive(task.status) && <Loader2 className="w-6 h-6 text-white animate-spin" />}
                  {task.status === 'pending' && <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white" />}
                </div>
                <div>
                  <p className={`font-bold text-lg ${
                    task.status === 'completed' ? 'text-green-700' :
                    task.status === 'error' ? 'text-red-700' :
                    'text-orange-700'
                  }`}>
                    {task.status === 'completed' && '下载完成！'}
                    {task.status === 'error' && '下载失败'}
                    {task.status === 'pending' && '等待中...'}
                    {task.status === 'parsing' && '解析视频中...'}
                    {task.status === 'processing' && '准备下载...'}
                    {task.status === 'downloading' && '正在下载视频...'}
                    {task.status === 'asr' && '语音识别中...'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {task.platform && `${task.platform} · `}
                    {getStatusText(task.status)}
                  </p>
                </div>
              </div>
            </div>

            {/* 进度条 */}
            {isActive(task.status) && (
              <div className="mb-5">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>下载进度</span>
                  <span className="font-medium">{task.progress}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF6B35] via-orange-500 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 视频信息 */}
            {task.title && (
              <div className="flex gap-4 mb-5 p-4 bg-gray-50 rounded-2xl">
                {task.thumbnailUrl && (
                  <img src={task.thumbnailUrl} alt={task.title} className="w-24 h-16 object-cover rounded-xl" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{task.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{task.platform}</p>
                </div>
              </div>
            )}

            {/* 完成后的下载操作区 */}
            {task.status === 'completed' && (
              <div className="space-y-3">
                {task.downloadUrl && (
                  <a
                    href={task.downloadUrl}
                    download
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-xl hover:shadow-green-200 transition-all"
                  >
                    <Download className="w-5 h-5" />
                    下载视频文件
                  </a>
                )}
                {/* 字幕下载 */}
                {task.subtitleFiles && task.subtitleFiles.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {task.subtitleFiles.map((sub) => (
                      <a
                        key={sub.filename}
                        href={sub.url}
                        download={sub.filename}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors"
                      >
                        <Languages className="w-4 h-4" />
                        {sub.filename}
                      </a>
                    ))}
                  </div>
                )}
                {/* ASR 结果 */}
                {task.asrText && (
                  <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Mic className="w-5 h-5 text-purple-600" />
                        <h4 className="font-bold text-purple-800">语音识别结果</h4>
                      </div>
                      <button
                        onClick={() => handleCopy(task.asrText!, 'asr')}
                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
                      >
                        {copiedId === 'asr' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === 'asr' ? '已复制' : '复制'}
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{task.asrText}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 错误信息 */}
            {task.status === 'error' && task.error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{task.error}</p>
              </div>
            )}
          </div>
        )}

        {/* 下载历史 - 折叠 */}
        <div className="bg-white rounded-3xl shadow-lg shadow-gray-100/50 overflow-hidden border border-gray-100">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-gray-800">下载历史</h3>
                <p className="text-sm text-gray-500">{history.length} 个任务</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!showHistory && history.length > 0 && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">最近 {Math.min(history.length, 3)} 条</span>
              )}
              {showHistory ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </button>

          {/* 折叠时显示最近3条预览 */}
          {!showHistory && history.length > 0 && (
            <div className="px-5 pb-4">
              <div className="space-y-2">
                {history.slice(0, 3).map((item) => (
                  <div key={item.taskId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    {getStatusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {item.title || '未命名视频'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.platform} · {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 展开完整历史 */}
          {showHistory && (
            <div className="border-t border-gray-100">
              {history.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无下载记录</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.taskId} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0">
                    {/* 缩略图 */}
                    <div className="flex-shrink-0">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" className="w-16 h-11 object-cover rounded-lg" />
                      ) : (
                        <div className="w-16 h-11 rounded-lg bg-gray-100 flex items-center justify-center">
                          {getStatusIcon(item.status)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {item.title || '未命名视频'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.platform} · {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.taskId)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 使用说明 */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl p-6 border border-indigo-100">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            使用说明
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-600 font-bold text-sm">1</span>
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">粘贴链接</p>
                <p className="text-xs text-gray-500">自动识别抖音、YouTube 等平台</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-600 font-bold text-sm">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">选择内容</p>
                <p className="text-xs text-gray-500">视频/文案/封面/字幕/语音</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-600 font-bold text-sm">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">选择位置</p>
                <p className="text-xs text-gray-500">手机相册或电脑文件夹</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-600 font-bold text-sm">4</span>
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">开始下载</p>
                <p className="text-xs text-gray-500">等待完成即可获取文件</p>
              </div>
            </div>
          </div>
          <div className="mt-5 p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
            <p className="text-yellow-700 text-sm flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              请尊重版权，仅供个人学习使用，严禁商用或传播
            </p>
          </div>
        </div>
      </main>

      <footer className="text-center py-8 text-gray-400 text-sm">
        <p>小电驴 v2.0.0 · Powered by yt-dlp & Whisper</p>
      </footer>
    </div>
  )
}

export default App
