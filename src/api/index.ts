import request from '@/utils/request'

/**
 * Get 请求示例
 */
export function getXxxxPrompt (params) {
  return request.get(`/xxxxxx/test/prompt`, params)
}

/**
 * ============ RAG 问答系统 API ============
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

export interface ChatMessage {
  type: 'category' | 'context' | 'content' | 'done' | 'error'
  data: any
}

/**
 * 后端健康检查
 */
export async function healthCheck (): Promise<{ status: string; }> {
  const response = await fetch(`${ API_BASE_URL.replace('/api', '') }/health`, {
    method: 'GET',
    signal: AbortSignal.timeout(3000)
  })
  if (!response.ok) {
    throw new Error(`Health check failed: ${ response.status }`)
  }
  return response.json()
}

/**
 * 流式RAG对话
 * @param question 用户问题
 * @param modelName 模型名称
 * @param useRAG 是否使用RAG增强
 * @param onMessage 消息回调
 */
export async function ragChatStream(
  question: string,
  modelName: string,
  useRAG: boolean,
  chatId: string,
  history: Array<{ role: string; content: string }> = [], // 新增 history 参数
  onMessage: (message: ChatMessage) => void
): Promise<void> {
  const token = localStorage.getItem('token') // 获取 Token
  const response = await fetch(`${ API_BASE_URL }/chat/stream`, { // 修正路径为 /chat/stream
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ token }` // 添加 Authorization 头
    },
    body: JSON.stringify({
      question,
      modelName,
      useRAG,
      chatId,
      history // 传递 history
    })
  })

  if (!response.ok) {
    throw new Error(`HTTP ${ response.status }: ${ response.statusText }`)
  }

  if (!response.body) {
    throw new Error('无法获取响应流')
  }

  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .getReader()

  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      // 拼接到缓冲区，处理跨 chunk 的 SSE 事件
      buffer += value
      const lines = buffer.split('\n')
      // 最后一段可能不完整，留在 buffer 中
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          try {
            const message: ChatMessage = JSON.parse(trimmed.slice(6))
            onMessage(message)

            if (message.type === 'done' || message.type === 'error') {
              return
            }
          } catch {
            // 非 JSON 数据，忽略
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// --- 用户相关接口 ---

export interface UserInfo {
  _id: string
  username: string
  role: 'user' | 'admin'
  token?: string
}

export interface AuthResponse {
  _id: string
  username: string
  role: 'user' | 'admin'
  token: string
}

// 登录
export function login(data: any) {
  return request.post('/users/login', data) as Promise<AuthResponse>
}

// 注册
export function register(data: any) {
  return request.post('/users/register', data) as Promise<AuthResponse>
}

// 注册管理员
export function registerAdmin(data: any) {
  return request.post('/users/register-admin', data) as Promise<AuthResponse>
}

// 获取用户信息
export function getUserInfo() {
  return request.get('/users/me') as Promise<UserInfo>
}

// --- 历史记录相关接口 ---

export interface ChatSession {
  _id: string
  title: string
  updatedAt: string
}

export interface ChatDetail {
  _id: string
  title: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: string
  }>
}

export function getHistoryList() {
  return request.get('/history') as Promise<ChatSession[]>
}

export function createChat(title?: string) {
  return request.post('/history', {
    title
  }) as Promise<ChatDetail>
}

export function getHistoryDetail(id: string) {
  return request.get(`/history/${ id }`) as Promise<ChatDetail>
}

export function deleteChat(id: string) {
  return request.delete(`/history/${ id }`)
}

// --- 知识库管理相关接口 ---

export interface ParseDocResponse {
  success: boolean
  data: {
    sourceName: string
    chunks: string[]
  }
  error?: string
}

export interface KnowledgeDoc {
  source: string
  category: string
  chunkCount: number
}

// 获取知识库列表
export function getKnowledgeListApi() {
  return request.get('/knowledge/list') as Promise<{ success: boolean, data: KnowledgeDoc[] }>
}

// 获取文档片段
export function getKnowledgeChunksApi(source: string) {
  return request.get('/knowledge/chunks', { source }) as Promise<{ success: boolean, data: any[] }>
}

// 删除文档
export function deleteKnowledgeDocApi(source: string) {
  return request.delete('/knowledge/delete', { data: { source } }) as Promise<{ success: boolean }>
}

// 上传并解析文档
export function parseKnowledgeDoc(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/knowledge/parse', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }) as Promise<ParseDocResponse>
}

// 保存编辑后的分块到向量库
export function saveKnowledgeChunks(data: { chunks: string[], category: string, sourceName: string }) {
  return request.post('/knowledge/save', data)
}
