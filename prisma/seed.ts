// =============================================================================
// "字见" AI驱动聋哑人识字辅助系统 — Prisma Seed Script
// =============================================================================
// 用途：创建测试账号（testadmin），保证幂等性（upsert）
// 执行：npx prisma db seed
// 日期：2026-03-13
// =============================================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 1. bcrypt hash 密码（cost=12）
  const passwordHash = await bcrypt.hash('Test1234!', 12)

  // 2. upsert 测试账号（以 username 为唯一键）
  const profile = await prisma.profile.upsert({
    where: { username: 'testadmin' },
    update: {},
    create: {
      username: 'testadmin',
      password_hash: passwordHash,
      nickname: '测试账号',
      role: 'adult',
      status: 'active',
    },
  })

  // 3. upsert 默认识字库（以 user_id + is_default 判断）
  const existingDefault = await prisma.wordBook.findFirst({
    where: { user_id: profile.id, is_default: true },
  })

  if (!existingDefault) {
    await prisma.wordBook.create({
      data: {
        user_id: profile.id,
        name: '我的识字库',
        is_default: true,
      },
    })
  }

  console.log('Seed完成：testadmin / Test1234!')
}

main()
  .catch((e) => {
    console.error('Seed 执行失败：', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
