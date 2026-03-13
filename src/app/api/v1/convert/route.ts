// =============================================================================
// POST /api/v1/convert — 手语式中文转标准书面语
// =============================================================================
// 任务: TASK-BE-009
// 职责:
//   - 请求参数验证（text 最长500字，context 枚举校验）
//   - 可选认证（有 token 则记录历史，无 token 仍可使用）
//   - 调用 ConvertService 执行转换
//   - 返回转换结果（含置信度/备选/Diff）
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { convertService } from '@/server/services/convert.service'
import { withOptionalAuth } from '@/server/middleware/auth.middleware'
import { withCsrfProtection } from '@/server/middleware/csrf.middleware'
import { handleApiError, BusinessException } from '@/server/middleware/error.middleware'
import { ErrorCode } from '@/types'

// ==========================================
// 请求体验证 Schema（Zod）
// ==========================================

const ConvertRequestSchema = z.object({
  text: z
    .string({
      required_error: 'text 不能为空',
      invalid_type_error: 'text 必须为字符串',
    })
    .min(1, 'text 不能为空字符串')
    .max(500, 'text 最长支持 500 个字符'),

  context: z.enum(['daily', 'academic', 'formal'], {
    required_error: 'context 为必填项',
    invalid_type_error: 'context 必须为 daily | academic | formal',
  }),
})

// ==========================================
// POST /api/v1/convert
// ==========================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // BUG-002修复：通过 withCsrfProtection 包裹，防止跨站请求伪造
  return withCsrfProtection(request, (req) =>
    withOptionalAuth(req, async (_req2, payload) => {
      try {
        // 1. 解析请求体
        let body: unknown
        try {
          body = await request.json()
        } catch {
          throw new BusinessException(
            ErrorCode.INVALID_PARAMS,
            '请求体必须为合法的 JSON 格式',
            400
          )
        }

        // 2. 参数校验（Zod）
        const parseResult = ConvertRequestSchema.safeParse(body)
        if (!parseResult.success) {
          const errorMessages = parseResult.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join('; ')
          throw new BusinessException(
            ErrorCode.INVALID_PARAMS,
            `参数验证失败: ${errorMessages}`,
            400
          )
        }

        const { text, context } = parseResult.data
        const userId = payload?.userId

        console.log(
          `[ConvertAPI] 转换请求: context=${context}, length=${text.length}, userId=${userId ?? '匿名'}`
        )

        // 3. 调用转换服务
        const result = await convertService.convert(text, context, userId)

        // 4. 返回成功响应
        return NextResponse.json(
          {
            success: true,
            data: {
              original: result.original,
              converted: result.converted,
              confidence: result.confidence,
              alternatives: result.alternatives,
              isFallback: result.isFallback,
              diff: result.diff,
            },
          },
          { status: 200 }
        )
      } catch (error) {
        return handleApiError(error)
      }
    })
  )
}
