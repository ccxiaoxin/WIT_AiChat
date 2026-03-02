/**
 * 意图识别服务 (Embedding 语义分类)
 *
 * 三级路由架构：
 *   第1级：强特征关键词匹配（<1ms，仅处理"铁定不会错"的场景）
 *   第2级：Embedding 语义相似度分类（~100-200ms，主力分类器）
 *   第3级：兜底归入 GENERAL
 *
 * 优势：
 *   - 无需调用 LLM，节省 1-3s 延迟和 Token 费用
 *   - 复用已有的 text-embedding-v2 模型
 *   - 标杆向量启动时预计算，运行时只需一次 embedQuery
 *   - 新增类别只需添加标杆问题，无需改逻辑
 */

import { OpenAIEmbeddings } from '@langchain/openai'
import { createHash } from 'crypto'
import fs from 'fs/promises'
import path from 'path'

// ==================== 分类类别定义 ====================

export const CATEGORIES = {
  POLICY_POSTGRADUATE: 'policy_postgraduate',
  POLICY_SCHOLARSHIP: 'policy_scholarship',
  POLICY_GRADUATION: 'policy_graduation',
  POLICY_MAJOR_SPLIT: 'policy_major_split',
  MAJOR_INTRO: 'major_intro',
  MAJOR_PROGRAM: 'major_program',
  CAREER: 'career',
  POLICY_GENERAL: 'policy_general',
  GENERAL: 'general'
}

// ==================== 标杆问题 (Exemplars) ====================

const CATEGORY_EXEMPLARS = {
  [CATEGORIES.POLICY_POSTGRADUATE]: [
    '保研需要什么条件',
    '推免资格怎么获得',
    '推免名额有多少个',
    '成绩排名多少能保研',
    '保研加分项有哪些',
    '免试攻读研究生的要求',
    'B类推免需要什么条件',
    '科研竞赛获奖能保研吗',
    '推免综合考核怎么评分',
    '英语四级多少分能保研',
    '推免材料什么时候提交',
    '专利能算保研加分吗',
    '推免答辩需要准备什么',
    '思想品德考核不合格能保研吗',
    '必修课有不及格记录还能保研吗',
    '英语六级没过能保研吗',
    '综合成绩是怎么计算的',
    '智育成绩占多少比例',
    '学术专长推免生的申请条件',
    '发表论文加分细则',
    '学科竞赛获奖加分标准',
    '参军入伍可以保研吗',
    '支教保研的条件是什么',
    '推免名单公示期是多久',
    '对推免结果有异议怎么申诉',
    '获得推免资格后受处分会被取消吗',
    '推免生能同时申请出国吗',
    '行政保研需要什么条件',
    '文艺特长生保研政策',
    '体育特长生保研要求',
    '社会工作加分怎么算',
    '志愿服务时长有要求吗',
    '推免生遴选工作小组的职责',
    '弄虚作假怎么处理'
  ],
  [CATEGORIES.POLICY_SCHOLARSHIP]: [
    '国家奖学金怎么申请',
    '奖学金评选标准是什么',
    '助学金申请条件有哪些',
    '校级奖学金什么时候评',
    '奖学金名额有几个',
    '评优评先的要求',
    '国奖评选的成绩排名要求',
    '学科竞赛获奖能加多少分',
    '科研论文能算奖学金加分吗',
    '奖学金答辩占多少比例',
    '国奖和励志奖学金能同时申请吗',
    '社会实践获奖能加奖学金分吗',
    '奖学金申请材料需要什么',
    '国家奖学金奖励多少钱',
    '国奖申请书怎么写',
    '奖学金评选领导小组是谁',
    '大二能申请国家奖学金吗',
    '有挂科记录能申请奖学金吗',
    '综合考评成绩怎么算',
    '智育成绩占奖学金评选多少比例',
    '实践与创新能力怎么加分',
    '发明专利能加多少分',
    '暑期社会实践获奖加分标准',
    '先进个人加分细则',
    '文体竞赛获奖加分多少',
    '奖学金评定结果公示多久',
    '对奖学金评选结果有异议怎么办',
    '弄虚作假申请奖学金怎么处理',
    '同一学年能同时拿国奖和励志吗',
    '发表SCI论文奖学金加分多少',
    '发表中文核心期刊加分多少'
  ],
  [CATEGORIES.POLICY_GRADUATION]: [
    '毕业论文格式要求是什么',
    '毕业设计怎么选题',
    '开题报告怎么写',
    '答辩流程是什么样的',
    '论文查重率要求多少',
    '毕业设计的时间安排',
    '毕业论文需要多少字',
    '参考文献需要多少篇',
    '外文参考文献有要求吗',
    '论文开题时间是什么时候',
    '答辩资格怎么审查',
    '论文修改后多久答辩',
    '毕业设计指导老师怎么选',
    '毕业论文页边距怎么设置',
    '毕业论文参考文献格式',
    '毕业论文摘要怎么写',
    '毕业论文目录自动生成',
    '毕业论文致谢怎么写',
    '毕业设计任务书怎么填',
    '中期检查需要提交什么材料',
    '外文翻译需要多少字',
    '毕业论文查重是在哪个网站',
    '答辩PPT需要包含哪些内容',
    '答辩陈述时间是多久',
    '答辩老师一般会问什么问题',
    '二辩的流程是什么',
    '毕业设计不及格怎么办',
    '优秀毕业论文怎么评选',
    '毕业论文电子版怎么提交',
    '毕业设计工作量要求',
    '毕业论文图表格式要求',
    '毕业论文页眉页脚设置'
  ],
  [CATEGORIES.POLICY_MAJOR_SPLIT]: [
    '大类分流怎么选专业',
    '专业分流的考核标准是什么',
    '分流的GPA要求是多少',
    '什么时候进行专业分流',
    '分流志愿怎么填',
    '专业分流有多少个名额',
    '图灵班分流需要什么条件',
    '分流面试考什么内容',
    '竞赛获奖能优先分流吗',
    '分流结果什么时候公示',
    '分流志愿可以填几个',
    '数学成绩对分流有影响吗',
    '专业分流咨询电话是多少',
    '计算机类专业分流方案',
    '分流综合成绩怎么计算',
    '高考成绩占分流多少比例',
    '第一学年成绩占分流多少比例',
    '挂科对分流有影响吗',
    '分流后学号会变吗',
    '分流后班级怎么分',
    '软件工程专业分流名额',
    '网络空间安全专业分流要求',
    '智能科学与技术专业分流',
    '物联网工程专业分流',
    '数字媒体技术专业分流',
    '分流志愿填报时间',
    '分流录取规则是什么',
    '志愿优先还是分数优先',
    '服从调剂是什么意思',
    '分流结果在哪里查询',
    '对分流结果有异议怎么申诉'
  ],
  [CATEGORIES.MAJOR_INTRO]: [
    '计算机科学与技术专业怎么样',
    '软件工程专业有什么特色',
    '这个专业主要学什么内容',
    '专业的优势和特色是什么',
    '哪个专业比较好',
    '专业概况介绍一下',
    '网络空间安全专业学什么',
    '智能科学与技术专业培养特色',
    '物联网工程专业核心能力是什么',
    '图灵班和普通计科有什么区别',
    '数字媒体技术专业有哪些学科竞赛机会',
    '网络空间安全专业的校企合作单位有哪些',
    '物联网工程专业的信创云实验室能做什么',
    '人工智能专业的科研成果有哪些应用',
    '计算机科学与技术专业的考研率多少',
    '网络空间安全专业的实验室资源有哪些',
    '数字媒体技术专业的师资力量如何',
    '物联网工程专业和计算机专业的区别',
    '智能科学与技术专业的国家级一流专业建设点是什么时候获批的',
    '软件工程专业的国家卓越工程师计划是什么时候启动的',
    '数字媒体技术考研去向怎么样',
    '这个专业读研率高吗',
    '本科毕业后去哪里深造',
    '毕业生的就业去向有哪些',
    '计科专业是国家级一流本科专业吗',
    '软件工程通过工程教育认证了吗',
    '智能科学与技术专业排名多少',
    '网络空间安全专业就业前景',
    '物联网工程专业是新工科专业吗',
    '数字媒体技术专业属于艺术类吗',
    '计算机学院有哪些硕士点',
    '人工智能专业是新开的吗',
    '图灵班的选拔机制是什么',
    '华为ICT学院是什么',
    '腾讯云人工智能学院介绍',
    '专业有哪些实习基地',
    '本科生导师制是怎么样的',
    '专业有哪些知名校友',
    '考研可以考哪些学校',
    '就业单位主要有哪些',
    '薪资待遇大概多少',
    '专业男女比例是多少'
  ],
  [CATEGORIES.MAJOR_PROGRAM]: [
    '培养方案具体是什么',
    '需要修多少学分才能毕业',
    '大二有哪些必修课',
    '选修课应该怎么选',
    '课程安排是怎样的',
    '专业核心课程有哪些',
    '必修课程有多少学分',
    '实践环节需要多少学分',
    '跨专业选课怎么操作',
    '重修课程怎么报名',
    '公选课什么时候选',
    '补休选课的流程是什么',
    '毕业需要修满多少选修课学分',
    '计算机科学与技术专业的最低毕业学分是多少',
    '软件工程专业的核心课程有Qt软件开发吗',
    '数字媒体技术专业的艺术修养基础是必修课吗',
    '网络空间安全专业的渗透测试技术是核心课吗',
    '物联网工程专业的单片机与嵌入式系统什么时候开设',
    '智能科学与技术专业的毕业要求有哪些',
    '各专业的学制和修业年限是多久',
    '计算机类专业的毕业论文要求多少字',
    '实践环节包括哪些内容（如实习、课程设计）',
    '培养方案中的工程知识要求具体是什么',
    '专业分流后的课程设置和大类阶段有什么区别',
    '智能科学与技术专业的嵌入式智能系统是核心课程吗',
    '网络空间安全专业的工业互联网安全课程主要学什么',
    '软件工程专业的软件测试课程占多少学分',
    '数字媒体技术专业的移动应用开发训练是实践课吗',
    '物联网工程专业的区块链技术与原理是选修课吗',
    '计算机科学与技术专业的大数据基础应用什么时候学',
    '各专业的授予学位是什么类型（工学/理学）',
    '培养方案中的项目管理能力怎么考核',
    '终身学习能力在培养方案中如何体现',
    '跨学科课程有哪些选择',
    '毕业最低要求多少学分',
    '拿学位的条件是什么',
    '毕业学分要求是多少',
    '多少分才能毕业',
    '创新创业学分怎么获得',
    '第二课堂学分要求',
    '通识教育课程包括哪些',
    '数学类课程有哪些',
    '英语分级教学是怎么样的',
    '体育课要上几年',
    '形势与政策课怎么上',
    '军事理论课是必修吗',
    '劳动教育课怎么考核',
    '美育课程有哪些',
    '专业导论课讲什么',
    '离散数学是大几学的',
    '数据结构是核心课吗',
    '操作系统实验怎么做',
    '计算机网络课程设计要求',
    '数据库原理及应用学分',
    '编译原理难不难',
    '软件工程导论什么时候学',
    '算法设计与分析课程内容'
  ],
  [CATEGORIES.CAREER]: [
    '毕业后能做什么工作',
    '前端开发需要学什么技能',
    '后端开发的就业前景怎么样',
    '算法工程师需要什么能力',
    '计算机专业就业方向有哪些',
    '找工作需要准备什么',
    '实习应该怎么找',
    '职业规划怎么做',
    '网络安全工程师前景如何',
    '数据工程师需要掌握什么',
    '互联网大厂面试流程',
    '简历怎么写才能过初筛',
    '技术岗面试一般问什么',
    '非技术岗有哪些选择',
    '考公和考研怎么选',
    '国企和私企哪个好',
    '银行科技岗怎么样',
    '外企对英语要求高吗',
    '应届生薪资大概多少',
    '春招和秋招的区别',
    '三方协议是什么',
    '违约金一般是多少',
    '试用期被辞退怎么办',
    '劳动合同要注意什么',
    '五险一金怎么算',
    '落户政策是怎样的',
    '档案派遣怎么办理',
    '报到证有什么用',
    '就业推荐表怎么填',
    '考编需要准备什么',
    '选调生是什么',
    '西部计划怎么报名',
    '三支一扶是什么',
    '军队文职怎么考',
    '创业有什么扶持政策'
  ],
  [CATEGORIES.POLICY_GENERAL]: [
    '怎么办理转专业',
    '休学需要什么手续',
    '四六级什么时候报名',
    '补考申请流程是什么',
    '学籍证明怎么开',
    '请假制度是怎样的',
    '学生证丢了怎么补办',
    '校园卡充值在哪里',
    '图书馆借书证怎么开',
    '宿舍门禁时间是几点',
    '怎么申请走读',
    '怎么申请调换宿舍',
    '宿舍报修电话是多少',
    '医保卡怎么使用',
    '校医院报销流程',
    '怎么开具在读证明',
    '成绩单在哪里打印',
    '怎么查询绩点',
    '怎么修改教务系统密码',
    '选课系统进不去怎么办',
    '怎么申请免修课程',
    '怎么申请缓考',
    '怎么查询考试安排',
    '怎么查询空闲教室',
    '怎么申请教室借用',
    '怎么报名参加社团',
    '怎么申请入党',
    '党组织关系怎么转接',
    '团员证丢了怎么补',
    '怎么申请贫困生认定',
    '助学贷款怎么办理',
    '勤工助学岗位怎么申请',
    '怎么办理退学手续',
    '怎么办理复学手续',
    '怎么办理保留学籍',
    '怎么开具无犯罪记录证明',
    '怎么办理户口迁移'
  ],
  [CATEGORIES.GENERAL]: [
    '你好',
    '你是谁',
    '今天天气怎么样',
    '讲个笑话',
    '谢谢你',
    '帮我写一段代码',
    '你会做什么',
    '能陪我聊天吗',
    '给我推荐一首歌',
    '最近有什么新闻',
    '你叫什么名字',
    '你几岁了',
    '你的开发者是谁',
    '你用的是什么模型',
    '能帮我翻译一下吗',
    '能帮我写一首诗吗',
    '能帮我写一篇文章吗',
    '能帮我润色一下这段话吗',
    '能帮我总结一下这篇文章吗',
    '能帮我提取关键词吗',
    '能帮我生成一个标题吗',
    '再见',
    '晚安',
    '早上好',
    '中午好',
    '下午好'
  ]
}

// ==================== Embedding 缓存 ====================

const CACHE_DIR = path.join(process.cwd(), 'data', 'cache')
const CACHE_FILE = path.join(CACHE_DIR, 'exemplar_vectors.json')

let embeddingsModel = null
let categoryVectors = null // { category: [ [向量], [向量], ... ] }
let isWarming = false
let warmPromise = null

/**
 * 获取 Embedding 模型（复用 vectorService 的配置逻辑）
 */
function getEmbeddings() {
  if (embeddingsModel) return embeddingsModel

  const isQwen = process.env.VITE_QWEN_KEY && !process.env.OPENAI_API_KEY
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_QWEN_KEY

  if (!apiKey) {
    throw new Error('[分类服务] Embedding API Key 未配置 (VITE_QWEN_KEY 或 OPENAI_API_KEY)')
  }

  embeddingsModel = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    modelName: isQwen ? 'text-embedding-v2' : 'text-embedding-3-small',
    ...(isQwen ? {
      configuration: {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      }
    } : {})
  })

  return embeddingsModel
}

/**
 * 计算标杆问题的指纹 (Hash)
 * 标杆问题发生任何变化（新增、修改、删除），指纹都会不同
 */
function computeExemplarsHash() {
  const content = JSON.stringify(CATEGORY_EXEMPLARS)
  return createHash('md5').update(content).digest('hex')
}

/**
 * 从本地缓存加载向量
 * @returns {object|null} categoryVectors 或 null（缓存不存在/已过期）
 */
async function loadCache() {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf-8')
    const cache = JSON.parse(raw)

    // 校验指纹：标杆问题没变才使用缓存
    if (cache.hash === computeExemplarsHash()) {
      return cache.vectors
    }
    console.log('[分类服务] 标杆问题已更新，缓存失效，将重新计算')
    return null
  } catch {
    // 文件不存在或解析失败
    return null
  }
}

/**
 * 保存向量到本地缓存
 */
async function saveCache(vectors) {
  try {
    await fs.mkdir(CACHE_DIR, {
      recursive: true
    })
    const cache = {
      hash: computeExemplarsHash(),
      createdAt: new Date().toISOString(),
      totalExemplars: Object.values(CATEGORY_EXEMPLARS).reduce((sum, arr) => sum + arr.length, 0),
      vectors
    }
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache), 'utf-8')
    console.log('[分类服务] 向量缓存已保存到磁盘 ✅')
  } catch (error) {
    console.warn('[分类服务] 缓存保存失败（不影响运行）:', error.message)
  }
}

/**
 * 预热：加载或计算所有标杆问题的向量
 *
 * 优先从本地缓存读取（<50ms），仅在标杆问题变化时才调 API 重算。
 * 启动时调用一次，后续所有分类请求直接复用内存缓存。
 */
export async function warmUpClassifier() {
  // 防止重复预热
  if (categoryVectors) return
  if (isWarming) return warmPromise

  isWarming = true
  warmPromise = (async () => {
    const startTime = Date.now()
    const totalExemplars = Object.values(CATEGORY_EXEMPLARS).reduce((sum, arr) => sum + arr.length, 0)

    try {
      // 1. 尝试从本地缓存加载
      const cached = await loadCache()
      if (cached) {
        categoryVectors = cached
        const elapsed = Date.now() - startTime
        console.log(`[分类服务] 从缓存加载成功 ✅ (${ totalExemplars } 条标杆, 耗时 ${ elapsed }ms)`)
        return
      }

      // 2. 缓存未命中，调 API 计算
      console.log(`[分类服务] 正在调用 Embedding API 计算 ${ totalExemplars } 条标杆向量...`)
      const embeddings = getEmbeddings()
      categoryVectors = {}

      // 千问 text-embedding-v2 单次批量上限 25 条，需分批处理
      const BATCH_SIZE = 20
      for (const [category, exemplars] of Object.entries(CATEGORY_EXEMPLARS)) {
        const allVectors = []
        for (let i = 0; i < exemplars.length; i += BATCH_SIZE) {
          const batch = exemplars.slice(i, i + BATCH_SIZE)
          const batchVectors = await embeddings.embedDocuments(batch)
          allVectors.push(...batchVectors)
        }
        categoryVectors[category] = allVectors
      }

      const elapsed = Date.now() - startTime
      console.log(`[分类服务] API 计算完成 ✅ (${ totalExemplars } 条标杆, 耗时 ${ elapsed }ms)`)

      // 3. 保存到本地缓存（后台执行，不阻塞）
      saveCache(categoryVectors)

    } catch (error) {
      console.error('[分类服务] 预热失败:', error.message)
      categoryVectors = null
    } finally {
      isWarming = false
    }
  })()

  return warmPromise
}

// ==================== 相似度计算 ====================

/**
 * 余弦相似度
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ==================== 分类策略 ====================

/**
 * 第1级：强特征关键词快速通道---政策类问题
 * 只保留"100%不会错"的铁规则，不做模糊匹配
 */
function classifyByStrongKeywords(question) {
  const q = question.toLowerCase()

  const strongRules = [
    {
      category: CATEGORIES.POLICY_POSTGRADUATE,
      phrases: ['保研', '推免', '免试攻读']
    },
    {
      category: CATEGORIES.POLICY_SCHOLARSHIP,
      phrases: ['国家奖学金', '奖学金', '助学金']
    },
    {
      category: CATEGORIES.POLICY_GRADUATION,
      phrases: ['毕业论文', '毕业设计', '开题报告', '答辩']
    },
    {
      category: CATEGORIES.POLICY_MAJOR_SPLIT,
      phrases: ['专业分流', '大类分流', '分流']
    }
  ]

  for (const rule of strongRules) {
    if (rule.phrases.some(p => q.includes(p))) {
      return {
        category: rule.category,
        confidence: 0.95,
        method: 'keyword'
      }
    }
  }

  return null
}

/**
 * 第2级：Embedding 语义相似度分类（主力）
 */
async function classifyByEmbedding(question) {
  // 确保标杆向量已就绪
  if (!categoryVectors) {
    await warmUpClassifier()
  }

  if (!categoryVectors) {
    throw new Error('标杆向量未就绪')
  }

  const embeddings = getEmbeddings()
  const queryVector = await embeddings.embedQuery(question)

  let bestCategory = CATEGORIES.GENERAL
  let bestScore = -1
  let bestExemplarIdx = -1

  for (const [category, exemplarVectors] of Object.entries(categoryVectors)) {
    for (let i = 0; i < exemplarVectors.length; i++) {
      const score = cosineSimilarity(queryVector, exemplarVectors[i])
      if (score > bestScore) {
        bestScore = score
        bestCategory = category
        bestExemplarIdx = i
      }
    }
  }

  const matchedExemplar = CATEGORY_EXEMPLARS[bestCategory]?.[bestExemplarIdx] || ''

  return {
    category: bestCategory,
    confidence: bestScore,
    method: 'embedding',
    matchedExemplar
  }
}

// ==================== 对外接口 ====================

/** 相似度阈值：低于此值归为 GENERAL */
const SIMILARITY_THRESHOLD = 0.7

/**
 * 智能问题分类（对外唯一接口）
 *
 * @param {string} question 用户问题
 * @returns {Promise<string>} 分类类别代码
 */
export async function classifyQuestion(question) {
  // 第1级：强特征关键词
  const strongHit = classifyByStrongKeywords(question)
  if (strongHit) {
    console.log(`[分类服务] 强特征命中: ${ strongHit.category } (关键词直接匹配)`)
    return strongHit.category
  }

  // 第2级：Embedding 语义分类
  try {
    const result = await classifyByEmbedding(question)
    if (result.confidence >= SIMILARITY_THRESHOLD) {
      console.log(`[分类服务] Embedding 分类: ${ result.category } (相似度: ${ result.confidence.toFixed(4) }, 最近标杆: "${ result.matchedExemplar }")`)
      return result.category
    }
    console.log(`[分类服务] 相似度过低 (${ result.confidence.toFixed(4) } < ${ SIMILARITY_THRESHOLD })，归为 GENERAL`)
    return CATEGORIES.GENERAL
  } catch (error) {
    console.error('[分类服务] Embedding 分类失败:', error.message)
    return CATEGORIES.GENERAL
  }
}

/**
 * 带详情的分类（供调试脚本使用）
 *
 * @param {string} question 用户问题
 * @returns {Promise<object>} { category, confidence, method, matchedExemplar }
 */
export async function classifyQuestionWithDetail(question) {
  // 第1级
  const strongHit = classifyByStrongKeywords(question)
  if (strongHit) return strongHit

  // 第2级
  try {
    const result = await classifyByEmbedding(question)
    if (result.confidence >= SIMILARITY_THRESHOLD) {
      return result
    }
    return {
      category: CATEGORIES.GENERAL,
      confidence: result.confidence,
      method: 'embedding_low',
      matchedExemplar: result.matchedExemplar
    }
  } catch (error) {
    return {
      category: CATEGORIES.GENERAL,
      confidence: 0,
      method: 'fallback',
      matchedExemplar: ''
    }
  }
}
