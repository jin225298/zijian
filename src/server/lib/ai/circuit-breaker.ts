/**
 * Circuit Breaker（熔断器）
 *
 * 状态机：
 *   closed  ─── 连续失败 >= failureThreshold ──▶  open
 *   open    ─── 超过 timeout 后首次调用        ──▶  half-open
 *   half-open ── 连续成功 >= successThreshold  ──▶  closed
 *   half-open ── 任意失败                      ──▶  open
 */

export interface CircuitBreakerOptions {
  /** 触发熔断的失败次数（默认 5） */
  failureThreshold: number
  /** 恢复正常的连续成功次数（默认 3） */
  successThreshold: number
  /** 熔断后等待时间 ms（默认 30000） */
  timeout: number
  /** 统计窗口 ms（默认 10000，超出窗口的旧失败不计入） */
  monitorInterval: number
}

export type CircuitState = 'closed' | 'open' | 'half-open'

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30_000,
  monitorInterval: 10_000,
}

export class CircuitBreaker {
  readonly name: string
  private readonly options: CircuitBreakerOptions

  private state: CircuitState = 'closed'
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime: number = 0
  /** 熔断发生的时刻（用于计算 timeout） */
  private openedAt: number = 0

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  // --------------------------------------------------
  // 公开 API
  // --------------------------------------------------

  /**
   * 执行目标函数，受熔断器保护。
   * - closed：直接执行
   * - open：立即抛出 CircuitOpenError
   * - half-open：尝试执行，成功则计入恢复，失败则重新打开
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new CircuitOpenError(
        `[CircuitBreaker:${this.name}] 熔断器已打开，拒绝请求（将在 ${this.remainingTimeout()}ms 后尝试恢复）`
      )
    }

    // open → half-open 过渡（timeout 已过）
    if (this.state === 'open') {
      this.transitionTo('half-open')
    }

    try {
      const result = await fn()
      this.recordSuccess()
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  /** 获取当前熔断器状态（用于监控/测试） */
  getState(): CircuitState {
    return this.state
  }

  /** 获取当前失败计数 */
  getFailureCount(): number {
    return this.failureCount
  }

  /** 重置熔断器（用于测试或手动干预） */
  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = 0
    this.openedAt = 0
  }

  // --------------------------------------------------
  // 私有方法
  // --------------------------------------------------

  /**
   * 记录一次失败。
   * - closed：若在 monitorInterval 内失败次数超过阈值，转 open
   * - half-open：任意失败立即重新 open
   */
  private recordFailure(): void {
    const now = Date.now()

    if (this.state === 'half-open') {
      // half-open 失败 → 立即重新熔断
      this.successCount = 0
      this.failureCount = 1
      this.lastFailureTime = now
      this.transitionTo('open')
      return
    }

    // closed 状态：检查失败是否在统计窗口内
    if (now - this.lastFailureTime > this.options.monitorInterval) {
      // 超出监控窗口，重置计数
      this.failureCount = 0
    }

    this.failureCount++
    this.lastFailureTime = now

    if (this.failureCount >= this.options.failureThreshold) {
      this.transitionTo('open')
    }
  }

  /**
   * 记录一次成功。
   * - half-open：若连续成功次数达到阈值，转 closed
   * - closed：重置失败计数
   */
  private recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++
      if (this.successCount >= this.options.successThreshold) {
        this.transitionTo('closed')
      }
      return
    }

    // closed 状态成功：重置失败计数
    this.failureCount = 0
    this.successCount = 0
  }

  /**
   * 是否处于拒绝请求的 open 状态（timeout 未过）。
   */
  private isOpen(): boolean {
    if (this.state !== 'open') return false
    return Date.now() - this.openedAt < this.options.timeout
  }

  /** 距熔断超时还剩多少 ms */
  private remainingTimeout(): number {
    return Math.max(0, this.options.timeout - (Date.now() - this.openedAt))
  }

  private transitionTo(next: CircuitState): void {
    const prev = this.state
    this.state = next

    if (next === 'open') {
      this.openedAt = Date.now()
      console.warn(
        `[CircuitBreaker:${this.name}] ${prev} → open（失败次数: ${this.failureCount}）`
      )
    } else if (next === 'half-open') {
      this.successCount = 0
      console.info(`[CircuitBreaker:${this.name}] open → half-open，开始探测恢复`)
    } else if (next === 'closed') {
      this.failureCount = 0
      this.successCount = 0
      console.info(`[CircuitBreaker:${this.name}] half-open → closed，服务已恢复`)
    }
  }
}

// --------------------------------------------------
// 自定义错误
// --------------------------------------------------

export class CircuitOpenError extends Error {
  readonly isCircuitOpen = true

  constructor(message: string) {
    super(message)
    this.name = 'CircuitOpenError'
  }
}
