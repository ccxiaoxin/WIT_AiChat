const LayoutDefault = () => import('@/components/Layout/default.vue')

const childrenRoutes: Array<RouteRecordRaw> = [
  {
    path: '/chat',
    component: LayoutDefault,
    name: 'ChatRoot',
    redirect: {
      name: 'ChatIndex'
    },
    children: [
      {
        path: '',
        name: 'ChatIndex',
        component: () => import('@/views/chat.vue')
      },
      {
        path: 'knowledge',
        name: 'KnowledgeManage',
        component: () => import('@/views/knowledge.vue'),
        meta: {
          title: '知识库管理',
          requiresAdmin: true
        }
      },
      {
        path: 'stats',
        name: 'DataStats',
        component: () => import('@/views/stats.vue'),
        meta: {
          title: '数据统计',
          requiresAdmin: true
        }
      }
    ]
  }
]

export default childrenRoutes
