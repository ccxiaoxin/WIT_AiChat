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

