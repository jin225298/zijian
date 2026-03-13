// =============================================================================
// POST /api/v1/auth/logout — 用户登出
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/server/middleware/auth.middleware'
import { logout } from '@/server/services/auth.service'
import { handleApiError } from '@/server/middleware/error.middleware'
import { JwtPayload } from '@/types'

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withAuth(request, async (_req: NextRequest, payload: JwtPayload) => {
    try {
      await logout(payload.userId)

      return NextResponse.json(
        { success: true, message: '已登出' },
        { status: 200 }
      )
    } catch (error) {
      return handleApiError(error)
    }
  })
}
