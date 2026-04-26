import { defineStore } from 'pinia'

import * as GlobalAPI from '@/api'
import { type ChatMessage, type ChatSession, getHistoryDetail, getHistoryList, ragChatStream } from '@/api'

import { defaultModelName, modelMappingList } from '@/components/MarkdownPreview/models'
import type { CrossTransformFunction } from '@/components/MarkdownPreview/models'

export interface MessageItem {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  routedModel?: string
  isAutoRouted?: boolean
}

export interface BusinessState {
  systemModelName: string
  useRAG: boolean
  currentCategory: string | null
  contextSources: string[]
  backendConnected: boolean
  currentChatId: string | null
  chatLoading: boolean // 新增：会话加载状态
  messageList: MessageItem[] // 新增：当前会话的消息列表
  historyList: ChatSession[] // 新增：历史会话列表
  routedModel: string | null // 新增：智能路由最终选择的模型
  isAutoRouted: boolean // 新增：是否是自动路由的
}

/**
 * 透传转换器：后端已完成 SSE 解析，stream 中是纯文本
 * MarkdownPreview 需要 { content, done } 格式
 */
const ragPassthroughTransform: CrossTransformFunction = (readValue, textDecoder) => {
  let content = ''
  if (readValue instanceof Uint8Array) {
    content = textDecoder.decode(readValue, {
      stream: true
    })
  } else {
    content = readValue as string
  }
  return {
    content,
    done: false
  }
}

export const useBusinessStore = defineStore('business-store', {
  state: (): BusinessState => {
    return {
      systemModelName: 'auto', // 默认使用智能路由
      useRAG: true, // 默认开启RAG
      currentCategory: null,
      contextSources: [],
      backendConnected: false,
      currentChatId: null,
      chatLoading: false,
      messageList: [], // 初始化为空
      historyList: [], // 初始化为空
      routedModel: null,
      isAutoRouted: false
    }
  },
  getters: {
    currentModelItem (state) {
      return modelMappingList.find(v => v.modelName === state.systemModelName)
    },

    /**
     * 当前应使用的流转换函数：
     * - 后端已连接 → 使用透传转换器（后端已完成 SSE 解析，enqueue 的是纯文本）
     * - 后端未连接 → 使用模型自带的转换器（前端直连大模型 API）
     */
    currentTransformFn (state): CrossTransformFunction | undefined {
      if (state.backendConnected) {
        return ragPassthroughTransform
      }
      return this.currentModelItem?.transformStreamValue as CrossTransformFunction | undefined
    }
  },
  actions: {
    /**
     * 检查后端连接
     */
    async checkBackendConnection() {
      try {
        const result = await GlobalAPI.healthCheck()
        this.backendConnected = result.status === 'ok'
        return this.backendConnected
      } catch (error: any) {
        console.warn('后端服务未连接:', error.message)
        this.backendConnected = false
        return false
      }
    },

    /**
     * 加载历史会话列表
     */
    async loadHistoryList() {
      try {
        const res = await getHistoryList() as unknown as ChatSession[]
        if (Array.isArray(res) && res.length === 0) {
          // Mock data
          this.historyList = [
            {
              _id: 'mock-1',
              title: '示例对话：RAG原理',
              updatedAt: new Date().toISOString()
            },
            {
              _id: 'mock-2',
              title: '示例对话：Vue3教程',
              updatedAt: new Date().toISOString()
            }
          ]
        } else {
          this.historyList = res
        }
      } catch (error) {
        console.error('获取历史记录失败', error)
        // Mock data on error
        this.historyList = [
          {
            _id: 'mock-1',
            title: '示例对话：RAG原理',
            updatedAt: new Date().toISOString()
          },
          {
            _id: 'mock-2',
            title: '示例对话：Vue3教程',
            updatedAt: new Date().toISOString()
          }
        ]
      }
    },

    /**
     * 静默更新当前会话的最新状态（不触发 loading 骨架屏）
     */
    async silentUpdateChatHistory(chatId: string) {
      if (!chatId) return
      try {
        const res = await getHistoryDetail(chatId)
        if (res && res.messages) {
          // 只更新最后一条消息的 _id 和 feedback 等状态，不替换整个数组以避免闪烁
          const lastServerMsg = res.messages[res.messages.length - 1]
          const lastLocalMsg = this.messageList[this.messageList.length - 1]
          
          if (lastServerMsg && lastLocalMsg && lastServerMsg.role === lastLocalMsg.role) {
             Object.assign(lastLocalMsg, lastServerMsg)
          } else {
             // 如果对不上，再整体替换
             this.messageList = res.messages
          }
        }
      } catch (error) {
        console.error('静默同步历史记录失败', error)
      }
    },

    /**
     * 加载会话详情
     */
    async loadChatHistory(chatId: string) {
      if (!chatId) return
      this.chatLoading = true
      this.messageList = [] // 立即清空，避免显示上一个会话的内容
      try {
        const res = await getHistoryDetail(chatId)
        if (res && res.messages) {
          this.messageList = res.messages
        } else {
          this.messageList = []
        }
      } catch (error) {
        console.error('加载历史记录失败', error)
        this.messageList = []
      } finally {
        this.chatLoading = false
      }
    },

    /**
     * 添加一条消息到列表
     */
    addMessage(role: 'user' | 'assistant', content: string) {
      this.messageList.push({
        role,
        content,
        timestamp: new Date().toISOString()
      })
    },

    /**
     * 统一对话接口：所有请求通过后端API处理
     * 后端会根据 useRAG 参数决定是否使用 RAG 增强
     * 后端会根据 modelName 选择对应的大模型
     */
    async createAssistantWriterStylized(data: { text: string; }): Promise<{
      error: number
      reader: ReadableStreamDefaultReader<string> | null
    }> {
      // 检查后端连接
      if (!this.backendConnected) {
        console.error('[API] 后端服务未连接，请先启动后端服务')
        window.$ModalMessage?.error('后端服务未连接，请先启动后端服务')
        return {
          error: 1,
          reader: null
        }
      }

      // 确保有会话ID
      if (!this.currentChatId) {
        // 如果没有会话ID，尝试创建一个新会话
        try {
          const newChat = await GlobalAPI.createChat()
          this.currentChatId = newChat._id
        } catch (e) {
          console.error('创建新会话失败', e)
          window.$ModalMessage?.error('创建新会话失败，无法开始对话')
          return {
            error: 1,
            reader: null
          }
        }
      }

      // 1. 添加用户消息
      this.addMessage('user', data.text)
      // 2. 添加助手消息占位符
      this.addMessage('assistant', '')
      const currentMessageIndex = this.messageList.length - 1

      return new Promise((resolve) => {
        // 重置RAG状态
        this.currentCategory = null
        this.contextSources = []
        this.routedModel = null
        this.isAutoRouted = false

        let streamClosed = false

        const stream = new ReadableStream<string>({
          start: async (controller) => {
            try {
              console.log(`[API] 请求后端: model=${ this.systemModelName }, useRAG=${ this.useRAG }, chatId=${ this.currentChatId }`)

              await ragChatStream(
                data.text,
                this.systemModelName,
                this.useRAG,
                this.currentChatId!, // 传递当前会话ID
                this.messageList.map(m => ({
                  role: m.role,
                  content: m.content
                })), // 传递历史记录
                (message: ChatMessage) => {
                  if (streamClosed) return

                  switch (message.type) {
                    case 'model_routed':
                      this.routedModel = message.data?.model || null
                      this.isAutoRouted = message.data?.isAutoRouted || false
                      // 同步保存到当前消息项中，供历史记录展示使用
                      this.messageList[currentMessageIndex].routedModel = this.routedModel || undefined
                      this.messageList[currentMessageIndex].isAutoRouted = this.isAutoRouted
                      console.log(`[RAG] 智能路由结果: ${this.routedModel} (Auto: ${this.isAutoRouted})`)
                      break
                    case 'category':
                      this.currentCategory = message.data
                      console.log('[RAG] 问题分类:', message.data)
                      break
                    case 'context':
                      this.contextSources = message.data?.sources || []
                      console.log('[RAG] 知识来源:', this.contextSources)
                      break
                    case 'content':
                      // 实时更新 Store 中的消息内容
                      this.messageList[currentMessageIndex].content += message.data
                      controller.enqueue(message.data)
                      break
                    case 'done':
                      if (!streamClosed) {
                        streamClosed = true
                        controller.close()
                      }
                      break
                    case 'error':
                      if (!streamClosed) {
                        streamClosed = true
                        controller.error(new Error(message.data))
                      }
                      break
                  }
                }
              )

              // ragChatStream 正常结束但 controller 未关闭（可能没收到 done 事件）
              if (!streamClosed) {
                streamClosed = true
                controller.close()
              }
            } catch (error) {
              console.error('[API] 调用失败:', error)
              if (!streamClosed) {
                streamClosed = true
                controller.error(error)
              }
            }
          }
        })

        const reader = stream.getReader()
        resolve({
          error: 0,
          reader
        })
      })
    }
  }
})
