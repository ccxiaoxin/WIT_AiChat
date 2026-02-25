import User from '../models/userModel.js'
import jwt from 'jsonwebtoken'

const generateToken = (id) => {
  return jwt.sign({
    id
  }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  })
}

// @desc    注册新用户
// @route   POST /api/users/register
// @access  Public
export const registerUser = async (req, res) => {
  const { username, password } = req.body

  try {
    const userExists = await User.findOne({
      username
    })

    if (userExists) {
      return res.status(400).json({
        message: '用户已存在'
      })
    }

    const user = await User.create({
      username,
      password
    })

    if (user) {
      res.status(201).json({
        _id: user._id,
        username: user.username,
        role: user.role,
        token: generateToken(user._id)
      })
    } else {
      res.status(400).json({
        message: '无效的用户数据'
      })
    }
  } catch (error) {
    res.status(500).json({
      message: error.message
    })
  }
}

// @desc    注册管理员
// @route   POST /api/users/register-admin
// @access  Public (实际生产中应加秘钥保护或仅限内部调用)
export const registerAdmin = async (req, res) => {
  const { username, password, adminKey } = req.body

  // 简单的安全校验，防止随意注册管理员
  if (adminKey !== process.env.ADMIN_REGISTRATION_KEY) {
    return res.status(403).json({
      message: '无权注册管理员'
    })
  }

  try {
    const userExists = await User.findOne({
      username
    })

    if (userExists) {
      return res.status(400).json({
        message: '用户已存在'
      })
    }

    const user = await User.create({
      username,
      password,
      role: 'admin' // 强制指定角色为 admin
    })

    if (user) {
      res.status(201).json({
        _id: user._id,
        username: user.username,
        role: user.role,
        token: generateToken(user._id)
      })
    } else {
      res.status(400).json({
        message: '无效的用户数据'
      })
    }
  } catch (error) {
    res.status(500).json({
      message: error.message
    })
  }
}

// @desc    用户登录
// @route   POST /api/users/login
// @access  Public
export const loginUser = async (req, res) => {
  const { username, password } = req.body

  try {
    const user = await User.findOne({
      username
    })

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        username: user.username,
        role: user.role,
        token: generateToken(user._id)
      })
    } else {
      res.status(401).json({
        message: '用户名或密码错误'
      })
    }
  } catch (error) {
    res.status(500).json({
      message: error.message
    })
  }
}

// @desc    获取当前用户信息
// @route   GET /api/users/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password')
    res.json(user)
  } catch (error) {
    res.status(500).json({
      message: error.message
    })
  }
}
