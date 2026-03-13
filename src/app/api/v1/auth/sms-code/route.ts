// =============================================================================
// POST /api/v1/auth/sms-code — 发送短信验证码
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendSmsCode } from '@/server/services/auth.service'
import { handleApiError } from '@/server/middleware/error.middleware'

// 请求体 Schema
const SmsCodeSchema = z.object({
  phone: z
    .string({ required_error: '手机号不能为空' })
    .regex(/^1[3-9]\d{9}$/, '手机号格式错误（需为11位大陆手机号）'),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { phone } = SmsCodeSchema.parse(body)

    await sendSmsCode({ phone })

    return NextResponse.json(
      { success: true, message: '验证码已发送' },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
