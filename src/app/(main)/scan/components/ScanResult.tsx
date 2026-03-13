'use client'

import { useState, useEffect } from 'react'
import {
  BookmarkPlus,
  BookmarkCheck,
  ChevronDown,
  Check,
  Clock,
  BarChart2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ApiResponse, ScanResultDTO, ScanRecordDTO, WordbookDTO } from '@/types'

// ================================
// 类型定义
// ================================

interface ScanResultProps {
  result: ScanResultDTO | null
  isLoading: boolean
  history: ScanRecordDTO[]
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ================================
// 组件实现
// ================================

export function ScanResult({ result, isLoading, history }: ScanResultProps) {
  const [activeTab, setActiveTab] = useState<'result' | 'history'>('result')

  // 切换到结果 Tab（新结果进来时）
  useEffect(() => {
    if (result) setActiveTab('result')
  }, [result])

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Tab 切换 */}
      <div
        role="tablist"
        aria-label="识别结果和历史"
        className="flex border-b border-border"
      >
        {([
          { key: 'result', label: '识别结果' },
          { key: 'history', label: `识别历史 (${history.length})` },
        ] as { key: 'result' | 'history'; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors relative',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset',
              activeTab === key
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
            {activeTab === key && (
              <span
                className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>

      {/* 识别结果 Tab */}
      {activeTab === 'result' && (
        <div role="tabpanel" aria-label="识别结果">
          {isLoading && <ResultSkeleton />}
          {!isLoading && !result && <ResultEmpty />}
          {!isLoading && result && <ResultDetail result={result} />}
        </div>
      )}

      {/* 识别历史 Tab */}
      {activeTab === 'history' && (
        <div role="tabpanel" aria-label="识别历史">
          <HistoryList history={history} />
        </div>
      )}
    </div>
  )
}

// --------------------------------
// 加载骨架屏
// --------------------------------
function ResultSkeleton() {
  return (
    <div
      role="status"
      aria-label="正在识别，请稍候"
      aria-live="polite"
      className="space-y-4 animate-pulse"
    >
      {/* 大字骨架 */}
      <div className="flex justify-center">
        <div className="w-36 h-36 rounded-2xl bg-muted" />
      </div>
      {/* 信息骨架 */}
      <div className="space-y-2">
        <div className="h-5 bg-muted rounded w-24 mx-auto" />
        <div className="h-4 bg-muted rounded w-40 mx-auto" />
        <div className="h-4 bg-muted rounded w-32 mx-auto" />
      </div>
      <span className="sr-only">正在识别汉字，请稍候…</span>
    </div>
  )
}

// --------------------------------
// 空状态
// --------------------------------
function ResultEmpty() {
  return (
    <div
      role="status"
      aria-label="等待拍照识别"
      className="py-12 text-center space-y-3"
    >
      <div className="text-[5rem] font-bold text-muted-foreground/15 leading-none select-none" aria-hidden="true">
        字
      </div>
      <p className="text-muted-foreground text-sm">拍照后，识别结果将显示在这里</p>
    </div>
  )
}

// --------------------------------
// 识别结果详情
// --------------------------------
function ResultDetail({ result }: { result: ScanResultDTO }) {
  const [wordbooks, setWordbooks] = useState<WordbookDTO[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedBookName, setSavedBookName] = useState<string | null>(null)
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null)
  const [loadingBooks, setLoadingBooks] = useState(false)

  const firstChar = result.chars[0]

  // 拉取字书列表
  useEffect(() => {
    const fetchWordbooks = async () => {
      setLoadingBooks(true)
      try {
        const res = await fetch('/api/v1/wordbooks', { credentials: 'include' })
        if (!res.ok) return
        const json: ApiResponse<{ items: WordbookDTO[] }> = await res.json()
        if (json.code === 0) setWordbooks(json.data?.items ?? [])
      } catch {
        // 静默失败
      } finally {
        setLoadingBooks(false)
      }
    }
    fetchWordbooks()
  }, [])

  // 保存到字书
  const saveToBook = async (wordbook: WordbookDTO) => {
    if (!firstChar) return
    setIsDropdownOpen(false)
    setSaveState('saving')
    setSaveErrorMsg(null)

    try {
      const res = await fetch(`/api/v1/wordbooks/${wordbook.id}/items`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: firstChar.character }),
      })
      const json: ApiResponse<unknown> = await res.json()

      if (!res.ok || json.code !== 0) {
        if (json.code === 40003) {
          setSaveState('saved')
          setSavedBookName(wordbook.name)
          return
        }
        throw new Error(json.message ?? '保存失败')
      }

      setSaveState('saved')
      setSavedBookName(wordbook.name)
      setTimeout(() => {
        setSaveState('idle')
        setSavedBookName(null)
      }, 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败，请重试'
      setSaveErrorMsg(msg)
      setSaveState('error')
      setTimeout(() => {
        setSaveState('idle')
        setSaveErrorMsg(null)
      }, 3000)
    }
  }

  if (!firstChar) return null

  const isSaved = saveState === 'saved'
  const isSaving = saveState === 'saving'
  const isError = saveState === 'error'

  // 置信度颜色
  const confidenceColor =
    result.confidence >= 0.9
      ? 'text-emerald-600'
      : result.confidence >= 0.7
      ? 'text-amber-600'
      : 'text-destructive'

  const confidenceLabel =
    result.confidence >= 0.9
      ? '高'
      : result.confidence >= 0.7
      ? '中'
      : '低'

  return (
    <div
      className="space-y-5"
      role="region"
      aria-label={`识别到汉字"${firstChar.character}"`}
      aria-live="polite"
    >
      {/* 汉字大字展示 */}
      <div className="flex justify-center">
        <div
          className={cn(
            'w-36 h-36 rounded-2xl',
            'bg-primary/8 border-2 border-primary/20',
            'flex items-center justify-center',
            'shadow-inner'
          )}
          aria-label={`识别结果：${firstChar.character}`}
        >
          <span
            className="text-8xl font-bold text-primary leading-none select-none"
            aria-hidden="true"
          >
            {firstChar.character}
          </span>
        </div>
      </div>

      {/* 拼音 */}
      {firstChar.pinyin.length > 0 && (
        <div className="text-center">
          <span
            className="text-2xl text-muted-foreground font-medium tracking-widest"
            aria-label={`拼音：${firstChar.pinyin.join('，')}`}
          >
            {firstChar.pinyin.join('  ')}
          </span>
        </div>
      )}

      {/* 详情信息 */}
      <div className="space-y-2 text-sm">
        {firstChar.meaning && (
          <div className="flex gap-2">
            <span className="text-muted-foreground w-12 shrink-0">释义</span>
            <span
              className="text-foreground flex-1"
              aria-label={`释义：${firstChar.meaning}`}
            >
              {firstChar.meaning}
            </span>
          </div>
        )}
        {firstChar.radical && (
          <div className="flex gap-2">
            <span className="text-muted-foreground w-12 shrink-0">部首</span>
            <span className="text-foreground" aria-label={`部首：${firstChar.radical}`}>
              {firstChar.radical}
            </span>
          </div>
        )}
        {firstChar.strokeCount > 0 && (
          <div className="flex gap-2">
            <span className="text-muted-foreground w-12 shrink-0">笔画</span>
            <span className="text-foreground" aria-label={`笔画：${firstChar.strokeCount}画`}>
              {firstChar.strokeCount} 画
            </span>
          </div>
        )}
        {firstChar.examples.length > 0 && (
          <div className="flex gap-2">
            <span className="text-muted-foreground w-12 shrink-0">例词</span>
            <span className="text-foreground" aria-label={`例词：${firstChar.examples.join('，')}`}>
              {firstChar.examples.slice(0, 3).join('、')}
            </span>
          </div>
        )}
      </div>

      {/* 置信度 */}
      <div
        className="flex items-center gap-2 text-sm"
        aria-label={`识别置信度：${confidenceLabel}（${Math.round(result.confidence * 100)}%）`}
      >
        <BarChart2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">置信度</span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              result.confidence >= 0.9
                ? 'bg-emerald-500'
                : result.confidence >= 0.7
                ? 'bg-amber-500'
                : 'bg-destructive'
            )}
            style={{ width: `${Math.round(result.confidence * 100)}%` }}
            aria-hidden="true"
          />
        </div>
        <span className={cn('font-medium text-xs', confidenceColor)}>
          {confidenceLabel} ({Math.round(result.confidence * 100)}%)
        </span>
      </div>

      {/* 保存到识字库 */}
      <div>
        <div className="flex rounded-lg overflow-hidden border border-input">
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
                ? `正在保存"${firstChar.character}"到识字库`
                : isSaved
                ? `"${firstChar.character}"已保存到${savedBookName ?? '识字库'}`
                : `保存"${firstChar.character}"到识字库`
            }
            aria-pressed={isSaved}
            className={cn(
              'rounded-none border-0 flex-1 gap-2',
              isError && 'text-destructive'
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

          {wordbooks.length > 1 && !isSaved && !isSaving && (
            <button
              type="button"
              onClick={() => setIsDropdownOpen((v) => !v)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
              aria-label="选择识字库"
              className="px-2 border-l border-input bg-background hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
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

        {/* 字书下拉菜单 */}
        {isDropdownOpen && wordbooks.length > 1 && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsDropdownOpen(false)}
              aria-hidden="true"
            />
            <div
              role="listbox"
              aria-label="选择识字库"
              className="absolute z-20 mt-1 w-56 rounded-lg border border-border bg-popover shadow-md py-1 overflow-hidden"
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
                    className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 text-sm hover:bg-accent transition-colors focus:outline-none focus:bg-accent"
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

        {/* 保存反馈 */}
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
            {isError && `⚠ ${saveErrorMsg}`}
          </p>
        )}
      </div>
    </div>
  )
}

// --------------------------------
// 识别历史列表
// --------------------------------
function HistoryList({ history }: { history: ScanRecordDTO[] }) {
  if (history.length === 0) {
    return (
      <div
        role="status"
        aria-label="暂无识别历史"
        className="py-12 text-center text-muted-foreground text-sm"
      >
        <Clock className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" aria-hidden="true" />
        <p>暂无识别历史</p>
        <p className="text-xs mt-1 text-muted-foreground/60">识别汉字后，记录将显示在这里</p>
      </div>
    )
  }

  return (
    <div role="list" aria-label="识别历史记录" className="space-y-2">
      {history.map((record) => (
        <div
          key={record.id}
          role="listitem"
          className={cn(
            'flex items-center gap-4 px-4 py-3 rounded-lg',
            'border border-border bg-card hover:bg-accent/30 transition-colors'
          )}
          aria-label={`识别到"${record.rawText}"，置信度 ${Math.round((record.confidence ?? 0) * 100)}%`}
        >
          {/* 汉字 */}
          <span
            className="text-3xl font-bold text-primary w-10 text-center leading-none"
            aria-hidden="true"
          >
            {record.rawText}
          </span>

          {/* 元信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              <time dateTime={record.createdAt}>
                {new Date(record.createdAt).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              {record.confidence != null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    className={cn(
                      record.confidence >= 0.9
                        ? 'text-emerald-600'
                        : record.confidence >= 0.7
                        ? 'text-amber-600'
                        : 'text-destructive'
                    )}
                  >
                    {Math.round(record.confidence * 100)}%
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 状态徽章 */}
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              record.status === 'COMPLETED'
                ? 'bg-emerald-100 text-emerald-700'
                : record.status === 'FAILED'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground'
            )}
            aria-label={`状态：${record.status === 'COMPLETED' ? '已完成' : record.status === 'FAILED' ? '失败' : '处理中'}`}
          >
            {record.status === 'COMPLETED'
              ? '已完成'
              : record.status === 'FAILED'
              ? '失败'
              : '处理中'}
          </span>
        </div>
      ))}
    </div>
  )
}
