'use client'

import { useState, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface CharSearchProps {
  onSearch: (char: string) => void
  isLoading?: boolean
  defaultValue?: string
}

export function CharSearch({ onSearch, isLoading = false, defaultValue = '' }: CharSearchProps) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validate = useCallback((input: string): string | null => {
    const trimmed = input.trim()
    if (!trimmed) return '请输入要学习的汉字'
    // 提取第一个有效汉字
    const match = trimmed.match(/[\u4e00-\u9fff\u3400-\u4dbf]/)
    if (!match) return '请输入有效的汉字字符'
    return null
  }, [])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    const err = validate(trimmed)
    if (err) {
      setError(err)
      inputRef.current?.focus()
      return
    }
    setError(null)
    // 取第一个汉字
    const match = trimmed.match(/[\u4e00-\u9fff\u3400-\u4dbf]/)
    if (match) {
      onSearch(match[0])
    }
  }, [value, validate, onSearch])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
    if (e.key === 'Escape') {
      handleClear()
    }
  }

  const handleClear = () => {
    setValue('')
    setError(null)
    inputRef.current?.focus()
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        role="search"
        aria-label="汉字搜索"
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <label htmlFor="char-search-input" className="sr-only">
            输入汉字进行搜索
          </label>
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          >
            <Search className="w-5 h-5" />
          </span>
          <input
            id="char-search-input"
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入汉字，如：学、好、字…"
            aria-invalid={!!error}
            aria-describedby={error ? 'char-search-error' : undefined}
            className={cn(
              'w-full h-12 pl-10 pr-10 rounded-lg border bg-background text-[18px]',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'placeholder:text-muted-foreground transition-colors',
              error
                ? 'border-destructive focus:ring-destructive'
                : 'border-input hover:border-primary/50'
            )}
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="清空搜索内容"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={!value.trim() || isLoading}
          size="lg"
          aria-label="搜索汉字"
          className="h-12 px-6 text-base"
        >
          搜索
        </Button>
      </div>

      {error && (
        <p
          id="char-search-error"
          role="alert"
          aria-live="polite"
          className="mt-2 text-sm text-destructive flex items-center gap-1"
        >
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}

      <p className="mt-2 text-sm text-muted-foreground">
        提示：每次搜索一个汉字，按 Enter 或点击搜索按钮
      </p>
    </div>
  )
}
