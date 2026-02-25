import fs from 'fs/promises'
import path from 'path'

/**
 * 获取知识库列表
 */
export async function getKnowledgeList(req, res) {
  try {
    const structuredPath = path.join(process.cwd(), 'data', 'structured')

    // 读取结构化数据目录
    const files = await fs.readdir(structuredPath)
    const jsonFiles = files.filter(f => f.endsWith('.json'))

    const knowledgeList = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(structuredPath, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const data = JSON.parse(content)

        return {
          name: file.replace('.json', ''),
          count: Array.isArray(data) ? data.length : 0,
          file
        }
      })
    )

    res.json({
      success: true,
      data: knowledgeList
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
      results: []
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

