// =============================================================================
// 字见系统 — CSRF 保护中间件
// =============================================================================
// 安全修复: 实现CSRF保护，防止跨站请求伪造攻击
// 使用双重提交Cookie模式（Double Submit Cookie）
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ErrorCode } from '@/types'
import { apiError } from '@/lib/utils'

/** CSRF Token 长度（字节） */
const CSRF_TOKEN_LENGTH = 32

/** CSRF Token 有效期（毫秒）- 1小时 */
const CSRF_TOKEN_TTL = 60 * 60 * 1000

/** CSRF Cookie 名称 */
export const CSRF_COOKIE_NAME = 'zijing_csrf_token'

/** CSRF Header 名称 */
export const CSRF_HEADER_NAME = 'X-CSRF-Token'

/**
 * 生成CSRF Token
 * 格式: timestamp:randomHex:signature
 */
export function generateCsrfToken(): string {
  const timestamp = Date.now().toString(36)
  const randomBytes = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
  const signature = createCsrfSignature(timestamp, randomBytes)
  return `${timestamp}:${randomBytes}:${signature}`
}

/**
 * 创建CSRF签名
 */
function createCsrfSignature(timestamp: string, randomBytes: string): string {
  const secret = process.env.CSRF_SECRET || process.env.JWT_SECRET
  if (!secret) {
    throw new Error('[CSRF] 缺少CSRF签名密钥')
  }
  const data = `${timestamp}:${randomBytes}`
  return crypto.createHmac('sha256', secret).update(data).digest('hex').slice(0, 16)
}

/**
 * 验证CSRF Token
 */
function validateCsrfToken(token: string): { valid: boolean; error?: string } {
  const parts = token.split(':')
  if (parts.length !== 3) {
    return { valid: false, error: 'Token格式无效' }
  }
  
  const [timestampStr, randomBytes, signature] = parts
  
  // 验证签名
  const expectedSignature = createCsrfSignature(timestampStr, randomBytes)
  if (signature !== expectedSignature) {
    return { valid: false, error: 'Token签名无效' }
  }
  
  // 验证时间戳（防重放）
  const timestamp = parseInt(timestampStr, 36)
  const now = Date.now()
  if (now - timestamp > CSRF_TOKEN_TTL) {
    return { valid: false, error: 'Token已过期' }
  }
  
  return { valid: true }
}

/**
 * 需要CSRF保护的方法
 */
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH']

/**
 * CSRF保护中间件
 * 用于保护状态变更的API路由
 * 
 * 使用方式:
 * 1. 前端首次加载时调用 GET /api/v1/csrf-token 获取token
 * 2. 将token存储在cookie中（自动）并在请求头中发送
 * 3. 后端验证cookie中的token与header中的token是否匹配
 */
export async function withCsrfProtection(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  // 非状态变更方法不需要CSRF保护
  if (!CSRF_PROTECTED_METHODS.includes(request.method)) {
    return handler(request)
  }
  
  // 从Cookie获取CSRF Token
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  
  // 从Header获取CSRF Token
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  
  // 验证Token存在
  if (!cookieToken || !headerToken) {
    return NextResponse.json(
      apiError('缺少CSRF Token', ErrorCode.CSRF_TOKEN_MISSING),
      { status: 403 }
    )
  }
  
  // 验证Cookie和Header中的Token匹配
  if (cookieToken !== headerToken) {
    return NextResponse.json(
      apiError('CSRF Token不匹配', ErrorCode.CSRF_TOKEN_MISMATCH),
      { status: 403 }
    )
  }
  
  // 验证Token有效性
  const validation = validateCsrfToken(cookieToken)
  if (!validation.valid) {
    return NextResponse.json(
      apiError(`CSRF验证失败: ${validation.error}`, ErrorCode.CSRF_TOKEN_INVALID),
      { status: 403 }
    )
  }
  
  return handler(request)
}

/**
 * 生成并设置CSRF Token的响应
 * 用于 GET /api/v1/csrf-token 端点
 */
export function createCsrfTokenResponse(): NextResponse {
  const token = generateCsrfToken()
  
  const response = NextResponse.json({
    code: 0,
    data: { token },
    message: 'success',
  })
  
  // 设置CSRF Cookie（HttpOnly=false，允许JS读取）
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,  // 允许前端JS读取
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',  // 严格的SameSite策略
    path: '/',
    maxAge: CSRF_TOKEN_TTL / 1000,
  })
  
  return response
}

/**
 * 为响应添加CSRF Token（用于登录成功后设置）
 */
export function addCsrfTokenToResponse(response: NextResponse): NextResponse {
  const token = generateCsrfToken()
  
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: CSRF_TOKEN_TTL / 1000,
  })
  
  // 同时在响应体中返回token（方便前端使用）
  return response
}
