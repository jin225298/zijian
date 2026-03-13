import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { ErrorCode, JwtPayload } from '@/types'
import { apiError } from '@/lib/utils'

/** JWT 允许的算法白名单 - 安全修复: 防止算法混淆攻击 */
const ALLOWED_JWT_ALGORITHMS = ['HS256'] as const

/** JWT密钥最小长度要求 */
const MIN_JWT_SECRET_LENGTH = 32

/**
 * 获取JWT密钥并验证强度
 * BUG-003修复: 改为惰性调用，不在模块顶层执行，
 * 避免环境变量未配置时服务启动崩溃
 */
function getValidatedJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  
  if (!secret) {
    throw new Error('[AuthMiddleware] 缺少环境变量: JWT_SECRET')
  }
  
  // 安全修复: 验证密钥强度
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `[AuthMiddleware] JWT_SECRET 强度不足：当前${secret.length}字符，要求至少${MIN_JWT_SECRET_LENGTH}字符`
    )
  }
  
  // 检查是否为fallback或弱密钥
  if (secret === 'fallback-secret-key' || secret.length < 16) {
    throw new Error('[AuthMiddleware] JWT_SECRET 使用了不安全的密钥')
  }
  
  return new TextEncoder().encode(secret)
}

// BUG-003修复: 已删除模块顶层 `const JWT_SECRET = getValidatedJwtSecret()`
// 原问题：模块加载时立即执行，若 JWT_SECRET 未配置则服务启动崩溃
// 修复后：改为各函数内惰性初始化，仅在实际处理请求时才验证

/**
 * 认证中间件 - 验证 JWT Token
 * 用于需要登录的 API 路由
 * 
 * 安全修复: 
 * 1. 明确指定允许的算法白名单
 * 2. 验证密钥强度（惰性初始化，避免服务启动时因环境变量缺失崩溃）
 */
export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest, payload: JwtPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  // BUG-003修复: 惰性初始化，移入函数体内，启动时不执行，调用时才验证
  const jwtSecret = getValidatedJwtSecret()
  try {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        apiError('未提供认证令牌', ErrorCode.UNAUTHORIZED),
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // 安全修复: 明确指定允许的算法，防止算法混淆攻击
    const { payload, protectedHeader } = await jwtVerify(token, jwtSecret, {
      algorithms: [...ALLOWED_JWT_ALGORITHMS],  // 算法白名单
      issuer: 'zijing',  // 验证签发者
      audience: 'zijing-users',  // 验证受众
    })
    
    // 额外验证: 确保算法在白名单中
    if (!protectedHeader.alg || !ALLOWED_JWT_ALGORITHMS.includes(protectedHeader.alg as typeof ALLOWED_JWT_ALGORITHMS[number])) {
      return NextResponse.json(
        apiError('不支持的JWT算法', ErrorCode.TOKEN_INVALID),
        { status: 401 }
      )
    }
    
    return await handler(request, payload as unknown as JwtPayload)
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'JWTExpired') {
        return NextResponse.json(
          apiError('认证令牌已过期', ErrorCode.TOKEN_EXPIRED),
          { status: 401 }
        )
      }
      // 安全修复: 区分不同类型的JWT错误
      if (error.message.includes('algorithm')) {
        return NextResponse.json(
          apiError('令牌算法无效', ErrorCode.TOKEN_INVALID),
          { status: 401 }
        )
      }
      if (error.message.includes('issuer') || error.message.includes('audience')) {
        return NextResponse.json(
          apiError('令牌验证失败', ErrorCode.TOKEN_INVALID),
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
    if (payload.role !== 'admin') {
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
    
    // BUG-003修复: 惰性初始化
    const jwtSecret = getValidatedJwtSecret()
    
    // 安全修复: 同样应用算法白名单
    const { payload } = await jwtVerify(token, jwtSecret, {
      algorithms: [...ALLOWED_JWT_ALGORITHMS],
      issuer: 'zijing',
      audience: 'zijing-users',
    })
    
    return handler(request, payload as unknown as JwtPayload)
  } catch {
    return handler(request, null)
  }
}
