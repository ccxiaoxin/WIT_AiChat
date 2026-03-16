<script lang="tsx" setup>
import { defaultMockModelName, modelMappingList, triggerModelTermination } from '@/components/MarkdownPreview/models'
import { renderMarkdownText } from '@/components/MarkdownPreview/plugins/markdown'
import { type InputInst, useMessage, useDialog, NRadioGroup, NRadio, NSpace, NInput as NInputComp } from 'naive-ui'
import type { SelectBaseOption } from 'naive-ui/es/select/src/interface'
import { isGithubDeployed } from '@/config'
import NavSideBar from '@/components/Navigation/NavSideBar.vue'
import { updateMessageFeedback } from '@/api'

import { UAParser } from 'ua-parser-js'

const route = useRoute()
const router = useRouter()
const businessStore = useBusinessStore()
const message = useMessage()
const dialog = useDialog()

// RAG相关：分类映射（与后端 CATEGORIES 对齐）
const categoryMap: Record<string, string> = {
  policy_postgraduate: '🎓 保研政策',
  policy_scholarship: '🏅 奖学金政策',
  policy_graduation: '📝 毕业论文/设计',
  policy_major_split: '🔀 专业分流',
  policy_general: '📋 通用政策',
  major_intro: '📚 专业介绍',
  major_program: '📖 培养方案',
  career: '💼 就业方向',
  general: '💬 通用问答'
}

// 检查后端连接
onMounted(async () => {
  const connected = await businessStore.checkBackendConnection()
  if (connected) {
    console.log('✅ 后端服务已连接')
  } else {
    console.warn('⚠️ 后端服务未连接')
  }
})

// 监听会话ID变化，加载历史记录
watch(() => businessStore.currentChatId, (newId) => {
  if (newId) {
    businessStore.loadChatHistory(newId)
    // 重置输入框和状态，但保留输入内容
    // handleResetState() // 移除这行，避免清空输入框
    stylizingLoading.value = false
    callPreviewMethod('resetStatus')
  } else {
    // 如果没有ID（比如刚删除完），清空消息
    businessStore.messageList = []
  }
})


const modelListSelections = computed(() => {
  return modelMappingList.map<SelectBaseOption>((modelItem) => {
    let disabled = false
    if (isGithubDeployed && modelItem.modelName !== defaultMockModelName) {
      disabled = true
    }

    return {
      label: modelItem.label,
      value: modelItem.modelName,
      // Github 演示环境禁用模型切换，拉取代码后可按自己需求修改
      disabled
    }
  })
})


const loading = ref(true)

setTimeout(() => {
  loading.value = false
}, 700)


const stylizingLoading = ref(false)


/**
 * 输入字符串
 */
const inputTextString = ref('')
const refInputTextString = ref<InputInst | null>()

/**
 * 输出字符串 Reader 流（风格化的）
 */
const outputTextReader = ref<ReadableStreamDefaultReader | null>()

const refReaderMarkdownPreview = ref<any>()

/**
 * 安全调用 MarkdownPreview 组件的方法
 * 因为在 v-for 中使用 ref，refReaderMarkdownPreview.value 可能是数组
 */
const callPreviewMethod = (methodName: string, ...args: any[]) => {
  const val = refReaderMarkdownPreview.value
  if (!val) return

  if (Array.isArray(val)) {
    val.forEach(item => {
      if (item && typeof item[methodName] === 'function') {
        item[methodName](...args)
      }
    })
  } else if (typeof val[methodName] === 'function') {
    val[methodName](...args)
  }
}

const onFailedReader = () => {
  outputTextReader.value = null
  stylizingLoading.value = false
  callPreviewMethod('initializeEnd')
  window.$ModalMessage.error('转换失败，请重试')
  setTimeout(() => {
    if (refInputTextString.value) {
      refInputTextString.value.focus()
    }
  })
  triggerModelTermination()
}
const onCompletedReader = () => {
  stylizingLoading.value = false
  // 对话完成后，重新拉取历史记录以更新标题（确保“新对话”标题被替换）
  businessStore.loadHistoryList()
  setTimeout(() => {
    if (refInputTextString.value) {
      refInputTextString.value.focus()
    }
  })
  triggerModelTermination()
}

const handleCreateStylized = async () => {
  // 若正在加载，则点击后恢复初始状态
  if (stylizingLoading.value) {
    callPreviewMethod('abortReader')
    onCompletedReader()
    return
  }

  // 检查输入内容
  if (!inputTextString.value.trim()) {
    if (refInputTextString.value) {
      refInputTextString.value.focus()
    }
    return
  }

  // 滚动到底部
  scrollToBottom()

  // 如果正在使用 Markdown 预览器，重置它
  callPreviewMethod('resetStatus')
  callPreviewMethod('initializeStart')

  stylizingLoading.value = true
  const textContent = inputTextString.value
  inputTextString.value = ''
  const { error, reader } = await businessStore.createAssistantWriterStylized({
    text: textContent
  })

  if (error) {
    onFailedReader()
    return
  }

  if (reader) {
    outputTextReader.value = reader
    // 开始流式输出后，重新拉取历史记录以更新标题
    businessStore.loadHistoryList()
  }
}


const keys = useMagicKeys()
const enterCommand = keys['Meta+Enter']
const enterCtrl = keys['Ctrl+Enter']

const activeElement = useActiveElement()
const notUsingInput = computed(() => activeElement.value?.tagName !== 'TEXTAREA')

const parser = new UAParser()
const isMacos = computed(() => {
  const os = parser.getOS()
  if (!os) return

  const osName = os.name ?? ''
  return osName
    .toLocaleLowerCase()
    .includes?.('macos')
})

const placeholder = computed(() => {
  if (stylizingLoading.value) {
    return `输入任意问题...`
  }
  return `输入任意问题, 按 ${ isMacos.value ? 'Command' : 'Ctrl' } + Enter 键快捷开始...`
})

watch(
  () => enterCommand.value,
  () => {
    if (!isMacos.value || notUsingInput.value) return

    if (stylizingLoading.value) return

    if (!enterCommand.value) {
      handleCreateStylized()
    }
  },
  {
    deep: true
  }
)

watch(
  () => enterCtrl.value,
  () => {
    if (isMacos.value || notUsingInput.value) return

    if (stylizingLoading.value) return

    if (!enterCtrl.value) {
      handleCreateStylized()
    }
  },
  {
    deep: true
  }
)


const handleResetState = () => {
  inputTextString.value = ''

  stylizingLoading.value = false
  nextTick(() => {
    refInputTextString.value?.focus()
  })
  callPreviewMethod('abortReader')
  callPreviewMethod('resetStatus')
}
handleResetState()


const PromptTag = defineComponent({
  props: {
    text: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const handleClick = () => {
      inputTextString.value = props.text
      nextTick(() => {
        refInputTextString.value?.focus()
      })
    }
    return {
      handleClick
    }
  },
  render() {
    return (
      <div
        b="~ solid transparent"
        hover="shadow-[--shadow] b-primary bg-#e8e8e8"
        class={[
          'px-10 py-2 rounded-7 text-12',
          'max-w-230 transition-all-300 select-none cursor-pointer',
          'c-#525252 bg-#ededed'
        ]}
        style={{
          '--shadow': '3px 3px 3px -1px rgba(0,0,0,0.1)'
        }}
        onClick={this.handleClick}
      >
        <n-ellipsis
          tooltip={{
            contentClass: 'wrapper-tooltip-scroller',
            keepAliveOnHover: true
          }}
        >
          {{
            tooltip: () => this.text,
            default: () => this.text
          }}
        </n-ellipsis>
      </div>
    )
  }
})

const promptTextList = ref([
  '计算机科学与技术专业的保研条件是什么？',
  '软件工程方向有哪些就业前景？需要学哪些课程？',
  '计算机类专业培养方案中有哪些核心课程？'
])

const messageListRef = ref<HTMLElement | null>(null)

const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

// 监听消息列表变化，自动滚动到底部
watch(() => businessStore.messageList.length, () => {
  scrollToBottom()
})

const handleFeedback = async (msg: any, type: 'like' | 'dislike') => {
  if (!businessStore.currentChatId || !msg._id) return

  // 如果点击的是已经选中的状态，则取消反馈
  if (msg.feedback === type) {
    try {
      await updateMessageFeedback(businessStore.currentChatId, msg._id, { feedback: 'none' })
      msg.feedback = 'none'
      message.success('已取消反馈')
    } catch (error: any) {
      message.error('取消反馈失败：' + error.message)
    }
    return
  }

  if (type === 'like') {
    try {
      await updateMessageFeedback(businessStore.currentChatId, msg._id, { feedback: 'like' })
      msg.feedback = 'like'
      message.success('感谢您的反馈！')
    } catch (error: any) {
      message.error('反馈失败：' + error.message)
    }
  } else if (type === 'dislike') {
    const reasonOptions = [
      { label: '答非所问', value: '答非所问' },
      { label: '信息过时', value: '信息过时' },
      { label: '胡编乱造', value: '胡编乱造' },
      { label: '其他原因', value: '其他' }
    ]
    
    let selectedReason = ref('答非所问')
    let customReason = ref('')
    
    const d = dialog.create({
      title: '请告诉我们不满意的原因',
      content: () => {
        return h('div', { style: 'margin-top: 10px; min-width: 300px; display: flex; flex-direction: column; gap: 16px;' }, [
          h(
            NRadioGroup,
            {
              value: selectedReason.value,
              'onUpdate:value': (v: string) => { 
                selectedReason.value = v 
                d.content = d.content
              },
              name: 'reasonGroup'
            },
            () => h(NSpace, { vertical: true }, () =>
              reasonOptions.map(opt =>
                h(NRadio, { value: opt.value }, () => opt.label)
              )
            )
          ),
          selectedReason.value === '其他' ? h(
            NInputComp,
            {
              value: customReason.value,
              'onUpdate:value': (v: string) => { 
                customReason.value = v 
              },
              type: 'textarea',
              placeholder: '请输入具体原因...',
              rows: 3
            }
          ) : null
        ])
      },
      positiveText: '提交',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          const finalReason = selectedReason.value === '其他' ? (customReason.value || '其他原因') : selectedReason.value
          await updateMessageFeedback(businessStore.currentChatId!, msg._id, { 
            feedback: 'dislike', 
            feedbackReason: finalReason 
          })
          msg.feedback = 'dislike'
          message.success('感谢您的反馈，我们将持续优化！')
        } catch (error: any) {
          message.error('反馈失败：' + error.message)
        }
      }
    })
  }
}

</script>

<template>
  <LayoutCenterPanel
    :loading="loading"
  >
    <template #sidebar>
      <NavSideBar />
    </template>

    <!-- 内容区域 -->
    <div
      flex="~ col"
      h-full
    >
      <div
        flex="~ justify-between items-center"
      >
        <NavigationNavBar>
          <template #right>
            <div
              flex="~ justify-center items-center wrap"
              class="text-16 line-height-16"
            >
              <span class="lt-xs:hidden">当前模型：</span>
              <div
                flex="~ justify-center items-center"
              >
                <n-select
                  v-model:value="businessStore.systemModelName"
                  class="w-280 lt-xs:w-260 pr-10 font-italic font-bold"
                  placeholder="请选择模型"
                  :disabled="stylizingLoading"
                  :options="modelListSelections"
                />

                <CustomTooltip
                  :disabled="false"
                >
                  <div>💡 系统说明：</div>
                  <div
                    v-if="businessStore.backendConnected"
                    class="mt-5"
                  >
                    ✅ 后端服务：已连接
                  </div>
                  <div
                    v-else
                    class="mt-5"
                  >
                    ❌ 后端服务：未连接（需要启动）
                  </div>
                  <div class="mt-5">
                    <strong>架构说明</strong>：所有请求统一由后端处理
                  </div>
                  <div>
                    API Key 配置在后端 .env 文件中
                  </div>
                  <template #trigger>
                    <span
                      class="cursor-help font-bold c-primary text-17 i-ic:sharp-help"
                      ml-10
                      mr-24
                    ></span>
                  </template>
                </CustomTooltip>
              </div>
            </div>
          </template>
        </NavigationNavBar>
      </div>

      <div
        ref="messageListRef"
        flex="1 ~ col"
        min-h-0
        pb-20
        class="message-list-container"
      >
        <!-- 骨架屏加载状态 -->
        <div
          v-if="businessStore.chatLoading"
          class="px-4 py-2"
        >
          <div
            v-for="i in 2"
            :key="i"
            class="mb-8"
          >
            <!-- 用户消息骨架 -->
            <div class="flex flex-row-reverse items-start mb-6">
              <n-skeleton
                circle
                size="medium"
                class="ml-3 flex-shrink-0"
              />
              <n-skeleton
                height="40px"
                width="200px"
                :sharp="false"
                style="border-radius: 12px 0 12px 12px"
              />
            </div>
            <!-- AI消息骨架 -->
            <div class="flex items-start">
              <n-skeleton
                circle
                size="medium"
                class="mr-3 flex-shrink-0"
              />
              <div class="flex-1 space-y-2">
                <n-skeleton
                  text
                  :repeat="2"
                />
                <n-skeleton
                  text
                  style="width: 60%"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 历史消息渲染 -->
        <template v-if="!businessStore.chatLoading && businessStore.messageList.length > 0">
          <div
            v-for="(msg, index) in businessStore.messageList"
            :key="index"
            class="message-item"
            :class="msg.role"
          >
            <div class="message-avatar">
              <div
                v-if="msg.role === 'user'"
                class="i-carbon-user-avatar-filled-alt text-24 c-gray-500"
              ></div>
              <div
                v-else
                class="i-carbon-bot text-24 c-blue-500"
              ></div>
            </div>
            <div class="message-content">
              <!-- 如果是最后一条且是 assistant，且正在生成中，使用 MarkdownPreview 组件渲染流式效果 -->
              <template v-if="index === businessStore.messageList.length - 1 && msg.role === 'assistant' && stylizingLoading">
                <!-- RAG信息显示 (仅在生成时显示在顶部，或者你可以选择一直显示) -->
                <div
                  v-if="businessStore.backendConnected && (businessStore.currentCategory || businessStore.contextSources.length > 0)"
                  class="px-10 py-6 mb-5 bg-blue-50 dark:bg-blue-900/20 rounded-5 text-12"
                >
                  <n-space
                    vertical
                    :size="4"
                  >
                    <n-space
                      v-if="businessStore.currentCategory"
                      align="center"
                    >
                      <span class="c-#666 dark:c-#ccc">分类:</span>
                      <n-tag
                        type="info"
                        size="small"
                        :bordered="false"
                      >
                        {{ categoryMap[businessStore.currentCategory] || businessStore.currentCategory }}
                      </n-tag>
                    </n-space>
                    <n-space
                      v-if="businessStore.contextSources.length > 0"
                      align="center"
                    >
                      <span class="c-#666 dark:c-#ccc">来源:</span>
                      <n-tag
                        v-for="(source, idx) in businessStore.contextSources"
                        :key="idx"
                        type="success"
                        size="small"
                        :bordered="false"
                      >
                        📚 {{ source }}
                      </n-tag>
                    </n-space>
                  </n-space>
                </div>

                <MarkdownPreview
                  ref="refReaderMarkdownPreview"
                  v-model:reader="outputTextReader"
                  :model="businessStore.currentModelItem?.modelName"
                  :transform-stream-fn="businessStore.currentTransformFn"
                  @failed="onFailedReader"
                  @completed="onCompletedReader"
                />
              </template>
              <!-- 否则渲染静态内容 (历史记录) -->
              <template v-else>
                <div
                  class="markdown-wrapper"
                  v-html="renderMarkdownText(msg.content)"
                ></div>
                <!-- 反馈按钮区 -->
                <div v-if="msg.role === 'assistant'" class="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <n-button 
                    size="tiny" 
                    quaternary 
                    :type="msg.feedback === 'like' ? 'primary' : 'default'"
                    @click="handleFeedback(msg, 'like')"
                  >
                    <template #icon>
                      <div :class="msg.feedback === 'like' ? 'i-carbon-thumbs-up-filled' : 'i-carbon-thumbs-up'"></div>
                    </template>
                  </n-button>
                  <n-button 
                    size="tiny" 
                    quaternary 
                    :type="msg.feedback === 'dislike' ? 'error' : 'default'"
                    @click="handleFeedback(msg, 'dislike')"
                  >
                    <template #icon>
                      <div :class="msg.feedback === 'dislike' ? 'i-carbon-thumbs-down-filled' : 'i-carbon-thumbs-down'"></div>
                    </template>
                  </n-button>
                </div>
              </template>
            </div>
          </div>
        </template>

        <!-- 欢迎页/空状态 -->
        <div
          v-if="businessStore.messageList.length === 0 && !businessStore.chatLoading"
          class="flex flex-col items-center justify-center h-full text-gray-400"
        >
          <div class="i-carbon-chat text-64 mb-4"></div>
          <div>问一个问题，我才会消失 ~</div>
        </div>

        <!-- 后端未连接警告 -->
        <div
          v-if="!businessStore.backendConnected"
          class="px-20 py-10 mb-10 mx-14 bg-red-50 dark:bg-red-900/20 rounded-10"
        >
          <n-space align="center">
            <span class="text-16 i-ic:round-error c-red-500"></span>
            <span class="text-12 c-#666 dark:c-#ccc">
              ⚠️ 后端服务未连接，无法使用。请启动后端服务：<code class="px-5 bg-gray-200">cd backend && npm run dev</code>
            </span>
          </n-space>
        </div>
      </div>

      <div
        flex="~ col items-center"
        flex-basis="10%"
        p="14px"
        py="0"
      >
        <div
          w-full
          flex="~ justify-start"
          class="px-1em pb-10"
        >
          <n-space>
            <PromptTag
              v-for="(textItem, idx) in promptTextList"
              :key="idx"
              :text="textItem"
            />
          </n-space>
        </div>
        <div
          relative
          flex="1"
          w-full
          px-1em
        >
          <n-input
            ref="refInputTextString"
            v-model:value="inputTextString"
            type="textarea"
            autofocus
            h-full
            class="textarea-resize-none text-15"
            :style="{
              '--n-border-radius': '20px',
              '--n-padding-left': '20px',
              '--n-padding-right': '20px',
              '--n-padding-vertical': '10px',
            }"
            :placeholder="placeholder"
          />
          <n-float-button
            position="absolute"
            :right="40"
            bottom="50%"
            :type="stylizingLoading || inputTextString.trim() ? 'primary' : 'default'"
            color
            :class="[
              stylizingLoading && 'opacity-90',
              'translate-y-50%'
            ]"
            @click.stop="handleCreateStylized()"
          >
            <div
              v-if="stylizingLoading"
              class="i-svg-spinners:pulse-2 c-#fff"
            ></div>
            <div
              v-else
              class="transform-rotate-z--90 text-22 i-hugeicons:start-up-02"
              :class="inputTextString.trim() ? 'c-#fff' : 'c-#303133/70'"
            ></div>
          </n-float-button>
        </div>
      </div>
    </div>
  </LayoutCenterPanel>
</template>

<style lang="scss" scoped>
.message-list-container {
  overflow-y: auto;
  padding: 20px;
}

.message-item {
  display: flex;
  margin-bottom: 24px;

  &.user {
    flex-direction: row-reverse;

    .message-content {
      background-color: #e6f7ff;
      border-radius: 12px 0 12px 12px;
      margin-right: 12px;
    }

    .message-avatar {
      margin-left: 0;
    }
  }

  &.assistant {
    .message-content {
      background-color: #f9f9f9;
      border-radius: 0 12px 12px 12px;
      margin-left: 12px;
      width: 100%; // 让 Markdown 预览占满剩余空间
    }
  }
}

.message-avatar {
  flex-shrink: 0;
  margin-top: 4px;
}

.message-content {
  padding: 12px 16px;
  max-width: 85%;
  font-size: 15px;
  line-height: 1.6;
  color: #333;
  overflow-wrap: break-word;
}

.static-message-content {
  white-space: pre-wrap;
}
</style>
