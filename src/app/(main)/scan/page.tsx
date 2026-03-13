'use client'

import { useState, useCallback, useEffect } from 'react'
import { Camera, Wifi, AlertTriangle } from 'lucide-react'
import { CameraConnect } from './components/CameraConnect'
import { CameraStream } from './components/CameraStream'
import { ScanResult } from './components/ScanResult'
import { DeviceList } from './components/DeviceList'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ApiResponse, ScanResultDTO, ScanRecordDTO } from '@/types'
import type { DeviceInfo } from './components/CameraConnect'

// ================================
// 主页面
// ================================

export default function ScanPage() {
  // 设备 & 连接状态
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [activeDevice, setActiveDevice] = useState<DeviceInfo | null>(null)

  // 识别状态
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResultDTO | null>(null)
  const [recognizeError, setRecognizeError] = useState<string | null>(null)

  // 识别历史
  const [history, setHistory] = useState<ScanRecordDTO[]>([])

  // --------------------------------
  // 初始化：拉取历史
  // --------------------------------
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/v1/scan/history', { credentials: 'include' })
        if (!res.ok) return
        const json: ApiResponse<{ items: ScanRecordDTO[] }> = await res.json()
        if (json.code === 0) setHistory(json.data?.items ?? [])
      } catch {
        // 静默失败，历史非核心功能
      }
    }
    fetchHistory()
  }, [])

  // --------------------------------
  // 连接摄像头
  // --------------------------------
  const handleConnect = useCallback((device: DeviceInfo) => {
    setDevices((prev) => {
      // 防止重复添加
      if (prev.some((d) => d.id === device.id)) return prev
      return [...prev, device]
    })
    setActiveDevice(device)
    setScanResult(null)
    setRecognizeError(null)
  }, [])

  // --------------------------------
  // 断开摄像头
  // --------------------------------
  const handleDisconnect = useCallback(
    (deviceId: string) => {
      setDevices((prev) => prev.filter((d) => d.id !== deviceId))
      if (activeDevice?.id === deviceId) {
        setActiveDevice(null)
        setScanResult(null)
      }
    },
    [activeDevice]
  )

  // --------------------------------
  // 截图后调用识别 API
  // --------------------------------
  const handleCapture = useCallback(
    async (imageData: string) => {
      if (!activeDevice) return

      setIsRecognizing(true)
      setScanResult(null)
      setRecognizeError(null)

      try {
        const res = await fetch('/api/v1/scan/recognize', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData,
            deviceId: activeDevice.id,
          }),
        })

        const json: ApiResponse<ScanResultDTO> = await res.json()

        if (!res.ok || json.code !== 0) {
          setRecognizeError(json.message ?? '识别失败，请重试')
          return
        }

        setScanResult(json.data)

        // 更新历史（乐观更新，插入到开头）
        const newRecord: ScanRecordDTO = {
          id: json.data.sessionId,
          deviceId: activeDevice.id,
          sessionId: json.data.sessionId,
          imageUrl: null,
          rawText: json.data.rawText,
          chars: json.data.chars.map((c) => c.character),
          confidence: json.data.confidence,
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
        }
        setHistory((prev) => [newRecord, ...prev.slice(0, 19)])
      } catch {
        setRecognizeError('网络异常，请检查连接后重试')
      } finally {
        setIsRecognizing(false)
      }
    },
    [activeDevice]
  )

  // --------------------------------
  // 渲染
  // --------------------------------
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Camera className="w-6 h-6 text-primary" aria-hidden="true" />
          实物识字
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          连接 ESP32-S3 摄像头，对准实物拍照，自动识别汉字并加入识字库
        </p>
      </div>

      {/* 主内容区：两栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* ======== 左栏：摄像头区域 ======== */}
        <div className="space-y-4">
          {/* 视频流 / 连接引导 */}
          {activeDevice ? (
            <div className="space-y-3">
              <CameraStream
                streamUrl={activeDevice.streamUrl}
                onCapture={handleCapture}
                isRecognizing={isRecognizing}
              />

              {/* 识别错误提示 */}
              {recognizeError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-3 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm"
                >
                  <AlertTriangle
                    className="w-4 h-4 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{recognizeError}</span>
                  <button
                    type="button"
                    onClick={() => setRecognizeError(null)}
                    aria-label="关闭错误提示"
                    className="ml-auto shrink-0 text-destructive/60 hover:text-destructive"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* 未连接时展示连接引导 */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wifi className="w-5 h-5 text-primary" aria-hidden="true" />
                  连接摄像头
                </CardTitle>
                <CardDescription>
                  选择连接方式，将 ESP32-S3 摄像头接入系统
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CameraConnect onConnect={handleConnect} />
              </CardContent>
            </Card>
          )}

          {/* 已连接设备列表 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                已连接设备
              </h2>
              {/* 连接新设备按钮（已有设备时显示） */}
              {activeDevice && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveDevice(null)}
                  className="h-7 text-xs gap-1.5"
                  aria-label="连接新摄像头"
                >
                  <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
                  切换 / 新增摄像头
                </Button>
              )}
            </div>
            <DeviceList
              devices={devices}
              onDisconnect={handleDisconnect}
            />
          </div>

          {/* 连接新摄像头（有已连接设备时，折叠展示连接面板） */}
          {activeDevice && devices.length > 0 && (
            <ConnectNewCamera onConnect={handleConnect} />
          )}
        </div>

        {/* ======== 右栏：识别结果 ======== */}
        <Card
          className="lg:sticky lg:top-6"
          role="complementary"
          aria-label="识别结果面板"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">识别结果</CardTitle>
          </CardHeader>
          <CardContent>
            <ScanResult
              result={scanResult}
              isLoading={isRecognizing}
              history={history}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// --------------------------------
// 折叠的"连接新摄像头"面板
// --------------------------------
function ConnectNewCamera({ onConnect }: { onConnect: (device: DeviceInfo) => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-dashed border-border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="new-camera-panel"
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'text-sm text-muted-foreground hover:text-foreground transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring rounded-lg'
        )}
      >
        <span className="flex items-center gap-2">
          <Wifi className="w-4 h-4" aria-hidden="true" />
          连接其他摄像头
        </span>
        <span
          className={cn(
            'text-xs transition-transform duration-200',
            expanded ? 'rotate-180' : ''
          )}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div id="new-camera-panel" className="px-4 pb-4 border-t border-border pt-4">
          <CameraConnect onConnect={onConnect} />
        </div>
      )}
    </div>
  )
}
