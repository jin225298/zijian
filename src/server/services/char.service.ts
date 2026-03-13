// =============================================================================
// 字见系统 — 汉字信息服务
// =============================================================================
// 任务: TASK-BE-008
// 职责:
//   - 获取汉字基础信息（拼音、笔画数、部首、释义、例词）
//   - 优先使用 cnchar 库（需安装: npm install cnchar cnchar-pro）
//   - cnchar 未安装时降级为 Unicode 范围基础信息
// =============================================================================

// ================================
// 汉字验证
// ================================

/**
 * 验证是否为合法的单个汉字（CJK 统一汉字及扩展区）
 */
export function isValidChinese(char: string): boolean {
  if (!char || char.length > 4) return false
  // CJK 统一汉字: \u4E00-\u9FFF
  // CJK 扩展A区: \u3400-\u4DBF
  // CJK 扩展B区: \u{20000}-\u{2A6DF}（代理对）
  const cjkRegex = /^[\u3400-\u9FFF\uF900-\uFAFF]$/u
  return cjkRegex.test(char)
}

// ================================
// cnchar 动态加载（可选依赖）
// ================================

interface CncharModule {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (char: string, ...args: any[]): any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use: (...plugins: any[]) => void
  spell: (char: string, toneType?: string) => string
  stroke: (char: string, strokeType?: string) => number
}

let _cnchar: CncharModule | null = null
let _cncharLoaded = false

async function loadCnchar(): Promise<CncharModule | null> {
  if (_cncharLoaded) return _cnchar
  _cncharLoaded = true

  try {
    // 动态加载 cnchar（可选依赖）
    const cncharModule = await import('cnchar' as string)
    _cnchar = cncharModule.default ?? cncharModule
    console.log('[CharService] cnchar 库加载成功')
    return _cnchar
  } catch {
    console.warn(
      '[CharService] cnchar 库未安装，将使用降级方案。' +
        '完整功能需安装: npm install cnchar cnchar-pro'
    )
    return null
  }
}

// ================================
// 汉字信息结构
// ================================

export interface CharInfo {
  char: string
  pinyin: string       // 主拼音（含声调，如 "shuǐ"）
  strokes: number      // 笔画数
  radical: string      // 部首
  meaning: string      // 释义（简短）
  examples: string[]   // 常用例词（2-3个）
}

// ================================
// 降级：基础静态数据（常用汉字子集）
// ================================

/**
 * 常用汉字静态数据（cnchar 不可用时的降级方案）
 * 覆盖部分高频汉字，其余返回基础占位信息
 */
const STATIC_CHAR_DATA: Record<string, Omit<CharInfo, 'char'>> = {
  水: { pinyin: 'shuǐ', strokes: 4, radical: '水', meaning: '无色无味透明的液体', examples: ['喝水', '河水', '雨水'] },
  火: { pinyin: 'huǒ', strokes: 4, radical: '火', meaning: '物质燃烧时产生的光和热', examples: ['火焰', '篝火', '生火'] },
  山: { pinyin: 'shān', strokes: 3, radical: '山', meaning: '地面隆起的部分', examples: ['山峰', '高山', '登山'] },
  木: { pinyin: 'mù', strokes: 4, radical: '木', meaning: '树木的茎干', examples: ['木头', '树木', '木材'] },
  日: { pinyin: 'rì', strokes: 4, radical: '日', meaning: '太阳；白天', examples: ['日出', '日落', '日记'] },
  月: { pinyin: 'yuè', strokes: 4, radical: '月', meaning: '月球；月份', examples: ['月亮', '月光', '新月'] },
  人: { pinyin: 'rén', strokes: 2, radical: '人', meaning: '能制造工具并使用工具的动物', examples: ['人类', '人民', '人生'] },
  大: { pinyin: 'dà', strokes: 3, radical: '大', meaning: '在体积、面积等方面超过一般', examples: ['大小', '大家', '广大'] },
  小: { pinyin: 'xiǎo', strokes: 3, radical: '小', meaning: '在体积、面积等方面不超过一般', examples: ['小心', '小学', '渺小'] },
  土: { pinyin: 'tǔ', strokes: 3, radical: '土', meaning: '地面上的泥沙混合物', examples: ['土地', '泥土', '国土'] },
  口: { pinyin: 'kǒu', strokes: 3, radical: '口', meaning: '嘴；出入的地方', examples: ['口语', '入口', '出口'] },
  手: { pinyin: 'shǒu', strokes: 4, radical: '手', meaning: '人体上肢前端能抓握的部分', examples: ['手机', '手工', '握手'] },
  心: { pinyin: 'xīn', strokes: 4, radical: '心', meaning: '心脏；思想感情', examples: ['心情', '开心', '真心'] },
  目: { pinyin: 'mù', strokes: 5, radical: '目', meaning: '眼睛', examples: ['目标', '注目', '眼目'] },
  耳: { pinyin: 'ěr', strokes: 6, radical: '耳', meaning: '听觉器官', examples: ['耳朵', '耳机', '耳目'] },
}

// ================================
// 汉字信息获取
// ================================

/**
 * 获取汉字基础信息
 * 优先使用 cnchar 库，不可用时降级为静态数据
 */
export async function getCharInfo(char: string): Promise<CharInfo> {
  const cnchar = await loadCnchar()

  if (cnchar) {
    return getCharInfoByCnchar(char, cnchar)
  }

  return getCharInfoByFallback(char)
}

/**
 * 通过 cnchar 获取汉字信息
 */
function getCharInfoByCnchar(char: string, cnchar: CncharModule): CharInfo {
  try {
    // 获取拼音（带声调符号，cnchar 有效参数：tone）
    const pinyin = cnchar.spell(char, 'tone') || cnchar.spell(char) || '—'
    // 获取笔画数
    const strokes = cnchar.stroke(char) || 0

    // 静态数据补充（部首和释义 cnchar 基础版不提供）
    const staticData = STATIC_CHAR_DATA[char]

    return {
      char,
      pinyin: String(pinyin),
      strokes,
      radical: staticData?.radical ?? '—',
      meaning: staticData?.meaning ?? '暂无释义',
      examples: staticData?.examples ?? [],
    }
  } catch (error) {
    console.warn(`[CharService] cnchar 解析失败 char=${char}:`, error)
    return getCharInfoByFallback(char)
  }
}

/**
 * 降级：静态数据 + Unicode 基础信息
 */
function getCharInfoByFallback(char: string): CharInfo {
  const staticData = STATIC_CHAR_DATA[char]

  if (staticData) {
    return { char, ...staticData }
  }

  // 最终兜底：仅返回字符本身，其余字段为占位值
  return {
    char,
    pinyin: '—',
    strokes: 0,
    radical: '—',
    meaning: '暂无释义',
    examples: [],
  }
}
