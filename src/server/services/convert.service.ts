// =============================================================================
// 字见系统 — 语言转换服务
// =============================================================================
// 任务: TASK-BE-009
// 职责:
//   - 手语式中文 → 标准书面语 AI 转换
//   - Redis 两级缓存（命中直接返回，Key: nlp:{sha256(text:context)}）
//   - 10秒超时控制 + AI 熔断降级（降级时返回原文 + 低置信度）
//   - 字符级 LCS Diff 对比原文与转换结果
//   - 异步记录 translate_history（不阻塞响应）
// =============================================================================

import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { getAIDispatcher } from '@/server/lib/ai'
import { buildConvertPrompt, type ConvertContext } from '@/server/lib/ai/prompts/convert-examples'

// ==========================================
// 类型定义
// ==========================================

export interface DiffSegment {
  type: 'unchanged' | 'changed' | 'added' | 'removed'
  text: string
}

export interface ConvertResult {
  original: string
  converted: string
  confidence: number
  alternatives: string[]
  isFallback: boolean
  diff: DiffSegment[]
}

/** LLM 输出的原始 JSON 结构 */
interface LLMOutputJSON {
  converted: string
  confidence: number
  alternatives: string[]
}

// ==========================================
// 常量配置
// ==========================================

/** NLP 缓存 TTL：1小时（热门句式命中率高） */
const NLP_CACHE_TTL = 3600

/** AI 调用超时：10秒 */
const AI_TIMEOUT_MS = 10_000

/** 降级时的置信度 */
const FALLBACK_CONFIDENCE = 0.3

/** 最大允许文本长度 */
const MAX_TEXT_LENGTH = 500

// ==========================================
// Redis Key 工厂
// ==========================================

const REDIS_KEY = {
  /**
   * NLP 缓存 Key：nlp:{sha256(text:context)}
   * 相同输入+场景组合 → 稳定命中同一缓存桶
   */
  nlpCache: (text: string, context: string): string => {
    const hash = crypto
      .createHash('sha256')
      .update(`${text}:${context}`)
      .digest('hex')
    return `nlp:${hash}`
  },
}

// ==========================================
// ConvertService
// ==========================================

export class ConvertService {
  // --------------------------------------------------
  // 1. 主转换方法
  // --------------------------------------------------

  /**
   * 将手语式中文转换为标准书面语
   *
   * @param text    - 手语式中文原文（最长 500 字）
   * @param context - 场景（daily | formal | academic）
   * @param userId  - 可选的用户 ID（用于记录历史）
   */
  async convert(
    text: string,
    context: string,
    userId?: string
  ): Promise<ConvertResult> {
    // Step 1: 输入清理（去除首尾空格，合并多余空格）
    const cleanText = text.trim().replace(/\s{2,}/g, ' ')

    if (!cleanText) {
      return this.buildFallbackResult('', '输入文本不能为空')
    }

    if (cleanText.length > MAX_TEXT_LENGTH) {
      return this.buildFallbackResult(cleanText, '文本超过最大长度限制')
    }

    const safeContext = this.validateContext(context)
    const cacheKey = REDIS_KEY.nlpCache(cleanText, safeContext)

    // Step 2: 缓存查找
    const cached = await this.getFromCache(cacheKey)
    if (cached) {
      console.log(`[ConvertService] 缓存命中: key=${cacheKey.substring(0, 20)}...`)
      return cached
    }

    // Step 3: 构建 Prompt（few-shot）
    const prompt = buildConvertPrompt(cleanText, safeContext)

    // Step 4: 调用 AI 调度器（含 10 秒超时 + 熔断降级）
    let result: ConvertResult
    try {
      const aiOutput = await this.callAIWithTimeout(prompt)
      result = this.parseAndBuildResult(cleanText, aiOutput)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.warn(`[ConvertService] AI 调用失败，使用降级结果: ${errMsg}`)
      result = this.buildFallbackResult(cleanText)
    }

    // Step 5: 缓存写入（降级结果不缓存，避免缓存无效数据）
    if (!result.isFallback) {
      await this.setToCache(cacheKey, result)
    }

    // Step 6: 异步记录历史（不阻塞响应）
    if (userId) {
      this.recordHistory({
        userId,
        inputText: cleanText,
        outputText: result.converted,
        confidence: result.confidence,
        isFallback: result.isFallback,
      }).catch((err) =>
        console.error('[ConvertService] 记录历史失败:', err)
      )
    }

    return result
  }

  // --------------------------------------------------
  // 2. AI 调用（含超时控制）
  // --------------------------------------------------

  /**
   * 调用 AI 调度器生成文本，超过 10 秒则 reject
   */
  private async callAIWithTimeout(prompt: string): Promise<string> {
    const dispatcher = getAIDispatcher()

    const aiPromise = dispatcher.generateText(prompt, {
      temperature: 0.3,          // 较低温度保证输出稳定性
      maxTokens: 512,
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('AI 调用超时（10秒）')),
        AI_TIMEOUT_MS
      )
    )

    const textResult = await Promise.race([aiPromise, timeoutPromise])
    return textResult.content
  }

  // --------------------------------------------------
  // 3. 解析 LLM 输出并构建结果
  // --------------------------------------------------

  /**
   * 解析 LLM 输出的 JSON，构建 ConvertResult
   * 兼容以下输出格式：
   *   - 裸 JSON：{"converted":"...","confidence":0.9,"alternatives":[...]}
   *   - Markdown 代码块包裹：```json {...} ```
   */
  private parseAndBuildResult(original: string, llmOutput: string): ConvertResult {
    const parsed = this.parseLLMOutput(llmOutput)

    if (!parsed) {
      console.warn('[ConvertService] LLM 输出解析失败，使用降级:', llmOutput.substring(0, 100))
      return this.buildFallbackResult(original)
    }

    const converted = parsed.converted?.trim() ?? original
    const confidence = this.clamp(Number(parsed.confidence) || 0.7, 0, 1)
    const alternatives = Array.isArray(parsed.alternatives)
      ? parsed.alternatives
          .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
          .slice(0, 3)
      : []

    const diff = this.computeDiff(original, converted)

    return {
      original,
      converted,
      confidence,
      alternatives,
      isFallback: false,
      diff,
    }
  }

  /**
   * 从 LLM 输出中提取 JSON 对象
   */
  private parseLLMOutput(raw: string): LLMOutputJSON | null {
    try {
      // 尝试直接解析
      const trimmed = raw.trim()
      if (trimmed.startsWith('{')) {
        return JSON.parse(trimmed) as LLMOutputJSON
      }

      // 尝试从 Markdown 代码块中提取
      const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1].trim()) as LLMOutputJSON
      }

      // 尝试从任意位置提取第一个 JSON 对象
      const jsonMatch = trimmed.match(/\{[\s\S]*"converted"[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as LLMOutputJSON
      }

      return null
    } catch {
      return null
    }
  }

  // --------------------------------------------------
  // 4. Diff 计算（字符级 LCS）
  // --------------------------------------------------

  /**
   * 计算原文与转换结果的字符级差异
   *
   * 算法：Myers LCS（动态规划），时间复杂度 O(m×n)
   * 对手语式输入，先去除空格后与转换结果对比
   */
  private computeDiff(original: string, converted: string): DiffSegment[] {
    // 去除原文中的空格（手语式中文词间分隔符）进行字符级对比
    const src = original.replace(/\s+/g, '')
    const dst = converted

    if (!src || !dst) {
      if (!src && dst) return [{ type: 'added', text: dst }]
      if (src && !dst) return [{ type: 'removed', text: src }]
      return []
    }

    const m = src.length
    const n = dst.length

    // 构建 LCS 动态规划表
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      new Array(n + 1).fill(0)
    )

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (src[i - 1] === dst[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
        }
      }
    }

    // 反向回溯，生成操作序列
    const ops: Array<{ type: 'unchanged' | 'added' | 'removed'; char: string }> = []
    let i = m
    let j = n

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && src[i - 1] === dst[j - 1]) {
        ops.unshift({ type: 'unchanged', char: src[i - 1] })
        i--
        j--
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.unshift({ type: 'added', char: dst[j - 1] })
        j--
      } else {
        ops.unshift({ type: 'removed', char: src[i - 1] })
        i--
      }
    }

    // 合并相邻同类操作为 DiffSegment
    const segments: DiffSegment[] = []
    for (const op of ops) {
      const last = segments[segments.length - 1]
      if (last && last.type === op.type) {
        last.text += op.char
      } else {
        segments.push({ type: op.type, text: op.char })
      }
    }

    return segments
  }

  // --------------------------------------------------
  // 5. 降级结果构建
  // --------------------------------------------------

  /**
   * 构建降级结果（AI 不可用时返回原文）
   */
  private buildFallbackResult(original: string, _reason?: string): ConvertResult {
    return {
      original,
      converted: original,
      confidence: FALLBACK_CONFIDENCE,
      alternatives: [],
      isFallback: true,
      diff: [],
    }
  }

  // --------------------------------------------------
  // 6. 缓存操作
  // --------------------------------------------------

  private async getFromCache(key: string): Promise<ConvertResult | null> {
    try {
      const raw = await redis.get<string>(key)
      if (!raw) return null
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      return data as ConvertResult
    } catch (error) {
      console.error(`[ConvertService] 缓存读取失败 key=${key.substring(0, 20)}:`, error)
      return null
    }
  }

  private async setToCache(key: string, result: ConvertResult): Promise<void> {
    try {
      await redis.setex(key, NLP_CACHE_TTL, JSON.stringify(result))
    } catch (error) {
      console.error(`[ConvertService] 缓存写入失败 key=${key.substring(0, 20)}:`, error)
    }
  }

  // --------------------------------------------------
  // 7. 历史记录（异步）
  // --------------------------------------------------

  /**
   * 异步写入 translate_history 表
   * 由调用方 .catch() 处理异常，不阻塞主流程
   */
  private async recordHistory(params: {
    userId: string
    inputText: string
    outputText: string
    confidence: number
    isFallback: boolean
    aiProvider?: string
  }): Promise<void> {
    await prisma.translateHistory.create({
      data: {
        user_id: params.userId,
        input_text: params.inputText,
        output_text: params.outputText,
        confidence: params.confidence,
        ai_provider: params.aiProvider ?? null,
        is_fallback: params.isFallback,
      },
    })
    console.log(`[ConvertService] 历史记录成功: userId=${params.userId}`)
  }

  // --------------------------------------------------
  // 工具方法
  // --------------------------------------------------

  private validateContext(context: string): ConvertContext {
    const valid: ConvertContext[] = ['daily', 'formal', 'academic']
    return valid.includes(context as ConvertContext)
      ? (context as ConvertContext)
      : 'daily'
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }
}

// ==========================================
// 单例导出
// ==========================================

export const convertService = new ConvertService()
