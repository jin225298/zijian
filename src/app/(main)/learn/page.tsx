'use client'

import { useState, useCallback } from 'react'
import { Minus, Plus } from 'lucide-react'
import { CharSearch } from './components/CharSearch'
import { CharCard } from './components/CharCard'
import { StrokePlayer } from './components/StrokePlayer'
import { VisualizeSection } from './components/VisualizeSection'
import { SaveToBookButton } from './components/SaveToBookButton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CharDTO, ApiResponse } from '@/types'

// 字体大小四档
const FONT_SIZES = ['base', 'lg', 'xl', '2xl'] as const
type FontSize = (typeof FONT_SIZES)[number]

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  base: '标准',
  lg: '大',
  xl: '特大',
  '2xl': '超大',
}

export default function LearnPage() {
  const [currentChar, setCurrentChar] = useState<CharDTO | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState<FontSize>('base')

  const fontSizeIndex = FONT_SIZES.indexOf(fontSize)

  const handleSearch = useCallback(async (char: string) => {
    setIsSearching(true)
    setSearchError(null)
    setCurrentChar(null)

    try {
      const res = await fetch(`/api/v1/chars/${encodeURIComponent(char)}`, {
        credentials: 'include',
      })

      const json: ApiResponse<CharDTO> = await res.json()

      if (!res.ok || json.code !== 0) {
        if (json.code === 30001) {
          setSearchError(`暂无"${char}"的数据，请尝试其他汉字`)
        } else {
          setSearchError(json.message ?? '查询失败，请稍后重试')
        }
        return
      }

      setCurrentChar(json.data)
    } catch {
      setSearchError('网络异常，请检查连接后重试')
    } finally {
      setIsSearching(false)
    }
  }, [])

  const decreaseFontSize = () => {
    if (fontSizeIndex > 0) {
      setFontSize(FONT_SIZES[fontSizeIndex - 1])
    }
  }

  const increaseFontSize = () => {
    if (fontSizeIndex < FONT_SIZES.length - 1) {
      setFontSize(FONT_SIZES[fontSizeIndex + 1])
    }
  }

  return (
    <div className="space-y-8">
      {/* 页面标题 & 字体调节 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">汉字学习</h1>
          <p className="text-muted-foreground text-sm mt-1">
            搜索汉字，查看详细信息、笔画动画与可视化图片
          </p>
        </div>

        {/* 字体大小调节 */}
        <div
          className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5"
          role="group"
          aria-label="字体大小调节"
        >
          <span className="text-xs text-muted-foreground">字号</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={decreaseFontSize}
            disabled={fontSizeIndex === 0}
            aria-label="缩小字体"
            className="h-7 w-7 p-0"
          >
            <Minus className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
          <span
            className="text-sm font-medium min-w-[2rem] text-center"
            aria-live="polite"
            aria-label={`当前字体大小：${FONT_SIZE_LABELS[fontSize]}`}
          >
            {FONT_SIZE_LABELS[fontSize]}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={increaseFontSize}
            disabled={fontSizeIndex === FONT_SIZES.length - 1}
            aria-label="放大字体"
            className="h-7 w-7 p-0"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* 搜索区 */}
      <section aria-label="汉字搜索">
        <CharSearch
          onSearch={handleSearch}
          isLoading={isSearching}
        />

        {/* 搜索错误提示 */}
        {searchError && (
          <div
            role="alert"
            aria-live="assertive"
            className={cn(
              'mt-4 mx-auto max-w-2xl',
              'flex items-center gap-3 px-4 py-3 rounded-lg',
              'border border-destructive/30 bg-destructive/5 text-destructive text-sm'
            )}
          >
            <span aria-hidden="true" className="text-lg">⚠</span>
            <span>{searchError}</span>
          </div>
        )}
      </section>

      {/* 搜索结果区 */}
      {currentChar ? (
        <div
          className="space-y-6"
          role="main"
          aria-label={`"${currentChar.character}"学习内容`}
        >
          {/* 两栏布局：左-汉字信息卡片，右-笔画动画 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 汉字信息卡片 */}
            <CharCard char={currentChar} fontSize={fontSize} />

            {/* 笔画动画播放器 */}
            <StrokePlayer char={currentChar.character} />
          </div>

          {/* 可视化图片展示 */}
          <VisualizeSection char={currentChar.character} />

          {/* 收藏操作 */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs">
              <SaveToBookButton char={currentChar.character} />
            </div>
          </div>
        </div>
      ) : !isSearching && !searchError ? (
        /* 空状态引导 */
        <div
          className="text-center py-20 space-y-4"
          role="status"
          aria-label="请搜索汉字开始学习"
        >
          <div className="text-[5rem] font-bold text-muted-foreground/20 leading-none select-none" aria-hidden="true">
            字
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-muted-foreground">
              输入一个汉字，开始学习之旅
            </p>
            <p className="text-sm text-muted-foreground/70">
              可查看拼音、笔画、释义、例词，并播放笔画书写动画
            </p>
          </div>

          {/* 推荐常见汉字快捷入口 */}
          <div
            className="flex flex-wrap gap-2 justify-center pt-4"
            role="group"
            aria-label="推荐汉字"
          >
            {['人', '山', '水', '日', '月', '木', '火', '土'].map((ch) => (
              <button
                key={ch}
                onClick={() => handleSearch(ch)}
                aria-label={`搜索汉字"${ch}"`}
                className={cn(
                  'w-12 h-12 rounded-lg border border-border bg-background',
                  'text-xl font-bold hover:border-primary hover:text-primary',
                  'transition-all focus:outline-none focus:ring-2 focus:ring-ring',
                  'hover:shadow-sm active:scale-95'
                )}
              >
                {ch}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">点击上方常见汉字快速体验</p>
        </div>
      ) : null}
    </div>
  )
}
