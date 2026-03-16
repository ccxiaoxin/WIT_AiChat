import Chat from '../models/chatModel.js'

// @desc    获取所有对话中用户提问的分类统计 (用于饼图)
// @route   GET /api/stats/categories
// @access  Private/Admin
export const getCategoryStats = async (req, res) => {
  try {
    const stats = await Chat.aggregate([
      { $unwind: "$messages" },
      { $match: { "messages.role": "user", "messages.category": { $exists: true, $ne: null } } },
      { $group: { _id: "$messages.category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])

    // 格式化为前端 ECharts 需要的格式
    const formattedStats = stats.map(item => ({
      name: item._id,
      value: item.count
    }))

    res.json({ success: true, data: formattedStats })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// @desc    获取被点踩(dislike)的回答列表
// @route   GET /api/stats/feedbacks
// @access  Private/Admin
export const getDislikedFeedbacks = async (req, res) => {
  try {
    const chats = await Chat.find({ "messages.feedback": "dislike" }).populate('user', 'username')
    
    let dislikedMessages = []

    chats.forEach(chat => {
      chat.messages.forEach((msg, index) => {
        if (msg.feedback === 'dislike') {
          // 尝试找到对应的用户提问 (通常是上一条)
          let questionMsg = null
          if (index > 0 && chat.messages[index - 1].role === 'user') {
            questionMsg = chat.messages[index - 1]
          }

          dislikedMessages.push({
            chatId: chat._id,
            chatTitle: chat.title,
            username: chat.user?.username || '未知用户',
            messageId: msg._id,
            question: questionMsg ? questionMsg.content : '未知问题',
            category: questionMsg ? questionMsg.category : '未知分类',
            answer: msg.content,
            reason: msg.feedbackReason || '未提供原因',
            timestamp: msg.timestamp
          })
        }
      })
    })

    // 按时间倒序
    dislikedMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    res.json({ success: true, data: dislikedMessages })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}