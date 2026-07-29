export interface NavItem {
  key: string
  label: string
  to: string
  /** 底部 Tab 是否显示 */
  mobile: boolean
}

export const primaryNav: NavItem[] = [
  { key: 'home', label: '首页', to: '/', mobile: true },
  { key: 'banks', label: '题库', to: '/banks', mobile: true },
  { key: 'practice', label: '练习', to: '/practice', mobile: true },
  { key: 'exam', label: '考试', to: '/exam', mobile: false },
  { key: 'wrong', label: '错题', to: '/wrong', mobile: true },
  { key: 'search', label: '搜索', to: '/search', mobile: false },
  { key: 'favorites', label: '收藏', to: '/favorites', mobile: true },
  { key: 'notes', label: '笔记', to: '/notes', mobile: false },
  { key: 'import-export', label: '导入导出', to: '/import-export', mobile: false },
  { key: 'guide', label: '手册', to: '/guide', mobile: false },
  { key: 'settings', label: '设置', to: '/settings', mobile: false },
]

export const mobileTabNav = primaryNav.filter((item) => item.mobile)
