<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { type ChatDetail, type ChatSession, createChat, deleteChat, getHistoryList } from '@/api'
import { useDialog, useMessage } from 'naive-ui'
import { useBusinessStore } from '@/store/business'

import { storeToRefs } from 'pinia'

const router = useRouter()
const userStore = useUserStore()
const businessStore = useBusinessStore()
const { currentChatId, historyList } = storeToRefs(businessStore)
const message = useMessage()
const dialog = useDialog()

const showUploadModal = ref(false)
const uploadLoading = ref(false)

// 获取历史记录
const fetchHistory = async () => {
  await businessStore.loadHistoryList()
}

// 新建对话
const handleNewChat = async () => {
  try {
    const res = await createChat() as unknown as ChatDetail
    if (res) {
      // 重新拉取列表
      await businessStore.loadHistoryList()
      // 选中新对话
      businessStore.currentChatId = res._id
    }
  } catch (error) {
    message.error('创建新对话失败')
  }
}

// 切换对话
const handleSelectChat = (chatId: string) => {
  console.log('Switching chat to:', chatId)
  businessStore.currentChatId = chatId
}

// 删除对话
const handleDeleteChat = (chatId: string, event: Event) => {
  event.stopPropagation()
  dialog.warning({
    title: '确认删除',
    content: '确定要删除这条对话记录吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        if (chatId.startsWith('mock-')) {
          historyList.value = historyList.value.filter(item => item._id !== chatId)
          message.success('删除成功')
          return
        }
        await deleteChat(chatId)
        message.success('删除成功')
        // 从列表中移除
        historyList.value = historyList.value.filter(item => item._id !== chatId)
        // 如果删除的是当前选中的对话，重置
        if (currentChatId.value === chatId) {
          businessStore.currentChatId = null
        }
      } catch (error) {
        message.error('删除失败')
      }
    }
  })
}

// 退出登录
const handleLogout = () => {
  dialog.info({
    title: '退出登录',
    content: '确定要退出登录吗？',
    positiveText: '退出',
    negativeText: '取消',
    onPositiveClick: () => {
      userStore.logout()
    }
  })
}

// 上传完成回调
const handleUploadFinish = ({ file, event }: { file: any
  event?: any; }) => {
  uploadLoading.value = false
  message.success('文件上传成功，后台正在处理...')
  showUploadModal.value = false
}

const handleUploadError = () => {
  uploadLoading.value = false
  message.error('上传失败')
}

const beforeUpload = () => {
  uploadLoading.value = true
  return true
}

onMounted(() => {
  if (userStore.isLoggedIn) {
    businessStore.loadHistoryList()
  }
})

</script>

<template>
  <aside class="navigation-nav-sidebar-container">
    <!-- 顶部操作区 -->
    <div class="sidebar-header">
      <n-button
        type="primary"
        block
        dashed
        @click="handleNewChat"
      >
        <template #icon>
          <div class="i-carbon-add"></div>
        </template>
        新建对话
      </n-button>
    </div>

    <!-- 历史记录列表 -->
    <div class="history-list">
      <div
        v-for="item in historyList"
        :key="item._id"
        class="history-item"
        :class="{ active: currentChatId === item._id }"
        @click="handleSelectChat(item._id)"
      >
        <div
          class="history-title"
          :title="item.title"
        >
          <div
            class="i-carbon-chat"
            style="margin-right: 8px; flex-shrink: 0;"
          ></div>
          <span class="text-truncate">{{ item.title }}</span>
        </div>
        <div
          class="delete-btn"
          @click="(e) => handleDeleteChat(item._id, e)"
        >
          <div class="i-carbon-trash-can"></div>
        </div>
      </div>

      <div
        v-if="historyList.length === 0"
        class="empty-history"
      >
        暂无历史记录
      </div>
    </div>

    <!-- 底部用户信息 -->
    <div class="user-profile">
      <div class="user-info">
        <div class="avatar">
          {{ userStore.userInfo?.username.charAt(0).toUpperCase() }}
        </div>
        <div class="info-content">
          <div
            class="username text-truncate"
            :title="userStore.userInfo?.username"
          >
            {{ userStore.userInfo?.username }}
          </div>
          <div
            class="role-badge"
            :class="{ admin: userStore.isAdmin }"
          >
            {{ userStore.isAdmin ? '管理员' : '普通用户' }}
          </div>
        </div>
      </div>

      <!-- 管理员专属功能入口 -->
      <div
        v-if="userStore.isAdmin"
        class="admin-actions"
      >
        <n-button
          size="small"
          type="info"
          ghost
          block
          @click="showUploadModal = true"
        >
          <template #icon>
            <div class="i-carbon-upload"></div>
          </template>
          上传知识库
        </n-button>
      </div>

      <n-button
        size="small"
        type="error"
        ghost
        block
        style="margin-top: 8px;"
        @click="handleLogout"
      >
        <template #icon>
          <div class="i-carbon-logout"></div>
        </template>
        退出登录
      </n-button>
    </div>

    <!-- 上传模态框 -->
    <n-modal v-model:show="showUploadModal">
      <n-card
        title="上传知识库文档"
        style="width: 500px"
        :bordered="false"
        size="huge"
        role="dialog"
        aria-modal="true"
      >
        <n-upload
          multiple
          directory-dnd
          action="/api/knowledge/upload"
          :headers="{ Authorization: `Bearer ${userStore.token}` }"
          @finish="handleUploadFinish"
          @error="handleUploadError"
          @before-upload="beforeUpload"
        >
          <n-upload-dragger>
            <div style="margin-bottom: 12px">
              <div
                class="i-carbon-cloud-upload"
                style="font-size: 48px; color: #18a058;"
              ></div>
            </div>
            <n-text style="font-size: 16px">
              点击或者拖动文件到该区域来上传
            </n-text>
            <n-p
              depth="3"
              style="margin-top: 8px"
            >
              支持 PDF, DOCX, TXT, MD 等格式
            </n-p>
          </n-upload-dragger>
        </n-upload>
      </n-card>
    </n-modal>
  </aside>
</template>

<style lang="scss" scoped>
.navigation-nav-sidebar-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: #f9f9f9;
  border-right: 1px solid #eee;
}

.sidebar-header {
  padding: 15px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #333;
  font-size: 14px;

  &:hover {
    background-color: #e6f7ff;

    .delete-btn {
      opacity: 1;
    }
  }

  &.active {
    background-color: #e6f7ff;
    color: #1890ff;
    font-weight: 500;
  }
}

.history-title {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;

  .text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.delete-btn {
  opacity: 0;
  color: #ff4d4f;
  padding: 4px;
  border-radius: 4px;
  transition: opacity 0.2s;

  &:hover {
    background-color: rgba(255, 77, 79, 0.1);
  }
}

.empty-history {
  text-align: center;
  color: #999;
  margin-top: 40px;
  font-size: 13px;
}

.user-profile {
  padding: 15px;
  border-top: 1px solid #eee;
  background: #fff;
}

.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.avatar {
  width: 36px;
  height: 36px;
  background-color: #1890ff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
  margin-right: 10px;
}

.info-content {
  flex: 1;
  overflow: hidden;
}

.username {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 2px;
}

.role-badge {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: #f0f0f0;
  color: #666;

  &.admin {
    background-color: #f6ffed;
    color: #52c41a;
    border: 1px solid #b7eb8f;
  }
}

.admin-actions {
  margin-bottom: 8px;
}
</style>
