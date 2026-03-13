// =============================================================================
// POST /api/v1/auth/login — 手机号验证码登录
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { login } from '@/server/services/auth.service'
import { handleApiError } from '@/server/middleware/error.middleware'
import { addCsrfTokenToResponse } from '@/server/middleware/csrf.middleware'

// 请求体 Schema
const LoginSchema = z.object({
  phone: z
    .string({ required_error: '手机号不能为空' })
    .regex(/^1[3-9]\d{9}$/, '手机号格式错误'),
  code: z
    .string({ required_error: '验证码不能为空' })
    .regex(/^\d{6}$/, '验证码必须为6位数字'),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { phone, code } = LoginSchema.parse(body)

    // 获取客户端 IP 和 User-Agent（用于 Session 记录）
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      undefined
    const userAgent = request.headers.get('user-agent') ?? undefined

    const data = await login({ phone, code, ip, userAgent })

    // 安全修复: 登录成功后设置CSRF Token
    const response = NextResponse.json(
      { success: true, data },
      { status: 200 }
    )
    
    // 添加CSRF Token到响应
    addCsrfTokenToResponse(response)
    
    return response
  } catch (error) {
    return handleApiError(error)
  }
}
