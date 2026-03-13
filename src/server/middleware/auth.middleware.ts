import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { ErrorCode, JwtPayload } from '@/types'
import { apiError } from '@/lib/utils'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-secret-key'
)

/**
 * 认证中间件 - 验证 JWT Token
 * 用于需要登录的 API 路由
 */
export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest, payload: JwtPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        apiError('未提供认证令牌', ErrorCode.UNAUTHORIZED),
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    return await handler(request, payload as unknown as JwtPayload)
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'JWTExpired') {
        return NextResponse.json(
          apiError('认证令牌已过期', ErrorCode.TOKEN_EXPIRED),
          { status: 401 }
        )
      }
    }
    return NextResponse.json(
      apiError('认证令牌无效', ErrorCode.TOKEN_INVALID),
      { status: 401 }
    )
  }
}

/**
 * 管理员权限中间件
 */
export async function withAdmin(
  request: NextRequest,
  handler: (req: NextRequest, payload: JwtPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, payload) => {
    if (payload.role !== 'ADMIN') {
      return NextResponse.json(
        apiError('无权限访问', ErrorCode.FORBIDDEN),
        { status: 403 }
      )
    }
    return handler(req, payload)
  })
}

/**
 * 可选认证中间件 - 不强制要求登录，但如果提供了 Token 则验证
 */
export async function withOptionalAuth(
  request: NextRequest,
  handler: (req: NextRequest, payload: JwtPayload | null) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return handler(request, null)
    }

    const token = authHeader.substring(7)
    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    return handler(request, payload as unknown as JwtPayload)
  } catch {
    return handler(request, null)
  }
}
