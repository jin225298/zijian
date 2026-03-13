// =============================================================================
// POST /api/v1/auth/refresh — 刷新 Access Token
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { refreshTokens } from '@/server/services/auth.service'
import { handleApiError } from '@/server/middleware/error.middleware'

// 请求体 Schema
const RefreshSchema = z.object({
  refreshToken: z
    .string({ required_error: 'refreshToken 不能为空' })
    .min(1, 'refreshToken 不能为空'),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { refreshToken } = RefreshSchema.parse(body)

    const data = await refreshTokens(refreshToken)

    return NextResponse.json(
      { success: true, data },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
