'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  LayoutGrid,
  List,
  RefreshCw,
  PlayCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CharListItem } from '../components/CharListItem'
import { ProgressStats } from '../components/ProgressStats'
import { LoadingSpinner } from '@/components/shared'
import { cn } from '@/lib/utils'
import type { ApiResponse, WordbookDTO } from '@/types'
import type { WordBookItemDTO, WordBookStatsDTO } from '@/server/services/wordbook.service'

// ================================
// 类型
// ================================

type FilterStatus = 'all' | 'learning' | 'mastered'
type SortField = 'created_at' | 'mastery_level' | 'next_review_at'
type ViewMode = 'grid' | 'list'

interface ItemsResponse {
  items: WordBookItemDTO[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ================================
// 状态筛选 Tab
// ================================

const STATUS_TABS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'learning', label: '学习中' },
  { value: 'mastered', label: '已掌握' },
]

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'created_at', label: '加入时间' },
  { value: 'mastery_level', label: '掌握程度' },
  { value: 'next_review_at', label: '复习时间' },
]

// ================================
// 主页面
// ================================

export default function WordbookDetailPage() {
  const params = useParams()
  const router = useRouter()
  const bookId = params.id as string

  // 识字库基本信息
  const [wordbook, setWordbook] = useState<WordbookDTO | null>(null)

  // 汉字列表
  const [items, setItems] = useState<WordBookItemDTO[]>([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [isLoadingItems, setIsLoadingItems] = useState(true)
  const [itemsError, setItemsError] = useState<string | null>(null)

  // 统计数据
  const [stats, setStats] = useState<WordBookStatsDTO | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)

  // 待复习数量
  const [reviewCount, setReviewCount] = useState<number>(0)

  // 筛选 / 排序 / 视图
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [currentPage, setCurrentPage] = useState(1)

  // ---- 加载识字库基础信息（从列表接口获取） ----
  const loadWordbook = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/wordbooks', { credentials: 'include' })
      const json: ApiResponse<{ items: WordbookDTO[] }> = await res.json()
      if (res.ok && json.code === 0) {
        const found = json.data.items.find((w) => w.id === bookId)
        setWordbook(found ?? null)
      }
    } catch {
      // 忽略，仅影响名称显示
    }
  }, [bookId])

  // ---- 加载汉字列表 ----
  const loadItems = useCallback(async (page = 1) => {
    setIsLoadingItems(true)
    setItemsError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        status: filterStatus,
        sort: sortField,
      })
      const res = await fetch(`/api/v1/wordbooks/${bookId}/items?${params}`, {
        credentials: 'include',
      })
      const json: ApiResponse<ItemsResponse> = await res.json()
      if (!res.ok || json.code !== 0) {
        setItemsError(json.message ?? '加载失败')
        return
      }
      setItems(json.data.items)
      setPagination({
        page: json.data.pagination.page,
        total: json.data.pagination.total,
        totalPages: json.data.pagination.totalPages,
      })
    } catch {
      setItemsError('网络异常，请检查连接后重试')
    } finally {
      setIsLoadingItems(false)
    }
  }, [bookId, filterStatus, sortField])

  // ---- 加载统计数据 ----
  const loadStats = useCallback(async () => {
    setIsLoadingStats(true)
    try {
      const res = await fetch(`/api/v1/wordbooks/${bookId}/stats`, { credentials: 'include' })
      const json: { success: boolean; data: WordBookStatsDTO } = await res.json()
      if (res.ok && json.success) {
        setStats(json.data)
      }
    } catch {
      // 忽略统计加载失败
    } finally {
      setIsLoadingStats(false)
    }
  }, [bookId])

  // ---- 加载待复习数量 ----
  const loadReviewCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/wordbooks/${bookId}/review`, { credentials: 'include' })
      const json: { success: boolean; data: { total: number } } = await res.json()
      if (res.ok && json.success) {
        setReviewCount(json.data.total)
      }
    } catch {
      // 忽略
    }
  }, [bookId])

  // 初始化加载
  useEffect(() => {
    loadWordbook()
    loadStats()
    loadReviewCount()
  }, [loadWordbook, loadStats, loadReviewCount])

  // 筛选/排序/翻页变化时重新加载
  useEffect(() => {
    setCurrentPage(1)
    loadItems(1)
  }, [filterStatus, sortField]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadItems(currentPage)
  }, [currentPage]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleLearn = (character: string) => {
    router.push(`/learn?char=${encodeURIComponent(character)}`)
  }

  return (
    <div className="space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 text-muted-foreground"
          onClick={() => router.push('/wordbooks')}
          aria-label="返回识字库列表"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回</span>
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-lg font-semibold truncate">
          {wordbook?.name ?? '识字库'}
        </h1>
      </div>

      {/* 统计数据 */}
      {isLoadingStats ? (
        <div className="h-32 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : stats ? (
        <ProgressStats stats={stats} />
      ) : null}

      {/* 操作栏：复习入口 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            今日待复习：
            <span className={cn('font-semibold', reviewCount > 0 ? 'text-primary' : 'text-muted-foreground')}>
              {reviewCount} 个
            </span>
          </span>
        </div>
        <Button
          onClick={() => router.push(`/wordbooks/${bookId}/review`)}
          disabled={reviewCount === 0}
          className="flex items-center gap-2"
          aria-label={reviewCount > 0 ? `开始复习 ${reviewCount} 个汉字` : '暂无待复习汉字'}
        >
          <PlayCircle className="w-4 h-4" />
          开始复习 {reviewCount > 0 ? `(${reviewCount})` : ''}
        </Button>
      </div>

      {/* 汉字列表区 */}
      <div className="space-y-4">
        {/* 工具栏 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* 状态筛选 */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1" role="tablist" aria-label="状态筛选">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={filterStatus === tab.value}
                onClick={() => setFilterStatus(tab.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  filterStatus === tab.value
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 右侧：排序 + 视图切换 */}
          <div className="flex items-center gap-2">
            {/* 排序 */}
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="text-sm border border-border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="排序方式"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* 视图切换 */}
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5 transition-colors',
                  viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                )}
                aria-label="列表视图"
                aria-pressed={viewMode === 'list'}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 transition-colors',
                  viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                )}
                aria-label="卡片视图"
                aria-pressed={viewMode === 'grid'}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* 刷新 */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => loadItems(currentPage)}
              aria-label="刷新列表"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 列表内容 */}
        {isLoadingItems ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : itemsError ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 py-12 text-center border border-destructive/20 rounded-xl bg-destructive/5"
          >
            <p className="text-destructive">{itemsError}</p>
            <Button variant="outline" size="sm" onClick={() => loadItems(currentPage)}>重新加载</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <span className="text-5xl">📚</span>
            <p className="font-medium">
              {filterStatus === 'all' ? '识字库暂无汉字' : '此分类暂无汉字'}
            </p>
            {filterStatus !== 'all' && (
              <Button variant="outline" size="sm" onClick={() => setFilterStatus('all')}>
                查看全部
              </Button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          /* 列表视图 */
          <div className="space-y-2" role="list" aria-label="汉字列表">
            {items.map((item) => (
              <div key={item.id} role="listitem">
                <CharListItem item={item} onLearn={handleLearn} />
              </div>
            ))}
          </div>
        ) : (
          /* 卡片视图（网格） */
          <div
            className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
            role="list"
            aria-label="汉字卡片"
          >
            {items.map((item) => (
              <div key={item.id} role="listitem">
                <button
                  onClick={() => handleLearn(item.character)}
                  className={cn(
                    'w-full aspect-square flex flex-col items-center justify-center gap-1',
                    'rounded-xl border-2 border-border bg-card hover:border-primary/40',
                    'hover:bg-primary/5 transition-all text-2xl font-bold',
                    'focus:outline-none focus:ring-2 focus:ring-ring',
                    item.mastery_level >= 5 && 'border-green-200 bg-green-50 text-green-700'
                  )}
                  aria-label={`汉字"${item.character}"，掌握等级${item.mastery_level}`}
                >
                  {item.character}
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          i < item.mastery_level ? 'bg-primary' : 'bg-muted'
                        )}
                      />
                    ))}
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {pagination.totalPages > 1 && (
          <div
            className="flex items-center justify-center gap-2 pt-4"
            role="navigation"
            aria-label="翻页"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="上一页"
            >
              上一页
            </Button>

            {/* 页码按钮 */}
            {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
              // 计算显示的页码（当前页居中）
              let startPage = Math.max(1, currentPage - 2)
              const endPage = Math.min(pagination.totalPages, startPage + 4)
              startPage = Math.max(1, endPage - 4)
              const page = startPage + i
              if (page > pagination.totalPages) return null

              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={cn(
                    'w-8 h-8 rounded-md text-sm font-medium transition-colors',
                    page === currentPage
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-muted-foreground'
                  )}
                  aria-label={`第 ${page} 页`}
                  aria-current={page === currentPage ? 'page' : undefined}
                >
                  {page}
                </button>
              )
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= pagination.totalPages}
              aria-label="下一页"
            >
              下一页
            </Button>

            <span className="text-xs text-muted-foreground ml-2">
              共 {pagination.total} 个
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
