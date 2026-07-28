import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '首页', nav: 'home' },
    },
    {
      path: '/banks',
      name: 'banks',
      component: () => import('@/views/BankListView.vue'),
      meta: { title: '题库', nav: 'banks' },
    },
    {
      path: '/practice',
      name: 'practice',
      component: () => import('@/views/PracticeView.vue'),
      meta: { title: '练习', nav: 'practice' },
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('@/views/SearchView.vue'),
      meta: { title: '搜索', nav: 'search' },
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: () => import('@/views/FavoritesView.vue'),
      meta: { title: '收藏', nav: 'favorites' },
    },
    {
      path: '/notes',
      name: 'notes',
      component: () => import('@/views/NotesView.vue'),
      meta: { title: '笔记', nav: 'notes' },
    },
    {
      path: '/import-export',
      name: 'import-export',
      component: () => import('@/views/ImportExportView.vue'),
      meta: { title: '导入导出', nav: 'import-export' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '设置', nav: 'settings' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '未找到', nav: null },
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? '如故题库'
  document.title = title === '首页' ? '如故题库' : `${title} · 如故题库`
})

export default router
