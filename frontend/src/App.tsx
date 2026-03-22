import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { 
  Download, 
  Link2, 
  Mic, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Play,
  FileText,
  Music,
  Video,
  Trash2,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Zap,
  Youtube,
  Twitter,
  Music2,
  Image as ImageIcon,
  Type,
  Languages,
  Clock,
  AlertCircle,
  ArrowRight,
  Copy,
  Check
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

// 平台配置
const PLATFORMS = [
  { 
    id: 'auto', 
    label: '自动识别', 
    icon: Zap, 
    gradient: 'from-gray-500 to-gray-600',
    bgColor: 'bg-gray-500',
    description: '智能识别平台'
  },
  { 
    id: 'douyin', 
    label: '抖音', 
    icon: Music2, 
    gradient: 'from-pink-500 to-rose-600',
    bgColor: 'bg-pink-500',
    description: '抖音/TikTok中国版'
  },
  { 
    id: 'tiktok', 
    label: 'TikTok', 
    icon: Music2, 
    gradient: 'from-cyan-500 to-blue-600',
    bgColor: 'bg-cyan-500',
    description: '国际版抖音'
  },
  { 
    id: 'x', 
    label: 'X', 
    icon: Twitter, 
    gradient: 'from-gray-700 to-black',
    bgColor: 'bg-gray-700',
    description: '原Twitter'
  },
  { 
    id: 'youtube', 
    label: 'YouTube', 
    icon: Youtube, 
    gradient: 'from-red-500 to-red-700',
    bgColor: 'bg-red-500',
    description: '全球最大视频平台'
  },
  { 
    id: 'bilibili', 
    label: 'B站', 
    icon: Play, 
    gradient: 'from-pink-400 to-pink-600',
    bgColor: 'bg-pink-400',
    description: '哔哩哔哩'
  },
]

// 下载选项
const DOWNLOAD_OPTIONS = [
  { id: 'video', label: '视频文件', icon: Video, desc: 'MP4格式', color: 'blue' },
  { id: 'audio', label: '音频文件', icon: Music, desc: 'MP3格式', color: 'purple' },
  { id: 'cover', label: '封面图片', icon: ImageIcon, desc: 'JPG格式', color: 'green' },
  { id: 'subtitle', label: '字幕文件', icon: Languages, desc: 'SRT格式', color: 'orange' },
]

function App() {
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState('auto')
  const [needAsr, setNeedAsr] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState(['video'])
  const [task, setTask] = useState<Task | null>(null)
  const [history, setHistory] = useState<HistoryTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState(false)

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
    setError('请求发送中，如首次访问请等待几秒...')
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
        setError('服务器响应超时，请稍后再试（免费服务可能需要冷启动）')
      } else {
        setError(e.response?.data?.message || '创建任务失败，请检查链接是否正确')
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '等待中',
      processing: '处理中',
      downloading: '下载中',
      asr: '语音识别中',
      completed: '已完成',
      error: '失败',
    }
    return map[status] || status
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
          <p className="text-white/80 text-lg">多平台视频下载 + AI 语音转文字</p>
        </div>
        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full">
            <path fill="url(#gradient)" d="M0,20 C360,60 720,0 1080,20 C1260,30 1380,10 1440,20 L1440,60 L0,60 Z" />
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="1440" y2="0">
                <stop offset="0%" stopColor="#FFF7ED" />
                <stop offset="100%" stopColor="#F9FAFB" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* 输入卡片 */}
        <div className="bg-white rounded-3xl shadow-lg shadow-orange-100/50 p-6 border border-orange-100">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">下载视频</h2>
              <p className="text-sm text-gray-500">支持抖音、YouTube、X 等平台</p>
            </div>
          </div>

          {/* 输入框 */}
          <div className="relative mb-4">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Link2 className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="粘贴视频分享链接..."
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-orange-100 focus:border-orange-400 outline-none text-gray-800 text-base transition-all"
            />
          </div>

          {/* 平台选择 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-gray-700">选择平台</span>
              <span className="text-xs text-gray-400">自动识别推荐</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const Icon = p.icon
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      platform === p.id
                        ? `bg-gradient-to-r ${p.gradient} text-white shadow-md shadow-${p.color.split('-')[1]}-200`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ASR 开关 */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-purple-50 transition-colors">
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${needAsr ? 'bg-purple-500' : 'bg-gray-200'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${needAsr ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
            <input
              type="checkbox"
              checked={needAsr}
              onChange={(e) => setNeedAsr(e.target.checked)}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <Mic className={`w-5 h-5 ${needAsr ? 'text-purple-500' : 'text-gray-400'}`} />
              <div>
                <span className={`font-medium ${needAsr ? 'text-purple-700' : 'text-gray-600'}`}>
                  语音转文字
                </span>
                <span className="text-xs text-gray-400 block">AI 自动提取视频中的语音内容</span>
              </div>
            </div>
          </label>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-5 w-full py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r from-[#FF6B35] via-orange-500 to-pink-500 hover:shadow-xl hover:shadow-orange-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                开始下载
              </>
            )}
          </button>
        </div>

        {/* 当前任务 */}
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

            {/* 状态卡片 */}
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
                    {task.status === 'completed' && '下载完成！'}
                    {task.status === 'error' && '下载失败'}
                    {task.status === 'pending' && '等待中...'}
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
            {(task.status === 'processing' || task.status === 'downloading' || task.status === 'asr') && (
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
                {task.thumbnail && (
                  <img 
                    src={task.thumbnail} 
                    alt={task.title}
                    className="w-24 h-16 object-cover rounded-xl"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{task.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{task.platform}</p>
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
                下载视频文件
              </a>
            )}

            {/* ASR 结果 */}
            {task.asrText && (
              <div className="mt-5 p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
                <div className="flex items-center gap-2 mb-3">
                  <Mic className="w-5 h-5 text-purple-600" />
                  <h4 className="font-bold text-purple-800">语音识别结果</h4>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{task.asrText}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(task.asrText!)}
                  className="mt-3 text-xs text-purple-600 hover:text-purple-800 font-medium"
                >
                  复制文字
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
          <div className="bg-white rounded-3xl shadow-lg shadow-gray-100/50 overflow-hidden border border-gray-100">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">下载历史</h3>
                  <p className="text-sm text-gray-500">{history.length} 个任务</p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
            
            {showHistory && (
              <div className="border-t border-gray-100">
                {history.map((item) => (
                  <div key={item.taskId} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0">
                    <div className="flex-shrink-0">
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{item.title || '未命名视频'}</p>
                      <p className="text-sm text-gray-500">
                        {item.platform} · {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.taskId)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                <p className="text-xs text-gray-500">从抖音、YouTube 等平台复制分享链接</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-600 font-bold text-sm">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">选择平台</p>
                <p className="text-xs text-gray-500">系统会自动识别，也可手动选择</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-600 font-bold text-sm">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">开启 ASR</p>
                <p className="text-xs text-gray-500">需要提取语音文字时勾选此选项</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-600 font-bold text-sm">4</span>
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">开始下载</p>
                <p className="text-xs text-gray-500">等待完成即可下载视频文件</p>
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

      {/* Footer */}
      <footer className="text-center py-8 text-gray-400 text-sm">
        <p>小电驴 v1.2.0 · Powered by yt-dlp & Whisper</p>
      </footer>
    </div>
  )
}

export default App
