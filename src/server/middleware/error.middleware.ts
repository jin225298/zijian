import { NextResponse } from 'next/server'
import { ErrorCode } from '@/types'
import { apiError } from '@/lib/utils'

// ================================
// 业务异常类
// ================================

export class BusinessException extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly statusCode = 400
  ) {
    super(message ?? getDefaultMessage(code))
    this.name = 'BusinessException'
  }
}

function getDefaultMessage(code: ErrorCode): string {
  const messages: Record<number, string> = {
    [ErrorCode.INVALID_PARAMS]: '参数错误',
    [ErrorCode.UNAUTHORIZED]: '未授权访问',
    [ErrorCode.FORBIDDEN]: '无权限访问',
    [ErrorCode.NOT_FOUND]: '资源不存在',
    [ErrorCode.RATE_LIMIT_EXCEEDED]: '请求过于频繁',
    [ErrorCode.USER_NOT_FOUND]: '用户不存在',
    [ErrorCode.INVALID_PASSWORD]: '用户名或密码错误',
    [ErrorCode.ACCOUNT_DISABLED]: '账号已被禁用',
    [ErrorCode.TOKEN_EXPIRED]: '令牌已过期',
    [ErrorCode.TOKEN_INVALID]: '令牌无效',
    [ErrorCode.EMAIL_ALREADY_EXISTS]: '邮箱已被注册',
    [ErrorCode.USERNAME_ALREADY_EXISTS]: '用户名已被使用',
    [ErrorCode.CHAR_NOT_FOUND]: '汉字不存在',
    [ErrorCode.WORDBOOK_NOT_FOUND]: '字书不存在',
    [ErrorCode.WORDBOOK_ACCESS_DENIED]: '无权访问该字书',
    [ErrorCode.CHAR_ALREADY_IN_WORDBOOK]: '汉字已在字书中',
    [ErrorCode.CONVERT_FAILED]: '转换失败',
    [ErrorCode.TEXT_TOO_LONG]: '文本过长',
    [ErrorCode.SCAN_FAILED]: '扫描识别失败',
    [ErrorCode.DEVICE_NOT_CONNECTED]: '设备未连接',
    [ErrorCode.VISUAL_DAILY_LIMIT_EXCEEDED]: '今日可视化生成次数已达上限',
    [ErrorCode.VISUAL_TASK_NOT_FOUND]: '任务不存在或已过期',
    [ErrorCode.VISUAL_CHAR_INVALID]: '汉字参数无效',
    // CSRF安全错误
    [ErrorCode.CSRF_TOKEN_MISSING]: '缺少CSRF Token',
    [ErrorCode.CSRF_TOKEN_MISMATCH]: 'CSRF Token不匹配',
    [ErrorCode.CSRF_TOKEN_INVALID]: 'CSRF Token无效或已过期',
  }
  return messages[code] ?? '服务器内部错误'
}

// ================================
// 统一错误处理函数
// ================================

/**
 * 处理 API 路由中的错误，返回统一格式的错误响应
 */
export function handleApiError(error: unknown): NextResponse {
  // 业务异常
  if (error instanceof BusinessException) {
    return NextResponse.json(
      apiError(error.message, error.code),
      { status: error.statusCode }
    )
  }

  // Zod 验证错误
  if (isZodError(error)) {
    const messages = error.errors.map((e: { path: (string | number)[]; message: string }) => 
      `${e.path.join('.')}: ${e.message}`
    ).join('; ')
    return NextResponse.json(
      apiError(`参数验证失败: ${messages}`, ErrorCode.INVALID_PARAMS),
      { status: 400 }
    )
  }

  // Prisma 错误
  if (isPrismaError(error)) {
    return handlePrismaError(error)
  }

  // 未知错误
  console.error('[API Error]', error)
  return NextResponse.json(
    apiError('服务器内部错误', ErrorCode.SERVER_ERROR),
    { status: 500 }
  )
}

function isZodError(error: unknown): error is { name: string; errors: { path: (string | number)[]; message: string }[] } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'ZodError'
  )
}

function isPrismaError(error: unknown): error is { code: string; meta?: { target?: string[] } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('P')
  )
}

function handlePrismaError(error: { code: string; meta?: { target?: string[] } }): NextResponse {
  switch (error.code) {
    case 'P2002': {
      const field = error.meta?.target?.[0] ?? 'field'
      return NextResponse.json(
        apiError(`${field} 已存在`, ErrorCode.INVALID_PARAMS),
        { status: 409 }
      )
    }
    case 'P2025':
      return NextResponse.json(
        apiError('记录不存在', ErrorCode.NOT_FOUND),
        { status: 404 }
      )
    default:
      console.error('[Prisma Error]', error)
      return NextResponse.json(
        apiError('数据库操作失败', ErrorCode.SERVER_ERROR),
        { status: 500 }
      )
  }
}
