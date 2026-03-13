/**
 * 通义万相 Provider（生图主服务）
 *
 * 文档：https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-wanxiang
 * 采用异步任务模式：先提交任务，再轮询结果
 */

import { AIConfig } from '@/config/ai.config'
import type { ImageOptions, AIProvider } from '../dispatcher'

interface WanxTaskResponse {
  output?: {
    task_id?: string
    task_status?: string
    results?: Array<{ url?: string }>
  }
  code?: string
  message?: string
}

export class WanxProvider implements AIProvider {
  readonly name = 'wanx'
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly model: string
  private readonly timeout: number

  /** 轮询间隔（ms） */
  private readonly pollInterval = 2_000
  /** 最大轮询次数 */
  private readonly maxPolls = 20

  constructor() {
    const cfg = AIConfig.wanx
    this.apiKey = cfg.apiKey
    this.baseUrl = cfg.baseUrl
    this.model = cfg.model
    this.timeout = cfg.timeout
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey
  }

  async generateImage(prompt: string, options: ImageOptions = {}): Promise<Buffer> {
    // Step 1：提交异步生图任务
    const taskId = await this.submitTask(prompt, options)

    // Step 2：轮询任务结果
    const imageUrl = await this.pollTask(taskId)

    // Step 3：下载图片为 Buffer
    return this.downloadImage(imageUrl)
  }

  async generateText(_prompt: string, _options: unknown): Promise<string> {
    throw new Error('WanxProvider 不支持文本生成，请使用 QwenProvider')
  }

  // --------------------------------------------------
  // 私有方法
  // --------------------------------------------------

  private async submitTask(prompt: string, options: ImageOptions): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)

    try {
      const response = await fetch(
        `${this.baseUrl}/services/aigc/text2image/image-synthesis`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'X-DashScope-Async': 'enable',
          },
          body: JSON.stringify({
            model: this.model,
            input: { prompt },
            parameters: {
              style: options.style ?? '<auto>',
              size: options.size ?? '1024*1024',
              n: 1,
            },
          }),
          signal: controller.signal,
        }
      )

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`[Wanx] 提交任务失败 HTTP ${response.status}: ${body}`)
      }

      const data = (await response.json()) as WanxTaskResponse

      if (!data.output?.task_id) {
        throw new Error(`[Wanx] 提交任务失败: ${data.message ?? 'task_id 为空'}`)
      }

      return data.output.task_id
    } finally {
      clearTimeout(timer)
    }
  }

  private async pollTask(taskId: string): Promise<string> {
    const deadline = Date.now() + this.timeout

    for (let i = 0; i < this.maxPolls; i++) {
      if (Date.now() > deadline) {
        throw new Error(`[Wanx] 任务 ${taskId} 超时`)
      }

      await sleep(this.pollInterval)

      const response = await fetch(
        `${this.baseUrl}/tasks/${taskId}`,
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        }
      )

      if (!response.ok) {
        throw new Error(`[Wanx] 查询任务失败 HTTP ${response.status}`)
      }

      const data = (await response.json()) as WanxTaskResponse
      const status = data.output?.task_status

      if (status === 'SUCCEEDED') {
        const url = data.output?.results?.[0]?.url
        if (!url) throw new Error('[Wanx] 任务成功但 URL 为空')
        return url
      }

      if (status === 'FAILED') {
        throw new Error(`[Wanx] 任务失败: ${data.message ?? '未知原因'}`)
      }

      // PENDING / RUNNING → 继续等待
    }

    throw new Error(`[Wanx] 超过最大轮询次数（${this.maxPolls}）`)
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)

    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) {
        throw new Error(`[Wanx] 下载图片失败 HTTP ${response.status}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } finally {
      clearTimeout(timer)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
