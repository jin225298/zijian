// =============================================================================
// POST /api/v1/wordbooks/:id/items/:itemId/study — 提交学习结果（SM-2算法）
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/server/middleware/auth.middleware'
import { handleApiError } from '@/server/middleware/error.middleware'
import { submitStudyResult } from '@/server/services/wordbook.service'
import { JwtPayload } from '@/types'

interface RouteContext {
  params: Promise<{ id: string; itemId: string }>
}

// 请求体 Schema
const StudySchema = z.object({
  result: z.enum(['correct', 'hint_used', 'wrong'], {
    required_error: 'result 不能为空',
    invalid_type_error: 'result 必须为 correct | hint_used | wrong',
  }),
})

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  return withAuth(request, async (req, payload: JwtPayload) => {
    try {
      const { id: bookId, itemId } = await context.params
      const body = await req.json()
      const { result } = StudySchema.parse(body)

      const data = await submitStudyResult({
        userId: payload.userId,
        bookId,
        itemId,
        result,
      })

      return NextResponse.json({
        success: true,
        data,
      })
    } catch (error) {
      return handleApiError(error)
    }
  })
}
