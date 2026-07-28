export type QuestionType = 'single' | 'multiple' | 'judge' | 'blank' | 'short'

export type MediaPlacement =
  | 'inline'
  | 'after-stem'
  | 'after-options'
  | 'in-answer'
  | 'unknown'

export interface QuestionMedia {
  id: string
  mime: string
  /** blob URL / public path / data URL */
  src: string
  placement: MediaPlacement
  /** 可选：插在题干第 N 段后、或 optionId 后 */
  anchor?: string
  alt?: string
}

export interface QuestionOption {
  id: string
  label: string
  content: string
  media?: QuestionMedia[]
  /** 稳定键，乱序不改，用于对答案 */
  key: string
}

export interface QuestionAnswer {
  optionKeys?: string[]
  texts?: string[]
  explanation?: string
  media?: QuestionMedia[]
}

export interface Question {
  id: string
  bankId: string
  type: QuestionType
  stem: string
  media: QuestionMedia[]
  options?: QuestionOption[]
  answer: QuestionAnswer
  tags?: string[]
  sourceMeta?: { fileName?: string; sheet?: string; row?: number }
}

export type BankSource = 'builtin' | 'import' | 'generated'

export interface Bank {
  id: string
  name: string
  description?: string
  source: BankSource
  questionCount: number
  createdAt: number
  updatedAt: number
}

export interface FavoriteRecord {
  id?: number
  questionId: string
  bankId: string
  createdAt: number
}

export interface NoteRecord {
  id?: number
  questionId: string
  bankId: string
  content: string
  updatedAt: number
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选',
  multiple: '多选',
  judge: '判断',
  blank: '填空',
  short: '简答',
}

export const ALL_QUESTION_TYPES: QuestionType[] = [
  'single',
  'multiple',
  'judge',
  'blank',
  'short',
]
