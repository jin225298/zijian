'use client'

import { BookOpen, Star, Flame, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WordBookStatsDTO } from '@/server/services/wordbook.service'

interface ProgressStatsProps {
  stats: WordBookStatsDTO
  className?: string
}

/** 将日期字符串格式化为周几（短名） */
function formatWeekday(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return days[date.getDay()]
}

export function ProgressStats({ stats, className }: ProgressStatsProps) {
  const maxCount = Math.max(...stats.weekly_progress.map((w) => w.count), 1)

  return (
    <div className={cn('grid gap-4', className)}>
      {/* 统计数字卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 总字数 */}
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <BookOpen className="w-3.5 h-3.5" />
            总字数
          </div>
          <span className="text-2xl font-bold text-foreground">{stats.total_characters}</span>
        </div>

        {/* 已掌握 */}
        <div className="flex flex-col gap-1 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-1.5 text-green-600 text-xs">
            <Star className="w-3.5 h-3.5" />
            已掌握
          </div>
          <span className="text-2xl font-bold text-green-700">{stats.mastered_count}</span>
        </div>

        {/* 学习中 */}
        <div className="flex flex-col gap-1 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-1.5 text-blue-600 text-xs">
            <TrendingUp className="w-3.5 h-3.5" />
            学习中
          </div>
          <span className="text-2xl font-bold text-blue-700">{stats.learning_count}</span>
        </div>

        {/* 连续天数 */}
        <div className="flex flex-col gap-1 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-1.5 text-orange-600 text-xs">
            <Flame className="w-3.5 h-3.5" />
            连续学习
          </div>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold text-orange-700">{stats.streak_days}</span>
            <span className="text-sm text-orange-600 mb-0.5">天</span>
          </div>
        </div>
      </div>

      {/* 周进度图表 */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">近7天学习</h3>
        <div className="flex items-end gap-1.5 h-20">
          {stats.weekly_progress.map((item) => {
            const heightPct = maxCount > 0 ? (item.count / maxCount) * 100 : 0
            const isToday = item.date === new Date().toISOString().slice(0, 10)

            return (
              <div
                key={item.date}
                className="flex-1 flex flex-col items-center gap-1"
                title={`${item.date}：${item.count} 次`}
              >
                <span className="text-xs text-muted-foreground">{item.count > 0 ? item.count : ''}</span>
                <div className="w-full flex items-end h-12 relative">
                  <div
                    className={cn(
                      'w-full rounded-t transition-all duration-500',
                      isToday ? 'bg-primary' : 'bg-primary/30',
                      item.count === 0 && 'bg-muted min-h-[4px]'
                    )}
                    style={{ height: item.count === 0 ? '4px' : `${Math.max(8, heightPct * 0.48)}rem` }}
                    aria-label={`${item.date} 学习 ${item.count} 次`}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs',
                    isToday ? 'text-primary font-semibold' : 'text-muted-foreground'
                  )}
                >
                  {formatWeekday(item.date)}
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          今日已学 <span className="text-foreground font-medium">{stats.today_learned}</span> 次
        </p>
      </div>
    </div>
  )
}
