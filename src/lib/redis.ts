import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// ================================
// Redis 客户端配置
// ================================

// 检查是否配置了 Upstash Redis
const hasUpstashRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN

// 内存降级存储（仅用于本地开发）
class MemoryStore {
  private store = new Map<string, { value: string; expiresAt?: number }>()

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key)
    if (!item) return null
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key)
      return null
    }
    try {
      return JSON.parse(item.value) as T
    } catch {
      return item.value as unknown as T
    }
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : undefined
    this.store.set(key, { value, expiresAt })
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.set(key, value, { ex: ttl })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async incr(key: string): Promise<number> {
    const item = this.store.get(key)
    const newValue = item ? parseInt(item.value) + 1 : 1
    this.store.set(key, { value: String(newValue), expiresAt: item?.expiresAt })
    return newValue
  }

  async expire(key: string, ttl: number): Promise<void> {
    const item = this.store.get(key)
    if (item) {
      item.expiresAt = Date.now() + ttl * 1000
    }
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    const item = this.store.get(key)
    const arr: string[] = item ? JSON.parse(item.value) : []
    arr.unshift(...values)
    this.store.set(key, { value: JSON.stringify(arr), expiresAt: item?.expiresAt })
    return arr.length
  }
}

// 创建 Redis 客户端或内存降级
const memoryStore = new MemoryStore()

export const redis = hasUpstashRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : {
      // 内存降级模式（本地开发）
      get: async <T>(key: string) => memoryStore.get<T>(key),
      set: async (key: string, value: string, options?: { ex?: number }) => {
        await memoryStore.set(key, value, options)
        return 'OK'
      },
      setex: async (key: string, ttl: number, value: string) => {
        await memoryStore.setex(key, ttl, value)
        return 'OK'
      },
      del: async (key: string) => {
        await memoryStore.del(key)
        return 1
      },
      incr: async (key: string) => memoryStore.incr(key),
      expire: async (key: string, ttl: number) => {
        await memoryStore.expire(key, ttl)
        return 1
      },
      lpush: async (key: string, ...values: string[]) => {
        return memoryStore.lpush(key, ...values)
      },
    }

if (!hasUpstashRedis) {
  console.warn('[Redis] ⚠️ 未配置 Upstash Redis，使用内存降级模式（仅限本地开发）')
}

// ================================
// 速率限制器
// ================================

// API 通用速率限制：每分钟 100 次
export const apiRatelimit = hasUpstashRedis
  ? new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'zijing:ratelimit:api',
    })
  : {
      // 内存降级模式
      limit: async (key: string) => {
        const rlKey = `ratelimit:${key}`
        const current = await memoryStore.incr(rlKey)
        if (current === 1) await memoryStore.expire(rlKey, 60)
        const success = current <= 100
        return {
          success,
          limit: 100,
          remaining: Math.max(0, 100 - current),
          reset: Date.now() + 60000,
        }
      },
    }

// 登录速率限制：每分钟 10 次
export const loginRatelimit = hasUpstashRedis
  ? new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'zijing:ratelimit:login',
    })
  : {
      limit: async (key: string) => {
        const rlKey = `ratelimit:login:${key}`
        const current = await memoryStore.incr(rlKey)
        if (current === 1) await memoryStore.expire(rlKey, 60)
        const success = current <= 10
        return {
          success,
          limit: 10,
          remaining: Math.max(0, 10 - current),
          reset: Date.now() + 60000,
        }
      },
    }

// AI 接口速率限制：每分钟 20 次
export const aiRatelimit = hasUpstashRedis
  ? new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      analytics: true,
      prefix: 'zijing:ratelimit:ai',
    })
  : {
      limit: async (key: string) => {
        const rlKey = `ratelimit:ai:${key}`
        const current = await memoryStore.incr(rlKey)
        if (current === 1) await memoryStore.expire(rlKey, 60)
        const success = current <= 20
        return {
          success,
          limit: 20,
          remaining: Math.max(0, 20 - current),
          reset: Date.now() + 60000,
        }
      },
    }

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
