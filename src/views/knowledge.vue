<template>
  <div class="knowledge-container">
    <div class="header">
      <h2>知识库管理</h2>
      <n-space>
        <n-button v-if="viewMode === 'list'" type="primary" @click="createNewDoc">新增文档</n-button>
        <n-button v-if="viewMode === 'edit'" @click="backToList">返回列表</n-button>
        <n-button @click="$router.push('/chat')">返回对话</n-button>
      </n-space>
    </div>

    <!-- 列表视图 -->
    <div v-if="viewMode === 'list'" class="list-section">
      <n-data-table
        :columns="columns"
        :data="documentList"
        :bordered="false"
        :loading="loadingList"
      />
    </div>

    <!-- 编辑/新增视图 -->
    <div v-else-if="viewMode === 'edit'" class="edit-section">
      <div v-if="!isEditingExisting" class="upload-section">
        <n-upload
          multiple
          directory-dnd
          :show-file-list="false"
          accept=".txt,.md,.json,.pdf,.doc,.docx"
          @before-upload="handleBeforeUpload"
        >
          <n-upload-dragger>
            <div style="margin-bottom: 12px">
              <div class="i-carbon-cloud-upload" style="font-size: 48px; color: #18a058;"></div>
            </div>
            <n-text style="font-size: 16px">
              点击或者拖动文件到该区域来上传并解析
            </n-text>
            <n-p depth="3" style="margin-top: 8px">
              支持 txt, md, json, pdf, doc, docx 文件
            </n-p>
          </n-upload-dragger>
        </n-upload>
      </div>

      <div v-if="parsedChunks.length > 0" class="editor-section">
        <div class="editor-header">
          <h3>编辑文档片段 ({{ parsedChunks.length }} 个)</h3>
          <div class="actions">
            <n-select
              v-model:value="selectedCategory"
              :options="categoryOptions"
              placeholder="选择分类"
              style="width: 150px; margin-right: 10px;"
            />
            <n-input
              v-model:value="sourceName"
              placeholder="来源名称"
              :disabled="isEditingExisting"
              style="width: 200px; margin-right: 10px;"
            />
            <n-button type="primary" @click="submitChunks" :loading="submitting">确认入库</n-button>
          </div>
        </div>

        <div class="chunks-list">
          <div v-for="(chunk, index) in parsedChunks" :key="index" class="chunk-item">
            <div class="chunk-header">
              <span>片段 {{ index + 1 }}</span>
              <div class="chunk-actions">
                <n-button size="small" type="primary" ghost @click="insertChunk(index)" style="margin-right: 8px;">插入片段</n-button>
                <n-button size="small" type="error" ghost @click="removeChunk(index)">删除</n-button>
              </div>
            </div>
            <n-input
              v-model:value="parsedChunks[index]"
              type="textarea"
              :rows="5"
              placeholder="请输入片段内容"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { useMessage, useDialog, NButton, NSpace, NTag } from 'naive-ui'
import { 
  parseKnowledgeDoc, 
  saveKnowledgeChunks, 
  getKnowledgeListApi, 
  getKnowledgeChunksApi, 
  deleteKnowledgeDocApi,
  type KnowledgeDoc
} from '@/api'
import { useRouter } from 'vue-router'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()

// 视图状态
const viewMode = ref<'list' | 'edit'>('list')
const loadingList = ref(false)
const documentList = ref<KnowledgeDoc[]>([])

// 编辑表单状态
const parsedChunks = ref<string[]>([])
const selectedCategory = ref('policy_general')
const sourceName = ref('')
const submitting = ref(false)
const isEditingExisting = ref(false)

const categoryOptions = [
  { label: '保研政策', value: 'policy_postgraduate' },
  { label: '奖学金政策', value: 'policy_scholarship' },
  { label: '毕业论文/设计', value: 'policy_graduation' },
  { label: '专业分流', value: 'policy_major_split' },
  { label: '通用政策', value: 'policy_general' },
  { label: '专业介绍', value: 'major_intro' },
  { label: '培养方案', value: 'major_program' }
]

const categoryMap: Record<string, string> = {
  policy_postgraduate: '保研政策',
  policy_scholarship: '奖学金政策',
  policy_graduation: '毕业论文/设计',
  policy_major_split: '专业分流',
  policy_general: '通用政策',
  major_intro: '专业介绍',
  major_program: '培养方案'
}

// 表格列定义
const columns = [
  {
    title: '文档名称 (Source)',
    key: 'source',
    render(row: KnowledgeDoc) {
      return h('strong', row.source)
    }
  },
  {
    title: '分类',
    key: 'category',
    render(row: KnowledgeDoc) {
      return h(
        NTag,
        { type: 'info', bordered: false },
        { default: () => categoryMap[row.category] || row.category }
      )
    }
  },
  {
    title: '片段数量',
    key: 'chunkCount',
    render(row: KnowledgeDoc) {
      return h(NTag, { type: 'success', bordered: false }, { default: () => `${row.chunkCount} 个` })
    }
  },
  {
    title: '操作',
    key: 'actions',
    render(row: KnowledgeDoc) {
      return h(NSpace, null, {
        default: () => [
          h(
            NButton,
            { size: 'small', type: 'primary', ghost: true, onClick: () => editDocument(row) },
            { default: () => '编辑' }
          ),
          h(
            NButton,
            { size: 'small', type: 'error', ghost: true, onClick: () => deleteDocument(row) },
            { default: () => '删除' }
          )
        ]
      })
    }
  }
]

// 加载列表数据
const loadList = async () => {
  loadingList.value = true
  try {
    const res = await getKnowledgeListApi()
    if (res.success) {
      documentList.value = res.data
    } else {
      message.error('获取列表失败')
    }
  } catch (error: any) {
    message.error('获取列表出错: ' + error.message)
  } finally {
    loadingList.value = false
  }
}

onMounted(() => {
  loadList()
})

// 新增文档
const createNewDoc = () => {
  isEditingExisting.value = false
  parsedChunks.value = []
  sourceName.value = ''
  selectedCategory.value = 'policy_general'
  viewMode.value = 'edit'
}

// 返回列表
const backToList = () => {
  viewMode.value = 'list'
  loadList()
}

// 编辑文档
const editDocument = async (doc: KnowledgeDoc) => {
  try {
    const res = await getKnowledgeChunksApi(doc.source)
    if (res.success && res.data) {
      isEditingExisting.value = true
      sourceName.value = doc.source
      selectedCategory.value = doc.category
      // ChromaDB 返回的 documents 直接是字符串数组
      parsedChunks.value = res.data.map((item: any) => typeof item === 'string' ? item : (item.pageContent || ''))
      viewMode.value = 'edit'
    } else {
      message.error('获取片段失败')
    }
  } catch (error: any) {
    message.error('获取片段出错: ' + error.message)
  }
}

// 删除文档
const deleteDocument = (doc: KnowledgeDoc) => {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除文档 "${doc.source}" 及其所有片段吗？此操作不可恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const res = await deleteKnowledgeDocApi(doc.source)
        if (res.success) {
          message.success('删除成功')
          loadList()
        } else {
          message.error('删除失败')
        }
      } catch (error: any) {
        message.error('删除出错: ' + error.message)
      }
    }
  })
}

// 上传处理
const handleBeforeUpload = async (options: { file: { file: File } }) => {
  const file = options.file.file
  if (!file) return false

  try {
    const res = await parseKnowledgeDoc(file)
    if (res.success) {
      parsedChunks.value = res.data.chunks
      sourceName.value = res.data.sourceName
      message.success('解析成功，请检查并编辑片段')
    } else {
      message.error(res.error || '解析失败')
    }
  } catch (error: any) {
    message.error('解析出错: ' + error.message)
  }
  
  return false // 阻止默认上传行为
}

const removeChunk = (index: number) => {
  parsedChunks.value.splice(index, 1)
}

const insertChunk = (index: number) => {
  parsedChunks.value.splice(index + 1, 0, '')
}

const submitChunks = async () => {
  if (!selectedCategory.value) {
    message.warning('请选择分类')
    return
  }
  if (!sourceName.value) {
    message.warning('请输入来源名称')
    return
  }
  
  // 过滤掉空片段
  const validChunks = parsedChunks.value.filter(chunk => chunk.trim() !== '')
  if (validChunks.length === 0) {
    message.warning('文档片段不能为空')
    return
  }

  submitting.value = true
  try {
    const res = await saveKnowledgeChunks({
      chunks: validChunks,
      category: selectedCategory.value,
      sourceName: sourceName.value
    }) as any
    
    if (res.success) {
      message.success(isEditingExisting.value ? '更新成功' : '入库成功')
      backToList()
    } else {
      message.error(res.error || '保存失败')
    }
  } catch (error: any) {
    message.error('保存出错: ' + error.message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.knowledge-container {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.list-section {
  flex: 1;
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.edit-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.upload-section {
  margin-bottom: 30px;
}

.editor-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.actions {
  display: flex;
  align-items: center;
}

.chunks-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 10px;
}

.chunk-item {
  margin-bottom: 15px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 15px;
  background-color: #fff;
}

.chunk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-weight: bold;
  color: #606266;
}
</style>
