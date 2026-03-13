// =============================================================================
// 字见系统 — 识字库服务层
// =============================================================================
// 任务: TASK-BE-010
// 职责:
//   - 识字库 CRUD（创建、查询）
//   - 识字库条目管理（添加汉字、分页查询、状态筛选）
//   - SM-2 间隔重复算法（学习结果处理、复习计划计算）
//   - 今日待复习汉字获取
//   - 学习统计（总量、掌握数、连续天数、周进度）
// =============================================================================

import prisma from '@/lib/prisma'
import { BusinessException } from '@/server/middleware/error.middleware'
import { ErrorCode } from '@/types'

// ================================
// 类型定义
// ================================

export interface WordBookDTO {
  id: string
  name: string
  is_default: boolean
  item_count: number
  created_at: string
}

export interface WordBookItemDTO {
  id: string
  character: string
  mastery_level: number
  next_review_at: string | null
  created_at: string
}

export interface StudyResultDTO {
  mastery_level: number
  next_review_at: string
  review_count: number
}

export interface ReviewItemDTO {
  id: string
  character: string
  mastery_level: number
}

export interface WeeklyProgressItem {
  date: string
  count: number
}

export interface WordBookStatsDTO {
  total_characters: number
  mastered_count: number
  learning_count: number
  today_learned: number
  streak_days: number
  weekly_progress: WeeklyProgressItem[]
}

export type StudyResult = 'correct' | 'hint_used' | 'wrong'
export type ItemStatus = 'all' | 'learning' | 'mastered'

// ================================
// SM-2 间隔重复算法
// ================================

interface Sm2Input {
  mastery_level: number
  ease_factor: number | { toNumber(): number }
  review_count: number
}

interface Sm2Output {
  ease_factor: number
  interval: number
  mastery_level: number
  next_review_at: Date
}

/**
 * SM-2 间隔重复算法
 * @param item    当前识字库条目
 * @param quality 学习质量分: 5=correct, 3=hint_used, 1=wrong
 */
function sm2Algorithm(item: Sm2Input, quality: number): Sm2Output {
  const currentEF =
    typeof item.ease_factor === 'object' && 'toNumber' in item.ease_factor
      ? item.ease_factor.toNumber()
      : Number(item.ease_factor)

  // 计算新的 ease_factor（最低 1.3）
  let newEF = currentEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  newEF = Math.max(1.3, newEF)

  let newInterval: number
  let newMastery = item.mastery_level

  if (quality < 3) {
    // 回答错误：重置间隔，掌握等级 -1
    newInterval = 1
    newMastery = Math.max(0, item.mastery_level - 1)
  } else if (item.review_count === 0) {
    // 首次复习（答对/提示）：明天再复习
    newInterval = 1
    newMastery = Math.min(5, item.mastery_level + 1)
  } else if (item.review_count === 1) {
    // 第二次复习：6天后
    newInterval = 6
    newMastery = Math.min(5, item.mastery_level + 1)
  } else {
    // 后续复习：根据 EF 因子计算间隔
    newInterval = Math.round(item.review_count * newEF)
    newMastery = Math.min(5, item.mastery_level + 1)
  }

  return {
    ease_factor: newEF,
    interval: newInterval,
    mastery_level: newMastery,
    next_review_at: new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000),
  }
}

/** 将 StudyResult 字符串映射到 SM-2 quality 分 */
function resultToQuality(result: StudyResult): number {
  switch (result) {
    case 'correct':
      return 5
    case 'hint_used':
      return 3
    case 'wrong':
      return 1
  }
}

// ================================
// 1. 获取用户所有识字库
// ================================

export async function getWordBooks(userId: string): Promise<WordBookDTO[]> {
  const books = await prisma.wordBook.findMany({
    where: { user_id: userId },
    include: {
      _count: { select: { items: true } },
    },
    orderBy: [
      { is_default: 'desc' }, // 默认库排在最前
      { created_at: 'asc' },
    ],
  })

  return books.map((book) => ({
    id: book.id,
    name: book.name,
    is_default: book.is_default,
    item_count: book._count.items,
    created_at: book.created_at.toISOString(),
  }))
}

// ================================
// 2. 创建新识字库
// ================================

export interface CreateWordBookParams {
  userId: string
  name: string
}

export async function createWordBook(
  params: CreateWordBookParams
): Promise<WordBookDTO> {
  const { userId, name } = params

  // 名称不能为空
  if (!name || name.trim().length === 0) {
    throw new BusinessException(ErrorCode.INVALID_PARAMS, '识字库名称不能为空', 400)
  }
  if (name.trim().length > 100) {
    throw new BusinessException(ErrorCode.INVALID_PARAMS, '识字库名称最长100个字符', 400)
  }

  const book = await prisma.wordBook.create({
    data: {
      user_id: userId,
      name: name.trim(),
      is_default: false,
    },
  })

  return {
    id: book.id,
    name: book.name,
    is_default: book.is_default,
    item_count: 0,
    created_at: book.created_at.toISOString(),
  }
}

// ================================
// 内部工具：验证识字库所有权
// ================================

async function verifyBookOwnership(bookId: string, userId: string) {
  const book = await prisma.wordBook.findUnique({
    where: { id: bookId },
  })

  if (!book) {
    throw new BusinessException(ErrorCode.WORDBOOK_NOT_FOUND, '识字库不存在', 404)
  }

  if (book.user_id !== userId) {
    throw new BusinessException(ErrorCode.WORDBOOK_ACCESS_DENIED, '无权访问该识字库', 403)
  }

  return book
}

// ================================
// 3. 获取识字库条目（分页 + 筛选）
// ================================

export interface GetItemsParams {
  userId: string
  bookId: string
  page?: number
  limit?: number
  status?: ItemStatus
  sort?: string
}

export interface GetItemsResult {
  items: WordBookItemDTO[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export async function getWordBookItems(
  params: GetItemsParams
): Promise<GetItemsResult> {
  const { userId, bookId, status = 'all', sort = 'created_at' } = params
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))

  // 验证所有权
  await verifyBookOwnership(bookId, userId)

  // 构造筛选条件
  const statusFilter =
    status === 'mastered'
      ? { mastery_level: 5 }
      : status === 'learning'
      ? { mastery_level: { lt: 5 } }
      : {}

  const where = { book_id: bookId, ...statusFilter }

  // 排序字段映射（仅允许白名单字段）
  const allowedSortFields: Record<string, object> = {
    created_at: { created_at: 'desc' },
    mastery_level: { mastery_level: 'desc' },
    next_review_at: { next_review_at: 'asc' },
  }
  const orderBy = allowedSortFields[sort] ?? { created_at: 'desc' }

  const [total, items] = await Promise.all([
    prisma.wordBookItem.count({ where }),
    prisma.wordBookItem.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return {
    items: items.map((item) => ({
      id: item.id,
      character: item.character,
      mastery_level: item.mastery_level,
      next_review_at: item.next_review_at?.toISOString() ?? null,
      created_at: item.created_at.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

// ================================
// 4. 添加汉字到识字库
// ================================

export interface AddItemParams {
  userId: string
  bookId: string
  character: string
}

export async function addWordBookItem(params: AddItemParams) {
  const { userId, bookId, character } = params

  // 验证所有权
  await verifyBookOwnership(bookId, userId)

  // 验证汉字参数（至少1个字符，最多4个字节）
  if (!character || character.trim().length === 0) {
    throw new BusinessException(ErrorCode.INVALID_PARAMS, '汉字不能为空', 400)
  }
  const trimmed = character.trim()
  if ([...trimmed].length !== 1) {
    throw new BusinessException(ErrorCode.INVALID_PARAMS, '每次只能添加一个汉字', 400)
  }

  // 检查是否已存在
  const existing = await prisma.wordBookItem.findFirst({
    where: { book_id: bookId, character: trimmed },
  })

  if (existing) {
    throw new BusinessException(
      ErrorCode.CHAR_ALREADY_IN_WORDBOOK,
      `"${trimmed}" 已在识字库中`,
      409
    )
  }

  const item = await prisma.wordBookItem.create({
    data: {
      book_id: bookId,
      character: trimmed,
      mastery_level: 0,
      ease_factor: 2.5,
      review_count: 0,
    },
  })

  return {
    id: item.id,
    character: item.character,
    mastery_level: item.mastery_level,
    ease_factor: Number(item.ease_factor),
  }
}

// ================================
// 5. 提交学习结果（SM-2算法）
// ================================

export interface SubmitStudyParams {
  userId: string
  bookId: string
  itemId: string
  result: StudyResult
}

export async function submitStudyResult(
  params: SubmitStudyParams
): Promise<StudyResultDTO> {
  const { userId, bookId, itemId, result } = params

  // 验证识字库所有权
  await verifyBookOwnership(bookId, userId)

  // 查找条目
  const item = await prisma.wordBookItem.findFirst({
    where: { id: itemId, book_id: bookId },
  })

  if (!item) {
    throw new BusinessException(ErrorCode.NOT_FOUND, '识字库条目不存在', 404)
  }

  // 应用 SM-2 算法
  const quality = resultToQuality(result)
  const sm2Result = sm2Algorithm(
    {
      mastery_level: item.mastery_level,
      ease_factor: item.ease_factor,
      review_count: item.review_count,
    },
    quality
  )

  // 确定学习记录类型
  const actionType =
    sm2Result.mastery_level >= 5
      ? 'master'
      : item.review_count > 0
      ? 'review'
      : 'practice'

  // 批量更新：更新条目 + 写入学习记录（事务保证一致性）
  const [updatedItem] = await prisma.$transaction([
    prisma.wordBookItem.update({
      where: { id: itemId },
      data: {
        mastery_level: sm2Result.mastery_level,
        ease_factor: sm2Result.ease_factor,
        review_count: { increment: 1 },
        next_review_at: sm2Result.next_review_at,
      },
    }),
    prisma.learningRecord.create({
      data: {
        user_id: userId,
        character: item.character,
        action_type: actionType,
        accuracy: quality === 5 ? 100 : quality === 3 ? 60 : 0,
      },
    }),
  ])

  console.log(
    `[Wordbook] 学习记录: userId=${userId}, char=${item.character}, result=${result}, ` +
      `mastery=${updatedItem.mastery_level}, nextReview=${sm2Result.next_review_at.toISOString()}`
  )

  return {
    mastery_level: updatedItem.mastery_level,
    next_review_at: sm2Result.next_review_at.toISOString(),
    review_count: updatedItem.review_count,
  }
}

// ================================
// 6. 获取今日待复习汉字
// ================================

export interface GetReviewParams {
  userId: string
  bookId: string
}

export interface GetReviewResult {
  items: ReviewItemDTO[]
  total: number
}

export async function getTodayReview(
  params: GetReviewParams
): Promise<GetReviewResult> {
  const { userId, bookId } = params

  // 验证所有权
  await verifyBookOwnership(bookId, userId)

  const now = new Date()

  // 查询到期且未完全掌握的条目（mastery_level < 5）
  const items = await prisma.wordBookItem.findMany({
    where: {
      book_id: bookId,
      mastery_level: { lt: 5 },
      OR: [
        { next_review_at: null },               // 从未复习过
        { next_review_at: { lte: now } },        // 到期
      ],
    },
    orderBy: { next_review_at: 'asc' },
    select: {
      id: true,
      character: true,
      mastery_level: true,
    },
  })

  return {
    items: items.map((item) => ({
      id: item.id,
      character: item.character,
      mastery_level: item.mastery_level,
    })),
    total: items.length,
  }
}

// ================================
// 7. 获取学习统计
// ================================

export async function getWordBookStats(
  userId: string,
  bookId: string
): Promise<WordBookStatsDTO> {
  // 验证所有权
  await verifyBookOwnership(bookId, userId)

  // 今日时间范围（00:00:00 ~ 23:59:59）
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // 并行查询：汇总统计 + 今日学习数 + 周进度 + 连续学习天数
  const [masteredCount, learningCount, totalCount, todayRecords, weekRecords, allDates] =
    await Promise.all([
      // 已掌握（mastery_level = 5）
      prisma.wordBookItem.count({
        where: { book_id: bookId, mastery_level: 5 },
      }),
      // 学习中（mastery_level < 5）
      prisma.wordBookItem.count({
        where: { book_id: bookId, mastery_level: { lt: 5 } },
      }),
      // 总数
      prisma.wordBookItem.count({
        where: { book_id: bookId },
      }),
      // 今日学习记录数（通过学习记录表，针对该用户）
      prisma.learningRecord.count({
        where: {
          user_id: userId,
          created_at: { gte: todayStart, lte: todayEnd },
        },
      }),
      // 近7天每日学习次数（用于周进度图）
      prisma.learningRecord.findMany({
        where: {
          user_id: userId,
          created_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: { created_at: true },
      }),
      // 所有学习记录日期（用于连续天数计算）
      prisma.learningRecord.findMany({
        where: { user_id: userId },
        select: { created_at: true },
        orderBy: { created_at: 'desc' },
      }),
    ])

  // ---- 周进度统计 ----
  const weeklyProgress = buildWeeklyProgress(weekRecords.map((r) => r.created_at))

  // ---- 连续学习天数计算 ----
  const streakDays = calcStreakDays(allDates.map((r) => r.created_at))

  return {
    total_characters: totalCount,
    mastered_count: masteredCount,
    learning_count: learningCount,
    today_learned: todayRecords,
    streak_days: streakDays,
    weekly_progress: weeklyProgress,
  }
}

// ================================
// 内部工具：周进度聚合
// ================================

function buildWeeklyProgress(dates: Date[]): WeeklyProgressItem[] {
  // 生成最近7天的日期字符串（含今天）
  const result: WeeklyProgressItem[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    result.push({ date: d.toISOString().slice(0, 10), count: 0 })
  }

  // 计数
  for (const date of dates) {
    const dayStr = date.toISOString().slice(0, 10)
    const entry = result.find((r) => r.date === dayStr)
    if (entry) {
      entry.count++
    }
  }

  return result
}

// ================================
// 内部工具：连续学习天数计算
// ================================

function calcStreakDays(dates: Date[]): number {
  if (dates.length === 0) return 0

  // 去重为日期字符串集合
  const daySet = new Set(dates.map((d) => d.toISOString().slice(0, 10)))

  let streak = 0
  const today = new Date()

  // 从今天往前数连续有记录的天数
  // 如果今天没有记录，则从昨天开始数
  const todayStr = today.toISOString().slice(0, 10)
  const startOffset = daySet.has(todayStr) ? 0 : 1

  for (let i = startOffset; ; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dayStr = d.toISOString().slice(0, 10)

    if (daySet.has(dayStr)) {
      streak++
    } else {
      break
    }
  }

  return streak
}
