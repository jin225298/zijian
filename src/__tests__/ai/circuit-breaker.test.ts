/**
 * CircuitBreaker 单元测试
 *
 * 运行方式（需先安装 Jest）：
 *   npm install --save-dev jest @types/jest ts-jest
 *   npx jest src/__tests__/ai/circuit-breaker.test.ts
 *
 * 验收标准：
 * ✅ 模拟 5 次失败触发熔断（state → open）
 * ✅ 熔断期间请求立即被拒绝（抛出 CircuitOpenError）
 * ✅ 超过 timeout 后进入 half-open，允许探测请求
 * ✅ half-open 连续成功 3 次后恢复 closed
 * ✅ half-open 期间失败重新 open
 * ✅ 超出 monitorInterval 的旧失败不计入阈值
 */

import { CircuitBreaker, CircuitOpenError } from '../../server/lib/ai/circuit-breaker'

// ──────────────────────────────────────────────
// 辅助：假时钟
// ──────────────────────────────────────────────
let fakeNow = Date.now()

beforeAll(() => {
  jest.spyOn(Date, 'now').mockImplementation(() => fakeNow)
})

afterAll(() => {
  jest.restoreAllMocks()
})

function advanceTime(ms: number) {
  fakeNow += ms
}

// ──────────────────────────────────────────────
// 辅助：必然失败 / 必然成功的 async fn
// ──────────────────────────────────────────────
const failFn = () => Promise.reject(new Error('模拟失败'))
const successFn = <T = string>(value: T = 'ok' as unknown as T) =>
  () => Promise.resolve(value)

// ──────────────────────────────────────────────
// 测试套件
// ──────────────────────────────────────────────

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker

  beforeEach(() => {
    fakeNow = Date.now()
    cb = new CircuitBreaker('test', {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30_000,
      monitorInterval: 10_000,
    })
  })

  // ────────────────────────────────────
  // 1. 初始状态
  // ────────────────────────────────────

  test('初始状态为 closed', () => {
    expect(cb.getState()).toBe('closed')
  })

  // ────────────────────────────────────
  // 2. 5 次失败触发熔断
  // ────────────────────────────────────

  test('连续 5 次失败后状态变为 open', async () => {
    for (let i = 0; i < 4; i++) {
      await expect(cb.execute(failFn)).rejects.toThrow('模拟失败')
      expect(cb.getState()).toBe('closed')  // 未达阈值，仍 closed
    }

    // 第 5 次失败 → 触发熔断
    await expect(cb.execute(failFn)).rejects.toThrow('模拟失败')
    expect(cb.getState()).toBe('open')
  })

  // ────────────────────────────────────
  // 3. 熔断期间请求被立即拒绝
  // ────────────────────────────────────

  test('熔断后请求抛出 CircuitOpenError', async () => {
    // 触发熔断
    for (let i = 0; i < 5; i++) {
      await cb.execute(failFn).catch(() => {})
    }

    // 下一个请求应被直接拒绝
    await expect(cb.execute(successFn())).rejects.toThrow(CircuitOpenError)
  })

  // ────────────────────────────────────
  // 4. timeout 后进入 half-open
  // ────────────────────────────────────

  test('timeout 过后进入 half-open，允许探测请求', async () => {
    // 触发熔断
    for (let i = 0; i < 5; i++) {
      await cb.execute(failFn).catch(() => {})
    }
    expect(cb.getState()).toBe('open')

    // 模拟时间推进 30s（超过 timeout）
    advanceTime(30_001)

    // 此时执行应进入 half-open 并成功
    const result = await cb.execute(successFn('探测成功'))
    expect(result).toBe('探测成功')
    expect(cb.getState()).toBe('half-open')
  })

  // ────────────────────────────────────
  // 5. half-open 连续 3 次成功 → closed
  // ────────────────────────────────────

  test('half-open 连续成功 3 次后恢复为 closed', async () => {
    // 触发熔断 → 推进时间 → 进入 half-open
    for (let i = 0; i < 5; i++) {
      await cb.execute(failFn).catch(() => {})
    }
    advanceTime(30_001)

    // 3 次成功
    for (let i = 0; i < 3; i++) {
      await cb.execute(successFn())
    }

    expect(cb.getState()).toBe('closed')
  })

  // ────────────────────────────────────
  // 6. half-open 失败 → 重新 open
  // ────────────────────────────────────

  test('half-open 期间失败立即重新打开', async () => {
    for (let i = 0; i < 5; i++) {
      await cb.execute(failFn).catch(() => {})
    }
    advanceTime(30_001)

    // 进入 half-open 后立即失败
    await expect(cb.execute(failFn)).rejects.toThrow('模拟失败')
    expect(cb.getState()).toBe('open')
  })

  // ────────────────────────────────────
  // 7. monitorInterval 窗口外的旧失败不计入
  // ────────────────────────────────────

  test('超出 monitorInterval 的旧失败被丢弃，不触发熔断', async () => {
    // 失败 4 次（未到阈值）
    for (let i = 0; i < 4; i++) {
      await cb.execute(failFn).catch(() => {})
    }

    // 推进时间超出监控窗口（10s）
    advanceTime(10_001)

    // 再失败 4 次（前 4 次被丢弃，新的计数从 1 开始）
    for (let i = 0; i < 4; i++) {
      await cb.execute(failFn).catch(() => {})
    }

    // 总共 8 次失败，但新窗口内只有 4 次，未达阈值 5
    expect(cb.getState()).toBe('closed')
  })

  // ────────────────────────────────────
  // 8. reset 后恢复 closed
  // ────────────────────────────────────

  test('reset() 后熔断器恢复初始 closed 状态', async () => {
    for (let i = 0; i < 5; i++) {
      await cb.execute(failFn).catch(() => {})
    }
    expect(cb.getState()).toBe('open')

    cb.reset()
    expect(cb.getState()).toBe('closed')
    expect(cb.getFailureCount()).toBe(0)

    // reset 后正常请求可以通过
    const result = await cb.execute(successFn('已重置'))
    expect(result).toBe('已重置')
  })

  // ────────────────────────────────────
  // 9. closed 状态下成功重置失败计数
  // ────────────────────────────────────

  test('closed 状态下成功后失败计数清零', async () => {
    // 失败 3 次
    for (let i = 0; i < 3; i++) {
      await cb.execute(failFn).catch(() => {})
    }
    expect(cb.getFailureCount()).toBe(3)

    // 成功一次
    await cb.execute(successFn())
    expect(cb.getFailureCount()).toBe(0)

    // 后续再失败需要重新积累到 5 次才能触发熔断
    for (let i = 0; i < 4; i++) {
      await cb.execute(failFn).catch(() => {})
    }
    expect(cb.getState()).toBe('closed')
  })
})
