// =============================================================================
// 字见系统 — 语言转换 Few-Shot 示例与 Prompt 构建器
// =============================================================================
// 任务: TASK-BE-009
// 职责:
//   - 提供三个场景（日常/正式/学术）的 few-shot 转换示例
//   - 构建结构化 JSON 输出的 Prompt，引导 LLM 输出可解析结果
// =============================================================================

// ==========================================
// 类型定义
// ==========================================

export type ConvertContext = 'daily' | 'formal' | 'academic'

export interface ConvertExample {
  input: string
  output: string
}

// ==========================================
// Few-Shot 示例集
// ==========================================

export const FEW_SHOT_EXAMPLES: Record<ConvertContext, ConvertExample[]> = {
  // ---------- 日常生活场景 ----------
  daily: [
    {
      input: '我 昨天 超市 买 苹果 三个',
      output: '我昨天在超市买了三个苹果',
    },
    {
      input: '他 医院 看 病',
      output: '他去医院看病了',
    },
    {
      input: '你 今天 吃饭 了 吗',
      output: '你今天吃饭了吗',
    },
    {
      input: '我 朋友 明天 来 这里',
      output: '我的朋友明天要来这里',
    },
    {
      input: '天气 今天 很好 我们 出去 玩',
      output: '今天天气很好，我们出去玩吧',
    },
    {
      input: '妈妈 超市 买 菜 回来',
      output: '妈妈去超市买菜回来了',
    },
    {
      input: '我 手机 找不到 急 很',
      output: '我找不到手机，非常着急',
    },
  ],

  // ---------- 正式/公文场景 ----------
  formal: [
    {
      input: '我 需要 申请 休假 三天',
      output: '我需要申请三天的休假',
    },
    {
      input: '公司 会议 明天 上午 九点',
      output: '公司会议定于明天上午九点召开',
    },
    {
      input: '报告 已经 完成 请 审阅',
      output: '报告已经完成，请您审阅',
    },
    {
      input: '项目 进度 延误 原因 说明',
      output: '现就项目进度延误的原因进行说明',
    },
    {
      input: '感谢 你们 支持 帮助',
      output: '感谢各位的支持与帮助',
    },
    {
      input: '合同 条款 修改 需要 确认',
      output: '合同条款的修改内容需要双方确认',
    },
    {
      input: '本次 活动 时间 地点 通知',
      output: '现就本次活动的时间与地点进行通知',
    },
  ],

  // ---------- 学术/论文场景 ----------
  academic: [
    {
      input: '研究 表明 学习 方法 影响 成绩',
      output: '研究表明，学习方法对学业成绩具有显著影响',
    },
    {
      input: '实验 数据 分析 结果 显示',
      output: '实验数据的分析结果显示',
    },
    {
      input: '本文 讨论 语言 认知 关系',
      output: '本文旨在探讨语言与认知之间的关系',
    },
    {
      input: '该 理论 提出 新 观点 值得 关注',
      output: '该理论提出了新的观点，值得深入关注与研究',
    },
    {
      input: '数据 样本 选取 随机 方法',
      output: '数据样本采用随机抽样方法进行选取',
    },
    {
      input: '前人 研究 成果 基础 上 进一步 探讨',
      output: '在前人研究成果的基础上，本文进一步探讨',
    },
    {
      input: '实验 结论 验证 假设 正确',
      output: '实验结论验证了假设的正确性',
    },
  ],
}

// ==========================================
// 场景标签映射
// ==========================================

const CONTEXT_LABELS: Record<ConvertContext, string> = {
  daily: '日常生活',
  formal: '正式/公文',
  academic: '学术/论文',
}

const CONTEXT_STYLE_HINTS: Record<ConvertContext, string> = {
  daily: '口语化、自然流畅，贴近日常交流',
  formal: '措辞严谨、结构规范，适用于公文/职场',
  academic: '用语精准、逻辑严密，符合学术写作规范',
}

// ==========================================
// Prompt 构建器
// ==========================================

/**
 * 构建手语转标准书面语的 few-shot Prompt
 *
 * @param text    - 手语式中文输入（词语之间用空格分隔）
 * @param context - 转换场景（daily | formal | academic）
 * @returns 完整 Prompt 字符串
 *
 * LLM 输出格式（严格 JSON）：
 * {
 *   "converted": "转换后的标准中文",
 *   "confidence": 0.0-1.0,
 *   "alternatives": ["备选1", "备选2"]  // 最多3个
 * }
 */
export function buildConvertPrompt(text: string, context: ConvertContext): string {
  const contextLabel = CONTEXT_LABELS[context]
  const styleHint = CONTEXT_STYLE_HINTS[context]
  const examples = FEW_SHOT_EXAMPLES[context]

  // 取前3个示例用于 few-shot（避免 prompt 过长）
  const fewShotText = examples
    .slice(0, 3)
    .map(
      (ex) =>
        `输入：${ex.input}\n` +
        `输出：{"converted":"${ex.output}","confidence":0.95,"alternatives":[]}`
    )
    .join('\n\n')

  return (
    `你是一位专业的中文语言转换助手，专门将手语式中文转换为标准书面语。\n` +
    `\n` +
    `【手语式中文特点】\n` +
    `- 词语之间用空格分隔\n` +
    `- 词序与手语一致（通常为主-宾-谓结构）\n` +
    `- 省略助词（的/了/在/着）、虚词和时态标记\n` +
    `- 语法较简略，缺少连词和介词\n` +
    `\n` +
    `【转换要求】\n` +
    `1. 严格保留原文语义，不增删实质性内容\n` +
    `2. 补全省略的助词、虚词、介词\n` +
    `3. 调整词序为标准现代汉语语序\n` +
    `4. 当前场景"${contextLabel}"：${styleHint}\n` +
    `5. confidence 反映转换质量（1.0=完全确定，<0.7=有歧义）\n` +
    `6. alternatives 提供最多3个语义等价的备选转换\n` +
    `\n` +
    `【输出格式】严格输出 JSON，不要有任何额外文字或代码块标记：\n` +
    `{"converted":"转换后文本","confidence":0.95,"alternatives":["备选1","备选2"]}\n` +
    `\n` +
    `【示例】\n` +
    `${fewShotText}\n` +
    `\n` +
    `【待转换】场景：${contextLabel}\n` +
    `输入：${text}\n` +
    `输出：`
  )
}
