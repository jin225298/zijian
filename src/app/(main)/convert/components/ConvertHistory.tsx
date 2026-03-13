'use client'

import { Clock, Trash2, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConvertContext } from './ConvertInput'

// ==========================================
// 类型定义
// ==========================================

export interface HistoryItem {
  id: string
  inputText: string
  outputText: string
  context: ConvertContext
  confidence: number
  createdAt: string
}

interface ConvertHistoryProps {
  items: HistoryItem[]
  onReuse: (item: HistoryItem) => void
  onClear: () => void
}

// ==========================================
// 场景标签映射
// ==========================================

const CONTEXT_LABELS: Record<ConvertContext, string> = {
  daily: '日常',
  academic: '学术',
  formal: '公文',
}

// ==========================================
// 格式化时间
// ==========================================

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60_000)
    const diffHour = Math.floor(diffMs / 3_600_000)
    const diffDay = Math.floor(diffMs / 86_400_000)

    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin} 分钟前`
    if (diffHour < 24) return `${diffHour} 小时前`
    if (diffDay < 7) return `${diffDay} 天前`

    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

// ==========================================
// ConvertHistory 主组件
// ==========================================

export function ConvertHistory({ items, onReuse, onClear }: ConvertHistoryProps) {
  if (items.length === 0) {
    return (
      <div
        className="text-center py-10 text-muted-foreground text-sm"
        role="status"
        aria-label="暂无历史记录"
      >
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" aria-hidden="true" />
        <p>暂无转换记录</p>
        <p className="text-xs mt-1 opacity-70">完成转换后将在此显示</p>
      </div>
    )
  }

  return (
    <div className="space-y-3" role="region" aria-label="转换历史记录">
      {/* 标题栏 & 清除按钮 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          最近 {items.length} 条记录
        </p>
        <button
          type="button"
          onClick={onClear}
          aria-label="清除所有历史记录"
          className={cn(
            'inline-flex items-center gap-1 text-xs text-muted-foreground',
            'hover:text-destructive transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring rounded'
          )}
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          清除记录
        </button>
      </div>

      {/* 历史列表 */}
      <ul
        className="space-y-2"
        aria-label="历史转换列表"
      >
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onReuse(item)}
              aria-label={`复用记录：${item.inputText.slice(0, 20)}${item.inputText.length > 20 ? '…' : ''}`}
              className={cn(
                'w-full text-left p-3 rounded-lg border bg-background',
                'hover:border-primary/50 hover:bg-accent/30 transition-all',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                'group'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                {/* 文本内容 */}
                <div className="flex-1 min-w-0 space-y-1">
                  {/* 原文 */}
                  <p
                    className="text-sm font-medium text-foreground truncate"
                    title={item.inputText}
                  >
                    {item.inputText}
                  </p>
                  {/* 转换结果预览 */}
                  <p
                    className="text-xs text-muted-foreground truncate"
                    title={item.outputText}
                  >
                    → {item.outputText}
                  </p>
                </div>

                {/* 右侧操作区 */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <ArrowUpRight
                    className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* 底部元信息 */}
              <div className="flex items-center gap-2 mt-2">
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded border font-medium',
                  'bg-secondary text-secondary-foreground border-border'
                )}>
                  {CONTEXT_LABELS[item.context]}
                </span>
                <span
                  className="text-xs text-muted-foreground"
                  aria-label={`转换时间：${formatTime(item.createdAt)}`}
                >
                  <Clock className="w-3 h-3 inline mr-0.5" aria-hidden="true" />
                  {formatTime(item.createdAt)}
                </span>
                <span
                  className={cn(
                    'text-xs ml-auto',
                    item.confidence >= 0.85
                      ? 'text-green-600'
                      : item.confidence >= 0.6
                      ? 'text-yellow-600'
                      : 'text-red-500'
                  )}
                  aria-label={`置信度 ${Math.round(item.confidence * 100)}%`}
                >
                  {Math.round(item.confidence * 100)}%
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
