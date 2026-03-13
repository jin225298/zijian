'use client'

import { useState, useCallback } from 'react'
import { Wifi, Usb, Link, AlertCircle, CheckCircle2, Loader2, QrCode, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ================================
// 类型定义
// ================================

export type ConnectionMode = 'wifi' | 'usb'
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface DeviceInfo {
  id: string
  name: string
  ip?: string
  mode: ConnectionMode
  status: ConnectionStatus
  streamUrl: string
  connectedAt: string
}

interface CameraConnectProps {
  onConnect: (device: DeviceInfo) => void
}

// ================================
// 组件实现
// ================================

export function CameraConnect({ onConnect }: CameraConnectProps) {
  const [mode, setMode] = useState<ConnectionMode>('wifi')
  const [ip, setIp] = useState('')
  const [ipError, setIpError] = useState<string | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // --------------------------------
  // 表单验证
  // --------------------------------
  const validateIp = (value: string): boolean => {
    if (!value.trim()) {
      setIpError('请输入摄像头 IP 地址')
      return false
    }
    // 支持 IP 格式 或 IP:PORT 格式
    const ipPortRegex =
      /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/
    if (!ipPortRegex.test(value.trim())) {
      setIpError('IP 格式不正确，例如：192.168.1.100 或 192.168.1.100:81')
      return false
    }
    setIpError(null)
    return true
  }

  // --------------------------------
  // WiFi 连接
  // --------------------------------
  const handleWifiConnect = useCallback(async () => {
    if (!validateIp(ip)) return

    setStatus('connecting')
    setErrorMsg(null)

    const host = ip.trim()
    const streamUrl = `http://${host}/stream`

    // 通过 fetch 探测设备是否可达（简单 HEAD 请求）
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)

      await fetch(streamUrl, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors', // ESP32 可能不设置 CORS 头
      })

      clearTimeout(timer)
    } catch {
      // no-cors 模式下 fetch 成功时会 resolve（opaque response），
      // 只有网络不通时才 reject
      setStatus('error')
      setErrorMsg(`无法连接到 ${host}，请确认设备已开机且处于同一局域网`)
      return
    }

    const device: DeviceInfo = {
      id: `wifi-${Date.now()}`,
      name: `ESP32-S3 (${host})`,
      ip: host,
      mode: 'wifi',
      status: 'connected',
      streamUrl,
      connectedAt: new Date().toISOString(),
    }

    setStatus('connected')
    onConnect(device)
  }, [ip, onConnect])

  // --------------------------------
  // USB 连接检测
  // --------------------------------
  const handleUsbConnect = useCallback(async () => {
    setStatus('connecting')
    setErrorMsg(null)

    // 检查浏览器是否支持 WebUSB
    if (!('usb' in navigator)) {
      setStatus('error')
      setErrorMsg('当前浏览器不支持 WebUSB，请使用 Chrome 或 Edge 浏览器，或改用 WiFi 模式')
      return
    }

    try {
      // WebUSB 请求设备（ESP32 的 VID/PID 可能需要调整）
      // @ts-expect-error WebUSB API 类型声明需要额外安装
      const usbDevice = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x303a }, // Espressif VID
          { vendorId: 0x10c4 }, // Silicon Labs VID (CP210x)
        ],
      })

      const device: DeviceInfo = {
        id: `usb-${Date.now()}`,
        name: usbDevice.productName || 'ESP32-S3',
        mode: 'usb',
        status: 'connected',
        // USB 模式下通过本地代理转发视频流
        streamUrl: 'http://localhost:8080/stream',
        connectedAt: new Date().toISOString(),
      }

      setStatus('connected')
      onConnect(device)
    } catch (err) {
      const isCancel =
        err instanceof Error && err.name === 'NotFoundError'
      if (!isCancel) {
        setStatus('error')
        setErrorMsg('USB 连接失败，请确认设备已通过 USB 连接并安装驱动')
      } else {
        setStatus('disconnected')
      }
    }
  }, [onConnect])

  // --------------------------------
  // 重置状态
  // --------------------------------
  const handleReset = () => {
    setStatus('disconnected')
    setErrorMsg(null)
    setIpError(null)
  }

  // --------------------------------
  // 渲染
  // --------------------------------
  return (
    <div className="space-y-6">
      {/* 连接模式切换 */}
      <div
        role="tablist"
        aria-label="连接方式"
        className="flex gap-2 p-1 rounded-lg bg-muted/50 w-fit"
      >
        {(['wifi', 'usb'] as ConnectionMode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m)
              handleReset()
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              mode === m
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {m === 'wifi' ? (
              <Wifi className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Usb className="w-4 h-4" aria-hidden="true" />
            )}
            {m === 'wifi' ? 'WiFi 连接' : 'USB 连接'}
          </button>
        ))}
      </div>

      {/* WiFi 连接面板 */}
      {mode === 'wifi' && (
        <div
          role="tabpanel"
          aria-label="WiFi 连接设置"
          className="space-y-4"
        >
          <p className="text-sm text-muted-foreground">
            请确保手机 / 电脑与 ESP32-S3 摄像头连接到同一 WiFi 网络，然后输入摄像头的 IP 地址。
          </p>

          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                label="摄像头 IP 地址"
                placeholder="192.168.1.100 或 192.168.1.100:81"
                value={ip}
                onChange={(e) => {
                  setIp(e.target.value)
                  if (ipError) setIpError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleWifiConnect()
                }}
                error={ipError ?? undefined}
                helperText="可在 ESP32-S3 的串口日志中查看 IP 地址"
                disabled={status === 'connecting' || status === 'connected'}
                aria-label="摄像头 IP 地址"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleWifiConnect}
              disabled={status === 'connecting' || !ip.trim()}
              isLoading={status === 'connecting'}
              aria-label={status === 'connecting' ? '正在连接摄像头' : '连接摄像头'}
              className="gap-2"
            >
              {status !== 'connecting' && (
                <Link className="w-4 h-4" aria-hidden="true" />
              )}
              {status === 'connecting' ? '连接中…' : '连接摄像头'}
            </Button>

            {/* 扫描二维码提示 */}
            <button
              type="button"
              className={cn(
                'flex items-center gap-1.5 text-sm text-muted-foreground',
                'hover:text-foreground transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring rounded'
              )}
              title="ESP32-S3 可配置为开机后显示二维码（包含连接信息）"
            >
              <QrCode className="w-4 h-4" aria-hidden="true" />
              <span>扫码获取 IP</span>
            </button>
          </div>
        </div>
      )}

      {/* USB 连接面板 */}
      {mode === 'usb' && (
        <div
          role="tabpanel"
          aria-label="USB 连接设置"
          className="space-y-4"
        >
          <p className="text-sm text-muted-foreground">
            通过 USB 数据线连接 ESP32-S3，浏览器将通过 WebUSB 协议识别设备。
            <br />
            需要使用 Chrome 86+ 或 Edge 86+ 浏览器。
          </p>

          <Button
            onClick={handleUsbConnect}
            disabled={status === 'connecting'}
            isLoading={status === 'connecting'}
            className="gap-2"
            aria-label={status === 'connecting' ? '正在检测 USB 设备' : '检测 USB 设备'}
          >
            {status !== 'connecting' && (
              <Usb className="w-4 h-4" aria-hidden="true" />
            )}
            {status === 'connecting' ? '检测中…' : '检测 USB 设备'}
          </Button>
        </div>
      )}

      {/* 状态提示 */}
      {status === 'connecting' && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>正在连接，请稍候…</span>
        </div>
      )}

      {status === 'error' && errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className={cn(
            'flex items-start gap-3 px-4 py-3 rounded-lg',
            'border border-destructive/30 bg-destructive/5 text-destructive text-sm'
          )}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p>{errorMsg}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            aria-label="重试连接"
            className="shrink-0 h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            重试
          </Button>
        </div>
      )}

      {status === 'connected' && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-emerald-600"
        >
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          <span>摄像头已连接！正在加载视频流…</span>
        </div>
      )}

      {/* 连接提示说明 */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1.5">
        <p className="font-medium text-foreground text-xs uppercase tracking-wide mb-2">
          使用说明
        </p>
        {mode === 'wifi' ? (
          <ul className="space-y-1 list-disc list-inside">
            <li>给 ESP32-S3 上电，等待其连接到 WiFi</li>
            <li>在串口监视器中查看分配的 IP 地址</li>
            <li>将 IP 地址填入上方输入框，点击连接</li>
            <li>默认视频流端口为 80（路径 /stream）</li>
          </ul>
        ) : (
          <ul className="space-y-1 list-disc list-inside">
            <li>使用 USB 数据线连接 ESP32-S3 与电脑</li>
            <li>确认已安装 CP210x 或 CH340 驱动</li>
            <li>点击"检测 USB 设备"并在弹窗中选择设备</li>
            <li>首次使用需授予浏览器 USB 访问权限</li>
          </ul>
        )}
      </div>
    </div>
  )
}
