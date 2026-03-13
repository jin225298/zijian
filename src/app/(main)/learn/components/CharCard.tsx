'use client'

import { BookOpen, Hash, Layers } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CharDTO } from '@/types'

interface CharCardProps {
  char: CharDTO
  fontSize?: 'base' | 'lg' | 'xl' | '2xl'
}

const FONT_SIZE_MAP = {
  base: 'text-7xl',
  lg: 'text-8xl',
  xl: 'text-[7rem]',
  '2xl': 'text-[9rem]',
}

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: '入门',
  ELEMENTARY: '初级',
  INTERMEDIATE: '中级',
  ADVANCED: '高级',
}

const LEVEL_COLOR: Record<string, string> = {
  BEGINNER: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ELEMENTARY: 'bg-blue-100 text-blue-700 border-blue-200',
  INTERMEDIATE: 'bg-amber-100 text-amber-700 border-amber-200',
  ADVANCED: 'bg-rose-100 text-rose-700 border-rose-200',
}

export function CharCard({ char, fontSize = 'base' }: CharCardProps) {
  return (
    <Card
      className="overflow-hidden"
      role="region"
      aria-label={`汉字"${char.character}"的详细信息`}
    >
      <CardContent className="p-0">
        {/* 顶部：大字展示区 */}
        <div className="bg-gradient-to-br from-primary/5 via-background to-secondary/20 p-8 flex flex-col items-center gap-3 border-b border-border">
          <span
            className={cn(
              FONT_SIZE_MAP[fontSize],
              'font-bold leading-none select-none text-foreground',
              'transition-all duration-300'
            )}
            aria-label={`汉字：${char.character}`}
            lang="zh-CN"
          >
            {char.character}
          </span>

          {/* 拼音 */}
          <div
            className="text-xl text-primary font-medium tracking-widest"
            aria-label={`拼音：${char.pinyin.join('，')}`}
          >
            {char.pinyin.join(' / ')}
          </div>

          {/* 等级标签 */}
          <span
            className={cn(
              'text-xs px-2.5 py-0.5 rounded-full border font-medium',
              LEVEL_COLOR[char.level] ?? 'bg-muted text-muted-foreground border-border'
            )}
            aria-label={`难度等级：${LEVEL_LABEL[char.level] ?? char.level}`}
          >
            {LEVEL_LABEL[char.level] ?? char.level}
          </span>
        </div>

        {/* 信息网格 */}
        <div className="p-6 space-y-5">
          {/* 笔画 & 部首 */}
          <div className="grid grid-cols-2 gap-4">
            <div
              className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
              aria-label={`笔画数：${char.strokeCount}`}
            >
              <Hash className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">笔画</p>
                <p className="text-lg font-semibold">{char.strokeCount} 画</p>
              </div>
            </div>

            <div
              className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
              aria-label={`部首：${char.radical ?? '未知'}`}
            >
              <Layers className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">部首</p>
                <p className="text-lg font-semibold">{char.radical ?? '—'}</p>
              </div>
            </div>
          </div>

          {/* 释义 */}
          {char.meaning && (
            <section aria-label="释义">
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                释义
              </h3>
              <p className="text-[18px] leading-relaxed text-foreground bg-muted/30 rounded-lg p-3">
                {char.meaning}
              </p>
            </section>
          )}

          {/* 例词 */}
          {char.examples && char.examples.length > 0 && (
            <section aria-label="例词">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">例词</h3>
              <ul className="flex flex-wrap gap-2" role="list">
                {char.examples.map((example, i) => (
                  <li key={i}>
                    <span className="inline-block px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-[18px] font-medium">
                      {example}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
