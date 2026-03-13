/**
 * AI 服务统一配置
 *
 * 所有 API Key 从环境变量读取，禁止硬编码
 */

export const AIConfig = {
  // ==========================================
  // 通义千问（LLM 主服务）
  // ==========================================
  qwen: {
    apiKey: process.env.QWEN_API_KEY ?? '',
    baseUrl:
      process.env.QWEN_BASE_URL ??
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.QWEN_MODEL ?? 'qwen-max',
    timeout: 30_000,
  },

  // ==========================================
  // DeepSeek（LLM 备用服务）
  // ==========================================
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    baseUrl:
      process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    timeout: 30_000,
  },

  // ==========================================
  // 通义万相（生图主服务）
  // ==========================================
  wanx: {
    apiKey: process.env.WANX_API_KEY ?? '',
    baseUrl:
      process.env.WANX_BASE_URL ??
      'https://dashscope.aliyuncs.com/api/v1',
    model: process.env.WANX_MODEL ?? 'wanx-v1',
    timeout: 60_000,
  },

  // ==========================================
  // 智谱 CogView（生图备用服务）
  // ==========================================
  cogview: {
    apiKey: process.env.COGVIEW_API_KEY ?? '',
    baseUrl:
      process.env.COGVIEW_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4',
    model: process.env.COGVIEW_MODEL ?? 'cogview-3',
    timeout: 60_000,
  },

  // ==========================================
  // 阿里云内容安全（不降级）
  // ==========================================
  contentReview: {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID ?? '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET ?? '',
    regionId: process.env.ALIYUN_REGION_ID ?? 'cn-shanghai',
    timeout: 10_000,
  },

  // ==========================================
  // 熔断器全局配置
  // ==========================================
  circuitBreaker: {
    failureThreshold: 5,       // 触发熔断的连续失败次数
    successThreshold: 3,       // half-open 转 closed 需要的连续成功次数
    timeout: 30_000,           // 熔断后等待时间（ms）
    monitorInterval: 10_000,   // 统计窗口（ms）
  },

  // ==========================================
  // 降级图片路径（生图服务全部不可用时使用）
  // ==========================================
  fallbackImagePath:
    process.env.FALLBACK_IMAGE_PATH ?? '/public/fallback/char-placeholder.png',
} as const
