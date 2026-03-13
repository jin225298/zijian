// =============================================================================
// POST /api/v1/chars/:char/visualize — 请求生成可视化内容
// =============================================================================
// 任务: TASK-BE-008
// 职责:
//   - 验证请求参数（type / style）
//   - 要求用户登录（withAuth）
//   - 调用 VisualizeService 执行三级缓存查找
//   - 缓存命中直接返回 URL；未命中返回 taskId + 预估时间
//   - 儿童用户（child role）每日限制20次
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/server/middleware/auth.middleware'
import { handleApiError, BusinessException } from '@/server/middleware/error.middleware'
import { isValidChinese } from '@/server/services/char.service'
import { visualizeService } from '@/server/services/visualize.service'
import { ErrorCode, JwtPayload, VisualStyle, VisualType } from '@/types'

// ================================
// 请求参数 Schema
// ================================

const VisualizeSchema = z.object({
  type: z.enum(['image', 'video'], {
    required_error: 'type 不能为空',
    invalid_type_error: 'type 必须是 image 或 video',
  }),
  style: z.enum(['cartoon', 'ink', '3d', 'pictographic'], {
    required_error: 'style 不能为空',
    invalid_type_error: 'style 必须是 cartoon | ink | 3d | pictographic',
  }),
})

// ================================
// POST /api/v1/chars/:char/visualize
// ================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ char: string }> }
): Promise<NextResponse> {
  return withAuth(request, async (req: NextRequest, payload: JwtPayload) => {
    try {
      const { char } = await params
      const decodedChar = decodeURIComponent(char)

      // 1. 验证汉字参数
      if (!isValidChinese(decodedChar)) {
        throw new BusinessException(
          ErrorCode.VISUAL_CHAR_INVALID,
          `"${decodedChar}" 不是合法的汉字`,
          400
        )
      }

      // 2. 解析并验证请求体
      const body = await req.json()
      const { type, style } = VisualizeSchema.parse(body)

      // 3. 调用服务层（三级缓存 + 限额检查 + 入队）
      const result = await visualizeService.getVisualContent(
        decodedChar,
        style as VisualStyle,
        type as VisualType,
        payload.userId,
        payload.role
      )

      return NextResponse.json({ success: true, data: result }, { status: 200 })
    } catch (error) {
      return handleApiError(error)
    }
  })
}
