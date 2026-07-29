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
  /** 领域分类，用于筛选与组卷；与 tags 并存 */
  domain?: string
  tags?: string[]
  sourceMeta?: {
    fileName?: string
    sheet?: string
    row?: number
    /** 题型由规则自动推断 */
    inferredType?: boolean
    /** 解析存疑，预览中高亮 */
    uncertain?: boolean
  }
}

/** 持久错题记录（答错/半对写入；手动移除后再次答错会重新激活） */
export interface WrongRecord {
  /** 主键：题目 id */
  questionId: string
  bankId: string
  wrongCount: number
  lastWrongAt: number
  /** 用户手动移出错题本 */
  removed: boolean
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
  /** 题库级标签/分类，如学年「2025-2026」 */
  tags?: string[]
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
