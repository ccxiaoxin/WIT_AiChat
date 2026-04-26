/**
 * 智能模型路由服务
 * 根据用户意图（Category）自动分配最合适的模型
 */

// 定义支持的模型
export const SUPPORTED_MODELS = [
  { id: 'auto', name: '🤖 智能路由 (Auto)' },
  { id: 'qwen', name: '通义千问 (Qwen)' },
  { id: 'deepseek', name: 'DeepSeek (代码/逻辑强)' },
  { id: 'moonshot', name: 'Kimi (长文本强)' }
]

/**
 * 根据分类决定最佳模型
 * @param {string} category - 意图分类 (policy, major, career, general)
 * @returns {string} - 推荐的模型 ID (qwen, deepseek, moonshot)
 */
export function determineBestModel(category) {
  // 1. 政策类 (policy)：通常文本较长，需要大上下文，推荐 moonshot (Kimi) 或 qwen
  if (category.startsWith('policy')) {
    return 'moonshot'
  }
  
  // 2. 专业/代码类 (major)：需要极强的逻辑推理和代码能力，强烈推荐 deepseek
  if (category.startsWith('major')) {
    return 'deepseek'
  }
  
  // 3. 职业规划类 (career)：需要发散性思维和通用知识，推荐 qwen
  if (category === 'career') {
    return 'qwen'
  }
  
  // 4. 默认/闲聊 (general)：使用 qwen 作为默认底座
  return 'qwen'
}
