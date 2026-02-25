import express from 'express'
import { getMe, loginUser, registerAdmin, registerUser } from '../controllers/userController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/register', registerUser)
router.post('/register-admin', registerAdmin) // 新增管理员注册路由
router.post('/login', loginUser)
router.get('/me', protect, getMe)

export default router
