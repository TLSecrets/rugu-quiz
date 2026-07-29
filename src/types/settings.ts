import type { QuestionType } from './question'
import type { BankTagMatchMode } from '@/lib/bankTags'

export type ThemeMode = 'light' | 'dark' | 'system'

/** 提交后是否立即揭示解析 */
export type ShowAnswerMode = 'instant' | 'manual'

export type { BankTagMatchMode }

export interface AppSettings {
  theme: ThemeMode
  shuffleOptions: boolean
  /** 练习时默认启用的题型；空数组表示全部 */
  enabledTypes: QuestionType[]
  /** 填空判题是否宽松（去空格、大小写） */
  blankLooseMatch: boolean
  /** 答题后自动下一题延迟（秒）；0 表示立即。Phase B 起生效 */
  autoNextDelay: number
  /** 是否默认开启答后自动下一题。Phase B 起生效 */
  autoNextEnabled: boolean
  /** 答案展示：即时 / 手动确认。Phase B 起生效 */
  showAnswerMode: ShowAnswerMode
  /** 全局阅读字号（px）。Phase E 起 UI 可调 */
  fontSize: number
  /** 多标签筛选题库：或 / 与；默认或 */
  bankTagMatchMode: BankTagMatchMode
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
  autoNextDelay: 0,
  autoNextEnabled: false,
  showAnswerMode: 'instant',
  fontSize: 17,
  bankTagMatchMode: 'or',
  deepseek: {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
}

export const FONT_SIZE_MIN = 14
export const FONT_SIZE_MAX = 24

