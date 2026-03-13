'use client'

import { Wifi, Usb, WifiOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DeviceInfo } from './CameraConnect'

// ================================
// 类型定义
// ================================

interface DeviceListProps {
  devices: DeviceInfo[]
  onDisconnect: (deviceId: string) => void
}

// ================================
// 组件实现
// ================================

export function DeviceList({ devices, onDisconnect }: DeviceListProps) {
  if (devices.length === 0) {
    return (
      <div
        role="status"
        aria-label="暂无已连接设备"
        className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground"
      >
        <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>暂无已连接的摄像头设备</span>
      </div>
    )
  }

  return (
    <div role="list" aria-label="已连接设备列表" className="space-y-2">
      {devices.map((device) => (
        <DeviceItem
          key={device.id}
          device={device}
          onDisconnect={onDisconnect}
        />
      ))}
    </div>
  )
}

// --------------------------------
// 单个设备条目
// --------------------------------
function DeviceItem({
  device,
  onDisconnect,
}: {
  device: DeviceInfo
  onDisconnect: (deviceId: string) => void
}) {
  const isConnected = device.status === 'connected'

  const connectedTime = new Date(device.connectedAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      role="listitem"
      aria-label={`${device.name}，${isConnected ? '已连接' : '已断开'}，${device.mode === 'wifi' ? 'WiFi' : 'USB'} 模式`}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors',
        isConnected
          ? 'border-emerald-200 bg-emerald-50/50'
          : 'border-border bg-muted/30'
      )}
    >
      {/* 连接模式图标 */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
          isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground'
        )}
        aria-hidden="true"
      >
        {device.mode === 'wifi' ? (
          <Wifi className="w-4 h-4" />
        ) : (
          <Usb className="w-4 h-4" />
        )}
      </div>

      {/* 设备信息 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{device.name}</p>
        <p className="text-xs text-muted-foreground">
          {device.mode === 'wifi' ? 'WiFi' : 'USB'} 模式
          {device.ip && <span> · {device.ip}</span>}
          <span> · 连接于 {connectedTime}</span>
        </p>
      </div>

      {/* 状态指示点 */}
      <div
        className={cn(
          'w-2 h-2 rounded-full shrink-0',
          isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'
        )}
        aria-hidden="true"
      />

      {/* 断开按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDisconnect(device.id)}
        aria-label={`断开连接 ${device.name}`}
        className={cn(
          'shrink-0 h-7 w-7 p-0 rounded-full',
          'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
        )}
      >
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
      </Button>
    </div>
  )
}
