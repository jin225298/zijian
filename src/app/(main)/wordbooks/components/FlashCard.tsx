'use client'

import { useState } from 'react'
import { RotateCcw, CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ReviewItemDTO } from '@/server/services/wordbook.service'

export type StudyResult = 'correct' | 'hint_used' | 'wrong'

interface FlashCardProps {
  item: ReviewItemDTO
  /** 当前题号（从1开始） */
  current: number
  /** 总题数 */
  total: number
  /** 提交学习结果 */
  onSubmit: (itemId: string, result: StudyResult) => Promise<void>
  /** 是否提交中 */
  isSubmitting?: boolean
}

/** 掌握等级颜色 */
function getMasteryColor(level: number) {
  if (level >= 4) return '#22c55e'
  if (level >= 2) return '#3b82f6'
  return '#f97316'
}

export function FlashCard({ item, current, total, onSubmit, isSubmitting }: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)

  // 当切换到新卡片时重置翻转状态
  // （通过 key 强制重新渲染来实现，由父组件控制）

  const handleFlip = () => {
    if (!isFlipped) setIsFlipped(true)
  }

  const handleSubmit = async (result: StudyResult) => {
    if (isSubmitting) return
    await onSubmit(item.id, result)
    setIsFlipped(false) // 提交后重置（新卡片由父组件更新 item）
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto">
      {/* 进度提示 */}
      <p className="text-sm text-muted-foreground">
        第 <span className="font-semibold text-foreground">{current}</span> / {total} 张
      </p>

      {/* 闪卡容器（CSS 3D Flip） */}
      <div
        className="w-full cursor-pointer select-none"
        style={{ perspective: '1000px' }}
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleFlip()}
        aria-label={isFlipped ? '汉字卡片背面（已翻转）' : '点击翻转查看汉字详情'}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            height: '280px',
          }}
        >
          {/* 正面 */}
          <div
            className={cn(
              'absolute inset-0 rounded-2xl border-2 border-border bg-card shadow-lg',
              'flex flex-col items-center justify-center gap-4',
              'backface-hidden'
            )}
            style={{ backfaceVisibility: 'hidden' }}
            aria-hidden={isFlipped}
          >
            {/* 汉字 */}
            <span
              className="text-[7rem] font-bold leading-none select-none"
              style={{ color: getMasteryColor(item.mastery_level) }}
            >
              {item.character}
            </span>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              点击翻转查看详情
            </p>
          </div>

          {/* 背面 */}
          <div
            className={cn(
              'absolute inset-0 rounded-2xl border-2 border-primary/30 bg-card shadow-lg',
              'flex flex-col items-center justify-center gap-3 px-6'
            )}
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
            aria-hidden={!isFlipped}
          >
            {/* 汉字（小号显示在背面顶部） */}
            <span className="text-4xl font-bold text-foreground">{item.character}</span>

            {/* 掌握等级 */}
            <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
              <span>掌握等级</span>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-3 h-3 rounded-full',
                      i < item.mastery_level ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* 提示文字 */}
            <p className="text-xs text-muted-foreground text-center mt-2">
              前往学习页了解更多信息
            </p>

            <a
              href={`/learn?char=${encodeURIComponent(item.character)}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline mt-1"
            >
              查看详情 →
            </a>
          </div>
        </div>
      </div>

      {/* 评分按钮（翻转后显示） */}
      {isFlipped && (
        <div className="flex gap-3 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* 不认识 */}
          <Button
            variant="outline"
            className="flex-1 flex flex-col gap-1 h-auto py-3 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => handleSubmit('wrong')}
            disabled={isSubmitting}
            aria-label="不认识此字"
          >
            <XCircle className="w-5 h-5 mx-auto" />
            <span className="text-xs">不认识</span>
          </Button>

          {/* 提示过 */}
          <Button
            variant="outline"
            className="flex-1 flex flex-col gap-1 h-auto py-3 border-orange-400/40 text-orange-500 hover:bg-orange-50"
            onClick={() => handleSubmit('hint_used')}
            disabled={isSubmitting}
            aria-label="需要提示"
          >
            <HelpCircle className="w-5 h-5 mx-auto" />
            <span className="text-xs">需提示</span>
          </Button>

          {/* 认识 */}
          <Button
            variant="outline"
            className="flex-1 flex flex-col gap-1 h-auto py-3 border-green-400/40 text-green-600 hover:bg-green-50"
            onClick={() => handleSubmit('correct')}
            disabled={isSubmitting}
            aria-label="认识此字"
          >
            <CheckCircle2 className="w-5 h-5 mx-auto" />
            <span className="text-xs">认识</span>
          </Button>
        </div>
      )}

      {/* 未翻转时的占位提示 */}
      {!isFlipped && (
        <p className="text-xs text-muted-foreground">翻转后选择掌握程度</p>
      )}
    </div>
  )
}
