// =============================================================================
// GET /api/v1/scan/history — 获取识别历史
// =============================================================================
// 任务: TASK-FE-009
// 职责:
//   - 返回当前用户的识别历史记录
//   - 支持分页查询
//   - 当前为 mock 实现，实际应查询数据库
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/server/middleware/error.middleware'
import { apiResponse } from '@/lib/utils'
import type { ScanRecordDTO } from '@/types'

// ================================
// GET /api/v1/scan/history
// ================================

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Mock 历史数据
    // 实际环境中应查询数据库：
    // const records = await prisma.scanRecord.findMany({ ... })
    const mockHistory: ScanRecordDTO[] = [
      {
        id: 'mock-1',
        deviceId: 'device-001',
        sessionId: 'session-001',
        imageUrl: null,
        rawText: '字',
        chars: ['字'],
        confidence: 0.95,
        status: 'COMPLETED',
        createdAt: new Date(Date.now() - 60000).toISOString(),
      },
      {
        id: 'mock-2',
        deviceId: 'device-001',
        sessionId: 'session-002',
        imageUrl: null,
        rawText: '见',
        chars: ['见'],
        confidence: 0.88,
        status: 'COMPLETED',
        createdAt: new Date(Date.now() - 120000).toISOString(),
      },
      {
        id: 'mock-3',
        deviceId: 'device-001',
        sessionId: 'session-003',
        imageUrl: null,
        rawText: '学',
        chars: ['学'],
        confidence: 0.92,
        status: 'COMPLETED',
        createdAt: new Date(Date.now() - 300000).toISOString(),
      },
    ]

    return NextResponse.json(
      apiResponse({
        items: mockHistory,
        total: mockHistory.length,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
