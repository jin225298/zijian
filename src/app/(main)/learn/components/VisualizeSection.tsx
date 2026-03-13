'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ImageIcon, RefreshCw, ZoomIn } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ================================
// 类型定义（对应后端 VisualizeRequestDTO / TaskStatusDTO）
// ================================

interface VisualizeResult {
  taskId?: string
  estimatedSeconds?: number
  cached: boolean
  resultUrl?: string
}

interface TaskStatus {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  resultUrl?: string
  error?: string
}

interface VisualizeSectionProps {
  char: string
}

type SectionStatus = 'idle' | 'loading' | 'polling' | 'ready' | 'error'

/** 轮询间隔（ms） */
const POLL_INTERVAL = 3000
/** 最大轮询次数（3s * 40 = 2分钟） */
const MAX_POLL_COUNT = 40

// ================================
// 组件
// ================================

export function VisualizeSection({ char }: VisualizeSectionProps) {
  const [status, setStatus] = useState<SectionStatus>('idle')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [estimatedSeconds, setEstimatedSeconds] = useState<number>(15)

  const pollCountRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    pollCountRef.current = 0
  }, [])

  // 汉字切换时重置
  useEffect(() => {
    stopPolling()
    setStatus('idle')
    setImageUrl(null)
    setTaskId(null)
    setProgress(0)
    setErrorMsg(null)
  }, [char, stopPolling])

  // 组件卸载时停止轮询
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  // 轮询任务状态
  const pollTaskStatus = useCallback(
    (tid: string) => {
      const doFetch = async () => {
        try {
          const res = await fetch(`/api/v1/tasks/${tid}`, {
            credentials: 'include',
          })
          // 任务接口返回 { success: true, data: TaskStatusDTO }
          const json = await res.json()
          const data: TaskStatus = json?.data ?? json

          if (data.status === 'completed' && data.resultUrl) {
            stopPolling()
            setImageUrl(data.resultUrl)
            setProgress(100)
            setStatus('ready')
            return
          }

          if (data.status === 'failed') {
            stopPolling()
            setErrorMsg(data.error ?? '生成失败，请重试')
            setStatus('error')
            return
          }

          // pending / processing — 更新进度，继续轮询
          if (data.progress != null) setProgress(data.progress)

          pollCountRef.current += 1
          if (pollCountRef.current >= MAX_POLL_COUNT) {
            stopPolling()
            setErrorMsg('生成超时，请稍后重试')
            setStatus('error')
            return
          }

          pollTimerRef.current = setTimeout(doFetch, POLL_INTERVAL)
        } catch {
          // 网络异常，短暂延迟后继续轮询
          pollCountRef.current += 1
          if (pollCountRef.current < MAX_POLL_COUNT) {
            pollTimerRef.current = setTimeout(doFetch, POLL_INTERVAL)
          } else {
            setErrorMsg('网络异常，请刷新后重试')
            setStatus('error')
          }
        }
      }
      doFetch()
    },
    [stopPolling]
  )

  // 触发生成
  const fetchVisual = useCallback(async () => {
    stopPolling()
    setStatus('loading')
    setErrorMsg(null)
    setImageUrl(null)
    setTaskId(null)
    setProgress(0)

    try {
      const res = await fetch(`/api/v1/chars/${encodeURIComponent(char)}/visualize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'image', style: 'cartoon' }),
      })

      const json = await res.json()

      // 处理 401 未登录
      if (res.status === 401) {
        setErrorMsg('需要登录后才能生成可视化图片')
        setStatus('error')
        return
      }

      // 处理其他错误（错误响应使用 apiError 格式）
      if (!res.ok) {
        const msg = json?.message ?? '请求失败，请重试'
        setErrorMsg(msg)
        setStatus('error')
        return
      }

      // 成功响应：{ success: true, data: VisualizeRequestDTO }
      const data: VisualizeResult = json?.data ?? json

      // 命中缓存 — 直接显示图片
      if (data.cached && data.resultUrl) {
        setImageUrl(data.resultUrl)
        setProgress(100)
        setStatus('ready')
        return
      }

      // 直接有 URL（不带 taskId 的情况）
      if (data.resultUrl && !data.taskId) {
        setImageUrl(data.resultUrl)
        setProgress(100)
        setStatus('ready')
        return
      }

      // 异步任务 — 开始轮询
      if (data.taskId) {
        setTaskId(data.taskId)
        setEstimatedSeconds(data.estimatedSeconds ?? 15)
        setStatus('polling')
        pollCountRef.current = 0
        pollTimerRef.current = setTimeout(
          () => pollTaskStatus(data.taskId!),
          POLL_INTERVAL
        )
        return
      }

      setErrorMsg('暂无可视化内容，请稍后重试')
      setStatus('error')
    } catch {
      setErrorMsg('网络异常，请检查连接后重试')
      setStatus('error')
    }
  }, [char, stopPolling, pollTaskStatus])

  const isLoading = status === 'loading' || status === 'polling'

  return (
    <Card role="region" aria-label={`"${char}"可视化图片展示`}>
      <CardContent className="p-6">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold">可视化图片</h2>
          </div>

          {status !== 'idle' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchVisual}
              disabled={isLoading}
              aria-label="重新生成可视化图片"
              className="gap-1.5 text-xs"
            >
              <RefreshCw
                className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')}
                aria-hidden="true"
              />
              {isLoading ? '生成中…' : '重新生成'}
            </Button>
          )}
        </div>

        {/* ── 空状态 ── */}
        {status === 'idle' && (
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">
                AI 将为汉字生成形象可视化图片
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                帮助通过联想记忆学习汉字
              </p>
            </div>
            <Button
              onClick={fetchVisual}
              aria-label={`为"${char}"生成可视化图片`}
              className="gap-2"
            >
              <ZoomIn className="w-4 h-4" aria-hidden="true" />
              生成可视化图片
            </Button>
          </div>
        )}

        {/* ── 提交中 ── */}
        {status === 'loading' && (
          <div
            className="flex flex-col items-center justify-center py-10 gap-3"
            role="status"
            aria-label="正在提交生成请求，请稍候"
            aria-live="polite"
          >
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">正在提交请求…</p>
          </div>
        )}

        {/* ── 生成中（轮询） ── */}
        {status === 'polling' && taskId && (
          <div
            className="flex flex-col items-center justify-center py-10 gap-4"
            role="status"
            aria-label={`AI 正在生成图片，预计 ${estimatedSeconds} 秒`}
            aria-live="polite"
          >
            <div className="w-full max-w-xs space-y-2">
              <div
                className="h-2 rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`生成进度 ${progress}%`}
              >
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, progress)}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {progress > 0 ? `${progress}%` : '排队中…'}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              AI 正在生成可视化图片，预计需要{' '}
              <span className="font-medium text-foreground">{estimatedSeconds}</span> 秒
            </p>
            <p className="text-xs text-muted-foreground/70">
              生成完成后将自动显示，请耐心等待
            </p>
          </div>
        )}

        {/* ── 错误状态 ── */}
        {status === 'error' && (
          <div
            className="flex flex-col items-center justify-center py-8 gap-4 text-center"
            role="alert"
            aria-live="assertive"
          >
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <span className="text-destructive text-xl" aria-hidden="true">✕</span>
            </div>
            <div>
              <p className="text-sm font-medium text-destructive">生成失败</p>
              <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchVisual}
              aria-label="重试生成可视化图片"
            >
              重试
            </Button>
          </div>
        )}

        {/* ── 展示图片 ── */}
        {status === 'ready' && imageUrl && (
          <div className="space-y-3">
            <div
              className="relative rounded-xl overflow-hidden bg-muted aspect-square max-w-sm mx-auto border border-border"
              aria-label={`"${char}"的可视化图片`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`汉字"${char}"的可视化联想图片，帮助记忆`}
                className="w-full h-full object-contain"
                onError={() => {
                  setErrorMsg('图片加载失败，请重新生成')
                  setStatus('error')
                }}
              />

              {/* AI 生成水印 */}
              <div
                className={cn(
                  'absolute bottom-2 right-2',
                  'px-2 py-0.5 rounded-full text-[10px] font-medium',
                  'bg-black/50 text-white backdrop-blur-sm select-none'
                )}
                aria-hidden="true"
              >
                AI 生成
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              图片由 AI 生成，仅供辅助记忆参考
            </p>
          </div>
        )}

        {/* ── 生成完成但无图 ── */}
        {status === 'ready' && !imageUrl && (
          <div className="text-center py-8 text-sm text-muted-foreground" role="status">
            暂无可视化图片
          </div>
        )}
      </CardContent>
    </Card>
  )
}
