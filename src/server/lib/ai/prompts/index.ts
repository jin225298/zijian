/**
 * Prompt 模板管理
 *
 * 版本化管理，每个场景保留多个版本，通过 activeVersion 指定当前使用版本。
 * 不同版本可在 A/B 测试后切换，保留历史版本便于回滚。
 */

// ==========================================
// 从 convert-examples 导入并重新导出
// ==========================================

import {
  buildConvertPrompt as _buildConvertPrompt,
  FEW_SHOT_EXAMPLES as _FEW_SHOT_EXAMPLES,
  type ConvertContext,
  type ConvertExample,
} from './convert-examples'

export {
  _buildConvertPrompt as buildConvertPrompt,
  _FEW_SHOT_EXAMPLES as FEW_SHOT_EXAMPLES,
}
export type { ConvertContext, ConvertExample }

// ==========================================
// 汉字可视化 Prompt（用于通义万相生图）
// ==========================================

export const charVisualizationPrompts = {
  /** 当前激活版本 */
  activeVersion: 'v2' as const,

  v1: (char: string, style: string): string =>
    `为汉字"${char}"创作一幅${style}风格的教育插画。` +
    `画面中要体现汉字的象形来源或字义，色彩鲜艳，适合儿童学习。` +
    `背景简洁，主体突出，无文字水印。`,

  v2: (char: string, style: string): string =>
    `请为汉字"${char}"设计一幅${style}风格的教学插画：\n` +
    `1. 画面需直观体现汉字的本义或造字来源（象形/会意/形声）\n` +
    `2. 色调温暖明亮，线条清晰，适合6-12岁儿童\n` +
    `3. 构图简洁，主体占画面70%以上\n` +
    `4. 无任何文字、水印或边框`,
}

/** 快捷调用：使用当前激活版本 */
export function buildCharVisualizationPrompt(
  char: string,
  style: string = '水彩'
): string {
  const version = charVisualizationPrompts.activeVersion
  return charVisualizationPrompts[version](char, style)
}

// ==========================================
// 手语转标准书面语 Prompt（用于通义千问/DeepSeek）
// ==========================================

export const signToStandardPrompts = {
  activeVersion: 'v1' as const,

  v1: {
    /** 日常场景 */
    daily: (input: string): string =>
      `你是一位专业的中文语言转换助手，帮助听障用户将手语式中文转换为标准书面语。\n` +
      `\n` +
      `手语式中文特点：词序与手语一致（主-宾-谓），省略助词、虚词，语法较简略。\n` +
      `转换要求：\n` +
      `1. 保留原意，补全省略的助词和虚词\n` +
      `2. 调整词序为标准中文语序\n` +
      `3. 使用日常口语风格，自然流畅\n` +
      `4. 只输出转换后的文本，不要解释\n` +
      `\n` +
      `输入：${input}`,

    /** 正式场景（公文、简历等） */
    formal: (input: string): string =>
      `你是一位专业的中文语言转换助手，帮助听障用户将手语式中文转换为正式书面语。\n` +
      `\n` +
      `手语式中文特点：词序与手语一致（主-宾-谓），省略助词、虚词，语法较简略。\n` +
      `转换要求：\n` +
      `1. 保留原意，补全所有省略的语法成分\n` +
      `2. 调整词序为标准中文语序\n` +
      `3. 使用正式书面语风格，措辞严谨\n` +
      `4. 适当使用四字词语和正式用语\n` +
      `5. 只输出转换后的文本，不要解释\n` +
      `\n` +
      `输入：${input}`,
  },
}

/** 快捷调用 */
export function buildSignToStandardPrompt(
  input: string,
  scene: 'daily' | 'formal' = 'daily'
): string {
  const version = signToStandardPrompts.activeVersion
  return signToStandardPrompts[version][scene](input)
}

// ==========================================
// 汉字释义生成 Prompt
// ==========================================

export const charExplanationPrompts = {
  activeVersion: 'v1' as const,

  v1: (char: string): string =>
    `请为汉字"${char}"生成一段简短的儿童友好释义，要求：\n` +
    `1. 使用简单易懂的语言，避免生僻词汇\n` +
    `2. 先解释字义，再举一个生活化例句\n` +
    `3. 总长度不超过80字\n` +
    `4. 输出格式：{"meaning": "释义", "example": "例句"}\n` +
    `\n` +
    `汉字：${char}`,
}

/** 快捷调用 */
export function buildCharExplanationPrompt(char: string): string {
  const version = charExplanationPrompts.activeVersion
  return charExplanationPrompts[version](char)
}

// ==========================================
// 统一导出（向后兼容的命名空间风格）
// ==========================================

export const PromptTemplates = {
  charVisualization: charVisualizationPrompts,
  signToStandard: signToStandardPrompts,
  charExplanation: charExplanationPrompts,

  /** 便捷方法 */
  build: {
    charVisualization: buildCharVisualizationPrompt,
    signToStandard: buildSignToStandardPrompt,
    charExplanation: buildCharExplanationPrompt,
    convert: _buildConvertPrompt,
  },
} as const
