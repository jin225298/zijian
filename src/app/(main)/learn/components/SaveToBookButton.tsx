'use client'

import { useState, useEffect } from 'react'
import { BookmarkPlus, BookmarkCheck, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ApiResponse, WordbookDTO } from '@/types'

interface SaveToBookButtonProps {
  char: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function SaveToBookButton({ char }: SaveToBookButtonProps) {
  const [wordbooks, setWordbooks] = useState<WordbookDTO[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedBookName, setSavedBookName] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loadingBooks, setLoadingBooks] = useState(false)

  // 获取字书列表
  useEffect(() => {
    const fetchWordbooks = async () => {
      setLoadingBooks(true)
      try {
        const res = await fetch('/api/v1/wordbooks', {
          credentials: 'include',
        })
        if (!res.ok) return
        const json: ApiResponse<{ items: WordbookDTO[] }> = await res.json()
        if (json.code === 0) {
          setWordbooks(json.data?.items ?? [])
        }
      } catch {
        // 静默失败，不影响主要功能
      } finally {
        setLoadingBooks(false)
      }
    }

    fetchWordbooks()
  }, [])

  // 保存到指定字书
  const saveToBook = async (wordbook: WordbookDTO) => {
    setIsDropdownOpen(false)
    setSaveState('saving')
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/v1/wordbooks/${wordbook.id}/items`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: char }),
      })

      const json: ApiResponse<unknown> = await res.json()

      if (!res.ok || json.code !== 0) {
        // 40003: 已在字书中
        if (json.code === 40003) {
          setSaveState('saved')
          setSavedBookName(wordbook.name)
          return
        }
        throw new Error(json.message ?? '保存失败')
      }

      setSaveState('saved')
      setSavedBookName(wordbook.name)

      // 3秒后重置为 idle，允许再次操作
      setTimeout(() => {
        setSaveState('idle')
        setSavedBookName(null)
      }, 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败，请重试'
      setErrorMsg(msg)
      setSaveState('error')
      setTimeout(() => {
        setSaveState('idle')
        setErrorMsg(null)
      }, 3000)
    }
  }

  const isSaved = saveState === 'saved'
  const isSaving = saveState === 'saving'
  const isError = saveState === 'error'

  return (
    <div className="relative">
      <div className="flex rounded-lg overflow-hidden border border-input">
        {/* 主按钮 */}
        <Button
          variant={isSaved ? 'default' : 'outline'}
          size="md"
          disabled={isSaving || isSaved}
          onClick={() => {
            if (wordbooks.length === 1) {
              saveToBook(wordbooks[0])
            } else {
              setIsDropdownOpen((v) => !v)
            }
          }}
          aria-label={
            isSaving
              ? `正在保存"${char}"到识字库`
              : isSaved
              ? `"${char}"已保存到${savedBookName ?? '识字库'}`
              : `保存"${char}"到识字库`
          }
          aria-pressed={isSaved}
          className={cn(
            'rounded-none border-0 flex-1 gap-2',
            isError && 'text-destructive border-destructive'
          )}
        >
          {isSaving ? (
            <>
              <span
                className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
              保存中…
            </>
          ) : isSaved ? (
            <>
              <BookmarkCheck className="w-4 h-4" aria-hidden="true" />
              已收藏
            </>
          ) : isError ? (
            <>
              <span aria-hidden="true">⚠</span>
              保存失败
            </>
          ) : (
            <>
              <BookmarkPlus className="w-4 h-4" aria-hidden="true" />
              收藏到识字库
            </>
          )}
        </Button>

        {/* 下拉触发按钮（多字书时显示） */}
        {wordbooks.length > 1 && !isSaved && !isSaving && (
          <button
            type="button"
            onClick={() => setIsDropdownOpen((v) => !v)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="listbox"
            aria-label="选择识字库"
            className={cn(
              'px-2 border-l border-input bg-background hover:bg-accent transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
          >
            <ChevronDown
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform',
                isDropdownOpen && 'rotate-180'
              )}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {/* 下拉菜单 */}
      {isDropdownOpen && wordbooks.length > 1 && (
        <>
          {/* 点击外部关闭 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsDropdownOpen(false)}
            aria-hidden="true"
          />
          <div
            role="listbox"
            aria-label="选择要保存到的识字库"
            className={cn(
              'absolute right-0 top-full mt-1 z-20',
              'w-56 rounded-lg border border-border bg-popover shadow-md',
              'py-1 overflow-hidden'
            )}
          >
            {loadingBooks ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                加载中…
              </div>
            ) : wordbooks.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                暂无识字库，请先创建
              </div>
            ) : (
              wordbooks.map((book) => (
                <button
                  key={book.id}
                  role="option"
                  aria-selected={false}
                  onClick={() => saveToBook(book)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 flex items-center justify-between gap-2',
                    'text-sm hover:bg-accent transition-colors',
                    'focus:outline-none focus:bg-accent'
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: book.coverColor }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{book.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {book.charCount} 字
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {/* 成功 / 错误提示 */}
      {(isSaved || isError) && (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            'mt-1.5 text-xs text-center',
            isSaved ? 'text-emerald-600' : 'text-destructive'
          )}
        >
          {isSaved && savedBookName && (
            <>
              <Check className="inline w-3 h-3 mr-0.5" aria-hidden="true" />
              已收藏到「{savedBookName}」
            </>
          )}
          {isError && `⚠ ${errorMsg}`}
        </p>
      )}
    </div>
  )
}
