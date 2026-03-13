// =============================================================================
// 字见系统 — 汉字可视化服务
// =============================================================================
// 任务: TASK-BE-008
// 职责:
//   - 三级缓存查找（L1 进程内 LRU → L2 Redis → L3 数据库预生成）
//   - 缓存命中直接返回 URL
//   - 未命中则异步入队，返回 taskId
//   - 儿童用户每日生成次数限制（20次）
//   - 任务状态查询
// =============================================================================

import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { broadcastTaskComplete } from '@/lib/supabase'
import { BusinessException } from '@/server/middleware/error.middleware'
import {
  ErrorCode,
  VisualStyle,
  VisualType,
  VisualTaskMeta,
  VisualTaskStatus,
  VisualizeRequestDTO,
  TaskStatusDTO,
} from '@/types'

// ================================
// 常量配置
// ================================

/** 儿童用户每日最大生成次数 */
const CHILD_DAILY_LIMIT = 20

/** L2 Redis 缓存 TTL：30天（秒） */
const L2_CACHE_TTL = 86400 * 30

/** L1 进程内缓存最大条目数 */
const L1_CACHE_MAX = 500

/** 任务元数据 Redis TTL：7天（秒） */
const TASK_TTL = 86400 * 7

/** 图片生成预估时间（秒） */
const ESTIMATED_IMAGE_SECONDS = 15

/** 视频生成预估时间（秒） */
const ESTIMATED_VIDEO_SECONDS = 60

// ================================
// Redis Key 工厂
// ================================

const REDIS_KEY = {
  /** L2 可视化内容缓存 */
  visualCache: (char: string, style: string, type: string) =>
    `zijing:visual:${char}:${style}:${type}`,
  /** 儿童用户每日生成计数 */
  dailyLimit: (userId: string, date: string) =>
    `zijing:visual:daily:${userId}:${date}`,
  /** 任务元数据 */
  task: (taskId: string) => `zijing:task:${taskId}`,
  /** 任务队列（Redis List，LPUSH入队，RPOP出队） */
  taskQueue: () => 'zijing:task:queue',
}

// ================================
// L1 进程内 LRU 缓存
// ================================

/**
 * 简单 LRU 缓存实现（Map 维护插入顺序，淘汰最旧条目）
 * 注意：Next.js 无服务器部署时每个请求共享同一个模块实例（Node.js 进程内有效）
 */
class SimpleLRUCache<K, V> {
  private readonly cache = new Map<K, V>()

  constructor(private readonly max: number) {}

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined
    // 移到末尾（标记为最近使用）
    const val = this.cache.get(key)!
    this.cache.delete(key)
    this.cache.set(key, val)
    return val
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.max) {
      // 淘汰最旧（第一个）条目
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  get size(): number {
    return this.cache.size
  }
}

// 模块单例 L1 缓存（进程内共享）
// key: `visual:{char}:{style}:{type}` → value: storage_url
const l1Cache = new SimpleLRUCache<string, string>(L1_CACHE_MAX)

// ================================
// VisualizeService
// ================================

export class VisualizeService {
  // --------------------------------------------------
  // 1. 三级缓存查找可视化内容
  // --------------------------------------------------

  /**
   * 查找可视化内容（三级缓存）
   * @returns 缓存命中 → { url, cached: true }
   *          未命中   → { taskId, cached: false }
   */
  async getVisualContent(
    char: string,
    style: VisualStyle,
    type: VisualType,
    userId: string,
    userRole: string
  ): Promise<VisualizeRequestDTO> {
    const cacheKey = REDIS_KEY.visualCache(char, style, type)

    // ── L1: 进程内 LRU 缓存 ──────────────────────────
    const l1Hit = l1Cache.get(cacheKey)
    if (l1Hit) {
      console.log(`[VisualizeService] L1 命中: key=${cacheKey}`)
      return {
        cached: true,
        resultUrl: l1Hit,
        estimatedSeconds: 0,
      }
    }

    // ── L2: Redis 缓存 ───────────────────────────────
    const l2Hit = await this.getFromL2(cacheKey)
    if (l2Hit) {
      // 回填 L1
      l1Cache.set(cacheKey, l2Hit)
      console.log(`[VisualizeService] L2 命中: key=${cacheKey}`)
      return {
        cached: true,
        resultUrl: l2Hit,
        estimatedSeconds: 0,
      }
    }

    // ── L3: 数据库预生成内容 ─────────────────────────
    const l3Hit = await this.getFromL3(char, style, type)
    if (l3Hit) {
      // 回填 L2 + L1
      await this.setToL2(cacheKey, l3Hit)
      l1Cache.set(cacheKey, l3Hit)
      console.log(`[VisualizeService] L3 命中: char=${char}, style=${style}, type=${type}`)
      return {
        cached: true,
        resultUrl: l3Hit,
        estimatedSeconds: 0,
      }
    }

    // ── 未命中：检查限额并入队任务 ──────────────────
    console.log(`[VisualizeService] 三级缓存未命中，准备入队: char=${char}`)

    // 儿童用户每日限额检查（20次）
    if (userRole === 'child') {
      await this.checkDailyLimit(userId)
    }

    // 生成 taskId 并入队
    const taskId = crypto.randomUUID()
    await this.enqueueTask({ taskId, char, style, type, userId })

    // 儿童用户递增每日计数
    if (userRole === 'child') {
      await this.incrementDailyCount(userId)
    }

    return {
      taskId,
      cached: false,
      estimatedSeconds:
        type === 'video' ? ESTIMATED_VIDEO_SECONDS : ESTIMATED_IMAGE_SECONDS,
    }
  }

  // --------------------------------------------------
  // 2. 任务状态查询
  // --------------------------------------------------

  /**
   * 查询任务状态（从 Redis 读取）
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusDTO> {
    const raw = await redis.get<string>(REDIS_KEY.task(taskId))

    if (!raw) {
      throw new BusinessException(
        ErrorCode.VISUAL_TASK_NOT_FOUND,
        '任务不存在或已过期',
        404
      )
    }

    const meta: VisualTaskMeta =
      typeof raw === 'string' ? JSON.parse(raw) : (raw as VisualTaskMeta)

    return {
      taskId: meta.taskId,
      status: meta.status,
      progress: meta.progress,
      resultUrl: meta.resultUrl,
      error: meta.error,
    }
  }

  // --------------------------------------------------
  // 3. 任务完成回调（供 Worker 调用）
  // --------------------------------------------------

  /**
   * 标记任务完成，更新 Redis 元数据并回填缓存，推送 Realtime 通知
   */
  async completeTask(taskId: string, resultUrl: string): Promise<void> {
    const raw = await redis.get<string>(REDIS_KEY.task(taskId))
    if (!raw) {
      console.warn(`[VisualizeService] completeTask: 任务不存在 taskId=${taskId}`)
      return
    }

    const meta: VisualTaskMeta =
      typeof raw === 'string' ? JSON.parse(raw) : (raw as VisualTaskMeta)

    // 更新任务状态
    const updatedMeta: VisualTaskMeta = {
      ...meta,
      status: 'completed',
      progress: 100,
      resultUrl,
      updatedAt: new Date().toISOString(),
    }
    await redis.set(REDIS_KEY.task(taskId), JSON.stringify(updatedMeta), {
      ex: TASK_TTL,
    })

    // 回填 L2 + L1 缓存
    const cacheKey = REDIS_KEY.visualCache(meta.char, meta.style, meta.type)
    await this.setToL2(cacheKey, resultUrl)
    l1Cache.set(cacheKey, resultUrl)

    console.log(`[VisualizeService] 任务完成: taskId=${taskId}, url=${resultUrl}`)

    // Supabase Realtime 推送
    await broadcastTaskComplete(taskId, {
      taskId,
      status: 'completed',
      resultUrl,
    })
  }

  /**
   * 标记任务失败
   */
  async failTask(taskId: string, error: string): Promise<void> {
    const raw = await redis.get<string>(REDIS_KEY.task(taskId))
    if (!raw) return

    const meta: VisualTaskMeta =
      typeof raw === 'string' ? JSON.parse(raw) : (raw as VisualTaskMeta)

    const updatedMeta: VisualTaskMeta = {
      ...meta,
      status: 'failed',
      progress: 0,
      error,
      updatedAt: new Date().toISOString(),
    }
    await redis.set(REDIS_KEY.task(taskId), JSON.stringify(updatedMeta), {
      ex: TASK_TTL,
    })

    // Supabase Realtime 推送
    await broadcastTaskComplete(taskId, { taskId, status: 'failed', error })

    console.error(`[VisualizeService] 任务失败: taskId=${taskId}, error=${error}`)
  }

  /**
   * 更新任务进度（0-100）
   */
  async updateTaskProgress(taskId: string, progress: number): Promise<void> {
    const raw = await redis.get<string>(REDIS_KEY.task(taskId))
    if (!raw) return

    const meta: VisualTaskMeta =
      typeof raw === 'string' ? JSON.parse(raw) : (raw as VisualTaskMeta)

    const updatedMeta: VisualTaskMeta = {
      ...meta,
      status: 'processing',
      progress: Math.min(100, Math.max(0, progress)),
      updatedAt: new Date().toISOString(),
    }
    await redis.set(REDIS_KEY.task(taskId), JSON.stringify(updatedMeta), {
      ex: TASK_TTL,
    })
  }

  // --------------------------------------------------
  // 私有方法：缓存操作
  // --------------------------------------------------

  /** L2 Redis 读取（异常时静默降级） */
  private async getFromL2(key: string): Promise<string | null> {
    try {
      const val = await redis.get<string>(key)
      return val ?? null
    } catch (error) {
      console.error(`[VisualizeService] L2 读取失败 key=${key}:`, error)
      return null
    }
  }

  /** L2 Redis 写入 30天（异常时静默降级） */
  private async setToL2(key: string, url: string): Promise<void> {
    try {
      await redis.set(key, url, { ex: L2_CACHE_TTL })
    } catch (error) {
      console.error(`[VisualizeService] L2 写入失败 key=${key}:`, error)
    }
  }

  /** L3 数据库预生成内容查找 */
  private async getFromL3(
    char: string,
    style: string,
    type: VisualType
  ): Promise<string | null> {
    try {
      const record = await prisma.visualContent.findFirst({
        where: {
          character: char,
          style,
          content_type: type === 'image' ? 'image' : 'video',
          is_pregenerated: true,
          review_status: 'approved',
        },
        select: { storage_url: true },
      })
      return record?.storage_url ?? null
    } catch (error) {
      console.error(`[VisualizeService] L3 查询失败 char=${char}:`, error)
      return null
    }
  }

  // --------------------------------------------------
  // 私有方法：任务队列
  // --------------------------------------------------

  /**
   * 将任务入队到 Redis List，并写入任务元数据
   */
  private async enqueueTask(params: {
    taskId: string
    char: string
    style: VisualStyle
    type: VisualType
    userId: string
  }): Promise<void> {
    const now = new Date().toISOString()
    const meta: VisualTaskMeta = {
      taskId: params.taskId,
      char: params.char,
      style: params.style,
      type: params.type,
      userId: params.userId,
      status: 'pending',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    }

    // 写入任务元数据（TTL: 7天）
    await redis.set(REDIS_KEY.task(params.taskId), JSON.stringify(meta), {
      ex: TASK_TTL,
    })

    // 入队（LPUSH 入队，Worker RPOP 出队，保证 FIFO）
    await redis.lpush(REDIS_KEY.taskQueue(), params.taskId)

    console.log(
      `[VisualizeService] 任务入队: taskId=${params.taskId}, char=${params.char}, ` +
        `style=${params.style}, type=${params.type}`
    )
  }

  // --------------------------------------------------
  // 私有方法：儿童用户每日限额
  // --------------------------------------------------

  /**
   * 检查儿童用户今日生成次数是否超限
   */
  private async checkDailyLimit(userId: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const key = REDIS_KEY.dailyLimit(userId, today)

    const count = await redis.get<number>(key)
    const currentCount = count ?? 0

    if (currentCount >= CHILD_DAILY_LIMIT) {
      throw new BusinessException(
        ErrorCode.VISUAL_DAILY_LIMIT_EXCEEDED,
        `今日可视化生成次数已达上限（${CHILD_DAILY_LIMIT}次），请明日再试`,
        429
      )
    }
  }

  /**
   * 儿童用户每日计数 +1（当天末尾自动清零）
   */
  private async incrementDailyCount(userId: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10)
    const key = REDIS_KEY.dailyLimit(userId, today)

    await redis.incr(key)

    // 设置到当天 23:59:59 UTC 过期（确保跨天自动清零）
    const now = new Date()
    const endOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)
    )
    const ttlSeconds = Math.max(1, Math.floor((endOfDay.getTime() - now.getTime()) / 1000))
    await redis.expire(key, ttlSeconds)
  }
}

// 导出单例
export const visualizeService = new VisualizeService()
