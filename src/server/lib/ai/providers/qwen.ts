/**
 * 通义千问 Provider（LLM 主服务）
 *
 * 文档：https://help.aliyun.com/zh/dashscope/developer-reference/compatibility-of-openai-with-dashscope
 * 使用 OpenAI 兼容接口，方便切换
 */

import { AIConfig } from '@/config/ai.config'
import type { TextOptions, TextResult, AIProvider } from '../dispatcher'

export class QwenProvider implements AIProvider {
  readonly name = 'qwen'
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly model: string
  private readonly timeout: number

  constructor() {
    const cfg = AIConfig.qwen
    this.apiKey = cfg.apiKey
    this.baseUrl = cfg.baseUrl
    this.model = cfg.model
    this.timeout = cfg.timeout
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey
  }

  /** 不支持生图，直接抛出 */
  async generateImage(_prompt: string, _options: unknown): Promise<Buffer> {
    throw new Error('QwenProvider 不支持生图，请使用 WanxProvider')
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
        throw new Error(`[Qwen] HTTP ${response.status}: ${body}`)
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }

      const content = data.choices?.[0]?.message?.content
      if (content == null) {
        throw new Error('[Qwen] 响应中缺少 choices[0].message.content')
      }
      return content
    } finally {
      clearTimeout(timer)
    }
  }
}
