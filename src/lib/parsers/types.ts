import type { Question, QuestionType } from '@/types/question'

export interface ParseIssue {
  row?: number
  message: string
}

export interface ParseResult {
  bankName: string
  description?: string
  questions: Question[]
  issues: ParseIssue[]
}

export interface RawRow {
  rowNum: number
  题型?: string
  题干?: string
  选项A?: string
  选项B?: string
  选项C?: string
  选项D?: string
  选项E?: string
  选项F?: string
  答案?: string
  解析?: string
  图片?: string
  标签?: string
  [key: string]: string | number | undefined
}

export const TYPE_ALIASES: Record<string, QuestionType> = {
  单选: 'single',
  单选题: 'single',
  single: 'single',
  多选: 'multiple',
  多选题: 'multiple',
  multiple: 'multiple',
  判断: 'judge',
  判断题: 'judge',
  judge: 'judge',
  填空: 'blank',
  填空题: 'blank',
  blank: 'blank',
  简答: 'short',
  简答题: 'short',
  short: 'short',
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
