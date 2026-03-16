import express from 'express'
import { createChat, deleteChat, getHistoryDetail, getHistoryList, updateFeedback } from '../controllers/historyController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(protect) // 所有历史记录接口都需要登录

router.route('/')
  .get(getHistoryList)
  .post(createChat)

router.route('/:id')
  .get(getHistoryDetail)
  .delete(deleteChat)

router.route('/:chatId/message/:messageId/feedback')
  .put(updateFeedback)

export default router

