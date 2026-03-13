'use client'

import { useState } from 'react'
import { BookOpen, MoreVertical, Pencil, Trash2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WordbookDTO } from '@/types'

interface WordbookCardProps {
  wordbook: WordbookDTO
  onRename?: (id: string, currentName: string) => void
  onDelete?: (id: string, name: string) => void
}

export function WordbookCard({ wordbook, onRename, onDelete }: WordbookCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="relative group rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      {/* 封面色带 */}
      <div
        className="h-2 w-full flex-shrink-0"
        style={{ backgroundColor: wordbook.coverColor }}
      />

      <div className="flex flex-col flex-1 p-5">
        {/* 标题行 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <h3 className="font-semibold text-base truncate" title={wordbook.name}>
              {wordbook.name}
            </h3>
          </div>

          {/* 更多菜单按钮 */}
          <div className="relative flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((v) => !v)
              }}
              aria-label="更多操作"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>

            {menuOpen && (
              <>
                {/* 点击外部关闭 */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-lg border border-border bg-popover shadow-lg py-1 text-sm">
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-accent text-foreground transition-colors"
                    onClick={() => {
                      setMenuOpen(false)
                      onRename?.(wordbook.id, wordbook.name)
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    重命名
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-destructive/10 text-destructive transition-colors"
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete?.(wordbook.id, wordbook.name)
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 汉字数量 */}
        <p className="text-sm text-muted-foreground mt-2">
          共 <span className="font-medium text-foreground">{wordbook.charCount}</span> 个汉字
        </p>

        {/* 创建时间 */}
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(wordbook.createdAt).toLocaleDateString('zh-CN')} 创建
        </p>

        {/* 进入详情按钮 */}
        <div className="mt-4 pt-4 border-t border-border">
          <a
            href={`/wordbooks/${wordbook.id}`}
            className={cn(
              'flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium',
              'bg-primary/5 hover:bg-primary/10 text-primary transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
            aria-label={`进入识字库"${wordbook.name}"`}
          >
            <span>进入识字库</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}
