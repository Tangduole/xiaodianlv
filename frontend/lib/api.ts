import axios from 'axios'

const API_BASE = '/api'

export type Platform = 'douyin' | 'tiktok' | 'x' | 'youtube' | 'bilibili' | 'kuaishou' | 'auto'

export interface SubtitleFile {
  filename: string
  path: string
  url: string
}

export interface Task {
  taskId: string
  url: string
  platform: Platform
  needAsr: boolean
  status: 'pending' | 'parsing' | 'downloading' | 'asr' | 'completed' | 'error'
  progress: number
  title?: string
  duration?: number
  speed?: string
  eta?: string
  thumbnailUrl?: string
  downloadUrl?: string
  subtitleFiles?: SubtitleFile[]
  asrText?: string
  asrError?: string
  error?: string
  createdAt: number
}

export interface CreateDownloadRequest {
  url: string
  platform?: Platform
  needAsr?: boolean
}

export interface VideoInfo {
  title: string
  duration: number
  thumbnail: string
  uploader: string
  uploadDate: string
  viewCount: number
  formats: Array<{
    formatId: string
    ext: string
    resolution: string
    filesize: number
    format: string
  }>
}

const platformLabels: Record<Platform, string> = {
  douyin: '抖音',
  tiktok: 'TikTok',
  x: 'X (Twitter)',
  youtube: 'YouTube',
  bilibili: 'B站',
  kuaishou: '快手',
  auto: '自动识别',
}

export async function createDownload(data: CreateDownloadRequest): Promise<{ taskId: string; status: string; platform: string }> {
  const response = await axios.post(`${API_BASE}/download`, data)
  return response.data.data
}

export async function getTaskStatus(taskId: string): Promise<Task> {
  const response = await axios.get(`${API_BASE}/status/${taskId}`)
  return response.data.data
}

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  const response = await axios.get(`${API_BASE}/info`, { params: { url } })
  return response.data.data
}

export async function getHistory(limit = 50, offset = 0): Promise<{ tasks: Task[]; total: number }> {
  const response = await axios.get(`${API_BASE}/history`, { params: { limit, offset } })
  return response.data.data
}

export async function deleteTask(taskId: string): Promise<void> {
  await axios.delete(`${API_BASE}/tasks/${taskId}`)
}

export async function getSystemStatus() {
  const response = await axios.get(`${API_BASE}/system/status`)
  return response.data.data
}

export async function healthCheck() {
  const response = await axios.get(`${API_BASE}/health`)
  return response.data.data
}

export function formatDuration(seconds: number): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export { platformLabels }
export default { platformLabels }
