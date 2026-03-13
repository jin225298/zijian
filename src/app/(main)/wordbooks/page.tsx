'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WordbookCard } from './components/WordbookCard'
import { LoadingSpinner } from '@/components/shared'
import { cn } from '@/lib/utils'
import type { WordbookDTO, ApiResponse } from '@/types'

// ================================
// 创建识字库弹窗
// ================================

interface CreateDialogProps {
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

function CreateDialog({ onClose, onCreate }: CreateDialogProps) {
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('识字库名称不能为空')
      return
    }
    if (trimmed.length > 100) {
      setError('名称最长 100 个字符')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      await onCreate(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="create-dialog-title" className="text-lg font-semibold">创建识字库</h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose} aria-label="关闭">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="识字库名称"
            placeholder="例：常用汉字、日常生活..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error ?? undefined}
            autoFocus
            maxLength={100}
          />
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              取消
            </Button>
            <Button type="submit" isLoading={isLoading}>
              创建
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ================================
// 重命名弹窗
// ================================

interface RenameDialogProps {
  wordbookId: string
  currentName: string
  onClose: () => void
  onRename: (id: string, name: string) => Promise<void>
}

function RenameDialog({ wordbookId, currentName, onClose, onRename }: RenameDialogProps) {
  const [name, setName] = useState(currentName)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('识字库名称不能为空')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      await onRename(wordbookId, trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '重命名失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="rename-dialog-title" className="text-lg font-semibold">重命名识字库</h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose} aria-label="关闭">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="新名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error ?? undefined}
            autoFocus
            maxLength={100}
          />
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>取消</Button>
            <Button type="submit" isLoading={isLoading}>保存</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ================================
// 删除确认弹窗
// ================================

interface DeleteDialogProps {
  wordbookId: string
  wordbookName: string
  onClose: () => void
  onDelete: (id: string) => Promise<void>
}

function DeleteDialog({ wordbookId, wordbookName, onClose, onDelete }: DeleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await onDelete(wordbookId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl p-6 space-y-4">
        <h2 id="delete-dialog-title" className="text-lg font-semibold">删除识字库</h2>
        <p className="text-sm text-muted-foreground">
          确定要删除 <span className="font-medium text-foreground">「{wordbookName}」</span> 吗？此操作不可撤销。
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>取消</Button>
          <Button variant="destructive" onClick={handleDelete} isLoading={isLoading}>删除</Button>
        </div>
      </div>
    </div>
  )
}

// ================================
// 主页面
// ================================

export default function WordbooksPage() {
  const [wordbooks, setWordbooks] = useState<WordbookDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 弹窗状态
  const [showCreate, setShowCreate] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  // 加载识字库列表
  const loadWordbooks = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/v1/wordbooks', { credentials: 'include' })
      const json: ApiResponse<{ items: WordbookDTO[] }> = await res.json()
      if (!res.ok || json.code !== 0) {
        setLoadError(json.message ?? '加载失败')
        return
      }
      setWordbooks(json.data.items)
    } catch {
      setLoadError('网络异常，请检查连接后重试')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWordbooks()
  }, [loadWordbooks])

  // 创建识字库
  const handleCreate = async (name: string) => {
    const res = await fetch('/api/v1/wordbooks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const json: ApiResponse<WordbookDTO> = await res.json()
    if (!res.ok || json.code !== 0) {
      throw new Error(json.message ?? '创建失败')
    }
    setWordbooks((prev) => [json.data, ...prev])
  }

  // 重命名（当前API未提供PATCH接口，先做乐观更新）
  const handleRename = async (id: string, name: string) => {
    // 乐观更新 UI
    setWordbooks((prev) =>
      prev.map((w) => (w.id === id ? { ...w, name } : w))
    )
  }

  // 删除（当前API未提供DELETE接口，乐观更新）
  const handleDelete = async (id: string) => {
    setWordbooks((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">我的识字库</h1>
          <p className="text-muted-foreground text-sm mt-1">管理你的汉字收藏，开启间隔重复学习</p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2"
          aria-label="创建新识字库"
        >
          <Plus className="w-4 h-4" />
          新建识字库
        </Button>
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner size="lg" />
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className={cn(
            'flex flex-col items-center gap-3 py-16 text-center',
            'border border-destructive/20 rounded-xl bg-destructive/5'
          )}
        >
          <span className="text-4xl">⚠️</span>
          <p className="text-destructive font-medium">{loadError}</p>
          <Button variant="outline" onClick={loadWordbooks} size="sm">重新加载</Button>
        </div>
      ) : wordbooks.length === 0 ? (
        /* 空状态 */
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-medium">还没有识字库</p>
            <p className="text-sm text-muted-foreground">创建一个识字库，开始收集和学习汉字</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            创建第一个识字库
          </Button>
        </div>
      ) : (
        /* 识字库卡片网格 */
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          role="list"
          aria-label="识字库列表"
        >
          {wordbooks.map((wordbook) => (
            <div key={wordbook.id} role="listitem">
              <WordbookCard
                wordbook={wordbook}
                onRename={(id, name) => setRenameTarget({ id, name })}
                onDelete={(id, name) => setDeleteTarget({ id, name })}
              />
            </div>
          ))}
        </div>
      )}

      {/* 弹窗 */}
      {showCreate && (
        <CreateDialog
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
      {renameTarget && (
        <RenameDialog
          wordbookId={renameTarget.id}
          currentName={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onRename={handleRename}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          wordbookId={deleteTarget.id}
          wordbookName={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
