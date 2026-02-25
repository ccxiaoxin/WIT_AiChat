/**
 * 意图识别与 RAG 调度调试脚本
 *
 * 用法:
 *   node scripts/testRouter.js "你的问题"
 *   node scripts/testRouter.js              (使用默认测试问题)
 *   node scripts/testRouter.js --batch       (批量测试所有预设问题)
 */

import { CATEGORIES, classifyQuestionWithDetail, warmUpClassifier } from '../src/services/classifierService.js'
import { processRAG } from '../src/services/ragService.js'
import dotenv from 'dotenv'

dotenv.config()

// ==================== 批量测试用例 ====================

const TEST_CASES = [
  {
    question: '保研需要什么条件？',
    expected: CATEGORIES.POLICY_POSTGRADUATE
  },
  {
    question: '推免名额有多少',
    expected: CATEGORIES.POLICY_POSTGRADUATE
  },
  {
    question: '国家奖学金怎么申请',
    expected: CATEGORIES.POLICY_SCHOLARSHIP
  },
  {
    question: '毕业论文格式要求是什么',
    expected: CATEGORIES.POLICY_GRADUATION
  },
  {
    question: '答辩流程是怎样的',
    expected: CATEGORIES.POLICY_GRADUATION
  },
  {
    question: '专业分流怎么选',
    expected: CATEGORIES.POLICY_MAJOR_SPLIT
  },
  {
    question: '计算机专业怎么样',
    expected: CATEGORIES.MAJOR_INTRO
  },
  {
    question: '这个专业学什么',
    expected: CATEGORIES.MAJOR_INTRO
  },
  {
    question: '培养方案是什么',
    expected: CATEGORIES.MAJOR_PROGRAM
  },
  {
    question: '必修课有哪些',
    expected: CATEGORIES.MAJOR_PROGRAM
  },
  {
    question: '前端开发需要学什么',
    expected: CATEGORIES.CAREER
  },
  {
    question: '计算机专业就业方向有哪些',
    expected: CATEGORIES.CAREER
  },
  {
    question: '毕业后能做什么工作',
    expected: CATEGORIES.CAREER
  },
  {
    question: '算法工程师需要什么能力',
    expected: CATEGORIES.CAREER
  },
  {
    question: '怎么办理转专业',
    expected: CATEGORIES.POLICY_GENERAL
  },
  {
    question: '四六级什么时候报名',
    expected: CATEGORIES.POLICY_GENERAL
  },
  {
    question: '你好',
    expected: CATEGORIES.GENERAL
  },
  {
    question: '讲个笑话',
    expected: CATEGORIES.GENERAL
  },
  // 容易混淆的边界问题
  {
    question: '学前端需要上什么课',
    expected: CATEGORIES.CAREER
  },
  {
    question: '计算机专业的就业方向有哪些',
    expected: CATEGORIES.CAREER
  },
  {
    question: '学分够不够保研',
    expected: CATEGORIES.POLICY_POSTGRADUATE
  },
  {
    question: '我成绩3.5能保上吗',
    expected: CATEGORIES.POLICY_POSTGRADUATE
  }
]

// ==================== 单问题调试 ====================

async function testSingle(question) {
  console.log('='.repeat(60))
  console.log(`🔍 调试输入: "${ question }"`)
  console.log('='.repeat(60))

  try {
    // 1. 测试意图识别（带详情）
    console.log('\n[步骤 1: 意图识别]')
    const detail = await classifyQuestionWithDetail(question)
    console.log(`   分类结果: ${ detail.category }`)
    console.log(`   置信度:   ${ detail.confidence?.toFixed?.(4) || detail.confidence }`)
    console.log(`   分类方式: ${ detail.method }`)
    if (detail.matchedExemplar) {
      console.log(`   最近标杆: "${ detail.matchedExemplar }"`)
    }

    // 2. 测试 RAG 调度 (结构化增强 + 向量检索)
    console.log('\n[步骤 2: RAG 调度与知识增强]')
    const { chunks, sources } = await processRAG(question, detail.category)

    console.log(`   检索到片段数: ${ chunks.length }`)
    console.log(`   知识来源: ${ sources.join(', ') || '无' }`)

    // 3. 打印检索到的内容预览
    if (chunks.length > 0) {
      console.log('\n[步骤 3: 检索内容预览]')
      chunks.forEach((chunk, i) => {
        console.log(`--- 片段 ${ i + 1 } ---`)
        const preview = chunk.length > 300 ? `${ chunk.substring(0, 300) }...` : chunk
        console.log(preview)
        console.log('')
      })
    }

    console.log('='.repeat(60))
    console.log('💡 调试建议:')
    if (chunks.length === 0) {
      console.log('  - 没有搜到内容，请检查 initVectorDB.js 是否已运行，或 category 元数据是否匹配。')
    } else if (chunks[0].includes('【官方数据】') || chunks[0].includes('【职业百科】')) {
      console.log('  - ✅ 命中结构化知识增强，回答准确度将非常高。')
    } else {
      console.log('  - 仅命中向量检索，请检查片段内容是否能回答问题。')
    }

    return detail

  } catch (error) {
    console.error('\n❌ 调试失败:', error.message)
    return null
  }
}

// ==================== 批量测试 ====================

async function testBatch() {
  console.log('='.repeat(60))
  console.log('📋 批量意图识别测试')
  console.log('='.repeat(60))

  // 先预热
  await warmUpClassifier()

  let correct = 0
  const total = TEST_CASES.length
  const failures = []

  for (const tc of TEST_CASES) {
    const detail = await classifyQuestionWithDetail(tc.question)
    const isCorrect = detail.category === tc.expected
    if (isCorrect) {
      correct++
    } else {
      failures.push({
        question: tc.question,
        expected: tc.expected,
        actual: detail.category,
        confidence: detail.confidence?.toFixed?.(4),
        matchedExemplar: detail.matchedExemplar
      })
    }

    const icon = isCorrect ? '✅' : '❌'
    console.log(`${ icon } "${ tc.question }"`)
    console.log(`   期望: ${ tc.expected } | 实际: ${ detail.category } | 置信度: ${ detail.confidence?.toFixed?.(4) } | 方式: ${ detail.method }`)
  }

  console.log(`\n${ '='.repeat(60) }`)
  console.log(`📊 测试结果: ${ correct }/${ total } (${ (correct / total * 100).toFixed(1) }%)`)

  if (failures.length > 0) {
    console.log(`\n❌ 失败用例 (${ failures.length })：`)
    failures.forEach(f => {
      console.log(`   "${ f.question }"`)
      console.log(`      期望: ${ f.expected }, 实际: ${ f.actual }`)
      console.log(`      置信度: ${ f.confidence }, 标杆: "${ f.matchedExemplar }"`)
    })
    console.log('\n💡 优化建议: 在 CATEGORY_EXEMPLARS 中为失败的类别补充更相似的标杆问题。')
  } else {
    console.log('\n🎉 全部通过！')
  }
}

// ==================== 入口 ====================

const args = process.argv.slice(2)

if (args.includes('--batch')) {
  testBatch()
} else {
  const query = args[0] || '保研的申请条件是什么？'
  testSingle(query)
}
