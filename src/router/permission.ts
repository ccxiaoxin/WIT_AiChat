import type { Router } from 'vue-router'
import { useUserStore } from '@/store/user'

export function createRouterGuards(router: Router) {
  router.beforeEach((to, from, next) => {
    const userStore = useUserStore()

    // 如果是去登录页
    if (to.path === '/login') {
      // 如果已登录，跳转到首页
      if (userStore.isLoggedIn) {
        next('/')
      } else {
        // 否则放行
        next()
      }
    } else {
      // 如果去其他页面
      // 如果已登录，放行
      if (userStore.isLoggedIn) {
        next()
      } else {
        // 否则跳转到登录页，并记录原目标路径以便登录后跳转回来（可选优化）
        next('/login')
      }
    }
  })
}
