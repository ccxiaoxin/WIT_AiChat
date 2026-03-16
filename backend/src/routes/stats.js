import express from 'express'
import { getCategoryStats, getDislikedFeedbacks } from '../controllers/statsController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

const router = express.Router()

// 所有统计接口都需要登录且为管理员
router.use(protect, admin)

router.get('/categories', getCategoryStats)
router.get('/feedbacks', getDislikedFeedbacks)

export default router