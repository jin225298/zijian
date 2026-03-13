// =============================================================================
// POST /api/v1/auth/login-password — 账号密码登录（降级方案）
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { loginWithPassword } from '@/server/services/auth.service'
import { handleApiError } from '@/server/middleware/error.middleware'
import { addCsrfTokenToResponse } from '@/server/middleware/csrf.middleware'
import { loginRatelimit } from '@/lib/redis'

const LoginPasswordSchema = z.object({
  username: z
    .string({ required_error: '账号不能为空' })
    .min(1, '账号不能为空')
    .max(50, '账号长度不能超过50个字符'),
  password: z
    .string({ required_error: '密码不能为空' })
    .min(1, '密码不能为空')
    .max(100, '密码长度不能超过100个字符'),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 速率限制（基于 IP，与 SMS 登录保持一致）
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      '127.0.0.1'
    const { success: rateLimitOk } = await loginRatelimit.limit(clientIp)
    if (!rateLimitOk) {
      return NextResponse.json(
        { success: false, message: '请求过于频繁，请稍后再试' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { username, password } = LoginPasswordSchema.parse(body)

    const ip = clientIp !== '127.0.0.1' ? clientIp : undefined
    const userAgent = request.headers.get('user-agent') ?? undefined

    const data = await loginWithPassword({ username, password, ip, userAgent })

    const response = NextResponse.json(
      { success: true, data },
      { status: 200 }
    )
    
    addCsrfTokenToResponse(response)
    
    return response
  } catch (error) {
    return handleApiError(error)
  }
}
