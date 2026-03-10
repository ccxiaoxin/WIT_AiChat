import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'

// 引入我们新写的通用向量服务
import { addDocumentsToVectorStore, deleteDocumentBySource } from '../src/services/vectorService.js'

dotenv.config()

const DOC_DIR = path.join(process.cwd(), 'data/doc')

// 保持与前端一致的分类映射
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
  return 'policy_general' // 默认分类
}

async function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const fileName = path.basename(filePath, ext) // 作为 sourceName
  const category = getCategory(filePath)

  console.log(`\n📄 处理文件: ${ fileName }${ ext } [分类: ${ category }]`)

  try {
    let loader
    if (ext === '.pdf') {
      loader = new PDFLoader(filePath, { splitPages: true })
    } else if (ext === '.docx') {
      loader = new DocxLoader(filePath)
    } else {
      return 0
    }

    const rawDocs = await loader.load()
    const fullText = rawDocs.map(d => d.pageContent).join('\n')

    // 保持与前端上传一致的分块策略
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    })

    const chunks = await splitter.createDocuments([fullText])
    // 提取纯文本数组，与前端传给后端的格式保持一致
    const chunkTexts = chunks.map(chunk => chunk.pageContent)

    if (chunkTexts.length === 0) return 0

    // 1. 先清理旧数据 (复用 vectorService)
    await deleteDocumentBySource(fileName)
    
    // 2. 存入新数据 (复用 vectorService)
    await addDocumentsToVectorStore(chunkTexts, category, fileName)

    console.log(`   ✅ 成功存入 ${ chunkTexts.length } 个片段`)
    return chunkTexts.length

  } catch (error) {
    console.error(`   ❌ 处理失败: ${ error.message }`)
    return 0
  }
}

async function scanDocs(dir) {
  let results = []
  try {
    const list = await fs.readdir(dir, { withFileTypes: true })
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
  } catch (err) {
    console.warn(`⚠️ 无法读取目录 ${dir}:`, err.message)
  }
  return results
}

async function main() {
  try {
    console.log(`\n🔍 正在扫描目录: ${ DOC_DIR }...`)
    const files = await scanDocs(DOC_DIR)
    console.log(`   找到 ${ files.length } 个支持的文档`)

    let totalChunks = 0
    for (const file of files) {
      const count = await processFile(file)
      totalChunks += count
    }

    console.log(`\n🎉 批量导入完成！总计处理片段: ${ totalChunks }`)
    process.exit(0)
  } catch (error) {
    console.error('\n❌ 发生严重错误:', error.message)
    process.exit(1)
  }
}

main()
