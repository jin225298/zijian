/**
 * 阿里云内容安全 Provider（不可降级）
 *
 * 文档：https://help.aliyun.com/zh/content-moderation/
 * 注意：此服务不配置熔断降级，不可用时直接报错
 *
 * 鉴权方式：HMAC-SHA1 签名（阿里云 ROA 风格）
 */

import { createHmac, createHash } from 'crypto'
import { AIConfig } from '@/config/ai.config'
import type { ReviewOptions, ReviewResult } from '../dispatcher'

interface AliyunScanResponse {
  code: number
  data?: Array<{
    code: number
    taskId: string
    results?: Array<{
      scene: string
      suggestion: string  // 'pass' | 'review' | 'block'
      label: string
      rate: number
    }>
  }>
  msg?: string
}

export class ContentReviewProvider {
  private readonly accessKeyId: string
  private readonly accessKeySecret: string
  private readonly regionId: string
  private readonly timeout: number
  private readonly endpoint: string

  constructor() {
    const cfg = AIConfig.contentReview
    this.accessKeyId = cfg.accessKeyId
    this.accessKeySecret = cfg.accessKeySecret
    this.regionId = cfg.regionId
    this.timeout = cfg.timeout
    this.endpoint = `https://green-cip.${this.regionId}.aliyuncs.com`
  }

  /**
   * 审核图片
   * 注意：该服务不降级，不可用时抛出异常，由上层决定是否拦截
   */
  async reviewImage(image: Buffer, options: ReviewOptions = {}): Promise<ReviewResult> {
    this.assertConfigured()

    const scenes = options.scenes ?? ['porn', 'terrorism', 'ad']
    const base64 = image.toString('base64')

    const requestBody = JSON.stringify({
      tasks: [
        {
          dataId: options.dataId ?? `task_${Date.now()}`,
          content: base64,
        },
      ],
      scenes,
    })

    const result = await this.callAliyunAPI('/green/image/scan', requestBody)
    return this.parseResult(result, scenes)
  }

  /**
   * 审核文本
   * 注意：该服务不降级，不可用时抛出异常
   */
  async reviewText(text: string, options: ReviewOptions = {}): Promise<ReviewResult> {
    this.assertConfigured()

    const scenes = options.scenes ?? ['antispam']

    const requestBody = JSON.stringify({
      tasks: [
        {
          dataId: options.dataId ?? `task_${Date.now()}`,
          content: text,
        },
      ],
      scenes,
    })

    const result = await this.callAliyunAPI('/green/text/scan', requestBody)
    return this.parseResult(result, scenes)
  }

  // --------------------------------------------------
  // 私有方法
  // --------------------------------------------------

  private assertConfigured(): void {
    if (!this.accessKeyId || !this.accessKeySecret) {
      throw new ContentReviewUnavailableError(
        '[ContentReview] 未配置 ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET'
      )
    }
  }

  private async callAliyunAPI(
    path: string,
    body: string
  ): Promise<AliyunScanResponse> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const date = new Date().toUTCString()
      const contentMd5 = createHash('md5').update(body).digest('base64')
      const contentType = 'application/json'
      const stringToSign = [
        'POST',
        contentMd5,
        contentType,
        date,
        path,
      ].join('\n')

      const signature = createHmac('sha1', this.accessKeySecret)
        .update(stringToSign)
        .digest('base64')

      const authorization = `acs ${this.accessKeyId}:${signature}`

      const response = await fetch(`${this.endpoint}${path}`, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': contentType,
          'Content-MD5': contentMd5,
          Date: date,
          Accept: 'application/json',
        },
        body,
        signal: controller.signal,
      })

      if (!response.ok) {
        const errBody = await response.text()
        throw new ContentReviewUnavailableError(
          `[ContentReview] HTTP ${response.status}: ${errBody}`
        )
      }

      return (await response.json()) as AliyunScanResponse
    } catch (error) {
      if (error instanceof ContentReviewUnavailableError) throw error
      throw new ContentReviewUnavailableError(
        `[ContentReview] 请求失败: ${(error as Error).message}`
      )
    } finally {
      clearTimeout(timer)
    }
  }

  private parseResult(
    data: AliyunScanResponse,
    scenes: string[]
  ): ReviewResult {
    if (data.code !== 200) {
      throw new ContentReviewUnavailableError(
        `[ContentReview] API 错误 code=${data.code} msg=${data.msg}`
      )
    }

    const taskResult = data.data?.[0]
    if (!taskResult || taskResult.code !== 200) {
      throw new ContentReviewUnavailableError(
        `[ContentReview] 任务执行失败 code=${taskResult?.code}`
      )
    }

    // 只要有一个 scene 返回 block，整体就是 blocked
    const results = taskResult.results ?? []
    const isBlocked = results.some((r) => r.suggestion === 'block')
    const needsReview = !isBlocked && results.some((r) => r.suggestion === 'review')

    const details = results.map((r) => ({
      scene: r.scene,
      suggestion: r.suggestion as 'pass' | 'review' | 'block',
      label: r.label,
      rate: r.rate,
    }))

    return {
      passed: !isBlocked && !needsReview,
      blocked: isBlocked,
      needsReview,
      scenes,
      details,
    }
  }
}

// --------------------------------------------------
// 自定义错误
// --------------------------------------------------

export class ContentReviewUnavailableError extends Error {
  readonly isContentReviewError = true

  constructor(message: string) {
    super(message)
    this.name = 'ContentReviewUnavailableError'
  }
}
