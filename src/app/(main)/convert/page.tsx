'use client'

import { useState, useCallback } from 'react'
import { History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConvertInput, type ConvertContext } from './components/ConvertInput'
import { ConvertResult, type ConvertResultData } from './components/ConvertResult'
import { ConvertHistory, type HistoryItem } from './components/ConvertHistory'

// ==========================================
// 本地历史记录 Hook
// ==========================================

const HISTORY_KEY = 'zijing_convert_history'
const MAX_HISTORY = 20

function useConvertHistory() {
  const [items, setItems] = useState<HistoryItem[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      return raw ? (JSON.parse(raw) as HistoryItem[]) : []
    } catch {
      return []
    }
  })

  const addItem = useCallback((item: HistoryItem) => {
    setItems((prev) => {
      // 去重：相同 inputText + context 只保留最新一条
      const filtered = prev.filter(
        (h) => !(h.inputText === item.inputText && h.context === item.context)
      )
      const next = [item, ...filtered].slice(0, MAX_HISTORY)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        // 忽略存储失败
      }
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch {
      // 忽略
    }
  }, [])

  return { items, addItem, clearAll }
}

// ==========================================
// ConvertPage — 主页面
// ==========================================

export default function ConvertPage() {
  // ---------- 输入状态 ----------
  const [inputText, setInputText] = useState('')
  const [context, setContext] = useState<ConvertContext>('daily')

  // ---------- 转换状态 ----------
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ConvertResultData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ---------- 历史记录 ----------
  const { items: historyItems, addItem, clearAll } = useConvertHistory()
  const [showHistory, setShowHistory] = useState(false)

  // ==========================================
  // 转换处理
  // ==========================================

  const handleConvert = useCallback(async () => {
    const text = inputText.trim()
    if (!text) return

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/v1/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text, context }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        const msg = json.message ?? json.error ?? '转换失败，请稍后重试'
        setError(msg)
        return
      }

      const data = json.data as ConvertResultData
      setResult(data)

      // 记录历史
      const historyItem: HistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        inputText: text,
        outputText: data.converted,
        context,
        confidence: data.confidence,
        createdAt: new Date().toISOString(),
      }
      addItem(historyItem)
    } catch {
      setError('网络异常，请检查连接后重试')
    } finally {
      setIsLoading(false)
    }
  }, [inputText, context, addItem])

  // ==========================================
  // 历史记录复用
  // ==========================================

  const handleReuseHistory = useCallback((item: HistoryItem) => {
    setInputText(item.inputText)
    setContext(item.context)
    setResult(null)
    setError(null)
    setShowHistory(false)
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // ==========================================
  // 渲染
  // ==========================================

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* 页面标题栏 */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">语言转换</h1>
          <p className="text-muted-foreground text-sm mt-1">
            将手语式中文转换为标准书面语，支持日常、学术、公文三种场景
          </p>
        </div>

        {/* 历史记录切换按钮 */}
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          aria-controls="history-panel"
          aria-label={showHistory ? '收起历史记录' : '展开历史记录'}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium',
            'transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            showHistory
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-input hover:border-primary/50 hover:bg-accent/50'
          )}
        >
          <History className="w-4 h-4" aria-hidden="true" />
          历史记录
          {historyItems.length > 0 && (
            <span
              className={cn(
                'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold',
                showHistory
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-primary/10 text-primary'
              )}
              aria-label={`${historyItems.length} 条记录`}
            >
              {historyItems.length}
            </span>
          )}
        </button>
      </div>

      {/* 主内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：输入 & 结果（占2列） */}
        <div className="lg:col-span-2 space-y-6">
          {/* 输入区域 */}
          <section
            aria-label="输入区域"
            className="p-6 rounded-xl border bg-card shadow-sm space-y-4"
          >
            <h2 className="text-base font-semibold">
              输入手语式中文
            </h2>
            <ConvertInput
              value={inputText}
              onChange={setInputText}
              context={context}
              onContextChange={setContext}
              onConvert={handleConvert}
              isLoading={isLoading}
            />
          </section>

          {/* 错误提示 */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg',
                'border border-destructive/30 bg-destructive/5 text-destructive text-sm'
              )}
            >
              <span aria-hidden="true" className="text-lg shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* 转换结果 */}
          {result && (
            <section
              aria-label="转换结果区域"
              className="p-6 rounded-xl border bg-card shadow-sm"
            >
              <h2 className="text-base font-semibold mb-4">转换结果</h2>
              <ConvertResult result={result} />
            </section>
          )}

          {/* 空状态引导（未输入时） */}
          {!result && !error && !isLoading && (
            <div
              role="status"
              aria-label="等待输入"
              className="text-center py-16 space-y-3"
            >
              <div
                className="text-[4rem] font-bold text-muted-foreground/15 leading-none select-none"
                aria-hidden="true"
              >
                转
              </div>
              <p className="text-muted-foreground text-sm">
                输入手语式中文，选择场景，点击「开始转换」
              </p>
              <p className="text-xs text-muted-foreground/60">
                示例：<span className="font-mono bg-muted px-1.5 py-0.5 rounded">我 昨天 去 医院 看 病</span>
              </p>
            </div>
          )}
        </div>

        {/* 右侧：历史记录面板（占1列） */}
        <aside
          id="history-panel"
          aria-label="历史记录面板"
          className={cn(
            'lg:col-span-1',
            'p-6 rounded-xl border bg-card shadow-sm',
            // 移动端：根据 showHistory 决定是否显示
            showHistory ? 'block' : 'hidden lg:block'
          )}
        >
          <h2 className="text-base font-semibold mb-4">历史记录</h2>
          <ConvertHistory
            items={historyItems}
            onReuse={handleReuseHistory}
            onClear={clearAll}
          />
        </aside>
      </div>
    </div>
  )
}
