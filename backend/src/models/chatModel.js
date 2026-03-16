import mongoose from 'mongoose'

const messageSchema = mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // 新增：分类字段 (用于统计)
  category: {
    type: String
  },
  // 新增：反馈字段 (仅对 role: 'assistant' 有效)
  feedback: {
    type: String,
    enum: ['like', 'dislike', 'none'],
    default: 'none'
  },
  // 新增：点踩的具体原因
  feedbackReason: {
    type: String
  }
})

const chatSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    title: {
      type: String,
      default: '新对话'
    },
    messages: [messageSchema]
  },
  {
    timestamps: true
  }
)

const Chat = mongoose.model('Chat', chatSchema)

export default Chat

