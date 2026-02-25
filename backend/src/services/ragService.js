import { searchVector } from './vectorService.js'
import { searchStructuredFacts } from './structuredService.js'
import { CATEGORIES } from './classifierService.js'

/**
 * 核心 RAG 处理服务 (智能路由与知识增强调度中心)
 *
 * 职责：
 * 1. 智能路由：根据分类决定检索策略
 * 2. 知识增强：优先检索结构化事实库，解决 LLM 幻觉
 * 3. 结果融合：合并结构化数据与向量检索结果
 *
 * 返回 chunks 和 sources 保持 1:1 对应关系
 */
export async function processRAG(question, category) {
  console.log(`[RAG路由] 正在调度意图: ${ category }`)

  // chunks 和 sources 始终保持 1:1 对应
  const allChunks = []
  const allSources = []

  try {
    // --- 策略 1: 结构化知识增强 (优先) ---
    const officialFact = await searchStructuredFacts(question, category)
    if (officialFact) {
      allChunks.push(officialFact)
      allSources.push('官方结构化数据库')
    }

    // --- 策略 2: 向量检索 (补充上下文) ---
    let filter = null
    if (category !== CATEGORIES.GENERAL) {
      filter = {
        category
      }
    }

    const vectorResults = await searchVector(question, 'knowledge_base', 3, filter)

    for (const result of vectorResults) {
      allChunks.push(result.pageContent)
      allSources.push(result.metadata?.source || '校园知识库')
    }

    // --- 策略 3: 限制总量，避免上下文过长 ---
    const finalChunks = allChunks.slice(0, 5)
    const finalSources = allSources.slice(0, 5)

    console.log(`[RAG路由] 调度完成: 结构化(${ officialFact ? 1 : 0 }) + 向量(${ vectorResults.length }) -> 总计 ${ finalChunks.length } 个片段`)

    return {
      chunks: finalChunks,
      sources: finalSources
    }

  } catch (error) {
    console.error('[RAG路由] 调度发生错误:', error.message)
    return {
      chunks: [],
      sources: []
    }
  }
}
