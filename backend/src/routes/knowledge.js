import express from 'express'
import { getKnowledgeList, searchKnowledge } from '../controllers/knowledgeController.js'

const router = express.Router()

// 获取知识库列表
router.get('/list', getKnowledgeList)

// 搜索知识库
router.post('/search', searchKnowledge)

export default router

