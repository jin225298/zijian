// =============================================================================
// GET /api/v1/chars/:char — 获取汉字详情
// =============================================================================
// 任务: TASK-BE-008 / TASK-FE-003
// 职责:
//   - 验证汉字参数合法性
//   - 使用 CharService 获取基础信息（拼音/笔画/部首/释义/例词）
//   - 组装 CharDTO 并以统一 ApiResponse 格式返回
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isValidChinese, getCharInfo } from '@/server/services/char.service'
import { handleApiError, BusinessException } from '@/server/middleware/error.middleware'
import { ErrorCode } from '@/types'
import type { CharDTO } from '@/types'
import { apiResponse } from '@/lib/utils'

// ================================
// GET /api/v1/chars/:char
// ================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ char: string }> }
): Promise<NextResponse> {
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

    // 2. 获取汉字基础信息（cnchar 或降级方案）
    const charInfo = await getCharInfo(decodedChar)

    // 3. 映射为前端使用的 CharDTO 结构
    const data: CharDTO = {
      id: decodedChar,           // 以汉字本身作为 ID（单字唯一）
      character: charInfo.char,
      pinyin: [charInfo.pinyin], // CharDTO 要求 string[]，单拼音包装为数组
      strokeCount: charInfo.strokes,
      radical: charInfo.radical !== '—' ? charInfo.radical : null,
      structure: null,
      level: 'BEGINNER',         // 默认等级（cnchar 不提供等级信息）
      frequency: 0,
      meaning: charInfo.meaning !== '暂无释义' ? charInfo.meaning : null,
      examples: charInfo.examples,
      strokeOrder: null,
    }

    return NextResponse.json(apiResponse(data), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
