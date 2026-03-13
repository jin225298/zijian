// =============================================================================
// GET /api/v1/auth/me — 获取当前登录用户信息
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/server/middleware/auth.middleware'
import { getCurrentUser } from '@/server/services/auth.service'
import { handleApiError } from '@/server/middleware/error.middleware'
import { JwtPayload } from '@/types'

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withAuth(request, async (_req: NextRequest, payload: JwtPayload) => {
    try {
      const user = await getCurrentUser(payload.userId)

      return NextResponse.json(
        { success: true, data: user },
        { status: 200 }
      )
    } catch (error) {
      return handleApiError(error)
    }
  })
}
