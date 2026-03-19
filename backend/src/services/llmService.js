import axios from 'axios'

/**
 * 大模型配置
 * 统一管理所有 API 接口
 */
const LLM_CONFIGS = {
  qwen: {
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    key: process.env.VITE_QWEN_KEY,
    model: 'qwen-plus'
  }
}

/**
 * 流式调用大模型 (通义千问)
 */
export async function callLLMStream(prompt, modelName, onChunk) {
  const config = LLM_CONFIGS.qwen

  if (!config.key) {
    throw new Error('通义千问 API Key 未配置')
  }

  try {
    const response = await axios.post(
      config.url,
      {
        model: config.model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        stream: true,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${ config.key }`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }
    )

    return new Promise((resolve, reject) => {
      let buffer = ''
      response.data.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            resolve()
            return
          }

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) onChunk(content)
          } catch (e) {}
        }
      })
      response.data.on('error', reject)
      response.data.on('end', resolve)
    })
  } catch (error) {
    console.error('[LLM流式调用] 失败:', error.message)
    throw error
  }
}

/**
 * 非流式调用 (用于分类等内部任务)
 */
export async function callLLM(prompt, modelName = 'qwen', maxTokens = 100) {
  const config = LLM_CONFIGS.qwen

  if (!config.key) {
    throw new Error('通义千问 API Key 未配置')
  }

  try {
    const response = await axios.post(
      config.url,
      {
        model: config.model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        stream: false,
        max_tokens: maxTokens,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${ config.key }`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )
    return response.data.choices[0].message.content
  } catch (error) {
    console.error('[LLM调用] 失败:', error.message)
    throw error
  }
}

export function getSupportedModels() {
  return [{
    name: 'qwen',
    model: LLM_CONFIGS.qwen.model,
    configured: !!LLM_CONFIGS.qwen.key
  }]
}
