import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind CSS 类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 统一 API 响应格式
 */
export function apiResponse<T>(
  data: T,
  message = 'success',
  code = 0
) {
  return {
    code,
    data,
    message,
    timestamp: new Date().toISOString(),
  }
}

/**
 * 统一 API 错误响应格式
 */
export function apiError(message: string, code = 500, details?: unknown) {
  return {
    code,
    data: null,
    message,
    details: process.env.NODE_ENV === 'development' ? details : undefined,
    timestamp: new Date().toISOString(),
  }
}

/**
 * 分页参数解析
 */
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

/**
 * 分页响应格式
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  }
}

/**
 * 延迟函数（毫秒）
 */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T
  } catch {
    return fallback
  }
}

/**
 * 隐藏邮箱中间部分
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  const masked = local.length > 3
    ? `${local.slice(0, 2)}***${local.slice(-1)}`
    : `${local[0]}***`
  return `${masked}@${domain}`
}

/**
 * 生成随机字符串
 */
export function generateRandomString(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
