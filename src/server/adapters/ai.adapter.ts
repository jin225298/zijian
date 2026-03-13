/**
 * AI 服务反锁定适配器
 * 
 * 设计原则：通过统一接口抽象多个 AI 服务提供商，
 * 实现热切换，避免对单一服务的强依赖
 */

// ================================
// AI 服务接口定义
// ================================

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AICompletionOptions {
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  model?: string
}

export interface AICompletionResult {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface AIAdapter {
  name: string
  complete(options: AICompletionOptions): Promise<AICompletionResult>
  isAvailable(): boolean
}

// ================================
// 适配器基类
// ================================

abstract class BaseAIAdapter implements AIAdapter {
  abstract name: string
  abstract complete(options: AICompletionOptions): Promise<AICompletionResult>
  
  isAvailable(): boolean {
    return true
  }
}

// ================================
// 通义千问适配器
// ================================

export class QwenAdapter extends BaseAIAdapter {
  name = 'qwen'
  private apiKey: string
  private baseUrl: string

  constructor() {
    super()
    this.apiKey = process.env.QWEN_API_KEY ?? ''
    this.baseUrl = process.env.QWEN_BASE_URL ?? 'https://dashscope.aliyuncs.com/api/v1'
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const response = await fetch(`${this.baseUrl}/services/aigc/text-generation/generation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model ?? 'qwen-plus',
        input: {
          messages: options.messages,
        },
        parameters: {
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Qwen API 调用失败: ${response.statusText}`)
    }

    const data = await response.json() as {
      output?: { text?: string };
      usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
    }
    return {
      content: data.output?.text ?? '',
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
    }
  }
}

// ================================
// OpenAI 兼容适配器
// ================================

export class OpenAIAdapter extends BaseAIAdapter {
  name = 'openai'
  private apiKey: string
  private baseUrl: string

  constructor() {
    super()
    this.apiKey = process.env.OPENAI_API_KEY ?? ''
    this.baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model ?? 'gpt-3.5-turbo',
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API 调用失败: ${response.statusText}`)
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
    }
  }
}

// ================================
// AI 服务管理器（自动故障转移）
// ================================

export class AIServiceManager {
  private adapters: AIAdapter[]
  private currentIndex = 0

  constructor(adapters: AIAdapter[]) {
    this.adapters = adapters
  }

  /**
   * 执行 AI 补全，自动故障转移到下一个可用服务
   */
  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const availableAdapters = this.adapters.filter(a => a.isAvailable())
    
    if (availableAdapters.length === 0) {
      throw new Error('没有可用的 AI 服务')
    }

    for (const adapter of availableAdapters) {
      try {
        console.log(`[AI] 使用 ${adapter.name} 服务`)
        return await adapter.complete(options)
      } catch (error) {
        console.error(`[AI] ${adapter.name} 调用失败，尝试下一个服务:`, error)
        continue
      }
    }

    throw new Error('所有 AI 服务均不可用')
  }
}

// ================================
// 默认 AI 服务实例（单例）
// ================================

let _aiService: AIServiceManager | null = null

export function getAIService(): AIServiceManager {
  if (!_aiService) {
    _aiService = new AIServiceManager([
      new QwenAdapter(),
      new OpenAIAdapter(),
    ])
  }
  return _aiService
}
