import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// ================================
// Upstash Redis 客户端（无服务器环境推荐）
// ================================
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// ================================
// 速率限制器
// ================================

// API 通用速率限制：每分钟 100 次
export const apiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
  prefix: 'zijing:ratelimit:api',
})

// 登录速率限制：每分钟 10 次
export const loginRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true,
  prefix: 'zijing:ratelimit:login',
})

// AI 接口速率限制：每分钟 20 次
export const aiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  analytics: true,
  prefix: 'zijing:ratelimit:ai',
})

// ================================
// Redis 缓存工具函数
// ================================

/**
 * 获取缓存，支持自动反序列化
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get<T>(key)
    return data
  } catch (error) {
    console.error(`[Redis] 获取缓存失败 key=${key}:`, error)
    return null
  }
}

/**
 * 设置缓存，支持过期时间（秒）
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttl?: number
): Promise<void> {
  try {
    if (ttl) {
      await redis.setex(key, ttl, JSON.stringify(value))
    } else {
      await redis.set(key, JSON.stringify(value))
    }
  } catch (error) {
    console.error(`[Redis] 设置缓存失败 key=${key}:`, error)
  }
}

/**
 * 删除缓存
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch (error) {
    console.error(`[Redis] 删除缓存失败 key=${key}:`, error)
  }
}

// 缓存键前缀常量
export const CACHE_KEYS = {
  USER: (id: string) => `zijing:user:${id}`,
  CHAR: (id: string) => `zijing:char:${id}`,
  CHAR_BY_CHARACTER: (char: string) => `zijing:char:c:${char}`,
  WORDBOOK: (id: string) => `zijing:wordbook:${id}`,
  USER_WORDBOOKS: (userId: string) => `zijing:user:${userId}:wordbooks`,
  LEARN_PROGRESS: (userId: string) => `zijing:user:${userId}:progress`,
} as const

// 缓存 TTL 常量（秒）
export const CACHE_TTL = {
  SHORT: 60,        // 1分钟
  MEDIUM: 300,      // 5分钟
  LONG: 3600,       // 1小时
  DAY: 86400,       // 1天
} as const
