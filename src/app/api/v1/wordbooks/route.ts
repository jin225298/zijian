// =============================================================================
// GET  /api/v1/wordbooks — 获取用户所有识字库
// POST /api/v1/wordbooks — 创建新识字库
// =============================================================================
// 适配 SaveToBookButton 所需的 ApiResponse<{ items: WordbookDTO[] }> 格式

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/server/middleware/auth.middleware'
import { withCsrfProtection } from '@/server/middleware/csrf.middleware'
import { handleApiError } from '@/server/middleware/error.middleware'
import { getWordBooks, createWordBook } from '@/server/services/wordbook.service'
import type { JwtPayload, WordbookDTO } from '@/types'
import { apiResponse } from '@/lib/utils'

// ================================
// 工具：根据 ID 生成确定性封面颜色
// ================================

const COVER_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  '#84cc16', '#f43f5e',
]

function getCoverColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return COVER_COLORS[hash % COVER_COLORS.length]
}

// ================================
// GET /api/v1/wordbooks
// ================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withAuth(request, async (_req, payload: JwtPayload) => {
    try {
      const books = await getWordBooks(payload.userId)

      // 映射为前端 WordbookDTO 格式
      const items: WordbookDTO[] = books.map((book) => ({
        id: book.id,
        userId: payload.userId,
        name: book.name,
        description: null,
        isPublic: false,
        coverColor: getCoverColor(book.id),
        charCount: book.item_count,
        createdAt: book.created_at,
        updatedAt: book.created_at,
      }))

      return NextResponse.json(apiResponse({ items }))
    } catch (error) {
      return handleApiError(error)
    }
  })
}

// ================================
// POST /api/v1/wordbooks
// ================================

const CreateWordBookSchema = z.object({
  name: z
    .string({ required_error: '识字库名称不能为空' })
    .min(1, '识字库名称不能为空')
    .max(100, '识字库名称最长100个字符'),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  // BUG-002修复：通过 withCsrfProtection 包裹，防止跨站请求伪造
  return withCsrfProtection(request, (req) =>
    withAuth(req, async (req2, payload: JwtPayload) => {
      try {
        const body = await req2.json()
        const { name } = CreateWordBookSchema.parse(body)

        const book = await createWordBook({ userId: payload.userId, name })

        const wordbook: WordbookDTO = {
          id: book.id,
          userId: payload.userId,
          name: book.name,
          description: null,
          isPublic: false,
          coverColor: getCoverColor(book.id),
          charCount: 0,
          createdAt: book.created_at,
          updatedAt: book.created_at,
        }

        return NextResponse.json(apiResponse(wordbook), { status: 201 })
      } catch (error) {
        return handleApiError(error)
      }
    })
  )
}
