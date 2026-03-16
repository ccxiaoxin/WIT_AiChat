import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import chatRoutes from './routes/chat.js'
import knowledgeRoutes from './routes/knowledge.js'
import userRoutes from './routes/user.js'
import historyRoutes from './routes/history.js'
import statsRoutes from './routes/stats.js'
import { warmUpClassifier } from './services/classifierService.js'
import connectDB from './config/db.js'

dotenv.config()

// 连接数据库
connectDB()

const app = express()
const PORT = process.env.PORT || 3001

// 中间件
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({
  extended: true
}))

// 日志中间件
app.use((req, res, next) => {
  console.log(`[${ new Date().toISOString() }] ${ req.method } ${ req.path }`)
  next()
})

// 路由
app.use('/api/chat', chatRoutes)
app.use('/api/knowledge', knowledgeRoutes)
app.use('/api/users', userRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/stats', statsRoutes)

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: '接口不存在'
  })
})

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack)
  res.status(500).json({
    error: '服务器错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

const server = app.listen(PORT, async () => {
  console.log(`🚀 RAG问答系统后端服务启动成功！`)
  console.log(`📡 服务地址: http://localhost:${ PORT }`)
  console.log(`🏥 健康检查: http://localhost:${ PORT }/health`)
  console.log(`🌍 环境: ${ process.env.NODE_ENV || 'development' }`)

  // 异步预热分类器标杆向量（不阻塞服务启动）
  warmUpClassifier().catch(err => {
    console.warn('[启动] 分类器预热失败，将在首次请求时重试:', err.message)
  })
})

// 优雅关闭：监听进程终止信号
process.on('SIGINT', () => {
  console.log('\n[系统] 收到 SIGINT 信号，正在关闭服务...')
  server.close(() => {
    console.log('[系统] 3001 端口已释放，服务已完全关闭')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('\n[系统] 收到 SIGTERM 信号，正在关闭服务...')
  server.close(() => {
    console.log('[系统] 3001 端口已释放，服务已完全关闭')
    process.exit(0)
  })
})

