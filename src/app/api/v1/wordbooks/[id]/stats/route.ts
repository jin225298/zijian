// =============================================================================
// GET /api/v1/wordbooks/:id/stats — 获取学习统计
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/server/middleware/auth.middleware'
import { handleApiError } from '@/server/middleware/error.middleware'
import { getWordBookStats } from '@/server/services/wordbook.service'
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

      const data = await getWordBookStats(payload.userId, bookId)

      return NextResponse.json({
        success: true,
        data,
      })
    } catch (error) {
      return handleApiError(error)
    }
  })
}
