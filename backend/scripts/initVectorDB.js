/**
 * 向量数据库初始化脚本 - 增强版
 *
 * 功能：
 * 1. 自动扫描 doc 文件夹下的所有 PDF 和 DOCX 文档
 * 2. 继承 processDoc.js 中的深度清洗逻辑（去除孤立换行、压缩空白等）
 * 3. 自动识别文件夹层级并注入更精确的元数据分类（category）
 * 4. 每次运行前自动清理旧数据，确保不重复且数据最新
 */

import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from '@langchain/openai'
import { Chroma } from '@langchain/community/vectorstores/chroma'
import { ChromaClient } from 'chromadb'
import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

// 配置常量
const DOC_DIR = path.join(process.cwd(), 'data/doc')
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000'
const DEFAULT_COLLECTION = 'knowledge_base'

console.log('='.repeat(60))
console.log('🚀 向量数据库初始化工具 (增强版)')
console.log('='.repeat(60))

/**
 * 深度清洗文本逻辑
 */
function cleanContent(text) {
  if (typeof text !== 'string') return ''

  return text
    .replace(/\r\n/g, '\n') // 统一换行符
    .replace(/\t/g, ' ') // 替换制表符
    .replace(/[ \t]+/g, ' ') // 压缩多余空格
    // 识别 (1) ① 1. 这种列表项，确保它们前面的换行被保留，但不要变成双换行
    .replace(/\n\s*(?=[(（\d①②③④⑤])/g, '\n')
    // 将 3 个以上的连续换行压缩为 2 个
    .replace(/\n{3,}/g, '\n\n')
    // 去除行首尾空格并重新组合
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim()
}

/**
 * 获取更精确的分类映射
 */
function getCategory(filePath) {
  const relativePath = path.relative(DOC_DIR, filePath)
  const pathParts = relativePath.split(path.sep)

  if (pathParts.includes('专业介绍')) return 'major_intro'
  if (pathParts.includes('专业培养方案')) return 'major_program'
  if (pathParts.includes('policy')) {
    const fileName = pathParts[pathParts.length - 1]
    if (fileName.includes('保研')) return 'policy_postgraduate'
    if (fileName.includes('奖学金')) return 'policy_scholarship'
    if (fileName.includes('毕业论文') || fileName.includes('毕业设计')) return 'policy_graduation'
    if (fileName.includes('分流')) return 'policy_major_split'
    return 'policy_general'
  }

  return 'general'
}

/**
 * 处理单个文档
 */
async function processFile(filePath, embeddings, collectionName) {
  const ext = path.extname(filePath).toLowerCase()
  const fileName = path.basename(filePath, ext)
  const category = getCategory(filePath)

  console.log(`\n📄 处理文件: ${ fileName }${ ext } [分类: ${ category }]`)

  try {
    // 1. 加载文档
    let loader
    if (ext === '.pdf') {
      loader = new PDFLoader(filePath, {
        splitPages: true
      })
    } else if (ext === '.docx') {
      loader = new DocxLoader(filePath)
    } else {
      return 0
    }

    const rawDocs = await loader.load()

    // 2. 预处理与清洗
    const fullText = rawDocs.map(d => d.pageContent).join('\n')
    const cleanedText = cleanContent(fullText)

    // 3. 结构化切片
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 900,
      chunkOverlap: 200,
      separators: [
        '\n\n', '\n',
        '第一条', '第二条', '第三条', '第四条', '第五条',
        '一、', '二、', '三、', '四、', '五、',
        '。', '；', '！', '？',
        ' ', ''
      ]
    })

    const texts = await splitter.splitText(cleanedText)

    // 4. 封装 Document 对象并注入元数据
    const finalDocs = texts
      .map((text, index) => ({
        pageContent: `[文档:${ fileName }] ${ text.trim() }`,
        metadata: {
          source: fileName,
          category,
          ext,
          chunk_id: index
        }
      }))
      .filter(doc => doc.pageContent.length > 30)

    // 5. 清理旧数据
    try {
      const client = new ChromaClient({
        path: CHROMA_URL
      })
      const collection = await client.getCollection({
        name: collectionName
      })
      await collection.delete({
        where: {
          'source': fileName
        }
      })
      console.log(`   ♻️  已清理旧数据`)
    } catch (e) {
      // 集合不存在则忽略
    }

    // 6. 存入向量库
    await Chroma.fromDocuments(finalDocs, embeddings, {
      collectionName,
      url: CHROMA_URL,
      collectionMetadata: {
        'hnsw:space': 'cosine'
      }
    })

    console.log(`   ✅ 成功存入 ${ finalDocs.length } 个片段`)
    return finalDocs.length

  } catch (error) {
    console.error(`   ❌ 处理失败: ${ error.message }`)
    return 0
  }
}

/**
 * 递归扫描目录
 */
async function scanDocs(dir) {
  let results = []
  const list = await fs.readdir(dir, {
    withFileTypes: true
  })
  for (const entry of list) {
    const res = path.resolve(dir, entry.name)
    if (entry.isDirectory()) {
      results = results.concat(await scanDocs(res))
    } else {
      const ext = path.extname(entry.name).toLowerCase()
      if (['.pdf', '.docx'].includes(ext)) {
        results.push(res)
      }
    }
  }
  return results
}

/**
 * 主函数
 */
async function main() {
  try {
    // 1. 环境检查
    if (!process.env.VITE_QWEN_KEY) {
      console.error('❌ 错误: 未配置 VITE_QWEN_KEY 环境变量')
      process.exit(1)
    }

    // 2. 初始化 Embeddings
    const isQwen = process.env.VITE_QWEN_KEY && !process.env.OPENAI_API_KEY
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.VITE_QWEN_KEY,
      modelName: isQwen ? 'text-embedding-v2' : 'text-embedding-3-small',
      ...(isQwen ? {
        configuration: {
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        }
      } : {})
    })

    // 3. 扫描文件
    console.log(`\n🔍 正在扫描目录: ${ DOC_DIR }...`)
    const files = await scanDocs(DOC_DIR)
    console.log(`   找到 ${ files.length } 个支持的文档 (.pdf, .docx)`)

    // 4. 循环处理
    let totalChunks = 0
    for (const file of files) {
      const count = await processFile(file, embeddings, DEFAULT_COLLECTION)
      totalChunks += count
    }

    console.log(`\n${ '='.repeat(60) }`)
    console.log(`🎉 初始化完成！`)
    console.log(`   总处理文件: ${ files.length }`)
    console.log(`   总生成片段: ${ totalChunks }`)
    console.log(`   存储集合: ${ DEFAULT_COLLECTION }`)
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ 初始化过程中发生严重错误:', error.message)
    process.exit(1)
  }
}

main()
