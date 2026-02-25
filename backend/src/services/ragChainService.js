/**
 * RAG Chain 服务 - 基于 LangChain
 * 实现完整的 RAG 流程：检索 + 增强 + 生成
 */

import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables'
import { processRAG } from './ragService.js'

/**
 * 获取 Chat 模型
 */
function getChatModel(modelName = 'qwen') {
  const modelConfigs = {
    qwen: {
      apiKey: process.env.VITE_QWEN_KEY,
      configuration: {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      },
      modelName: 'qwen-plus',
      temperature: 0.7,
      streaming: true
    },
    deepseek: {
      apiKey: process.env.VITE_DEEPSEEK_KEY,
      configuration: {
        baseURL: 'https://api.deepseek.com'
      },
      modelName: 'deepseek-chat',
      temperature: 0.7,
      streaming: true
    },
    moonshot: {
      apiKey: process.env.VITE_MOONSHOT_KEY,
      configuration: {
        baseURL: 'https://api.moonshot.cn/v1'
      },
      modelName: 'moonshot-v1-8k',
      temperature: 0.7,
      streaming: true
    }
  }

  const config = modelConfigs[modelName] || modelConfigs.qwen

  if (!config.apiKey) {
    throw new Error(`${ modelName } 模型的 API Key 未配置`)
  }

  return new ChatOpenAI(config)
}

/**
 * 创建 RAG Prompt 模板
 * 根据分类使用不同的角色设定和回答要求
 */
function createRAGPromptTemplate(category = 'general') {
  const categoryPrompts = {
    policy: `你是武汉工程大学计算机学院的政策咨询顾问。请基于以下政策文件内容，准确回答学生的问题。

【参考资料】:
{context}

【学生问题】: {question}

【回答要求】:
1. 严格基于上述参考资料回答，标注有【官方数据】的内容具有最高优先级，必须原样引用，不得改写或推测
2. 引用具体的政策条款和数字（如学分、比例、时间等）
3. 回答要准确、权威，用条理清晰的格式呈现
4. 如果参考资料中没有相关信息，请明确说明"目前知识库中暂无该信息"，不要编造

请回答：`,

    major: `你是武汉工程大学计算机学院的学业指导顾问。请基于以下专业和课程信息，为学生提供详细、准确的指导。

【参考资料】:
{context}

【学生问题】: {question}

【回答要求】:
1. 严格基于上述参考资料回答，标注有【官方数据】的内容具有最高优先级，必须原样引用其中的数据（学分、学制、课程名等）
2. 提供具体的课程名称、学分数、开设学期等信息
3. 如果涉及多个专业的对比，请分条说明各自特点
4. 回答要详细、条理清晰、易于理解
5. 如果参考资料中没有相关信息，请明确说明，不要编造课程或学分数据

请回答：`,

    career: `你是一位经验丰富的职业规划导师，熟悉计算机类专业的就业市场。请基于以下职业信息，为学生提供实用的职业发展建议。

【参考资料】:
{context}

【学生问题】: {question}

【回答要求】:
1. 严格基于上述参考资料回答，标注有【职业百科】的内容具有最高优先级，必须优先使用其中的技能要求、关联课程、行业趋势等数据
2. 将技能要求与在校课程联系起来，告诉学生"现在应该学什么"
3. 给出可操作的学习路线和求职准备建议
4. 回答要贴近实际，结合行业趋势
5. 如果参考资料中没有相关信息，请明确说明，不要编造公司名或薪资数据

请回答：`,

    general: `你是武汉工程大学计算机学院的智能问答助手。请基于以下知识库内容，准确、完整地回答学生的问题。

【参考资料】:
{context}

【学生问题】: {question}

【回答要求】:
1. 优先使用上述参考资料中的内容回答
2. 标注有【官方数据】或【职业百科】的内容具有最高优先级，不得与之矛盾
3. 回答要准确、完整、条理清晰
4. 如果知识库中没有相关信息，请说明"目前知识库中暂无该信息，建议咨询学院教务办公室"
5. 严禁编造数据或政策内容

请回答：`
  }

  // 映射细分分类到模板
  let templateKey = 'general'
  if (category.startsWith('policy')) templateKey = 'policy'
  else if (category.startsWith('major')) templateKey = 'major'
  else if (category === 'career') templateKey = 'career'

  const template = categoryPrompts[templateKey] || categoryPrompts.general
  return PromptTemplate.fromTemplate(template)
}

/**
 * 格式化检索到的文档为上下文
 */
function formatDocuments(docs) {
  if (!docs || docs.length === 0) {
    return '（当前知识库中未检索到相关内容）'
  }

  return docs.map((doc, index) => {
    const source = doc.metadata?.source || '知识库'
    return `【来源 ${ index + 1 }: ${ source }】\n${ doc.pageContent }`
  }).join('\n\n---\n\n')
}

/**
 * 创建 RAG Chain（集成智能路由与知识增强）
 */
export async function createRAGChain(question, category = 'general', modelName = 'qwen') {
  try {
    // 1. 调用统一的 RAG 调度服务 (获取结构化事实 + 向量检索结果)
    const { chunks, sources } = await processRAG(question, category)

    console.log(`[RAG Chain] 调度完成，获取到 ${ chunks.length } 个上下文片段`)

    // 2. 将 chunks 转换为 LangChain 期望的 Document 格式 (chunks 和 sources 保持 1:1)
    const retrievedDocs = chunks.map((content, i) => ({
      pageContent: content,
      metadata: {
        source: sources[i] || '知识库'
      }
    }))

    // 3. 创建 Prompt 模板
    const promptTemplate = createRAGPromptTemplate(category)

    // 4. 获取 Chat 模型
    const model = getChatModel(modelName)

    // 5. 使用 LCEL 构建 RAG Chain
    const ragChain = RunnableSequence.from([
      {
        context: () => formatDocuments(retrievedDocs),
        question: new RunnablePassthrough()
      },
      promptTemplate,
      model,
      new StringOutputParser()
    ])

    // 6. 去重来源列表（用于前端展示）
    const uniqueSources = [...new Set(sources)]

    return {
      chain: ragChain,
      retrievedDocs,
      sources: uniqueSources
    }

  } catch (error) {
    console.error('[RAG Chain] 创建失败:', error.message)
    throw error
  }
}

/**
 * 流式执行 RAG Chain
 */
export async function streamRAGChain(question, category, modelName, onChunk) {
  try {
    const { chain, sources } = await createRAGChain(question, category, modelName)

    // 流式调用
    const stream = await chain.stream(question)

    for await (const chunk of stream) {
      onChunk(chunk)
    }

    return {
      success: true,
      sources
    }

  } catch (error) {
    console.error('[RAG Chain] 流式执行失败:', error.message)
    throw error
  }
}

/**
 * 非流式执行 RAG Chain
 */
export async function invokeRAGChain(question, category, modelName) {
  try {
    const { chain, sources } = await createRAGChain(question, category, modelName)

    const result = await chain.invoke(question)

    return {
      result,
      sources
    }

  } catch (error) {
    console.error('[RAG Chain] 执行失败:', error.message)
    throw error
  }
}
