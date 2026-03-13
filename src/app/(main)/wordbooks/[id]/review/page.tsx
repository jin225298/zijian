'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Trophy, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FlashCard } from '../../components/FlashCard'
import { LoadingSpinner } from '@/components/shared'
import { cn } from '@/lib/utils'
import type { ReviewItemDTO } from '@/server/services/wordbook.service'
import type { StudyResult } from '../../components/FlashCard'

// ================================
// 复习完成统计界面
// ================================

interface ReviewCompleteProps {
  total: number
  correctCount: number
  hintCount: number
  wrongCount: number
  onRestart: () => void
  onBack: () => void
}

function ReviewComplete({
  total,
  correctCount,
  hintCount,
  wrongCount,
  onRestart,
  onBack,
}: ReviewCompleteProps) {
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0

  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center max-w-sm mx-auto">
      {/* 完成图标 */}
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
        <Trophy className="w-10 h-10 text-green-600" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-bold">复习完成！</h2>
        <p className="text-muted-foreground text-sm">
          今日共复习 <span className="font-semibold text-foreground">{total}</span> 个汉字
        </p>
      </div>

      {/* 准确率环 */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-5xl font-bold text-primary">{accuracy}%</span>
        <span className="text-sm text-muted-foreground">准确率</span>
      </div>

      {/* 详细统计 */}
      <div className="grid grid-cols-3 gap-3 w-full">
        <div className="flex flex-col gap-1 items-center rounded-xl border border-green-200 bg-green-50 px-3 py-3">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-xl font-bold text-green-700">{correctCount}</span>
          <span className="text-xs text-green-600">认识</span>
        </div>
        <div className="flex flex-col gap-1 items-center rounded-xl border border-orange-200 bg-orange-50 px-3 py-3">
          <span className="text-xl">💡</span>
          <span className="text-xl font-bold text-orange-600">{hintCount}</span>
          <span className="text-xs text-orange-500">需提示</span>
        </div>
        <div className="flex flex-col gap-1 items-center rounded-xl border border-red-200 bg-red-50 px-3 py-3">
          <span className="text-xl">❌</span>
          <span className="text-xl font-bold text-red-600">{wrongCount}</span>
          <span className="text-xs text-red-500">不认识</span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 w-full">
        <Button variant="outline" className="flex-1 flex items-center gap-2" onClick={onRestart}>
          <RotateCcw className="w-4 h-4" />
          再来一遍
        </Button>
        <Button className="flex-1" onClick={onBack}>
          返回字书
        </Button>
      </div>
    </div>
  )
}

// ================================
// 主复习页面
// ================================

export default function ReviewPage() {
  const params = useParams()
  const router = useRouter()
  const bookId = params.id as string

  // 待复习汉字队列
  const [reviewItems, setReviewItems] = useState<ReviewItemDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 当前进度
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 本次复习统计
  const [correctCount, setCorrectCount] = useState(0)
  const [hintCount, setHintCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  // 加载待复习汉字
  const loadReview = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    setIsComplete(false)
    setCurrentIndex(0)
    setCorrectCount(0)
    setHintCount(0)
    setWrongCount(0)
    try {
      const res = await fetch(`/api/v1/wordbooks/${bookId}/review`, { credentials: 'include' })
      const json: { success: boolean; data: { items: ReviewItemDTO[]; total: number } } = await res.json()
      if (!res.ok || !json.success) {
        setLoadError('加载复习数据失败，请稍后重试')
        return
      }
      setReviewItems(json.data.items)
      if (json.data.items.length === 0) {
        setIsComplete(true)
      }
    } catch {
      setLoadError('网络异常，请检查连接后重试')
    } finally {
      setIsLoading(false)
    }
  }, [bookId])

  useEffect(() => {
    loadReview()
  }, [loadReview])

  // 提交学习结果
  const handleSubmit = async (itemId: string, result: StudyResult) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(
        `/api/v1/wordbooks/${bookId}/items/${itemId}/study`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ result }),
        }
      )
      // 不强依赖响应成功，即使失败也推进流程
      if (res.ok) {
        // 统计
        if (result === 'correct') setCorrectCount((c) => c + 1)
        else if (result === 'hint_used') setHintCount((c) => c + 1)
        else setWrongCount((c) => c + 1)
      }
    } catch {
      // 忽略网络错误，推进下一题
    } finally {
      setIsSubmitting(false)
      // 推进到下一题
      const nextIndex = currentIndex + 1
      if (nextIndex >= reviewItems.length) {
        setIsComplete(true)
      } else {
        setCurrentIndex(nextIndex)
      }
    }
  }

  const currentItem = reviewItems[currentIndex]
  const total = reviewItems.length
  const progressPct = total > 0 ? ((currentIndex) / total) * 100 : 0

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 text-muted-foreground"
          onClick={() => router.push(`/wordbooks/${bookId}`)}
          aria-label="返回识字库"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回字书</span>
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">今日复习</h1>
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <LoadingSpinner size="lg" />
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 py-16 text-center border border-destructive/20 rounded-xl bg-destructive/5"
        >
          <p className="text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" onClick={loadReview}>重新加载</Button>
        </div>
      ) : isComplete ? (
        <ReviewComplete
          total={total}
          correctCount={correctCount}
          hintCount={hintCount}
          wrongCount={wrongCount}
          onRestart={loadReview}
          onBack={() => router.push(`/wordbooks/${bookId}`)}
        />
      ) : currentItem ? (
        <div className="space-y-4">
          {/* 进度条 */}
          <div className="space-y-1">
            <div
              className="h-2 bg-muted rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={currentIndex}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label={`复习进度 ${currentIndex}/${total}`}
            >
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{currentIndex} / {total} 已完成</span>
              <div className="flex gap-3">
                <span className={cn('text-green-600', correctCount === 0 && 'text-muted-foreground')}>
                  ✓ {correctCount}
                </span>
                <span className={cn('text-orange-500', hintCount === 0 && 'text-muted-foreground')}>
                  ? {hintCount}
                </span>
                <span className={cn('text-destructive', wrongCount === 0 && 'text-muted-foreground')}>
                  ✗ {wrongCount}
                </span>
              </div>
            </div>
          </div>

          {/* 闪卡 */}
          <FlashCard
            key={currentItem.id}
            item={currentItem}
            current={currentIndex + 1}
            total={total}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </div>
      ) : null}
    </div>
  )
}
