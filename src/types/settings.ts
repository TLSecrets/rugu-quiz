import type { QuestionType } from './question'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface AppSettings {
  theme: ThemeMode
  shuffleOptions: boolean
  /** 练习时默认启用的题型；空数组表示全部 */
  enabledTypes: QuestionType[]
  /** 填空判题是否宽松（去空格、大小写） */
  blankLooseMatch: boolean
  deepseek: {
    apiKey: string
    baseUrl: string
    model: string
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  shuffleOptions: true,
  enabledTypes: [],
  blankLooseMatch: true,
  deepseek: {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
}
