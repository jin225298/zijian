import { NextRequest, NextResponse } from 'next/server'
import { apiRatelimit } from '@/lib/redis'
import { apiError } from '@/lib/utils'
import { ErrorCode } from '@/types'

/**
 * 速率限制中间件
 * @param identifier 限制标识符（如 IP 地址或用户 ID）
 * @param limiter 速率限制器实例
 */
export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  identifier?: string
): Promise<NextResponse> {
  // 获取客户端 IP 作为默认标识符
  const ip = 
    request.headers.get('x-forwarded-for')?.split(',')[0] ??
    request.headers.get('x-real-ip') ??
    'anonymous'
  
  const id = identifier ?? ip

  try {
    const { success, limit, remaining, reset } = await apiRatelimit.limit(id)

    if (!success) {
      return NextResponse.json(
        apiError('请求过于频繁，请稍后再试', ErrorCode.RATE_LIMIT_EXCEEDED),
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      )
    }

    const response = await handler()
    
    // 添加速率限制响应头
    response.headers.set('X-RateLimit-Limit', limit.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', reset.toString())

    return response
  } catch (error) {
    // Redis 不可用时降级处理，不阻断请求
    console.error('[RateLimit] Redis 连接失败，跳过速率限制:', error)
    return handler()
  }
}
