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
          @click="$router.push('/chat/knowledge')"
        >
          <template #icon>
            <div class="i-carbon-settings"></div>
          </template>
          管理知识库
        </n-button>
        <n-button
          size="small"
          type="success"
          ghost
          block
          style="margin-top: 8px;"
          @click="$router.push('/chat/stats')"
        >
          <template #icon>
            <div class="i-carbon-chart-pie"></div>
          </template>
          数据统计
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
  </aside>
</template>

<style lang="scss" scoped>
.navigation-nav-sidebar-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #1a1c2e 0%, #2d3250 100%);
  border-right: none;
}

.sidebar-header {
  padding: 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  :deep(.n-button) {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 12px;
    height: 44px;
    font-weight: 500;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
  }
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
}

.delete-btn {
  opacity: 0;
  color: #ff6b6b;
  padding: 6px;
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    background-color: rgba(255, 107, 107, 0.15);
  }
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  margin-bottom: 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.1);

    .delete-btn {
      opacity: 1;
    }
  }

  &.active {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
    color: #fff;
    font-weight: 500;
    border-color: rgba(102, 126, 234, 0.5);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
  }
}

.history-title {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;

  .i-carbon-chat {
    color: rgba(255, 255, 255, 0.5);
  }

  .text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.empty-history {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 60px;
  font-size: 13px;
}

.user-profile {
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
}

.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.avatar {
  width: 42px;
  height: 42px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 18px;
  margin-right: 12px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.info-content {
  flex: 1;
  overflow: hidden;
}

.username {
  font-weight: 600;
  font-size: 14px;
  color: #fff;
  margin-bottom: 4px;
}

.role-badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);

  &.admin {
    background: linear-gradient(135deg, rgba(82, 196, 26, 0.2) 0%, rgba(115, 209, 61, 0.2) 100%);
    color: #73d13d;
    border: 1px solid rgba(115, 209, 61, 0.3);
  }
}

.admin-actions {
  margin-bottom: 10px;

  :deep(.n-button) {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    border-radius: 10px;
    transition: all 0.3s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
      color: #fff;
    }

    &.n-button--info-type {
      &:hover {
        background: rgba(102, 126, 234, 0.2);
        border-color: rgba(102, 126, 234, 0.4);
        color: #667eea;
      }
    }

    &.n-button--success-type {
      &:hover {
        background: rgba(82, 196, 26, 0.2);
        border-color: rgba(82, 196, 26, 0.4);
        color: #52c41a;
      }
    }

    &.n-button--error-type {
      &:hover {
        background: rgba(255, 77, 79, 0.2);
        border-color: rgba(255, 77, 79, 0.4);
        color: #ff4d4f;
      }
    }
  }
}
</style>
