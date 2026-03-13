'use client'

import { Star, Clock, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WordBookItemDTO } from '@/server/services/wordbook.service'

interface CharListItemProps {
  item: WordBookItemDTO
  /** 点击汉字跳转学习页 */
  onLearn?: (character: string) => void
}

/** 将 mastery_level (0-5) 映射为文字标签和颜色 */
function getMasteryInfo(level: number) {
  if (level >= 5) return { label: '已掌握', color: 'text-green-600 bg-green-50 border-green-200' }
  if (level >= 3) return { label: '学习中', color: 'text-blue-600 bg-blue-50 border-blue-200' }
  if (level >= 1) return { label: '初学', color: 'text-orange-600 bg-orange-50 border-orange-200' }
  return { label: '未学', color: 'text-muted-foreground bg-muted/50 border-border' }
}

/** 格式化下次复习时间 */
function formatNextReview(nextReview: string | null): string {
  if (!nextReview) return '待复习'
  const date = new Date(nextReview)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return '今天复习'
  if (diffDays === 1) return '明天复习'
  if (diffDays <= 7) return `${diffDays}天后复习`
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) + '复习'
}

export function CharListItem({ item, onLearn }: CharListItemProps) {
  const mastery = getMasteryInfo(item.mastery_level)

  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-card',
        'hover:border-primary/30 hover:bg-accent/30 transition-all duration-150',
        'group'
      )}
    >
      {/* 汉字 */}
      <div
        className={cn(
          'w-12 h-12 flex items-center justify-center rounded-lg flex-shrink-0',
          'text-2xl font-bold bg-muted/50 border border-border',
          'group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors cursor-pointer'
        )}
        onClick={() => onLearn?.(item.character)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onLearn?.(item.character)}
        aria-label={`学习汉字"${item.character}"`}
      >
        {item.character}
      </div>

      {/* 信息区 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 掌握状态 */}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
              mastery.color
            )}
          >
            <Star className="w-3 h-3" />
            {mastery.label}
          </span>

          {/* 掌握等级进度点 */}
          <div className="flex gap-0.5" aria-label={`掌握等级 ${item.mastery_level}/5`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full',
                  i < item.mastery_level ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>
        </div>

        {/* 下次复习时间 */}
        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Clock className="w-3 h-3 flex-shrink-0" />
          {formatNextReview(item.next_review_at)}
        </p>
      </div>

      {/* 跳转学习页 */}
      <button
        className={cn(
          'flex-shrink-0 p-1.5 rounded-md text-muted-foreground',
          'hover:text-primary hover:bg-primary/10 transition-colors',
          'opacity-0 group-hover:opacity-100'
        )}
        onClick={() => onLearn?.(item.character)}
        aria-label={`查看"${item.character}"详情`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
