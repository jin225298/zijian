import { NextResponse } from 'next/server'
import { createCsrfTokenResponse } from '@/server/middleware/csrf.middleware'

/**
 * GET /api/v1/csrf-token
 * 获取CSRF Token
 * 
 * 安全修复: 实现CSRF保护
 * 前端应在每次需要执行状态变更操作前获取此Token
 */
export async function GET() {
  return createCsrfTokenResponse()
}
