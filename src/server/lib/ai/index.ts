/**
 * AI 模块统一导出入口
 *
 * 对外只暴露：
 * 1. getAIDispatcher() —— 单例调度器（推荐使用）
 * 2. 各类型定义
 * 3. PromptTemplates —— Prompt 模板
 * 4. CircuitBreaker —— 如需单独使用熔断器
 */

export { AIDispatcher, AIDispatchError } from './dispatcher'
export type {
  AIProvider,
  ImageOptions,
  TextOptions,
  ReviewOptions,
  ImageResult,
  TextResult,
  ReviewResult,
} from './dispatcher'

export { CircuitBreaker, CircuitOpenError } from './circuit-breaker'
export type { CircuitBreakerOptions, CircuitState } from './circuit-breaker'

export { PromptTemplates, buildCharVisualizationPrompt, buildSignToStandardPrompt, buildCharExplanationPrompt } from './prompts'

// ==========================================
// 单例工厂
// ==========================================

import { AIDispatcher } from './dispatcher'
import { WanxProvider } from './providers/wanx'
import { CogViewProvider } from './providers/cogview'
import { QwenProvider } from './providers/qwen'
import { DeepSeekProvider } from './providers/deepseek'
import { ContentReviewProvider } from './providers/content-review'

let _dispatcher: AIDispatcher | null = null

/**
 * 获取全局唯一 AIDispatcher 实例
 *
 * - 生图：主=通义万相，备=智谱CogView
 * - 文本：主=通义千问，备=DeepSeek
 * - 审核：阿里云内容安全（不降级）
 */
export function getAIDispatcher(): AIDispatcher {
  if (!_dispatcher) {
    _dispatcher = new AIDispatcher(
      [new WanxProvider(), new CogViewProvider()],
      [new QwenProvider(), new DeepSeekProvider()],
      new ContentReviewProvider()
    )
  }
  return _dispatcher
}

/** 仅用于测试：重置单例 */
export function _resetAIDispatcher(): void {
  _dispatcher = null
}
