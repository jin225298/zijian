// =============================================================================
// GET  /api/v1/wordbooks/:id/items — 获取识字库条目（分页 + 筛选）
// POST /api/v1/wordbooks/:id/items — 添加汉字到识字库
// =============================================================================
// 适配前端 ApiResponse 格式（code + data + message + timestamp）

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/server/middleware/auth.middleware'
import { withCsrfProtection } from '@/server/middleware/csrf.middleware'
import { handleApiError } from '@/server/middleware/error.middleware'
import { getWordBookItems, addWordBookItem } from '@/server/services/wordbook.service'
import type { JwtPayload } from '@/types'
import { apiResponse } from '@/lib/utils'

interface RouteContext {
  params: Promise<{ id: string }>
}

// ================================
// GET /api/v1/wordbooks/:id/items
// ================================

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  return withAuth(request, async (_req, payload: JwtPayload) => {
    try {
      const { id: bookId } = await context.params
      const { searchParams } = new URL(request.url)

      const page = parseInt(searchParams.get('page') ?? '1')
      const limit = parseInt(searchParams.get('limit') ?? '20')
      const status = (searchParams.get('status') ?? 'all') as 'all' | 'learning' | 'mastered'
      const sort = searchParams.get('sort') ?? 'created_at'

      const result = await getWordBookItems({
        userId: payload.userId,
        bookId,
        page,
        limit,
        status,
        sort,
      })

      return NextResponse.json(apiResponse(result))
    } catch (error) {
      return handleApiError(error)
    }
  })
}

// ================================
// POST /api/v1/wordbooks/:id/items
// ================================

const AddItemSchema = z.object({
  character: z
    .string({ required_error: '汉字不能为空' })
    .min(1, '汉字不能为空')
    .max(4, '汉字参数过长'),
})

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  // BUG-002修复：通过 withCsrfProtection 包裹，防止跨站请求伪造
  return withCsrfProtection(request, (req) =>
    withAuth(req, async (req2, payload: JwtPayload) => {
      try {
        const { id: bookId } = await context.params
        const body = await req2.json()
        const { character } = AddItemSchema.parse(body)

        const item = await addWordBookItem({
          userId: payload.userId,
          bookId,
          character,
        })

        return NextResponse.json(apiResponse(item), { status: 201 })
      } catch (error) {
        return handleApiError(error)
      }
    })
  )
}
