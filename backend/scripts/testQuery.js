/**
 * 向量检索测试脚本
 * 用于验证 ChromaDB 中的知识库检索效果
 */

import { OpenAIEmbeddings } from '@langchain/openai'
import { Chroma } from '@langchain/community/vectorstores/chroma'
import dotenv from 'dotenv'

dotenv.config()

async function testQuery(queryText, collectionName = 'knowledge_base') {
  console.log('='.repeat(60))
  console.log(`🔍 检索测试`)
  console.log(`   查询内容: "${ queryText }"`)
  console.log(`   目标集合: ${ collectionName }`)
  console.log('='.repeat(60))

  try {
    // 1. 配置 Embeddings (需与处理脚本保持一致)
    const isQwen = process.env.VITE_QWEN_KEY && !process.env.OPENAI_API_KEY
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.VITE_QWEN_KEY || process.env.OPENAI_API_KEY,
      modelName: isQwen ? 'text-embedding-v2' : 'text-embedding-3-small',
      ...(isQwen ? {
        configuration: {
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        }
      } : {})
    })

    // 2. 连接 Chroma
    const vectorStore = await Chroma.fromExistingCollection(embeddings, {
      collectionName,
      url: process.env.CHROMA_URL || 'http://localhost:8000'
    })

    // 3. 执行相似度搜索
    console.log('\n[正在检索...]')
    const results = await vectorStore.similaritySearch(queryText, 3)

    // 4. 打印结果
    console.log(`\n✅ 找到 ${ results.length } 条相关结果:\n`)

    results.forEach((doc, i) => {
      console.log(`--- 结果 ${ i + 1 } ---`)
      const source = doc.metadata?.source || '未知'
      const category = doc.metadata?.category || '未分类'
      console.log(`[来源]: ${ source } [分类: ${ category }]`)
      console.log(`[内容]: ${ doc.pageContent }...`)
      console.log('\n')
    })

  } catch (error) {
    console.error('\n❌ 检索失败:', error.message)
    if (error.message.includes('not found')) {
      console.log('💡 提示: 可能是集合名称错误或尚未导入数据。')
    }
  }
}

// 从命令行获取查询参数
const args = process.argv.slice(2)
const query = args[0] || '保研的申请条件是什么？' // 默认测试问题
const collection = args[1] || 'knowledge_base'

testQuery(query, collection)
