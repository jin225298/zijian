// =============================================================================
// POST /api/v1/scan/recognize — ESP32-S3 实物识字
// =============================================================================
// 任务: TASK-FE-009
// 职责:
//   - 接收前端上传的图片（base64）
//   - 调用 OCR / AI 识别服务（当前为 mock 实现）
//   - 返回识别到的汉字及其详细信息
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { withCsrfProtection } from '@/server/middleware/csrf.middleware'
import { handleApiError, BusinessException } from '@/server/middleware/error.middleware'
import { isValidChinese, getCharInfo } from '@/server/services/char.service'
import { ErrorCode } from '@/types'
import { apiResponse, generateRandomString } from '@/lib/utils'
import type { ScanResultDTO } from '@/types'

// ================================
// POST /api/v1/scan/recognize
// ================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // BUG-002修复：通过 withCsrfProtection 包裹，防止跨站请求伪造
  return withCsrfProtection(request, async (req) => {
    try {
      const body = await req.json()
      const { imageData, deviceId } = body as {
        imageData: string
        deviceId?: string
      }

      if (!imageData) {
        throw new BusinessException(ErrorCode.INVALID_PARAMS, '缺少图片数据', 400)
      }

      // 验证 base64 格式
      const base64Regex = /^data:image\/(jpeg|jpg|png|webp);base64,/
      if (!base64Regex.test(imageData)) {
        throw new BusinessException(ErrorCode.INVALID_PARAMS, '图片格式不正确，需要 base64 编码', 400)
      }

      // ----------------------------------------------------------------
      // Mock OCR 识别逻辑
      // 实际环境中应调用 AI/OCR 服务，这里返回模拟数据
      // ----------------------------------------------------------------
      void deviceId // 未来用于设备日志追踪

      const mockChars = ['字', '见', '学', '习', '汉', '语', '文', '火']
      const randomChar = mockChars[Math.floor(Math.random() * mockChars.length)]
      const confidence = 0.75 + Math.random() * 0.24 // 75% ~ 99%

      // 获取汉字详情
      let charInfo
      try {
        if (!isValidChinese(randomChar)) throw new Error('invalid')
        charInfo = await getCharInfo(randomChar)
      } catch {
        // 降级处理
        charInfo = {
          char: randomChar,
          pinyin: '—',
          strokes: 0,
          radical: '—',
          meaning: '暂无释义',
          examples: [],
        }
      }

      const sessionId = generateRandomString(16)

      const result: ScanResultDTO = {
        sessionId,
        chars: [
          {
            id: randomChar,
            character: charInfo.char,
            pinyin: [charInfo.pinyin],
            strokeCount: charInfo.strokes,
            radical: charInfo.radical !== '—' ? charInfo.radical : null,
            structure: null,
            level: 'BEGINNER',
            frequency: 0,
            meaning: charInfo.meaning !== '暂无释义' ? charInfo.meaning : null,
            examples: charInfo.examples,
            strokeOrder: null,
          },
        ],
        rawText: randomChar,
        confidence,
      }

      // 在实际生产中，应将识别记录持久化到数据库
      // await prisma.scanRecord.create({ ... })

      return NextResponse.json(apiResponse(result), { status: 200 })
    } catch (error) {
      return handleApiError(error)
    }
  })
}
