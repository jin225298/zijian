'use client'

import { useState, useCallback } from 'react'
import { Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { DiffSegment } from '@/server/services/convert.service'

// ==========================================
// 类型定义
// ==========================================

export interface ConvertResultData {
  original: string
  converted: string
  confidence: number
  alternatives: string[]
  isFallback: boolean
  diff: DiffSegment[]
}

interface ConvertResultProps {
  result: ConvertResultData
}

// ==========================================
// 工具函数
// ==========================================

/** 置信度 → 标签 & 颜色 */
function getConfidenceStyle(confidence: number): { label: string; className: string } {
  if (confidence >= 0.85) {
    return { label: '高置信度', className: 'text-green-600 bg-green-50 border-green-200' }
  }
  if (confidence >= 0.6) {
    return { label: '中置信度', className: 'text-yellow-600 bg-yellow-50 border-yellow-200' }
  }
  return { label: '低置信度', className: 'text-red-600 bg-red-50 border-red-200' }
}

// ==========================================
// DiffView 子组件 - 高亮差异渲染
// ==========================================

function DiffView({ diff }: { diff: DiffSegment[] }) {
  if (!diff || diff.length === 0) {
    return <span className="text-muted-foreground text-sm">（无差异）</span>
  }

  return (
    <span aria-label="转换差异高亮">
      {diff.map((seg, idx) => {
        if (seg.type === 'unchanged') {
          return (
            <span key={idx}>{seg.text}</span>
          )
        }
        if (seg.type === 'added') {
          return (
            <mark
              key={idx}
              className="bg-green-100 text-green-800 rounded px-0.5"
              aria-label={`新增：${seg.text}`}
            >
              {seg.text}
            </mark>
          )
        }
        if (seg.type === 'removed') {
          return (
            <del
              key={idx}
              className="bg-red-100 text-red-700 rounded px-0.5 line-through"
              aria-label={`删除：${seg.text}`}
            >
              {seg.text}
            </del>
          )
        }
        if (seg.type === 'changed') {
          return (
            <mark
              key={idx}
              className="bg-blue-100 text-blue-800 rounded px-0.5"
              aria-label={`修改：${seg.text}`}
            >
              {seg.text}
            </mark>
          )
        }
        return null
      })}
    </span>
  )
}

// ==========================================
// CopyButton 子组件
// ==========================================

function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 降级：创建临时文本域
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [text])

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? '已复制到剪贴板' : label}
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
        'border transition-all focus:outline-none focus:ring-2 focus:ring-ring',
        copied
          ? 'border-green-300 bg-green-50 text-green-700'
          : 'border-input bg-background text-muted-foreground hover:text-foreground hover:border-primary/50'
      )}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
          已复制
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          复制
        </>
      )}
    </button>
  )
}

// ==========================================
// ConvertResult 主组件
// ==========================================

export function ConvertResult({ result }: ConvertResultProps) {
  const [altIndex, setAltIndex] = useState(0)
  const [showDiff, setShowDiff] = useState(true)

  const { original, converted, confidence, alternatives, isFallback, diff } = result
  const confidenceStyle = getConfidenceStyle(confidence)
  const confidencePercent = Math.round(confidence * 100)

  // 当前展示的备选文本（0 = 主结果）
  const allResults = [converted, ...alternatives]
  const currentText = allResults[altIndex] ?? converted

  const hasPrev = altIndex > 0
  const hasNext = altIndex < allResults.length - 1

  return (
    <div className="space-y-4" role="region" aria-label="转换结果">
      {/* 置信度 & 降级提示 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
            confidenceStyle.className
          )}
          aria-label={`置信度：${confidencePercent}%，${confidenceStyle.label}`}
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
          {confidenceStyle.label} · {confidencePercent}%
        </span>

        {isFallback && (
          <span
            role="alert"
            className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full border"
          >
            ⚠ AI 服务繁忙，已返回原文
          </span>
        )}
      </div>

      {/* 并排对比区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 原文 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">原文（手语式中文）</h3>
            <CopyButton text={original} label="复制原文" />
          </div>
          <div
            className={cn(
              'min-h-[120px] p-4 rounded-lg border bg-muted/30',
              'text-base leading-relaxed whitespace-pre-wrap break-words'
            )}
            aria-label="原文内容"
          >
            {original}
          </div>
        </div>

        {/* 转换结果 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">转换结果（标准书面语）</h3>
            <CopyButton text={currentText} label="复制转换结果" />
          </div>
          <div
            className={cn(
              'min-h-[120px] p-4 rounded-lg border bg-background',
              'text-base leading-relaxed whitespace-pre-wrap break-words',
              'border-primary/30 shadow-sm'
            )}
            aria-label="转换结果内容"
            aria-live="polite"
          >
            {currentText}
          </div>
        </div>
      </div>

      {/* Diff 差异高亮 */}
      {diff.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDiff((v) => !v)}
              aria-expanded={showDiff}
              aria-controls="diff-view"
              className={cn(
                'text-sm font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring rounded',
                'hover:text-primary',
                showDiff ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {showDiff ? '▾ 隐藏差异高亮' : '▸ 显示差异高亮'}
            </button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" aria-hidden="true" />
                新增
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" aria-hidden="true" />
                删除
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-100 border border-blue-200 inline-block" aria-hidden="true" />
                修改
              </span>
            </div>
          </div>

          {showDiff && (
            <div
              id="diff-view"
              className={cn(
                'p-4 rounded-lg border bg-muted/20',
                'text-base leading-relaxed'
              )}
              aria-label="差异对比高亮"
            >
              <DiffView diff={diff} />
            </div>
          )}
        </div>
      )}

      {/* 备选结果切换 */}
      {allResults.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            备选结果（共 {allResults.length} 个）
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAltIndex((i) => i - 1)}
              disabled={!hasPrev}
              aria-label="上一个备选结果"
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </Button>

            <div
              className="flex-1 px-4 py-2 rounded-lg border bg-background text-sm"
              aria-label={`当前显示第 ${altIndex + 1} 个结果：${currentText}`}
              aria-live="polite"
            >
              <span className="text-muted-foreground text-xs mr-2">
                {altIndex + 1} / {allResults.length}
              </span>
              {currentText}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setAltIndex((i) => i + 1)}
              disabled={!hasNext}
              aria-label="下一个备选结果"
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {/* 一键复制最终结果（大按钮，方便使用） */}
      <div className="pt-2 border-t border-border">
        <CopyButton text={currentText} label={`一键复制转换结果`} />
      </div>
    </div>
  )
}
