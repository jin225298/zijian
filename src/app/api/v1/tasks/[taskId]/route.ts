// =============================================================================
// GET /api/v1/tasks/:taskId — 查询可视化任务状态
// =============================================================================
// 任务: TASK-BE-008
// 职责:
//   - 验证 taskId 格式（UUID）
//   - 要求用户登录（withAuth）
//   - 从 Redis 读取任务元数据并返回状态
//   - 任务不存在时返回 404
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/server/middleware/auth.middleware'
import { handleApiError, BusinessException } from '@/server/middleware/error.middleware'
import { visualizeService } from '@/server/services/visualize.service'
import { ErrorCode, JwtPayload } from '@/types'

// UUID v4 正则（crypto.randomUUID() 生成格式）
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ================================
// GET /api/v1/tasks/:taskId
// ================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
): Promise<NextResponse> {
  return withAuth(request, async (_req: NextRequest, _payload: JwtPayload) => {
    try {
      const { taskId } = await params

      // 1. 验证 taskId 格式
      if (!UUID_REGEX.test(taskId)) {
        throw new BusinessException(
          ErrorCode.INVALID_PARAMS,
          'taskId 格式无效',
          400
        )
      }

      // 2. 查询任务状态
      const data = await visualizeService.getTaskStatus(taskId)

      return NextResponse.json({ success: true, data }, { status: 200 })
    } catch (error) {
      return handleApiError(error)
    }
  })
}
