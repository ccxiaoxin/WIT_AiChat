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
    <div class="login-box">
      <h2>{{ isRegister ? (isAdminReg ? '管理员注册' : '用户注册') : '用户登录' }}</h2>

      <n-form
        ref="formRef"
        :model="formModel"
        :rules="rules"
      >
        <n-form-item
          path="username"
          label="用户名"
        >
          <n-input
            v-model:value="formModel.username"
            placeholder="请输入用户名"
          />
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
          />
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
          />
        </n-form-item>

        <div class="actions">
          <n-button
            type="primary"
            block
            :loading="loading"
            @click="handleSubmit"
          >
            {{ isRegister ? '注册' : '登录' }}
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
  background-color: #f0f2f5;
}

.login-box {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

h2 {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
}

.actions {
  margin-top: 20px;
}

.links {
  margin-top: 15px;
  display: flex;
  justify-content: space-between;
}
</style>

