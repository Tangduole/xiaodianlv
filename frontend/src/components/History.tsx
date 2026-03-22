import React from 'react'
import { Task } from '../types'
import ASRDisplay from './ASRDisplay'

interface HistoryProps {
  tasks: Task[]
  onClear?: () => void
}

export default function History({ tasks, onClear }: HistoryProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text">📋 历史记录</h2>
        {onClear && (
          <button
            onClick={onClear}
            className="text-sm text-gray-600 hover:text-gray-700"
          >
            清空
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          暂无下载记录
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task, index) => (
            <div
              key={task.taskId}
              className="bg-white/90 rounded-xl shadow-sm p-4 border-l-2 border-gray-100"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm text-gray-500">
                  {new Date(task.createdAt).toLocaleString('zh-CN')}
                </span>
                {task.status === 'error' && (
                  <button
                    onClick={() => onClear && onClear()}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="mb-3">
                {task.platform && (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                      {task.platform}
                    </span>
                  </span>
                )}
                <span className="text-sm font-medium text-gray-900">
                  {task.title || '未命名'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {task.status === 'completed' && (
                  <span className="text-green-600">✅</span>
                )}
                {task.status === 'error' && (
                  <span className="text-red-600">❌</span>
                )}
                <span className="text-sm text-gray-600">
                  {task.status === 'completed' && '已完成'}
                  {task.status === 'error' && '失败'}
                  {task.status === 'processing' && '处理中'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
