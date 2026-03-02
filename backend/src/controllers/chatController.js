import { classifyQuestion } from '../services/classifierService.js'
import { streamRAGChain } from '../services/ragChainService.js'
import { callLLMStream } from '../services/llmService.js'
import Chat from '../models/chatModel.js'
import jwt from 'jsonwebtoken'
/**
 * 安全地向客户端写入 SSE 事件
 * 如果连接已关闭则静默跳过
 */
function safeSend(res, data) {
  try {
    if (!res.writableEnded) {
      res.write(`data: ${ JSON.stringify(data) }\n\n`)
    }
  } catch (e) {
    // 连接已关闭，静默忽略
  }
}

/**
 * 尝试从请求头获取用户ID (不强制阻断，用于关联历史记录)
 */
async function getUserIdFromRequest(req) {
  try {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      const token = req.headers.authorization.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      return decoded.id
    }
  } catch (error) {
    // Token 无效或过期，忽略
  }
  return null
}

/**
 * 流式对话控制器（集成智能路由、知识增强与历史记录预留）
 */
export async function streamChat(req, res) {
  const { question, modelName = 'qwen', useRAG = true, history = [], chatId } = req.body

  if (!question || !question.trim()) {
    return res.status(400).json({
      error: '问题不能为空'
    })
  }

  // 尝试获取用户ID
  const userId = await getUserIdFromRequest(req)

  // 客户端断连标记（必须监听 res 而非 req，req 在 body 解析完毕后就会触发 close）
  let clientClosed = false
  res.on('close', () => {
    if (!res.writableFinished) {
      clientClosed = true
      console.log('[对话中断] 客户端已断开连接')
    }
  })

  // 收集完整的回答内容，用于存入数据库
  let fullAnswer = ''

  try {
    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const startTime = Date.now()
    console.log(`\n[对话开始] 问题: ${ question }`)
    console.log(`[配置] 模型: ${ modelName }, RAG: ${ useRAG }, 历史记录数: ${ history.length }, ChatID: ${ chatId }`)

    if (useRAG) {
      // 1. 智能路由：问题分类
      const classifyStart = Date.now()
      const category = await classifyQuestion(question)
      const classifyTime = Date.now() - classifyStart
      console.log(`[智能路由] 识别分类: ${ category } (耗时 ${ classifyTime }ms)`)

      if (clientClosed) return res.end()

      // 发送分类结果给前端
      safeSend(res, {
        type: 'category',
        data: category
      })

      // 2. 执行 RAG Chain (内部已集成知识增强与向量检索)
      console.log(`[RAG Chain] 开始执行调度...`)
      const ragStart = Date.now()

      const { sources } = await streamRAGChain(
        question,
        category,
        modelName,
        history,
        (chunk) => {
          if (!clientClosed) {
            fullAnswer += chunk // 收集回答
            safeSend(res, {
              type: 'content',
              data: chunk
            })
          }
        }
      )

      const ragTime = Date.now() - ragStart
      console.log(`[RAG Chain] 流式输出完成 (耗时 ${ ragTime }ms)`)

      if (clientClosed) return res.end()

      // 3. 发送知识来源
      safeSend(res, {
        type: 'context',
        data: {
          sources,
          count: sources.length
        }
      })

    } else {
      // 直调模式（不经过 RAG）
      console.log(`[大模型调用] 直调模式`)
      await callLLMStream(question, modelName, (chunk) => {
        if (!clientClosed) {
          fullAnswer += chunk // 收集回答
          safeSend(res, {
            type: 'content',
            data: chunk
          })
        }
      })
    }

    if (clientClosed) return res.end()

    // 4. 发送完成信号
    safeSend(res, {
      type: 'done'
    })

    const totalTime = Date.now() - startTime
    console.log(`[对话完成] 总耗时 ${ totalTime }ms\n`)
    res.end()

    // 5. 异步保存对话历史 (在响应结束后执行，不阻塞前端)
    if (userId && chatId && fullAnswer) {
      saveChatHistory(userId, chatId, question, fullAnswer).catch(err => {
        console.error('[History] 保存历史记录失败:', err.message)
      })
    }

  } catch (error) {
    console.error('[ChatController] 错误:', error)

    // 如果连接还在，尝试发送错误信息给前端
    if (!clientClosed && !res.writableEnded) {
      try {
        // 如果还没发送过响应头，返回标准 JSON 错误
        if (!res.headersSent) {
          return res.status(500).json({
            error: error.message || '服务器内部错误'
          })
        }
        // 已发送 SSE 头，用 SSE 格式返回错误
        safeSend(res, {
          type: 'error',
          data: error.message || '服务器内部错误'
        })
      } catch (e) {
        // 发送错误信息本身也失败了，放弃
      }
    }

    if (!res.writableEnded) {
      res.end()
    }
  }
}

/**
 * 保存对话历史到数据库
 */
async function saveChatHistory(userId, chatId, question, answer) {
  try {
    const chat = await Chat.findOne({
      _id: chatId,
      user: userId
    })

    if (chat) {
      // 追加用户提问
      chat.messages.push({
        role: 'user',
        content: question
      })
      // 追加 AI 回答
      chat.messages.push({
        role: 'assistant',
        content: answer
      })

      // 如果是新对话（只有这两条消息），尝试用问题作为标题
      if (chat.messages.length <= 2 && chat.title === '新对话') {
        // 截取前20个字符作为标题
        chat.title = question.substring(0, 20) + (question.length > 20 ? '...' : '')
      }

      await chat.save()
      console.log(`[History] 已保存对话记录到会话: ${ chatId }`)
    } else {
      console.warn(`[History] 未找到会话或无权访问: ${ chatId }`)
    }
  } catch (error) {
    console.error(`[History] 保存失败: ${ error.message }`)
    throw error
  }
}

/**
 * 获取历史记录 (预留接口 - 已废弃，请使用 historyController)
 */
export async function getHistory(req, res) {
  try {
    // 兼容旧代码，返回空数组
    res.json({
      success: true,
      history: []
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
