// =============================================================================
// 字见系统 — Supabase 服务端客户端
// =============================================================================
// 职责：
//   - 服务端 Supabase 客户端（使用 SERVICE_ROLE_KEY，绕过 RLS）
//   - 用于 Realtime 任务完成推送
//   - 永远不暴露给前端
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 防止开发环境热重载时创建多个实例
declare global {
  // eslint-disable-next-line no-var
  var supabaseAdmin: SupabaseClient | undefined
}

function createSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      '[Supabase] 缺少环境变量: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * 服务端 Supabase 客户端（SERVICE_ROLE_KEY）
 * 仅在服务端使用，严禁暴露给客户端
 */
export const supabaseAdmin: SupabaseClient =
  globalThis.supabaseAdmin ?? createSupabaseAdmin()

if (process.env.NODE_ENV !== 'production') {
  globalThis.supabaseAdmin = supabaseAdmin
}

// ================================
// Realtime 推送工具函数
// ================================

/**
 * 通过 Supabase Realtime 推送任务完成事件
 * 客户端订阅 channel(`task:${taskId}`) 监听 broadcast 事件
 */
export async function broadcastTaskComplete(
  taskId: string,
  payload: {
    taskId: string
    status: string
    resultUrl?: string
    error?: string
  }
): Promise<void> {
  try {
    const channel = supabaseAdmin.channel(`task:${taskId}`)
    await channel.send({
      type: 'broadcast',
      event: 'task_complete',
      payload,
    })
    // 推送后立即取消订阅，避免频道泄漏
    await supabaseAdmin.removeChannel(channel)
    console.log(`[Supabase Realtime] 任务完成推送: taskId=${taskId}`)
  } catch (error) {
    // Realtime 推送失败不影响主流程，客户端可通过轮询降级
    console.error('[Supabase Realtime] 推送失败:', error)
  }
}
