import express from 'express'
import multer from 'multer'
import { 
  getKnowledgeList, 
  searchKnowledge, 
  parseDocument, 
  saveKnowledge,
  getKnowledgeChunks,
  deleteKnowledgeDoc
} from '../controllers/knowledgeController.js'

const router = express.Router()
const upload = multer({ dest: 'uploads/' })

// 获取知识库列表
router.get('/list', getKnowledgeList)

// 搜索知识库
router.post('/search', searchKnowledge)

// 获取单个文档的片段
router.get('/chunks', getKnowledgeChunks)

// 解析文档并返回 chunks
router.post('/parse', upload.single('file'), parseDocument)

// 保存 chunks 到向量库
router.post('/save', saveKnowledge)

// 删除整个文档
router.delete('/delete', deleteKnowledgeDoc)

export default router

