import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { 
  Download, 
  Link2, 
  Mic, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Video,
  Music,
  Image as ImageIcon,
  FileText,
  Languages,
  ExternalLink,
  ChevronDown,
  Trash2,
  Scooter,
  AlertCircle
} from 'lucide-react'

const API = '/api'

interface Task {
  taskId: string
  status: 'pending' | 'processing' | 'downloading' | 'asr' | 'completed' | 'error'
  progress: number
  title?: string
  platform?: string
  thumbnail?: string
  downloadUrl?: string
  asrText?: string
  error?: string
  createdAt: string
}

interface HistoryTask {
  taskId: string
  status: string
  title?: string
  platform?: string
  thumbnail?: string
  createdAt: string
}

// 平台列表
const PLATFORMS = [
  { id: 'auto', label: 'Auto-detect', icon: '🎯' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'x', label: 'X / Twitter', icon: '🐦' },
  { id: 'douyin', label: '抖音', icon: '📱' },
  { id: 'bilibili', label: 'Bilibili', icon: '📺' },
]

// 下载选项
const DOWNLOAD_OPTIONS = [
  { id: 'video', label: 'Download Video', format: 'MP4', icon: Video, description: 'Best quality available' },
  { id: 'audio', label: 'Audio Only', format: 'MP3', icon: Music, description: 'Original sound only' },
  { id: 'thumbnail', label: 'Video Thumbnail', format: 'JPG', icon: ImageIcon, description: 'High resolution cover' },
  { id: 'transcription', label: 'Transcription TXT', format: 'TXT', icon: FileText, description: 'Speech to text' },
  { id: 'subtitles', label: 'Subtitles', format: 'SRT/VTT', icon: Languages, description: 'Closed captions if available' },
]

function App() {
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState('auto')
  const [selectedOptions, setSelectedOptions] = useState(['video'])
  const [task, setTask] = useState<Task | null>(null)
  const [history, setHistory] = useState<HistoryTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)

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

  // 获取历史记录
  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/history`)
      setHistory(res.data.data || [])
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
    setLoading(true)
    setError('请求发送中，请稍等...')
    try {
      const res = await axios.post(`${API}/download`, { 
        url: url.trim(), 
        platform: platform === 'auto' ? undefined : platform, 
        needAsr: selectedOptions.has('asr'),
      }, { timeout: 120000 })
      setTask(res.data.data)
      setUrl('')
    } catch (e: any) {
      if (e.code === 'ECONNABORTED') {
        setError('服务器响应超时，请稍后再试')
      } else {
        setError(e.response?.data?.message || '创建任务失败，请检查链接')
      }
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

  const toggleOption = (optionId: string) => {
    setSelectedOptions(prev => 
      prev.includes(optionId) 
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'processing':
      case 'downloading':
      case 'asr':
        return <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
      default:
        return <div className="w-5 h-5 rounded-full bg-gray-200" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-orange-500/20 to-pink-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto px-6 py-12 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 border border-white/10">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span className="text-white/90 text-sm font-medium">AI-Powered Video Downloader</span>
          </div>
          
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-orange-500/30">
              <Scooter className="w-9 h-9 text-white" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
            Little Electric Donkey
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Professional video downloader supporting YouTube, TikTok, X/Twitter, and more.
            <br />
            <span className="text-orange-400">With AI-powered speech-to-text transcription.</span>
          </p>
        </div>
        
        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" className="w-full">
            <path fill="url(#wave-gradient)" d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,20 1440,40 L1440,80 L0,80 Z" />
            <defs>
              <linearGradient id="wave-gradient" x1="0" y1="0" x2="1440" y2="0">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="50%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#f8fafc" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* URL Input Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 border border-slate-100">
          {/* Platform Selection */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Select Platform
            </label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const Icon = p.icon
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      platform === p.id
                        ? `bg-gradient-to-r ${p.gradient} text-white shadow-lg shadow-${p.color.split('-')[1]}-200`
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title={p.description}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{p.label}</span>
                    <span className="sm:hidden">{p.icon}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* URL Input */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Video URL
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Link2 className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste video link from YouTube, TikTok, X..."
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-100 focus:border-orange-400 outline-none text-slate-800 text-base transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Download Options */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Download Options
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DOWNLOAD_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const isSelected = selectedOptions.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? `border-${opt.color}-500 bg-${opt.color}-50`
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isSelected ? `bg-${opt.color}-500` : 'bg-slate-100'
                    }`}>
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${isSelected ? `text-${opt.color}-700` : 'text-slate-700'}`}>
                          {opt.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isSelected ? `bg-${opt.color}-200 text-${opt.color}-700` : 'bg-slate-100 text-slate-500'}`}>
                          {opt.format}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 ${isSelected ? `text-${opt.color}-600` : 'text-slate-400'}`}>
                        {opt.description}
                      </p>
                    </div>
                    {isSelected && (
                      <div className={`w-6 h-6 rounded-full bg-${opt.color}-500 flex items-center justify-center flex-shrink-0`}>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || selectedOptions.length === 0}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r from-orange-500 via-orange-400 to-pink-500 hover:shadow-xl hover:shadow-orange-200/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Start Download
              </>
            )}
          </button>

          {selectedOptions.length === 0 && (
            <p className="mt-3 text-center text-sm text-orange-500">
              Please select at least one download option
            </p>
          )}
        </div>

        {/* 任务状态 */}
        {task && (
          <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">Download Progress</h3>
              <button 
                onClick={() => setTask(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <XCircle className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className={`p-4 rounded-2xl mb-5 ${
              task.status === 'completed' ? 'bg-green-50 border border-green-200' :
              task.status === 'error' ? 'bg-red-50 border border-red-200' :
              'bg-orange-50 border border-orange-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  task.status === 'completed' ? 'bg-green-500' :
                  task.status === 'error' ? 'bg-red-500' :
                  'bg-gradient-to-br from-orange-500 to-pink-500'
                }`}>
                  {task.status === 'completed' && <CheckCircle2 className="w-6 h-6 text-white" />}
                  {task.status === 'error' && <XCircle className="w-6 h-6 text-white" />}
                  {(task.status === 'processing' || task.status === 'downloading' || task.status === 'asr') && (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  )}
                  {task.status === 'pending' && <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white" />}
                </div>
                <div>
                  <p className={`font-bold text-lg ${
                    task.status === 'completed' ? 'text-green-700' :
                    task.status === 'error' ? 'text-red-700' :
                    'text-orange-700'
                  }`}>
                    {task.status === 'completed' && 'Download Complete!'}
                    {task.status === 'error' && 'Download Failed'}
                    {task.status === 'pending' && 'Waiting...'}
                    {task.status === 'processing' && 'Processing...'}
                    {task.status === 'downloading' && 'Downloading Video...'}
                    {task.status === 'asr' && 'Transcribing Audio...'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {task.platform && `${task.platform} · `}
                    {task.status === 'completed' ? 'Ready to download' : 
                     task.status === 'error' ? 'Please try again' : 
                     'Please wait...'}
                  </p>
                </div>
              </div>
            </div>

            {/* 进度条 */}
            {(task.status === 'processing' || task.status === 'downloading' || task.status === 'asr') && (
              <div className="mb-5">
                <div className="flex justify-between text-sm text-slate-600 mb-2">
                  <span>Download Progress</span>
                  <span className="font-medium">{task.progress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 via-orange-400 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 视频信息 */}
            {task.title && (
              <div className="flex gap-4 mb-5 p-4 bg-slate-50 rounded-2xl">
                {task.thumbnail && (
                  <img 
                    src={task.thumbnail} 
                    alt={task.title}
                    className="w-28 h-20 object-cover rounded-xl"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 line-clamp-2">{task.title}</p>
                  <p className="text-sm text-slate-500 mt-1">{task.platform}</p>
                </div>
              </div>
            )}

            {/* 下载按钮 */}
            {task.status === 'completed' && task.downloadUrl && (
              <a
                href={task.downloadUrl}
                download
                className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-xl hover:shadow-green-200 transition-all"
              >
                <Download className="w-5 h-5" />
                Download Video
              </a>
            )}

            {/* ASR 结果 */}
            {task.asrText && (
              <div className="mt-5 p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
                <div className="flex items-center gap-2 mb-3">
                  <Mic className="w-5 h-5 text-purple-600" />
                  <h4 className="font-bold text-purple-800">Transcription Result</h4>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{task.asrText}</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(task.asrText!)}
                  className="mt-3 text-xs text-purple-600 hover:text-purple-800 font-medium"
                >
                  Copy Text
                </button>
              </div>
            )}

            {/* 错误信息 */}
            {task.status === 'error' && task.error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{task.error}</p>
              </div>
            )}
          </div>
        )}

        {/* 历史记录 */}
        {history.length > 0 && (
          <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 overflow-hidden border border-slate-100">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Download History</h3>
                  <p className="text-sm text-slate-500">{history.length} tasks</p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
            
            {showHistory && (
              <div className="border-t border-slate-100">
                {history.map((item) => (
                  <div key={item.taskId} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0">
                    <div className="flex-shrink-0">
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{item.title || 'Untitled Video'}</p>
                      <p className="text-sm text-slate-500">
                        {item.platform} · {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.taskId)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-slate-400 text-sm">
        <p>Little Electric Donkey v1.2.0 · Powered by yt-dlp & Whisper</p>
        <p className="mt-1 text-xs">Please respect copyright laws. For personal use only.</p>
      </footer>
    </div>
  )
}

export default App
