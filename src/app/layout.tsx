import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '字见 - 智能汉字学习平台',
  description: '结合 AI 与 ESP32-S3 实物识字的创新汉字学习系统',
  keywords: ['汉字', '学习', 'AI', '简繁转换', '实物识字'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
