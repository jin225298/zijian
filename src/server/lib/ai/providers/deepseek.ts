/**
 * DeepSeek Provider（LLM 备用服务）
 *
 * 文档：https://platform.deepseek.com/api-docs/
 * 使用 OpenAI 兼容接口
 */

import { AIConfig } from '@/config/ai.config'
import type { TextOptions, AIProvider } from '../dispatcher'

export class DeepSeekProvider implements AIProvider {
  readonly name = 'deepseek'
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly model: string
  private readonly timeout: number

  constructor() {
    const cfg = AIConfig.deepseek
    this.apiKey = cfg.apiKey
    this.baseUrl = cfg.baseUrl
    this.model = cfg.model
    this.timeout = cfg.timeout
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey
  }

  async generateImage(_prompt: string, _options: unknown): Promise<Buffer> {
    throw new Error('DeepSeekProvider 不支持生图')
  }

  async generateText(prompt: string, options: TextOptions = {}): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model ?? this.model,
          messages: [
            ...(options.systemPrompt
              ? [{ role: 'system', content: options.systemPrompt }]
              : []),
            { role: 'user', content: prompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`[DeepSeek] HTTP ${response.status}: ${body}`)
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }

      const content = data.choices?.[0]?.message?.content
      if (content == null) {
        throw new Error('[DeepSeek] 响应中缺少 choices[0].message.content')
      }
      return content
    } finally {
      clearTimeout(timer)
    }
  }
}
