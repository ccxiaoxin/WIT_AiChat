import fs from 'fs/promises'
import path from 'path'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { 
  addDocumentsToVectorStore, 
  getVectorStoreList, 
  getChunksBySource, 
  deleteDocumentBySource 
} from '../services/vectorService.js'

/**
 * 获取知识库列表 (仅返回向量库数据)
 */
export async function getKnowledgeList(req, res) {
  try {
    const vectorList = await getVectorStoreList()

    res.json({
      success: true,
      data: vectorList
    })
  } catch (error) {
    console.error('获取知识库列表错误:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 获取单个文档的所有片段
 */
export async function getKnowledgeChunks(req, res) {
  const { source } = req.query
  
  if (!source) {
    return res.status(400).json({ success: false, error: '缺少 source 参数' })
  }

  try {
    const chunks = await getChunksBySource(source)
    res.json({
      success: true,
      data: chunks
    })
  } catch (error) {
    console.error('获取文档片段错误:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 删除整个文档
 */
export async function deleteKnowledgeDoc(req, res) {
  const { source } = req.body
  
  if (!source) {
    return res.status(400).json({ success: false, error: '缺少 source 参数' })
  }

  try {
    await deleteDocumentBySource(source)
    res.json({
      success: true,
      data: true,
      message: '删除成功'
    })
  } catch (error) {
    console.error('删除文档错误:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 搜索知识库
 */
export async function searchKnowledge(req, res) {
  const { query } = req.body

  if (!query) {
    return res.status(400).json({
      error: '搜索关键词不能为空'
    })
  }

  try {
    // TODO: 实现知识库搜索逻辑
    res.json({
      success: true,
      data: [],
      results: []
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 解析上传的文档并返回分块
 */
export async function parseDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' })
    }

    const filePath = req.file.path
    const originalName = req.file.originalname
    const ext = path.extname(originalName).toLowerCase()

    let text = ''
    
    if (ext === '.pdf') {
      const pdfParse = (await import('pdf-parse')).default
      const dataBuffer = await fs.readFile(filePath)
      const data = await pdfParse(dataBuffer)
      text = data.text
    } else if (ext === '.docx' || ext === '.doc') {
      const mammoth = (await import('mammoth')).default
      const result = await mammoth.extractRawText({ path: filePath })
      text = result.value
    } else if (ext === '.txt' || ext === '.md' || ext === '.json') {
      text = await fs.readFile(filePath, 'utf-8')
    } else {
      // 清理临时文件
      await fs.unlink(filePath).catch((err) => {
        console.warn(`[清理文件] 删除临时文件失败 ${filePath}:`, err.message)
      })
      return res.status(400).json({ success: false, error: '不支持的文件类型' })
    }

    // 清理临时文件
    await fs.unlink(filePath).catch((err) => {
      console.warn(`[清理文件] 删除临时文件失败 ${filePath}:`, err.message)
    })

    // 使用 LangChain 进行分块
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    })

    const chunks = await splitter.createDocuments([text])
    const chunkTexts = chunks.map(chunk => chunk.pageContent)

    res.json({
      success: true,
      data: {
        sourceName: originalName,
        chunks: chunkTexts
      }
    })
  } catch (error) {
    console.error('解析文档错误:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

/**
 * 保存编辑后的分块到向量库
 */
export async function saveKnowledge(req, res) {
  const { chunks, category, sourceName } = req.body

  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
    return res.status(400).json({ success: false, error: '分块数据不能为空' })
  }

  if (!category) {
    return res.status(400).json({ success: false, error: '分类不能为空' })
  }

  try {
    // 先删后插：保证同一 source 的数据是最新的
    await deleteDocumentBySource(sourceName || '手动上传')
    await addDocumentsToVectorStore(chunks, category, sourceName || '手动上传')
    
    res.json({
      success: true,
      data: true,
      message: '成功存入向量库'
    })
  } catch (error) {
    console.error('保存知识库错误:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

