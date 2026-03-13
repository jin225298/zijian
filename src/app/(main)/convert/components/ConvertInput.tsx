'use client'

import { useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ==========================================
// 类型定义
// ==========================================

export type ConvertContext = 'daily' | 'academic' | 'formal'

interface ConvertInputProps {
  value: string
  onChange: (value: string) => void
  context: ConvertContext
  onContextChange: (context: ConvertContext) => void
  onConvert: () => void
  isLoading: boolean
}

// ==========================================
// 场景配置
// ==========================================

const CONTEXT_OPTIONS: { value: ConvertContext; label: string; desc: string }[] = [
  { value: 'daily', label: '日常对话', desc: '口语化、轻松的表达' },
  { value: 'academic', label: '学术书面', desc: '正式学术文章风格' },
  { value: 'formal', label: '正式公文', desc: '政务、商务公文风格' },
]

const MAX_LENGTH = 500

// ==========================================
// ConvertInput 组件
// ==========================================

export function ConvertInput({
  value,
  onChange,
  context,
  onContextChange,
  onConvert,
  isLoading,
}: ConvertInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const charCount = value.length
  const isOverLimit = charCount > MAX_LENGTH
  const isEmpty = value.trim().length === 0

  const handleClear = () => {
    onChange('')
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter 触发转换
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!isEmpty && !isOverLimit && !isLoading) {
        onConvert()
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* 场景选择 */}
      <div
        role="tablist"
        aria-label="选择转换场景"
        className="flex gap-2 flex-wrap"
      >
        {CONTEXT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            role="tab"
            aria-selected={context === opt.value}
            aria-controls="convert-textarea"
            onClick={() => onContextChange(opt.value)}
            title={opt.desc}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'border',
              context === opt.value
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-foreground border-input hover:border-primary/50 hover:bg-accent/50'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 文本输入区域 */}
      <div className="relative">
        <label htmlFor="convert-textarea" className="sr-only">
          输入手语式中文文本（最多 {MAX_LENGTH} 字）
        </label>
        <textarea
          id="convert-textarea"
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="请输入手语式中文，例如：我 昨天 去 医院 看 病，医生 说 我 需要 多 休息…"
          rows={6}
          maxLength={MAX_LENGTH + 50} // 允许稍微超出以便给出提示
          aria-label="手语式中文输入框"
          aria-describedby="convert-hint convert-count"
          aria-invalid={isOverLimit}
          className={cn(
            'w-full resize-none rounded-lg border bg-background px-4 py-3',
            'text-base leading-relaxed placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'transition-colors',
            isOverLimit
              ? 'border-destructive focus:ring-destructive'
              : 'border-input hover:border-primary/50'
          )}
        />

        {/* 清空按钮 */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="清空输入内容"
            className={cn(
              'absolute right-3 top-3',
              'text-muted-foreground hover:text-foreground transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring rounded'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 字数统计 & 提示 */}
      <div className="flex items-center justify-between gap-4">
        <p
          id="convert-hint"
          className="text-xs text-muted-foreground"
        >
          提示：按 Ctrl + Enter 快速转换
        </p>
        <span
          id="convert-count"
          aria-live="polite"
          aria-label={`已输入 ${charCount} 字，最多 ${MAX_LENGTH} 字`}
          className={cn(
            'text-xs tabular-nums shrink-0',
            isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'
          )}
        >
          {charCount} / {MAX_LENGTH}
        </span>
      </div>

      {/* 字数超限提示 */}
      {isOverLimit && (
        <p
          role="alert"
          aria-live="assertive"
          className="text-sm text-destructive flex items-center gap-1"
        >
          <span aria-hidden="true">⚠</span>
          文本超过 {MAX_LENGTH} 字限制，请删减后再转换
        </p>
      )}

      {/* 转换按钮 */}
      <Button
        onClick={onConvert}
        isLoading={isLoading}
        disabled={isEmpty || isOverLimit || isLoading}
        size="lg"
        className="w-full"
        aria-label={isLoading ? '正在转换中…' : '开始转换'}
      >
        {isLoading ? '转换中…' : '开始转换'}
      </Button>
    </div>
  )
}
