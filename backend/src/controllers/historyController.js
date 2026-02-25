import Chat from '../models/chatModel.js'

// @desc    获取用户的所有对话列表（仅返回ID和标题）
// @route   GET /api/history
// @access  Private
export const getHistoryList = async (req, res) => {
  try {
    const chats = await Chat.find({
      user: req.user._id
    })
      .select('title updatedAt')
      .sort({
        updatedAt: -1
      })
    res.json(chats)
  } catch (error) {
    res.status(500).json({
      message: error.message
    })
  }
}

// @desc    获取单个对话的详细消息
// @route   GET /api/history/:id
// @access  Private
export const getHistoryDetail = async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (chat) {
      res.json(chat)
    } else {
      res.status(404).json({
        message: '对话不存在'
      })
    }
  } catch (error) {
    res.status(500).json({
      message: error.message
    })
  }
}

// @desc    创建新对话
// @route   POST /api/history
// @access  Private
export const createChat = async (req, res) => {
  const { title } = req.body
  try {
    const chat = await Chat.create({
      user: req.user._id,
      title: title || '新对话',
      messages: []
    })
    res.status(201).json(chat)
  } catch (error) {
    res.status(500).json({
      message: error.message
    })
  }
}

// @desc    删除对话
// @route   DELETE /api/history/:id
// @access  Private
export const deleteChat = async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    })
    if (chat) {
      res.json({
        message: '对话已删除'
      })
    } else {
      res.status(404).json({
        message: '对话不存在'
      })
    }
  } catch (error) {
    res.status(500).json({
      message: error.message
    })
  }
}

