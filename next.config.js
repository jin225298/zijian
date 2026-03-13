/** @type {import('next').NextConfig} */
const nextConfig = {
  // 跳过 ESLint 构建检查（缺少 @typescript-eslint 插件导致规则定义丢失）
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Next.js 15: 服务器外部包配置（从 experimental 移出）
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  // 图片域名配置
  images: {
    domains: [],
  },
  // 环境变量（客户端可访问）
  env: {
    NEXT_PUBLIC_APP_NAME: '字见',
    NEXT_PUBLIC_APP_VERSION: '0.1.0',
  },
}

module.exports = nextConfig
