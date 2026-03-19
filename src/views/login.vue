<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { useMessage } from 'naive-ui'

const router = useRouter()
const userStore = useUserStore()
const message = useMessage()

const isRegister = ref(false)
const isAdminReg = ref(false)
const loading = ref(false)

const formModel = reactive({
  username: '',
  password: '',
  adminKey: ''
})

const rules = {
  username: {
    required: true,
    message: '请输入用户名',
    trigger: 'blur'
  },
  password: {
    required: true,
    message: '请输入密码',
    trigger: 'blur'
  },
  adminKey: {
    required: true,
    message: '请输入管理员密钥',
    trigger: 'blur'
  }
}

const toggleMode = () => {
  isRegister.value = !isRegister.value
  isAdminReg.value = false // 重置管理员注册状态
}

const toggleAdminReg = () => {
  isAdminReg.value = !isAdminReg.value
}

const handleSubmit = async () => {
  if (!formModel.username || !formModel.password) {
    message.error('请填写完整信息')
    return
  }

  if (isRegister.value && isAdminReg.value && !formModel.adminKey) {
    message.error('管理员注册需要密钥')
    return
  }

  loading.value = true
  try {
    if (isRegister.value) {
      if (isAdminReg.value) {
        await userStore.registerAdmin(formModel)
      } else {
        await userStore.register(formModel)
      }
      message.success('注册成功')
    } else {
      await userStore.login(formModel)
      message.success('登录成功')
    }
    router.push('/')
  } catch (error: any) {
    console.error(error)
    message.error(error.message || '操作失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <!-- 装饰元素 -->
    <div class="decoration-circle circle-1"></div>
    <div class="decoration-circle circle-2"></div>
    <div class="decoration-circle circle-3"></div>

    <div class="login-box">
      <!-- Logo区域 -->
      <div class="logo-section">
        <div class="logo-icon">
          <div class="i-carbon-chat-bot text-36"></div>
        </div>
        <h1 class="app-title">智能问答系统</h1>
      </div>

      <h2 class="form-title">{{ isRegister ? (isAdminReg ? '管理员注册' : '用户注册') : '欢迎回来' }}</h2>
      <p class="form-subtitle">{{ isRegister ? '创建您的账号开始使用' : '登录您的账号继续使用' }}</p>

      <n-form
        ref="formRef"
        :model="formModel"
        :rules="rules"
        class="login-form"
      >
        <n-form-item
          path="username"
          label="用户名"
        >
          <n-input
            v-model:value="formModel.username"
            placeholder="请输入用户名"
            size="large"
          >
            <template #prefix>
              <div class="i-carbon-user text-18 c-gray-400"></div>
            </template>
          </n-input>
        </n-form-item>

        <n-form-item
          path="password"
          label="密码"
        >
          <n-input
            v-model:value="formModel.password"
            type="password"
            show-password-on="click"
            placeholder="请输入密码"
            size="large"
          >
            <template #prefix>
              <div class="i-carbon-locked text-18 c-gray-400"></div>
            </template>
          </n-input>
        </n-form-item>

        <n-form-item
          v-if="isRegister && isAdminReg"
          path="adminKey"
          label="管理员密钥"
        >
          <n-input
            v-model:value="formModel.adminKey"
            type="password"
            placeholder="请输入管理员注册密钥"
            size="large"
          >
            <template #prefix>
              <div class="i-carbon-password text-18 c-gray-400"></div>
            </template>
          </n-input>
        </n-form-item>

        <div class="actions">
          <n-button
            type="primary"
            block
            size="large"
            :loading="loading"
            @click="handleSubmit"
          >
            {{ isRegister ? '立即注册' : '立即登录' }}
          </n-button>
        </div>

        <div class="links">
          <n-button
            text
            type="primary"
            @click="toggleMode"
          >
            {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
          </n-button>
          <n-button
            v-if="isRegister"
            text
            type="warning"
            style="margin-left: 10px"
            @click="toggleAdminReg"
          >
            {{ isAdminReg ? '普通用户注册' : '管理员注册' }}
          </n-button>
        </div>
      </n-form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #1a1c2e 0%, #2d3250 50%, #424769 100%);
  position: relative;
  overflow: hidden;
}

.decoration-circle {
  position: absolute;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
  filter: blur(40px);
  animation: float 6s ease-in-out infinite;
}

.circle-1 {
  width: 400px;
  height: 400px;
  top: -100px;
  left: -100px;
  animation-delay: 0s;
}

.circle-2 {
  width: 300px;
  height: 300px;
  bottom: -50px;
  right: -50px;
  animation-delay: 2s;
}

.circle-3 {
  width: 200px;
  height: 200px;
  top: 50%;
  right: 20%;
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-20px) scale(1.05);
  }
}

.login-box {
  width: 420px;
  padding: 48px 40px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 1;
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.logo-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-bottom: 16px;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}

.app-title {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.form-title {
  text-align: center;
  margin-bottom: 8px;
  color: #333;
  font-size: 24px;
  font-weight: 600;
}

.form-subtitle {
  text-align: center;
  color: #888;
  font-size: 14px;
  margin-bottom: 32px;
}

.login-form {
  :deep(.n-form-item-label) {
    font-weight: 500;
    color: #555;
  }

  :deep(.n-input) {
    border-radius: 12px;

    .n-input__input-el {
      height: 48px;
    }
  }

  :deep(.n-input--focus) {
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  }
}

.actions {
  margin-top: 28px;

  :deep(.n-button) {
    height: 48px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
  }
}

.links {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 16px;

  :deep(.n-button__content) {
    font-size: 14px;
  }
}
</style>

