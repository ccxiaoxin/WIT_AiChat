import fs from 'fs/promises'
import path from 'path'

/**
 * 结构化数据检索服务 (知识增强核心)
 *
 * 从 JSON 文件中精确检索校园事实数据，覆盖：
 * - 6 个专业的培养方案 (training_program)
 * - 6 个专业的课程设置表 (curriculum)
 * - 8 个职业方向的技能图谱 (career)
 *
 * 设计原则：
 * - 关键词多维匹配，不依赖全名精确命中
 * - 区分 major_intro / major_program 返回不同层次的数据
 * - 数据启动时预加载到内存，避免每次查询都读磁盘
 */

const STRUCTURED_DATA_PATH = path.join(process.cwd(), 'data', 'structured')

// ==================== 专业名称别名映射 ====================

const MAJOR_ALIASES = {
  '计算机科学与技术': {
    trainingFile: '计算机科学与技术.json',
    curriculumFile: '计算机科学与技术.json',
    aliases: ['计算机', '计科', '计算机科学', 'CS', 'CST']
  },
  '软件工程': {
    trainingFile: '软件工程.json',
    curriculumFile: '软件工程.json',
    aliases: ['软件', '软工', 'SE']
  },
  '数字媒体技术': {
    trainingFile: '数媒.json',
    curriculumFile: '数媒.json',
    aliases: ['数媒', '数字媒体', 'DM', 'DMT']
  },
  '网络空间安全': {
    trainingFile: '网络空间安全.json',
    curriculumFile: '网络与空间安全.json',
    aliases: ['网安', '网络安全', '网空', 'NS', 'CSS']
  },
  '物联网工程': {
    trainingFile: '物联网工程.json',
    curriculumFile: '物联网工程.json',
    aliases: ['物联网', 'IoT']
  },
  '智能科学与技术': {
    trainingFile: '智能科学与技术.json',
    curriculumFile: '智能科学与技术.json',
    aliases: ['智能', '人工智能', 'AI', 'IST']
  }
}

// 课程 ID → 课程名称（用于就业数据中的课程引用）
const COURSE_MAP = {
  CS101: '程序设计基础',
  CS102: '面向对象程序设计',
  CS201: '数据结构与算法',
  CS202: '计算机网络',
  CS203: '操作系统',
  CS301: '数据库系统原理',
  CS302: '计算机图形学',
  DM301: '游戏引擎开发 (如 Unity/UE)',
  AI301: '机器学习',
  AI401: '深度学习',
  IoT301: '物联网通信协议'
}

// ==================== 数据预加载 ====================

let trainingDataCache = null // { majorName: jsonData }
let curriculumDataCache = null // { majorName: jsonData }
let careerDataCache = null // skills_related.json 的完整数据

/**
 * 预加载所有结构化数据到内存
 */
async function ensureDataLoaded() {
  if (trainingDataCache && curriculumDataCache && careerDataCache) return

  console.log('[结构化增强] 正在加载结构化数据...')

  // 加载培养方案
  trainingDataCache = {}
  for (const [majorName, config] of Object.entries(MAJOR_ALIASES)) {
    try {
      const filePath = path.join(STRUCTURED_DATA_PATH, 'major', 'training_program', config.trainingFile)
      const raw = await fs.readFile(filePath, 'utf-8')
      trainingDataCache[majorName] = JSON.parse(raw)
    } catch (e) {
      console.warn(`[结构化增强] 培养方案加载失败: ${ majorName } - ${ e.message }`)
    }
  }

  // 加载课程表
  curriculumDataCache = {}
  for (const [majorName, config] of Object.entries(MAJOR_ALIASES)) {
    try {
      const filePath = path.join(STRUCTURED_DATA_PATH, 'major', 'curriculum', config.curriculumFile)
      const raw = await fs.readFile(filePath, 'utf-8')
      curriculumDataCache[majorName] = JSON.parse(raw)
    } catch (e) {
      console.warn(`[结构化增强] 课程表加载失败: ${ majorName } - ${ e.message }`)
    }
  }

  // 加载职业数据
  try {
    const careerPath = path.join(STRUCTURED_DATA_PATH, 'career', 'skills_related.json')
    const raw = await fs.readFile(careerPath, 'utf-8')
    careerDataCache = JSON.parse(raw)
  } catch (e) {
    console.warn(`[结构化增强] 职业数据加载失败: ${ e.message }`)
    careerDataCache = {
      career_directions: []
    }
  }

  console.log('[结构化增强] 数据加载完成 ✅')
}

// ==================== 匹配工具函数 ====================

/**
 * 根据用户问题匹配专业名称
 * 返回匹配到的专业全名，或 null
 */
function matchMajorName(query) {
  const q = query.toLowerCase()

  // 优先匹配全名
  for (const majorName of Object.keys(MAJOR_ALIASES)) {
    if (q.includes(majorName.toLowerCase())) {
      return majorName
    }
  }

  // 再匹配别名（短名/缩写）
  for (const [majorName, config] of Object.entries(MAJOR_ALIASES)) {
    for (const alias of config.aliases) {
      if (q.includes(alias.toLowerCase())) {
        return majorName
      }
    }
  }

  return null
}

/**
 * 根据用户问题匹配职业方向
 * 多维关键词打分，返回最佳匹配
 */
function matchCareerDirection(query, directions) {
  const q = query.toLowerCase()

  // 为每个职业方向预定义关键词
  const careerKeywords = {
    '前端开发工程师': ['前端', 'web', '网页', 'html', 'css', 'javascript', 'vue', 'react'],
    '后端开发工程师': ['后端', '服务端', '服务器', 'java', 'python', 'go', 'spring', '接口', '微服务'],
    '游戏客户端开发工程师': ['游戏', 'unity', 'ue', '虚幻引擎', '客户端开发'],
    '人工智能/算法工程师': ['算法', 'ai', '人工智能', '机器学习', '深度学习', '大模型', 'aigc', '模型训练'],
    '数据工程师': ['大数据', '数据工程', '数据分析', '数仓', 'hadoop', 'spark', 'flink', '数据管道'],
    '网络安全工程师': ['网络安全', '安全工程', '渗透', '漏洞', '攻防', '信息安全', '等保'],
    '物联网系统工程师': ['物联网', '嵌入式', '单片机', 'arm', '传感器', '智能硬件'],
    '测试开发工程师': ['测试', '自动化测试', 'qa', '测开', '质量保证', '持续集成']
  }

  let bestMatch = null
  let bestScore = 0

  for (const direction of directions) {
    let score = 0

    // 1. 名称直接包含（高权重）
    if (q.includes(direction.name)) {
      score += 10
    }

    // 2. 名称部分匹配
    const nameParts = direction.name.replace(/[/()（）]/g, ' ').split(/\s+/)
    for (const part of nameParts) {
      if (part.length >= 2 && q.includes(part.toLowerCase())) {
        score += 3
      }
    }

    // 3. 预定义关键词匹配
    const keywords = careerKeywords[direction.name] || []
    for (const kw of keywords) {
      if (q.includes(kw)) {
        score += 2
      }
    }

    // 4. 描述包含查询关键词（低权重补充）
    if (direction.description) {
      const queryWords = q.match(/[\u4e00-\u9fa5]{2,}|[a-z]{2,}/gi) || []
      for (const word of queryWords) {
        if (direction.description.toLowerCase().includes(word.toLowerCase())) {
          score += 0.5
        }
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = direction
    }
  }

  // 至少需要 2 分才算命中（防止无关问题误匹配）
  return bestScore >= 2 ? bestMatch : null
}

// ==================== 对外接口 ====================

/**
 * 精确查找结构化事实（主入口）
 * @param {string} query 用户查询
 * @param {string} category 分类器识别出的类别
 * @returns {string|null} 格式化的结构化事实文本，或 null
 */
export async function searchStructuredFacts(query, category) {
  await ensureDataLoaded()

  try {
    // 专业介绍
    if (category === 'major_intro') {
      return searchMajorIntro(query)
    }

    // 培养方案 / 课程查询
    if (category === 'major_program') {
      return searchMajorProgram(query)
    }

    // 就业 / 职业方向
    if (category === 'career') {
      return searchCareerFacts(query)
    }
  } catch (error) {
    console.warn('[结构化增强] 检索失败:', error.message)
  }

  return null
}

// ==================== 专业介绍检索 ====================

function searchMajorIntro(query) {
  const majorName = matchMajorName(query)
  if (!majorName) {
    console.log('[结构化增强] 未匹配到具体专业，跳过')
    return null
  }

  const data = trainingDataCache[majorName]
  if (!data) return null

  const admin = data.metadata?.administration || {}
  const introData = data.content?.introduction || {}
  const sections = introData.sections || []
  const objectives = data.content?.cultivation_objectives?.objectives || []
  const coreCourses = data.content?.core_courses?.course_list || []

  // 1. 基础信息
  const parts = [
    `【官方数据】${ majorName } 专业介绍`,
    `🔹 学制：${ admin.length_of_schooling || '4年' }  |  毕业学分：${ admin.graduation_credits || '未知' }  |  授予学位：${ admin.awarded_degree || '工学学士' }`
  ]

  // 2. 智能提取概况 (优先提取 "专业定位" 或 "专业概况")
  const overviewSection = sections.find(s => s.title.includes('定位') || s.title.includes('概况') || s.title.includes('简介'))
  if (overviewSection) {
    parts.push(`🔹 专业概况：${ overviewSection.content.substring(0, 300) }${ overviewSection.content.length > 300 ? '...' : '' }`)
  }

  // 3. 针对性提取：如果问考研、去向、就业
  if (query.includes('考研') || query.includes('去向') || query.includes('就业') || query.includes('深造') || query.includes('发展')) {
    const targetKeywords = ['去向', '深造', '考研', '就业', '企业', '硕士', '博士']
    let found = false
    for (const section of sections) {
      if (targetKeywords.some(kw => section.content.includes(kw))) {
        parts.push(`🔹 发展去向（摘自${ section.title }）：${ section.content }`)
        found = true
      }
    }
    // 如果没找到专门的段落，尝试从培养目标里找
    if (!found && objectives.length > 0) {
      const careerObj = objectives.find(o => o.description.includes('就业') || o.description.includes('深造'))
      if (careerObj) {
        parts.push(`🔹 相关培养目标：${ careerObj.description }`)
      }
    }
  }

  if (objectives.length > 0) {
    const objText = objectives.map(o => `${ o.title }`).join('、')
    parts.push(`🔹 培养目标方向：${ objText }`)
  }

  if (coreCourses.length > 0) {
    parts.push(`🔹 核心课程：${ coreCourses.join('、') }`)
  }

  console.log(`[结构化增强] 命中专业介绍: ${ majorName }`)
  return parts.join('\n')
}

// ==================== 培养方案 / 课程检索 ====================

function searchMajorProgram(query) {
  const majorName = matchMajorName(query)

  // 优先尝试课程精确检索
  const courseResult = searchSpecificCourse(query, majorName)
  if (courseResult) return courseResult

  // 退回到培养方案概览
  if (!majorName) {
    console.log('[结构化增强] 未匹配到具体专业，跳过')
    return null
  }

  const trainingData = trainingDataCache[majorName]
  const curriculumData = curriculumDataCache[majorName]
  if (!trainingData && !curriculumData) return null

  const admin = trainingData?.metadata?.administration || {}
  const coreCourses = trainingData?.content?.core_courses?.course_list || []
  const gradReqs = trainingData?.content?.graduation_requirements?.requirements || []

  const parts = [
    `【官方数据】${ majorName } 培养方案`
  ]

  // 学制学分 (始终显示，因为这是最基础的属性)
  parts.push(`🔹 学制：${ admin.length_of_schooling || '4年' }  |  毕业最低学分要求：${ admin.graduation_credits || '未知' }  |  弹性学制：${ admin.duration_range || '4-6年' }`)

  // 核心课程
  if (coreCourses.length > 0) {
    parts.push(`🔹 专业核心课程(${ coreCourses.length }门)：${ coreCourses.join('、') }`)
  }

  // 课程分类统计
  if (curriculumData?.curriculum) {
    const categoryStats = curriculumData.curriculum.map(cat => {
      const courseCount = cat.courses?.length || 0
      return `${ cat.category }(${ cat.total_credits }学分, ${ courseCount }门)`
    })
    parts.push(`🔹 课程体系：\n   - ${ categoryStats.join('\n   - ') }`)
  }

  // 如果问的是毕业要求相关
  if (query.includes('毕业') || query.includes('要求') || query.includes('条件')) {
    // 显式强调学分要求
    if (admin.graduation_credits) {
      parts.push(`🔹 【重点】毕业最低学分要求：${ admin.graduation_credits } 学分`)
    }

    const reqTitles = gradReqs.map(r => r.title).join('、')
    parts.push(`🔹 毕业能力要求涵盖：${ reqTitles }`)
  }

  // 如果问学分 (增强匹配：分、多少分、学分)
  if (query.includes('学分') || query.includes('多少分')) {
    if (curriculumData?.major?.total_credits || admin.graduation_credits) {
      const credits = curriculumData?.major?.total_credits || admin.graduation_credits
      parts.push(`🔹 【重点】总学分要求：${ credits } 学分`)
    }
  }

  console.log(`[结构化增强] 命中培养方案: ${ majorName }`)
  return parts.join('\n')
}

/**
 * 精确检索具体课程信息
 */
function searchSpecificCourse(query, preferredMajor) {
  // 在所有专业的课程表中搜索匹配的课程
  const majorsToSearch = preferredMajor
    ? [preferredMajor, ...Object.keys(MAJOR_ALIASES).filter(m => m !== preferredMajor)]
    : Object.keys(MAJOR_ALIASES)

  for (const majorName of majorsToSearch) {
    const currData = curriculumDataCache[majorName]
    if (!currData?.curriculum) continue

    for (const category of currData.curriculum) {
      if (!category.courses) continue
      for (const course of category.courses) {
        // 课程名称匹配（允许部分匹配）
        if (course.name && query.includes(course.name)) {
          const parts = [
            `【官方数据】课程详情 - ${ course.name }`,
            `🔹 所属专业：${ majorName }`,
            `🔹 课程类型：${ category.category } (${ course.attribute })`,
            `🔹 学分：${ course.credits }  |  总学时：${ course.total_hours }  |  理论：${ course.lecture_hours }h  |  实验：${ course.lab_hours }h`,
            `🔹 开设学期：第${ course.semester }学期`,
            `🔹 开课单位：${ course.department || '未知' }`
          ]
          if (course.remark) {
            parts.push(`🔹 备注：${ course.remark }`)
          }
          console.log(`[结构化增强] 命中课程: ${ course.name } (${ majorName })`)
          return parts.join('\n')
        }
      }
    }
  }

  return null
}

// ==================== 就业 / 职业方向检索 ====================

function searchCareerFacts(query) {
  const directions = careerDataCache?.career_directions || []
  if (directions.length === 0) return null

  const direction = matchCareerDirection(query, directions)
  if (!direction) {
    // 如果没有精确命中单个方向，但问的是"就业方向有哪些"这种概览问题
    if (query.includes('就业方向') || query.includes('能做什么') || query.includes('做什么工作')) {
      return formatCareerOverview(query, directions)
    }
    console.log('[结构化增强] 未匹配到职业方向，跳过')
    return null
  }

  return formatCareerDetail(direction)
}

/**
 * 格式化单个职业方向的详细信息
 */
function formatCareerDetail(direction) {
  const hardSkills = direction.skill_requirements.hard_skills
    .map(s => {
      const courses = (s.related_course_id || [])
        .map(id => COURSE_MAP[id] || id)
        .join(', ')
      return courses
        ? `${ s.skill }(${ s.level }) [关联课程: ${ courses }]`
        : `${ s.skill }(${ s.level })`
    })
    .join('\n   - ')

  const softSkills = (direction.skill_requirements.soft_skills || []).join('、')

  const relatedMajors = (direction.relates_majors || [])
    .map(r => `${ r.major_code }(${ r.match_level })`)
    .join('、')

  const parts = [
    `【职业百科】${ direction.name }`,
    `🔹 职业类别：${ direction.category }`,
    `🔹 职业描述：${ direction.description }`,
    `🔹 核心技能要求：\n   - ${ hardSkills }`,
    `🔹 软技能：${ softSkills }`,
    `🔹 行业趋势：${ direction.industry_trend }`,
    `🔹 典型就业单位：${ direction.typical_companies.join('、') }`,
    `🔹 相关专业：${ relatedMajors }`
  ]

  console.log(`[结构化增强] 命中职业方向: ${ direction.name }`)
  return parts.join('\n')
}

/**
 * 格式化就业方向概览（多个方向汇总）
 */
function formatCareerOverview(query, directions) {
  // 如果提到具体专业，筛选该专业相关的方向
  const majorName = matchMajorName(query)
  let filtered = directions

  if (majorName) {
    const majorConfig = MAJOR_ALIASES[majorName]
    const majorCodes = majorConfig ? majorConfig.aliases.filter(a => a.length <= 3 && a === a.toUpperCase()) : []
    if (majorCodes.length > 0) {
      filtered = directions.filter(d =>
        (d.relates_majors || []).some(r =>
          majorCodes.includes(r.major_code) && (r.match_level === '核心匹配' || r.match_level === '高度相关')
        )
      )
    }
    // 如果筛选后为空，回退到全部
    if (filtered.length === 0) filtered = directions
  }

  const dirList = filtered.map(d => {
    const majors = (d.relates_majors || [])
      .filter(r => r.match_level === '核心匹配')
      .map(r => r.major_code)
      .join('/')
    return `• ${ d.name }（${ d.category }）- 核心专业: ${ majors || '通用' }`
  }).join('\n')

  const parts = [
    `【职业百科】计算机类专业${ majorName ? `(${ majorName })` : '' }就业方向概览`,
    dirList,
    `\n共 ${ filtered.length } 个方向，如需了解某个方向的详细技能要求，请直接问我。`
  ]

  console.log(`[结构化增强] 命中就业概览${ majorName ? ` (专业: ${ majorName })` : '' }`)
  return parts.join('\n')
}
