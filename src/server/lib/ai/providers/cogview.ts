/**
 * 智谱 CogView Provider（生图备用服务）
 *
 * 文档：https://bigmodel.cn/dev/api/image-model/cogview
 * 使用 OpenAI 兼容接口（同步返回 URL）
 */

import { AIConfig } from '@/config/ai.config'
import type { ImageOptions, AIProvider } from '../dispatcher'

export class CogViewProvider implements AIProvider {
  readonly name = 'cogview'
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly model: string
  private readonly timeout: number

  constructor() {
    const cfg = AIConfig.cogview
    this.apiKey = cfg.apiKey
    this.baseUrl = cfg.baseUrl
    this.model = cfg.model
    this.timeout = cfg.timeout
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey
  }

  async generateImage(prompt: string, options: ImageOptions = {}): Promise<Buffer> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      // Step 1：调用生图 API
      const response = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model ?? this.model,
          prompt,
          n: 1,
          size: options.size ?? '1024x1024',
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`[CogView] HTTP ${response.status}: ${body}`)
      }

      const data = (await response.json()) as {
        data?: Array<{ url?: string }>
      }

      const url = data.data?.[0]?.url
      if (!url) {
        throw new Error('[CogView] 响应中缺少图片 URL')
      }

      // Step 2：下载图片
      const imgRes = await fetch(url)
      if (!imgRes.ok) {
        throw new Error(`[CogView] 下载图片失败 HTTP ${imgRes.status}`)
      }

      const arrayBuffer = await imgRes.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } finally {
      clearTimeout(timer)
    }
  }

  async generateText(_prompt: string, _options: unknown): Promise<string> {
    throw new Error('CogViewProvider 不支持文本生成')
  }
}
