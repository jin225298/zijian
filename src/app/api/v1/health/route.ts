import { NextResponse } from 'next/server'

/**
 * GET /api/v1/health
 * 健康检查接口
 */
export async function GET() {
  return NextResponse.json({
    code: 0,
    data: {
      status: 'ok',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
      timestamp: new Date().toISOString(),
    },
    message: 'success',
  })
}
