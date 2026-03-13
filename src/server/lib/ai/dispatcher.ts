/**
 * AI 调度器（AI Dispatcher）
 *
 * 职责：
 * - 统一管理生图、LLM、内容审核三类 AI 服务
 * - 每个服务配置独立熔断器（CircuitBreaker）
 * - 主备自动切换，生图服务都失败时降级为预缓存图片
 * - 内容审核不降级，不可用时直接抛出异常
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker'
import { AIConfig } from '@/config/ai.config'

// ==========================================
// 类型定义
// ==========================================

export interface ImageOptions {
  style?: string
  size?: string
  model?: string
}

export interface TextOptions {
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  model?: string
}

export interface ReviewOptions {
  scenes?: string[]
  dataId?: string
}

export interface ImageResult {
  image: Buffer
  provider: string
  isFallback: boolean
}

export interface TextResult {
  content: string
  provider: string
}

export interface ReviewResult {
  passed: boolean
  blocked: boolean
  needsReview: boolean
  scenes: string[]
  details: Array<{
    scene: string
    suggestion: 'pass' | 'review' | 'block'
    label: string
    rate: number
  }>
}

export interface AIProvider {
  readonly name: string
  isAvailable(): Promise<boolean>
  generateImage(prompt: string, options: ImageOptions): Promise<Buffer>
  generateText(prompt: string, options: TextOptions): Promise<string>
}

// ==========================================
// AIDispatcher
// ==========================================

export class AIDispatcher {
  private readonly imageProviders: AIProvider[]
  private readonly textProviders: AIProvider[]
  private readonly circuitBreakers: Map<string, CircuitBreaker>

  /**
   * @param imageProviders - 生图 Provider 列表，按优先级排列（index 0 = 主服务）
   * @param textProviders  - 文本 Provider 列表，按优先级排列
   * @param contentReviewProvider - 内容审核 Provider（独立注入，不熔断降级）
   */
  constructor(
    imageProviders: AIProvider[],
    textProviders: AIProvider[],
    private readonly contentReviewProvider: {
      reviewImage(image: Buffer, options?: ReviewOptions): Promise<ReviewResult>
      reviewText(text: string, options?: ReviewOptions): Promise<ReviewResult>
    }
  ) {
    this.imageProviders = imageProviders
    this.textProviders = textProviders

    // 为每个 Provider 创建独立熔断器
    this.circuitBreakers = new Map()
    const cbOptions = AIConfig.circuitBreaker
    for (const p of [...imageProviders, ...textProviders]) {
      this.circuitBreakers.set(p.name, new CircuitBreaker(p.name, cbOptions))
    }
  }

  // --------------------------------------------------
  // 生图：主（万相）→ 备（CogView）→ 降级（本地图片）
  // --------------------------------------------------

  async generateImage(
    prompt: string,
    options: ImageOptions = {}
  ): Promise<ImageResult> {
    const errors: Error[] = []

    for (const provider of this.imageProviders) {
      const available = await provider.isAvailable()
      if (!available) {
        console.warn(`[AIDispatcher] ${provider.name} 未配置 API Key，跳过`)
        continue
      }

      const cb = this.circuitBreakers.get(provider.name)!

      try {
        const image = await cb.execute(() =>
          provider.generateImage(prompt, options)
        )

        console.info(
          `[AIDispatcher] 生图成功，provider=${provider.name}`
        )

        return { image, provider: provider.name, isFallback: false }
      } catch (error) {
        const err = error as Error
        errors.push(err)

        if (error instanceof CircuitOpenError) {
          console.warn(
            `[AIDispatcher] ${provider.name} 熔断器已开，切换到下一个 provider`
          )
        } else {
          console.error(
            `[AIDispatcher] ${provider.name} 生图失败，切换到下一个:`,
            err.message
          )
        }
      }
    }

    // 所有 Provider 都失败 → 降级返回预缓存图片
    console.warn('[AIDispatcher] 所有生图服务不可用，使用降级图片')
    const fallbackImage = this.loadFallbackImage()
    return { image: fallbackImage, provider: 'fallback', isFallback: true }
  }

  // --------------------------------------------------
  // 文本生成：主（千问）→ 备（DeepSeek）
  // --------------------------------------------------

  async generateText(
    prompt: string,
    options: TextOptions = {}
  ): Promise<TextResult> {
    const errors: Error[] = []

    for (const provider of this.textProviders) {
      const available = await provider.isAvailable()
      if (!available) {
        console.warn(`[AIDispatcher] ${provider.name} 未配置 API Key，跳过`)
        continue
      }

      const cb = this.circuitBreakers.get(provider.name)!

      try {
        const content = await cb.execute(() =>
          provider.generateText(prompt, options)
        )

        console.info(
          `[AIDispatcher] 文本生成成功，provider=${provider.name}`
        )

        return { content, provider: provider.name }
      } catch (error) {
        const err = error as Error
        errors.push(err)

        if (error instanceof CircuitOpenError) {
          console.warn(
            `[AIDispatcher] ${provider.name} 熔断器已开，切换到下一个 provider`
          )
        } else {
          console.error(
            `[AIDispatcher] ${provider.name} 文本生成失败，切换到下一个:`,
            err.message
          )
        }
      }
    }

    const messages = errors.map((e) => e.message).join('; ')
    throw new AIDispatchError(
      `所有文本生成服务均不可用: ${messages}`
    )
  }

  // --------------------------------------------------
  // 内容审核：不降级，不可用时直接抛出
  // --------------------------------------------------

  async reviewContent(
    content: Buffer | string,
    type: 'image' | 'text',
    options: ReviewOptions = {}
  ): Promise<ReviewResult> {
    try {
      if (type === 'image') {
        return await this.contentReviewProvider.reviewImage(
          content as Buffer,
          options
        )
      } else {
        return await this.contentReviewProvider.reviewText(
          content as string,
          options
        )
      }
    } catch (error) {
      // 内容审核失败直接上抛，不降级
      console.error('[AIDispatcher] 内容审核服务异常:', (error as Error).message)
      throw error
    }
  }

  // --------------------------------------------------
  // 工具方法
  // --------------------------------------------------

  /** 获取所有熔断器状态（用于监控面板） */
  getCircuitBreakerStats(): Record<string, { state: string; failures: number }> {
    const stats: Record<string, { state: string; failures: number }> = {}
    for (const [name, cb] of this.circuitBreakers) {
      stats[name] = {
        state: cb.getState(),
        failures: cb.getFailureCount(),
      }
    }
    return stats
  }

  private loadFallbackImage(): Buffer {
    try {
      const fallbackPath = join(process.cwd(), 'public', 'fallback', 'char-placeholder.png')
      return readFileSync(fallbackPath)
    } catch {
      // 如果降级图片也不存在，返回 1×1 透明 PNG
      console.error('[AIDispatcher] 降级图片不存在，使用最小 PNG 占位符')
      return TRANSPARENT_PNG_1X1
    }
  }
}

/** 1×1 透明 PNG（最终兜底） */
const TRANSPARENT_PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

// --------------------------------------------------
// 自定义错误
// --------------------------------------------------

export class AIDispatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIDispatchError'
  }
}
