/**
 * 向量检索服务 - 基于 LangChain
 */

import { Chroma } from '@langchain/community/vectorstores/chroma'
import { OpenAIEmbeddings } from '@langchain/openai'

/**
 * 获取 Embeddings 模型
 * 适配千问 (VITE_QWEN_KEY) 和 OpenAI
 */
function getEmbeddings() {
  const isQwen = process.env.VITE_QWEN_KEY && !process.env.OPENAI_API_KEY
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_QWEN_KEY

  if (!apiKey) {
    console.warn('[向量检索] 未配置 API Key')
    return null
  }

  return new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    modelName: isQwen ? 'text-embedding-v2' : 'text-embedding-3-small',
    ...(isQwen ? {
      configuration: {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      }
    } : {})
  })
}

/**
 * 向量检索（核心函数）
 * @param {string} query 查询文本
 * @param {string} collectionName 集合名称
 * @param {number} topK 返回结果数量
 * @param {object} filter 元数据过滤器 (用于智能路由)
 */
export async function searchVector(query, collectionName = 'knowledge_base', topK = 3, filter = null) {
  console.log(`[向量检索] 正在检索: "${ query }" (集合: ${ collectionName })`)

  try {
    const embeddings = getEmbeddings()
    if (!embeddings) throw new Error('Embeddings 未配置')

    // 连接现有的 Chroma 集合
    const vectorStore = await Chroma.fromExistingCollection(embeddings, {
      collectionName,
      url: process.env.CHROMA_URL || 'http://localhost:8000'
    })

    // 执行相似度搜索（带分数）
    // 注意：Chroma 的 score 是距离，越小越相关
    const results = await vectorStore.similaritySearchWithScore(query, topK, filter)

    console.log(`[向量检索] 找到 ${ results.length } 条结果`)

    // 转换为统一格式返回
    return results.map(([doc, score]) => ({
      pageContent: doc.pageContent,
      metadata: {
        source: doc.metadata?.source || '未知',
        category: doc.metadata?.category || '未分类',
        ...doc.metadata
      },
      score // 相似度分数
    }))

  } catch (error) {
    console.error('[向量检索] 检索失败:', error.message)
    return []
  }
}

/**
 * 创建检索器接口 (Retriever)
 * 方便后续集成到 LangChain 链中
 */
export async function createRetriever(collectionName = 'knowledge_base', options = {}) {
  try {
    const embeddings = getEmbeddings()
    const vectorStore = await Chroma.fromExistingCollection(embeddings, {
      collectionName,
      url: process.env.CHROMA_URL || 'http://localhost:8000'
    })

    return vectorStore.asRetriever({
      k: options.topK || 3,
      filter: options.filter,
      searchType: 'similarity'
    })
  } catch (error) {
    console.error('[向量检索] 创建 Retriever 失败:', error.message)
    return null
  }
}
