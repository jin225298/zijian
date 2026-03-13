// =============================================================================
// GET /api/v1/wordbooks/:id/review — 获取今日待复习汉字
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/server/middleware/auth.middleware'
import { handleApiError } from '@/server/middleware/error.middleware'
import { getTodayReview } from '@/server/services/wordbook.service'
import { JwtPayload } from '@/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  return withAuth(request, async (_req, payload: JwtPayload) => {
    try {
      const { id: bookId } = await context.params

      const data = await getTodayReview({
        userId: payload.userId,
        bookId,
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
