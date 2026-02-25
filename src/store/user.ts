import { defineStore } from 'pinia'
import { type AuthResponse, getUserInfo, login, register, registerAdmin } from '@/api'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userInfo: JSON.parse(localStorage.getItem('userInfo') || 'null') as AuthResponse | null
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.userInfo?.role === 'admin'
  },
  actions: {
    setToken(token: string) {
      this.token = token
      localStorage.setItem('token', token)
    },
    setUserInfo(user: AuthResponse) {
      this.userInfo = user
      localStorage.setItem('userInfo', JSON.stringify(user))
    },
    async login(loginForm: any) {
      const res: any = await login(loginForm)
      if (res && res.token) {
        this.setToken(res.token)
        this.setUserInfo(res)
        return res
      }
    },
    async register(registerForm: any) {
      const res: any = await register(registerForm)
      if (res && res.token) {
        this.setToken(res.token)
        this.setUserInfo(res)
        return res
      }
    },
    async registerAdmin(registerForm: any) {
      const res: any = await registerAdmin(registerForm)
      if (res && res.token) {
        this.setToken(res.token)
        this.setUserInfo(res)
        return res
      }
    },
    logout() {
      this.token = ''
      this.userInfo = null
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      // 刷新页面或跳转到登录页
      window.location.href = '/login'
    }
  }
})


