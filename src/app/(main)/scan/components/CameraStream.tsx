'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Maximize2,
  Minimize2,
  Camera,
  Loader2,
  AlertCircle,
  RefreshCw,
  ScanSearch,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ================================
// 类型定义
// ================================

interface CameraStreamProps {
  streamUrl: string
  onCapture: (imageData: string) => void
  isRecognizing?: boolean
}

type StreamStatus = 'loading' | 'playing' | 'error'

// ================================
// 组件实现
// ================================

export function CameraStream({ streamUrl, onCapture, isRecognizing = false }: CameraStreamProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [streamStatus, setStreamStatus] = useState<StreamStatus>('loading')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [retryKey, setRetryKey] = useState(0) // 重试时递增

  // --------------------------------
  // 全屏切换
  // --------------------------------
  const handleFullscreen = useCallback(async () => {
    const container = containerRef.current
    if (!container) return

    if (!document.fullscreenElement) {
      await container.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  // --------------------------------
  // 截图逻辑
  // --------------------------------
  const handleCapture = useCallback(() => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas || streamStatus !== 'playing') return

    setIsCapturing(true)
    setShowFlash(true)

    // 使用隐藏 Canvas 绘制当前帧
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setIsCapturing(false)
      setShowFlash(false)
      return
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const imageData = canvas.toDataURL('image/jpeg', 0.85)

    // 闪光动画结束后回调
    setTimeout(() => {
      setShowFlash(false)
      setIsCapturing(false)
      onCapture(imageData)
    }, 300)
  }, [streamStatus, onCapture])

  // --------------------------------
  // 重试
  // --------------------------------
  const handleRetry = () => {
    setStreamStatus('loading')
    setRetryKey((k) => k + 1)
  }

  // --------------------------------
  // 渲染
  // --------------------------------
  return (
    <div
      ref={containerRef}
      className={cn(
        'relative rounded-xl overflow-hidden bg-black',
        'border border-border',
        isFullscreen ? 'w-screen h-screen' : 'w-full aspect-video'
      )}
      role="region"
      aria-label="ESP32-S3 实时视频流"
    >
      {/* MJPEG 视频流 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={retryKey}
        ref={imgRef}
        src={streamUrl}
        alt="ESP32-S3 摄像头实时画面"
        className={cn(
          'w-full h-full object-contain',
          streamStatus !== 'playing' && 'invisible'
        )}
        onLoad={() => setStreamStatus('playing')}
        onError={() => setStreamStatus('error')}
        crossOrigin="anonymous"
      />

      {/* 隐藏 Canvas，用于截图 */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* 加载状态 */}
      {streamStatus === 'loading' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white"
          role="status"
          aria-live="polite"
          aria-label="视频流加载中"
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-white/70">正在连接视频流…</p>
        </div>
      )}

      {/* 错误状态 */}
      {streamStatus === 'error' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 text-white"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="w-10 h-10 text-destructive" aria-hidden="true" />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">视频流加载失败</p>
            <p className="text-xs text-white/60">请检查摄像头是否正常工作</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            aria-label="重新加载视频流"
            className="gap-2 border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            重新加载
          </Button>
        </div>
      )}

      {/* 正在识别遮罩 */}
      {isRecognizing && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60"
          role="status"
          aria-live="polite"
          aria-label="正在识别图像中的汉字"
        >
          <div className="relative">
            <ScanSearch className="w-12 h-12 text-primary" aria-hidden="true" />
            {/* 扫描线动画 */}
            <div
              className="absolute inset-0 overflow-hidden rounded"
              aria-hidden="true"
            >
              <div className="h-0.5 w-full bg-primary/80 shadow-[0_0_8px_2px_hsl(var(--primary)/0.5)] animate-[scanline_1.5s_ease-in-out_infinite]" />
            </div>
          </div>
          <p className="text-sm text-white font-medium">正在识别汉字…</p>
        </div>
      )}

      {/* 拍照闪光效果 */}
      {showFlash && (
        <div
          className="absolute inset-0 bg-white animate-[flash_0.3s_ease-out_forwards] pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* 识别框（视频流正常时显示的取景框） */}
      {streamStatus === 'playing' && !isRecognizing && (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        >
          {/* 四角取景框 */}
          <div className="absolute inset-[20%]">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/60 rounded-tl-sm" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary/60 rounded-tr-sm" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary/60 rounded-bl-sm" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/60 rounded-br-sm" />
          </div>
        </div>
      )}

      {/* 顶部工具栏 */}
      {streamStatus === 'playing' && (
        <div className="absolute top-3 right-3 flex gap-2">
          {/* 全屏按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFullscreen}
            aria-label={isFullscreen ? '退出全屏' : '全屏显示'}
            className={cn(
              'h-8 w-8 p-0 rounded-full',
              'bg-black/40 text-white hover:bg-black/60',
              'focus:ring-2 focus:ring-white/50'
            )}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="w-4 h-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      )}

      {/* 底部操作栏 */}
      {streamStatus === 'playing' && (
        <div className="absolute bottom-0 inset-x-0 px-4 py-4 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center justify-center">
            {/* 拍照识别按钮 */}
            <button
              onClick={handleCapture}
              disabled={isCapturing || isRecognizing}
              aria-label="拍照识别汉字"
              className={cn(
                'relative w-16 h-16 rounded-full',
                'bg-white border-4 border-white/80',
                'shadow-[0_0_20px_rgba(255,255,255,0.3)]',
                'flex items-center justify-center',
                'transition-all focus:outline-none focus:ring-4 focus:ring-white/50',
                'active:scale-90',
                (isCapturing || isRecognizing) && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Camera className="w-7 h-7 text-gray-800" aria-hidden="true" />
              {/* 外圈动画 */}
              {!isCapturing && !isRecognizing && (
                <span
                  className="absolute inset-0 rounded-full border-2 border-white/40 animate-ping"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
          <p className="text-center text-xs text-white/60 mt-2" aria-hidden="true">
            点击按钮拍照识别
          </p>
        </div>
      )}
    </div>
  )
}
