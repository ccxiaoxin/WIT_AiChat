import type { App } from 'vue'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { createRouterGuards } from '@/router/permission'
import routes from './routes'
import { isGithubDeployed } from '@/config'

const history = isGithubDeployed
  ? createWebHashHistory()
  : createWebHistory()

const router = createRouter({
  history,
  routes
})

export async function setupRouter(app: App) {
  app.use(router)
  createRouterGuards(router)
  await router.isReady()
}

export default router
