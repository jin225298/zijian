// ================================
// 通用类型定义
// ================================

export interface ApiResponse<T = unknown> {
  code: number
  data: T
  message: string
  timestamp: string
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// ================================
// 用户相关类型
// ================================

export interface UserDTO {
  id: string
  email: string
  username: string
  avatar: string | null
  role: 'USER' | 'ADMIN'
  isActive: boolean
  createdAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginResult {
  user: UserDTO
  tokens: AuthTokens
}

// ================================
// 汉字相关类型
// ================================

export type CharLevel = 'BEGINNER' | 'ELEMENTARY' | 'INTERMEDIATE' | 'ADVANCED'

export interface CharDTO {
  id: string
  character: string
  pinyin: string[]
  strokeCount: number
  radical: string | null
  structure: string | null
  level: CharLevel
  frequency: number
  meaning: string | null
  examples: string[]
  strokeOrder: string | null
}

// ================================
// 学习记录类型
// ================================

export type LearnStatus = 'NEW' | 'LEARNING' | 'REVIEWING' | 'MASTERED'

export interface LearnRecordDTO {
  id: string
  userId: string
  charId: string
  char?: CharDTO
  status: LearnStatus
  masteryLevel: number
  reviewCount: number
  nextReview: string | null
  lastReview: string | null
}

export interface LearnProgressDTO {
  total: number
  newCount: number
  learningCount: number
  reviewingCount: number
  masteredCount: number
  todayReview: number
}

// ================================
// 字书类型
// ================================

export interface WordbookDTO {
  id: string
  userId: string
  name: string
  description: string | null
  isPublic: boolean
  coverColor: string
  charCount: number
  createdAt: string
  updatedAt: string
}

export interface WordbookDetailDTO extends WordbookDTO {
  chars: CharDTO[]
}

// ================================
// 转换任务类型
// ================================

export type ConvertType = 'SIMPLIFIED_TO_TRADITIONAL' | 'TRADITIONAL_TO_SIMPLIFIED'
export type TaskStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface ConvertTaskDTO {
  id: string
  type: ConvertType
  inputText: string
  outputText: string | null
  status: TaskStatus
  charCount: number
  createdAt: string
}

// ================================
// 扫描记录类型（ESP32-S3）
// ================================

export type ScanStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface ScanRecordDTO {
  id: string
  deviceId: string
  sessionId: string
  imageUrl: string | null
  rawText: string | null
  chars: string[]
  confidence: number | null
  status: ScanStatus
  createdAt: string
}

export interface ScanResultDTO {
  sessionId: string
  chars: CharDTO[]
  rawText: string
  confidence: number
}

// ================================
// 错误码定义
// ================================

export enum ErrorCode {
  // 通用错误
  SUCCESS = 0,
  UNKNOWN_ERROR = 10000,
  INVALID_PARAMS = 10001,
  UNAUTHORIZED = 10002,
  FORBIDDEN = 10003,
  NOT_FOUND = 10004,
  RATE_LIMIT_EXCEEDED = 10005,
  SERVER_ERROR = 10006,

  // 认证错误
  USER_NOT_FOUND = 20001,
  INVALID_PASSWORD = 20002,
  ACCOUNT_DISABLED = 20003,
  TOKEN_EXPIRED = 20004,
  TOKEN_INVALID = 20005,
  EMAIL_ALREADY_EXISTS = 20006,
  USERNAME_ALREADY_EXISTS = 20007,

  // 手机号认证错误（字见系统）
  PHONE_INVALID = 20008,          // 手机号格式错误
  SMS_CODE_INVALID = 20009,       // 验证码错误
  SMS_COOLDOWN = 20010,           // 60秒内已发送，请勿重复请求
  ACCOUNT_LOCKED = 20011,         // 账号已锁定（连续错误5次，锁定30分钟）
  REFRESH_TOKEN_INVALID = 20012,  // Refresh Token 无效或已失效

  // 汉字错误
  CHAR_NOT_FOUND = 30001,

  // 字书错误
  WORDBOOK_NOT_FOUND = 40001,
  WORDBOOK_ACCESS_DENIED = 40002,
  CHAR_ALREADY_IN_WORDBOOK = 40003,

  // 转换错误
  CONVERT_FAILED = 50001,
  TEXT_TOO_LONG = 50002,

  // 扫描错误
  SCAN_FAILED = 60001,
  DEVICE_NOT_CONNECTED = 60002,

  // 可视化错误
  VISUAL_DAILY_LIMIT_EXCEEDED = 70001,  // 儿童用户每日生成次数超限（20次）
  VISUAL_TASK_NOT_FOUND = 70002,        // 任务不存在
  VISUAL_CHAR_INVALID = 70003,          // 汉字参数无效

  // CSRF安全错误
  CSRF_TOKEN_MISSING = 80001,           // 缺少CSRF Token
  CSRF_TOKEN_MISMATCH = 80002,          // CSRF Token不匹配
  CSRF_TOKEN_INVALID = 80003,           // CSRF Token无效或已过期
}

// ================================
// 可视化内容类型（TASK-BE-008）
// ================================

export type VisualStyle = 'cartoon' | 'ink' | '3d' | 'pictographic'
export type VisualType = 'image' | 'video'
export type VisualTaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

/** 汉字可视化内容 DTO */
export interface VisualContentDTO {
  imageUrl: string | null
  videoUrl: string | null
}

/** GET /api/v1/chars/:char 响应数据 */
export interface CharDetailDTO {
  char: string
  pinyin: string
  strokes: number
  radical: string
  meaning: string
  examples: string[]
  visualContent: VisualContentDTO
}

/** POST /api/v1/chars/:char/visualize 响应数据 */
export interface VisualizeRequestDTO {
  taskId?: string
  estimatedSeconds: number
  cached: boolean
  resultUrl?: string
}

/** GET /api/v1/tasks/:taskId 响应数据 */
export interface TaskStatusDTO {
  taskId: string
  status: VisualTaskStatus
  progress: number
  resultUrl?: string
  error?: string
}

/** Redis 中存储的任务元数据 */
export interface VisualTaskMeta {
  taskId: string
  char: string
  style: VisualStyle
  type: VisualType
  userId: string
  status: VisualTaskStatus
  progress: number
  resultUrl?: string
  error?: string
  createdAt: string
  updatedAt: string
}

// ================================
// JWT Payload 类型
// ================================

export interface JwtPayload {
  userId: string
  email?: string
  role: 'USER' | 'ADMIN' | 'child' | 'adult' | 'guardian' | 'teacher' | 'admin'
  iat?: number
  exp?: number
}

// ================================
// 手机号认证类型（字见系统）
// ================================

export type ZijingRole = 'child' | 'adult' | 'guardian' | 'teacher' | 'admin'

/** 登录响应中的用户 DTO */
export interface PhoneUserDTO {
  id: string
  phone: string          // 脱敏手机号，如 138****8888
  nickname: string | null
  avatar: string | null
  role: ZijingRole
  createdAt: string
}

/** 登录响应 data */
export interface LoginResponseData {
  accessToken: string
  refreshToken: string
  expiresIn: number      // accessToken 有效期（秒）
  isNewUser: boolean
  user: {
    id: string
    nickname: string | null
    avatar: string | null
    role: ZijingRole
  }
}

/** 刷新 Token 响应 data */
export interface RefreshResponseData {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// ================================
// 中间件扩展类型
// ================================

export interface AuthenticatedRequest {
  userId: string
  user: JwtPayload
}
