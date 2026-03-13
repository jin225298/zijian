'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, Pen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type HanziWriterType from 'hanzi-writer'

interface StrokePlayerProps {
  char: string
  onComplete?: () => void
}

type AnimationState = 'idle' | 'playing' | 'paused' | 'completed'

export function StrokePlayer({ char, onComplete }: StrokePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<HanziWriterType | null>(null)
  const [animState, setAnimState] = useState<AnimationState>('idle')
  const [isReady, setIsReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || !char) return

    setIsReady(false)
    setLoadError(null)
    setAnimState('idle')

    // 清理旧实例
    if (writerRef.current) {
      try {
        // hanzi-writer 没有官方 destroy 方法，手动清理 DOM
        containerRef.current.innerHTML = ''
      } catch {
        // ignore
      }
      writerRef.current = null
    }

    let isMounted = true

    const initWriter = async () => {
      try {
        const HanziWriter = (await import('hanzi-writer')).default
        if (!isMounted || !containerRef.current) return

        const writer = HanziWriter.create(containerRef.current, char, {
          width: 200,
          height: 200,
          padding: 10,
          strokeColor: '#334155',
          radicalColor: '#e74c3c',
          outlineColor: '#e2e8f0',
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 300,
          showCharacter: true,
          showOutline: true,
        })

        writerRef.current = writer
        if (isMounted) {
          setIsReady(true)
        }
      } catch (err) {
        console.error('HanziWriter 加载失败:', err)
        if (isMounted) {
          setLoadError('笔画数据加载失败，该汉字可能暂不支持动画')
        }
      }
    }

    initWriter()

    return () => {
      isMounted = false
    }
  }, [char])

  const playAnimation = () => {
    if (!writerRef.current) return
    setAnimState('playing')
    writerRef.current.animateCharacter({
      onComplete: () => {
        setAnimState('completed')
        onComplete?.()
      },
    })
  }

  const pauseAnimation = () => {
    if (!writerRef.current) return
    writerRef.current.pauseAnimation()
    setAnimState('paused')
  }

  const resumeAnimation = () => {
    if (!writerRef.current) return
    writerRef.current.resumeAnimation()
    setAnimState('playing')
  }

  const resetAnimation = async () => {
    if (!writerRef.current) return
    // 通过 pauseAnimation 停止再 setCharacter 重置回初始状态
    await writerRef.current.pauseAnimation()
    await writerRef.current.setCharacter(char)
    setAnimState('idle')
  }

  return (
    <Card role="region" aria-label={`"${char}"笔画动画播放器`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Pen className="w-4 h-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">笔画动画</h2>
        </div>

        {/* 动画容器 */}
        <div className="flex flex-col items-center gap-5">
          <div
            className={cn(
              'relative rounded-xl border-2 border-dashed p-4',
              'border-border bg-muted/20',
              !isReady && !loadError && 'animate-pulse'
            )}
            aria-live="polite"
            aria-label={
              animState === 'playing'
                ? '正在播放笔画动画'
                : animState === 'paused'
                ? '动画已暂停'
                : animState === 'completed'
                ? '动画播放完毕'
                : '准备播放'
            }
          >
            {loadError ? (
              <div
                className="w-[200px] h-[200px] flex items-center justify-center text-center text-sm text-muted-foreground px-4"
                role="alert"
              >
                <span>⚠ {loadError}</span>
              </div>
            ) : !isReady ? (
              <div className="w-[200px] h-[200px] flex items-center justify-center">
                <div
                  className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
                  role="status"
                  aria-label="加载笔画数据中"
                />
              </div>
            ) : null}

            {/* hanzi-writer 挂载点 */}
            <div
              ref={containerRef}
              className={cn(!isReady && !loadError ? 'hidden' : 'block')}
              aria-hidden="true"
            />
          </div>

          {/* 播放状态提示 */}
          <p
            className="text-sm text-muted-foreground"
            aria-live="polite"
            role="status"
          >
            {!isReady && !loadError && '正在加载笔画数据…'}
            {isReady && animState === 'idle' && '点击播放按钮开始笔画演示'}
            {animState === 'playing' && '正在演示笔画书写…'}
            {animState === 'paused' && '已暂停，点击继续恢复播放'}
            {animState === 'completed' && '演示完成！可以重置后再次观看'}
            {loadError && '请尝试其他汉字'}
          </p>

          {/* 控制按钮 */}
          <div
            className="flex gap-2"
            role="group"
            aria-label="笔画动画控制"
          >
            {/* 播放 / 暂停 / 继续 */}
            {animState !== 'playing' ? (
              <Button
                onClick={animState === 'paused' ? resumeAnimation : playAnimation}
                disabled={!isReady || !!loadError}
                size="sm"
                aria-label={animState === 'paused' ? '继续播放笔画动画' : '播放笔画动画'}
                className="gap-1.5"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                {animState === 'paused' ? '继续' : '播放'}
              </Button>
            ) : (
              <Button
                onClick={pauseAnimation}
                variant="secondary"
                size="sm"
                aria-label="暂停笔画动画"
                className="gap-1.5"
              >
                <Pause className="w-4 h-4" aria-hidden="true" />
                暂停
              </Button>
            )}

            {/* 重置 */}
            <Button
              onClick={resetAnimation}
              variant="outline"
              size="sm"
              disabled={!isReady || animState === 'idle' || !!loadError}
              aria-label="重置笔画动画"
              className="gap-1.5"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              重置
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
