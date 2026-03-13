// =============================================================================
// 字见系统 — 用户认证服务
// =============================================================================
// 任务: TASK-BE-006
// 职责:
//   - 手机号验证码登录（发码 / 校验 / 注册/登录合一）
//   - JWT 签发（accessToken 15分钟 / refreshToken 30天）
//   - Session 管理（RefreshToken 哈希存储 + 主动撤销）
//   - 手机号字段级加密（AES-256-CBC，可检索）
//   - 暴力破解防护（失败5次锁定30分钟）
// =============================================================================

import crypto from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import prisma from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { ErrorCode, LoginResponseData, RefreshResponseData, PhoneUserDTO, ZijingRole } from '@/types'
import { BusinessException } from '@/server/middleware/error.middleware'

// ================================
// 常量配置
// ================================

/** accessToken 有效期：15分钟（秒） */
const ACCESS_TOKEN_TTL = 15 * 60

/** refreshToken 有效期：30天（秒） */
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60

/** 短信验证码有效期：5分钟（秒） */
const SMS_CODE_TTL = 5 * 60

/** 短信发送冷却期：60秒 */
const SMS_COOLDOWN_TTL = 60

/** 登录失败最大次数，超过则锁定账号 */
const LOGIN_MAX_FAIL = 5

/** 账号锁定时长：30分钟（秒） */
const LOGIN_LOCK_TTL = 30 * 60

// ================================
// Redis Key 工厂
// ================================
const REDIS_KEY = {
  /** 短信验证码 */
  smsCode: (phone: string) => `zijing:sms:code:${phone}`,
  /** 短信发送冷却（60秒内不可重发） */
  smsCooldown: (phone: string) => `zijing:sms:cooldown:${phone}`,
  /** 登录失败计数（以加密手机号为 key，避免明文） */
  loginFailCount: (phoneEnc: string) => `zijing:login:fail:${phoneEnc}`,
}

// ================================
// 加密工具函数
// ================================

/**
 * 获取 AES-256-CBC 加密所需的 key
 * 环境变量:
 *   PHONE_ENCRYPTION_KEY — 64位十六进制字符串（32字节）
 * 
 * 安全修复: 不再使用固定IV，每次加密生成随机IV
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.PHONE_ENCRYPTION_KEY

  if (!keyHex) {
    throw new Error('[AuthService] 缺少环境变量: PHONE_ENCRYPTION_KEY')
  }

  if (keyHex.length !== 64) {
    throw new Error('[AuthService] PHONE_ENCRYPTION_KEY 必须为64位十六进制字符串（32字节）')
  }

  return Buffer.from(keyHex, 'hex')
}

/**
 * 对手机号进行 AES-256-CBC 加密（安全版本：随机IV）
 * 格式: iv(32位hex) + ciphertext(hex)
 * 注意: 每次加密结果不同，无法直接用于数据库检索
 * 如需检索，请使用 encryptPhoneForSearch() 或建立单独的检索索引
 */
export function encryptPhone(phone: string): string {
  const key = getEncryptionKey()
  // 安全修复: 每次加密使用随机IV
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(phone, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  // 返回格式: iv + ciphertext，便于解密时提取IV
  return iv.toString('hex') + ':' + encrypted
}

/**
 * 解密手机号（用于需要回显明文的场景）
 * 支持新格式(iv:ciphertext)和旧格式(固定IV)的向后兼容
 */
export function decryptPhone(phoneEnc: string): string {
  const key = getEncryptionKey()
  
  // 检查是否为新格式（包含冒号分隔符）
  if (phoneEnc.includes(':')) {
    const [ivHex, ciphertext] = phoneEnc.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }
  
  // 向后兼容：旧格式使用固定IV（仅用于解密历史数据）
  const ivHex = process.env.PHONE_ENCRYPTION_IV
  if (!ivHex) {
    throw new Error('[AuthService] 无法解密旧格式数据：缺少 PHONE_ENCRYPTION_IV')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(phoneEnc, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * 使用HMAC生成可检索的手机号索引
 * 用于数据库查询，不暴露明文
 */
export function getPhoneSearchIndex(phone: string): string {
  const key = getEncryptionKey()
  // 使用HMAC-SHA256生成确定性索引
  return crypto.createHmac('sha256', key).update(phone).digest('hex')
}

/**
 * 手机号脱敏显示：138****8888
 */
export function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

/**
 * 计算 SHA-256 哈希（用于 RefreshToken 安全存储）
 */
function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

// ================================
// JWT 工具函数
// ================================

/** JWT 允许的算法白名单 */
const ALLOWED_JWT_ALGORITHMS = ['HS256'] as const

/** JWT密钥最小长度要求（字符） */
const MIN_JWT_SECRET_LENGTH = 32

/**
 * 验证JWT密钥强度
 * 安全修复: 强制要求密钥满足最小长度
 */
function validateJwtSecretStrength(secret: string): void {
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `[AuthService] JWT_SECRET 强度不足：当前${secret.length}字符，要求至少${MIN_JWT_SECRET_LENGTH}字符。` +
      `请使用: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    )
  }
  
  // 检查是否为常见弱密钥
  const weakSecrets = ['secret', 'password', 'jwt-secret', 'fallback-secret-key', '123456']
  if (weakSecrets.includes(secret.toLowerCase()) || secret.length < 16) {
    throw new Error(
      '[AuthService] JWT_SECRET 使用了弱密钥，请使用强随机密钥。' +
      '生成命令: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('[AuthService] 缺少环境变量: JWT_SECRET')
  
  // 安全修复: 验证密钥强度
  validateJwtSecretStrength(secret)
  
  return new TextEncoder().encode(secret)
}

function getRefreshSecret(): Uint8Array {
  const secret = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET
  if (!secret) throw new Error('[AuthService] 缺少环境变量: JWT_REFRESH_SECRET')
  
  // 安全修复: 验证密钥强度
  validateJwtSecretStrength(secret)
  
  return new TextEncoder().encode(secret)
}

/**
 * 签发 accessToken（HS256, 15分钟）
 * 安全修复: 明确指定算法，防止算法混淆攻击
 */
async function signAccessToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: 'HS256' })  // 明确指定算法
    .setIssuedAt()
    .setIssuer('zijing')  // 添加签发者
    .setAudience('zijing-users')  // 添加受众
    .setExpirationTime(`${ACCESS_TOKEN_TTL}s`)
    .sign(getJwtSecret())
}

/**
 * 生成不透明 refreshToken（32字节随机十六进制）
 */
function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// ================================
// 1. 发送短信验证码
// ================================

export interface SendSmsCodeParams {
  phone: string
}

export async function sendSmsCode({ phone }: SendSmsCodeParams): Promise<void> {
  // 1. 校验手机号格式（11位数字，1开头）
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw new BusinessException(ErrorCode.PHONE_INVALID, '手机号格式错误', 400)
  }

  // 2. 检查60秒冷却期
  const cooldownKey = REDIS_KEY.smsCooldown(phone)
  const cooldownExists = await redis.get(cooldownKey)
  if (cooldownExists) {
    throw new BusinessException(
      ErrorCode.SMS_COOLDOWN,
      '验证码已发送，请60秒后再试',
      429
    )
  }

  // 3. 生成6位随机验证码
  const code = String(Math.floor(100000 + Math.random() * 900000))

  // 4. 存入 Redis（TTL: 5分钟）
  await redis.set(REDIS_KEY.smsCode(phone), code, { ex: SMS_CODE_TTL })

  // 5. 设置冷却标记（TTL: 60秒）
  await redis.set(cooldownKey, '1', { ex: SMS_COOLDOWN_TTL })

  // 6. 调用短信服务（TODO: 接入真实短信通道）
  console.log(`[SMS] 发送验证码 → 手机号: ${maskPhone(phone)}, 验证码: ${code}, TTL: ${SMS_CODE_TTL}s`)
}

// ================================
// 2. 手机号验证码登录
// ================================

export interface LoginParams {
  phone: string
  code: string
  ip?: string
  userAgent?: string
}

export async function login({
  phone,
  code,
  ip,
  userAgent,
}: LoginParams): Promise<LoginResponseData> {
  // 1. 参数格式校验
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw new BusinessException(ErrorCode.PHONE_INVALID, '手机号格式错误', 400)
  }
  if (!/^\d{6}$/.test(code)) {
    throw new BusinessException(ErrorCode.INVALID_PARAMS, '验证码必须为6位数字', 400)
  }

  // 2. 计算手机号的加密存储值与确定性检索索引
  const phoneEnc = encryptPhone(phone)
  const phoneIndex = getPhoneSearchIndex(phone)
  // 失败计数 key 使用确定性索引（避免随机IV导致每次不同）
  const failKey = REDIS_KEY.loginFailCount(phoneIndex)

  // 3. 检查账号是否已锁定（通过 phone_index 确定性查询，随机IV不影响检索）
  const existingProfile = await prisma.profile.findFirst({
    where: { phone_index: phoneIndex },
  })

  if (existingProfile) {
    if (
      existingProfile.status === 'banned' ||
      existingProfile.status === 'inactive'
    ) {
      throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被禁用', 403)
    }

    if (
      existingProfile.locked_until &&
      existingProfile.locked_until > new Date()
    ) {
      const remainMin = Math.ceil(
        (existingProfile.locked_until.getTime() - Date.now()) / 60000
      )
      throw new BusinessException(
        ErrorCode.ACCOUNT_LOCKED,
        `账号已被锁定，请${remainMin}分钟后重试`,
        403
      )
    }
  }

  // 4. 验证验证码
  const storedCode = await redis.get<string>(REDIS_KEY.smsCode(phone))

  if (!storedCode || storedCode !== code) {
    // 累计失败次数
    const failCount = await redis.incr(failKey)

    // 首次失败时设置失败计数过期时间（30分钟）
    if (failCount === 1) {
      await redis.expire(failKey, LOGIN_LOCK_TTL)
    }

    if (failCount >= LOGIN_MAX_FAIL && existingProfile) {
      // 锁定账号30分钟
      const lockUntil = new Date(Date.now() + LOGIN_LOCK_TTL * 1000)
      await prisma.profile.update({
        where: { id: existingProfile.id },
        data: { locked_until: lockUntil },
      })
      throw new BusinessException(
        ErrorCode.ACCOUNT_LOCKED,
        '连续验证失败次数过多，账号已被锁定30分钟',
        403
      )
    }

    const remaining = LOGIN_MAX_FAIL - Number(failCount)
    throw new BusinessException(
      ErrorCode.SMS_CODE_INVALID,
      `验证码错误，还可尝试${remaining}次`,
      400
    )
  }

  // 5. 查找或创建用户
  let profile = existingProfile
  let isNewUser = false

  if (!profile) {
    // 新用户注册：创建 Profile + 默认识字库（事务）
    const result = await prisma.$transaction(async (tx) => {
      const newProfile = await tx.profile.create({
        data: {
          phone_enc: phoneEnc,
          phone_index: phoneIndex,  // BUG-001修复：存储确定性HMAC索引，用于后续登录检索
          role: 'adult',
          status: 'active',
        },
      })

      await tx.wordBook.create({
        data: {
          user_id: newProfile.id,
          name: '我的识字库',
          is_default: true,
        },
      })

      return newProfile
    })

    profile = result
    isNewUser = true
    console.log(`[Auth] 新用户注册: userId=${profile.id}`)
  } else {
    // 老用户：清除 locked_until（若存在）
    if (profile.locked_until) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { locked_until: null },
      })
    }
  }

  // 6. 生成 Token 对
  const accessToken = await signAccessToken(profile.id, profile.role)
  const plainRefreshToken = generateRefreshToken()
  const refreshTokenHash = sha256(plainRefreshToken)

  // 7. 存储 Session（存 refreshToken 哈希，不存明文）
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)
  await prisma.userSession.create({
    data: {
      user_id: profile.id,
      token_hash: refreshTokenHash,
      ip_address: ip ?? null,
      user_agent: userAgent ?? null,
      expires_at: expiresAt,
    },
  })

  // 8. 清理验证码和失败计数
  await redis.del(REDIS_KEY.smsCode(phone))
  await redis.del(failKey)

  console.log(
    `[Auth] 登录成功: userId=${profile.id}, isNewUser=${isNewUser}, ip=${ip ?? 'unknown'}`
  )

  return {
    accessToken,
    refreshToken: plainRefreshToken,
    expiresIn: ACCESS_TOKEN_TTL,
    isNewUser,
    user: {
      id: profile.id,
      nickname: profile.nickname,
      avatar: profile.avatar_url,
      role: profile.role as ZijingRole,
    },
  }
}

// ================================
// 3. 刷新 Token
// ================================

export async function refreshTokens(
  plainRefreshToken: string
): Promise<RefreshResponseData> {
  if (!plainRefreshToken) {
    throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID, 'refreshToken 不能为空', 400)
  }

  const tokenHash = sha256(plainRefreshToken)

  // 查找有效 Session（未撤销 + 未过期）
  const session = await prisma.userSession.findFirst({
    where: {
      token_hash: tokenHash,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
    include: { user: true },
  })

  if (!session) {
    throw new BusinessException(
      ErrorCode.REFRESH_TOKEN_INVALID,
      'refreshToken 无效或已过期',
      401
    )
  }

  const profile = session.user

  // 检查账号状态
  if (profile.status !== 'active') {
    throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被禁用', 403)
  }

  // 轮换：撤销旧 Session，创建新 Session（Token Rotation，防止 Replay）
  const newPlainRefreshToken = generateRefreshToken()
  const newRefreshTokenHash = sha256(newPlainRefreshToken)
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)

  await prisma.$transaction([
    // 撤销旧 Session
    prisma.userSession.update({
      where: { id: session.id },
      data: { revoked_at: new Date() },
    }),
    // 创建新 Session
    prisma.userSession.create({
      data: {
        user_id: profile.id,
        token_hash: newRefreshTokenHash,
        ip_address: session.ip_address,
        user_agent: session.user_agent,
        expires_at: newExpiresAt,
      },
    }),
  ])

  const newAccessToken = await signAccessToken(profile.id, profile.role)

  console.log(`[Auth] Token 刷新成功: userId=${profile.id}`)

  return {
    accessToken: newAccessToken,
    refreshToken: newPlainRefreshToken,
    expiresIn: ACCESS_TOKEN_TTL,
  }
}

// ================================
// 4. 登出
// ================================

/**
 * 通过 accessToken 的 userId 撤销对应的所有有效 Session
 * （若需精确匹配 Session，可传入 sessionId）
 */
export async function logout(userId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: {
      user_id: userId,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
    data: {
      revoked_at: new Date(),
    },
  })

  console.log(`[Auth] 用户登出: userId=${userId}`)
}

// ================================
// 5. 获取当前用户信息
// ================================

export async function getCurrentUser(userId: string): Promise<PhoneUserDTO> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
  })

  if (!profile) {
    throw new BusinessException(ErrorCode.USER_NOT_FOUND, '用户不存在', 404)
  }

  if (profile.status !== 'active') {
    throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被禁用', 403)
  }

  // 解密手机号并脱敏
  let maskedPhone = '未绑定'
  if (profile.phone_enc) {
    try {
      const plainPhone = decryptPhone(profile.phone_enc)
      maskedPhone = maskPhone(plainPhone)
    } catch {
      maskedPhone = '***'
    }
  }

  return {
    id: profile.id,
    phone: maskedPhone,
    nickname: profile.nickname,
    avatar: profile.avatar_url,
    role: profile.role as ZijingRole,
    createdAt: profile.created_at.toISOString(),
  }
}

// ================================
// 6. 账号密码登录（降级方案）
// ================================

export interface PasswordLoginParams {
  username: string
  password: string
  ip?: string
  userAgent?: string
}

export async function loginWithPassword({
  username,
  password,
  ip,
  userAgent,
}: PasswordLoginParams): Promise<LoginResponseData> {
  // 1. 参数校验
  if (!username || !password) {
    throw new BusinessException(ErrorCode.INVALID_PARAMS, '账号和密码不能为空', 400)
  }

  // 2. 查找用户（by username）
  const profile = await prisma.profile.findUnique({
    where: { username },
  })

  // 3. 统一错误（不区分用户不存在/密码错误，防枚举）
  if (!profile || !profile.password_hash) {
    throw new BusinessException(ErrorCode.INVALID_PASSWORD, '账号或密码错误', 400)
  }

  // 4. 检查账号状态
  if (profile.status === 'banned' || profile.status === 'inactive') {
    throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被禁用', 403)
  }

  if (profile.locked_until && profile.locked_until > new Date()) {
    const remainMin = Math.ceil(
      (profile.locked_until.getTime() - Date.now()) / 60000
    )
    throw new BusinessException(
      ErrorCode.ACCOUNT_LOCKED,
      `账号已被锁定，请${remainMin}分钟后重试`,
      403
    )
  }

  // 5. 验证密码（bcrypt）
  const bcrypt = await import('bcryptjs')
  const failKey = `zijing:login:fail:pwd:${profile.id}`
  const isMatch = await bcrypt.compare(password, profile.password_hash)

  if (!isMatch) {
    const failCount = await redis.incr(failKey)
    if (failCount === 1) {
      await redis.expire(failKey, LOGIN_LOCK_TTL)
    }
    if (failCount >= LOGIN_MAX_FAIL) {
      const lockUntil = new Date(Date.now() + LOGIN_LOCK_TTL * 1000)
      await prisma.profile.update({
        where: { id: profile.id },
        data: { locked_until: lockUntil },
      })
      throw new BusinessException(
        ErrorCode.ACCOUNT_LOCKED,
        '连续登录失败次数过多，账号已被锁定30分钟',
        403
      )
    }
    const remaining = LOGIN_MAX_FAIL - Number(failCount)
    throw new BusinessException(
      ErrorCode.INVALID_PASSWORD,
      `账号或密码错误，还可尝试${remaining}次`,
      400
    )
  }

  // 6. 清除锁定状态（如有）
  if (profile.locked_until) {
    await prisma.profile.update({
      where: { id: profile.id },
      data: { locked_until: null },
    })
  }

  // 7. 生成 Token（复用现有逻辑）
  const accessToken = await signAccessToken(profile.id, profile.role)
  const plainRefreshToken = generateRefreshToken()
  const refreshTokenHash = sha256(plainRefreshToken)

  // 8. 存储 Session
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)
  await prisma.userSession.create({
    data: {
      user_id: profile.id,
      token_hash: refreshTokenHash,
      ip_address: ip ?? null,
      user_agent: userAgent ?? null,
      expires_at: expiresAt,
    },
  })

  // 9. 清理失败计数
  await redis.del(failKey)

  console.log(`[Auth] 密码登录成功: userId=${profile.id}, username=${username}, ip=${ip ?? 'unknown'}`)

  return {
    accessToken,
    refreshToken: plainRefreshToken,
    expiresIn: ACCESS_TOKEN_TTL,
    isNewUser: false,
    user: {
      id: profile.id,
      nickname: profile.nickname,
      avatar: profile.avatar_url,
      role: profile.role as ZijingRole,
    },
  }
}
