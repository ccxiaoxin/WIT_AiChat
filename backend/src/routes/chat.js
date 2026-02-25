import express from 'express'
import { streamChat } from '../controllers/chatController.js'

const router = express.Router()

// 流式对话接口
router.post('/stream', streamChat)

export default router
