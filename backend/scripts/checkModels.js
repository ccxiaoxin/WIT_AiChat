import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

/**
 * 检查后端支持的大模型配置状态
 */
const MODEL_CONFIGS = [
  {
    name: '阿里云千问',
    key: 'qwen',
    envVar: 'VITE_QWEN_KEY',
    required: false
  },
  {
    name: 'DeepSeek V3',
    key: 'deepseek-v3',
    envVar: 'VITE_DEEPSEEK_KEY',
    required: false
  },
  {
    name: 'DeepSeek R1 (推理模型)',
    key: 'deepseek-deep',
    envVar: 'VITE_DEEPSEEK_KEY',
    required: false
  },
  {
    name: 'Kimi Moonshot',
    key: 'moonshot',
    envVar: 'VITE_MOONSHOT_KEY',
    required: false
  },
  {
    name: '星火大模型',
    key: 'spark',
    envVar: 'VITE_SPARK_KEY',
    required: false
  },
  {
    name: '硅基流动',
    key: 'siliconflow',
    envVar: 'VITE_SILICONFLOW_KEY',
    required: false
  },
  {
    name: 'Ollama Llama3 (本地)',
    key: 'ollama3',
    envVar: null,
    required: false
  }
]

const EMBEDDINGS_CONFIGS = [
  {
    name: 'OpenAI Embeddings',
    envVar: 'OPENAI_API_KEY',
    priority: 1
  },
  {
    name: 'Qwen Embeddings',
    envVar: 'VITE_QWEN_KEY',
    priority: 2
  }
]

function checkModels() {
  console.log('\n🤖 ========== 大模型配置检查 ==========\n')

  // 检查 Embeddings（必需）
  console.log('📊 Embeddings 配置（必需）：')
  let embeddingsConfigured = false
  for (const config of EMBEDDINGS_CONFIGS) {
    const isConfigured = !!process.env[config.envVar]
    const status = isConfigured ? '✅ 已配置' : '❌ 未配置'
    console.log(`  ${status} ${config.name} (${config.envVar})`)
    if (isConfigured && !embeddingsConfigured) {
      embeddingsConfigured = true
      console.log(`     → 将使用此 Embeddings 模型`)
    }
  }

  if (!embeddingsConfigured) {
    console.log('\n⚠️  警告：至少需要配置一个 Embeddings 模型！')
    console.log('   请在 .env 中配置 OPENAI_API_KEY 或 VITE_QWEN_KEY\n')
  }

  console.log('\n🚀 大模型 API 配置（可选）：')
  let anyModelConfigured = false
  for (const config of MODEL_CONFIGS) {
    if (config.envVar === null) {
      // Ollama 不需要 API Key
      console.log(`  ✅ ${config.name} (${config.key})`)
      console.log(`     → 本地部署，无需 API Key（需要启动 Ollama 服务）`)
      anyModelConfigured = true
    } else {
      const isConfigured = !!process.env[config.envVar]
      const status = isConfigured ? '✅ 已配置' : '⚪ 未配置'
      console.log(`  ${status} ${config.name} (${config.key})`)
      if (isConfigured) {
        const keyPreview = process.env[config.envVar].substring(0, 10) + '...'
        console.log(`     → ${config.envVar}=${keyPreview}`)
        anyModelConfigured = true
      }
    }
  }

  if (!anyModelConfigured) {
    console.log('\n⚠️  提示：没有配置任何大模型 API Key')
    console.log('   前端将无法正常使用，请在 .env 中配置至少一个模型的 API Key\n')
  }

  console.log('\n🗂️  向量存储配置：')
  const vectorStoreType = process.env.VECTOR_STORE_TYPE || 'memory'
  console.log(`  类型: ${vectorStoreType}`)
  if (vectorStoreType === 'chroma') {
    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000'
    console.log(`  ChromaDB URL: ${chromaUrl}`)
  }

  console.log('\n========================================\n')

  // 返回配置状态
  return {
    embeddingsConfigured,
    anyModelConfigured,
    vectorStoreType
  }
}

// 运行检查
const result = checkModels()

if (!result.embeddingsConfigured) {
  console.log('❌ 配置不完整：缺少 Embeddings 配置')
  console.log('   解决方案：在 backend/.env 中添加以下任一配置：')
  console.log('   OPENAI_API_KEY=sk-your-key')
  console.log('   或')
  console.log('   VITE_QWEN_KEY=sk-your-key\n')
  process.exit(1)
}

if (!result.anyModelConfigured) {
  console.log('⚠️  提示：建议至少配置一个大模型 API Key')
  console.log('   编辑 backend/.env 文件，添加任一模型的 API Key\n')
}

console.log('✅ 配置检查完成！可以启动服务了。\n')

