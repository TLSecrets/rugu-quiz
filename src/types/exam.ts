import type { QuestionType } from '@/types/question'
import type { GradeVerdict, UserAnswer } from '@/lib/grade'

export type ExamPhase = 'compose' | 'taking' | 'result'

export interface TypeSlotConfig {
  enabled: boolean
  score: number
  count: number
}

/** 试卷中的一题 */
export interface ExamItem {
  questionId: string
  bankId: string
  type: QuestionType
  score: number
}

export interface ExamItemResult {
  verdict: GradeVerdict
  earned: number
  message: string
}

export function emptyTypeSlots(defaults?: Partial<TypeSlotConfig>): Record<QuestionType, TypeSlotConfig> {
  const base: TypeSlotConfig = {
    enabled: false,
    score: defaults?.score ?? 2,
    count: defaults?.count ?? 1,
  }
  return {
    single: { ...base },
    multiple: { ...base },
    judge: { ...base },
    blank: { ...base },
    short: { ...base, score: defaults?.score ?? 5 },
  }
}

export function emptyUserAnswer(type: QuestionType, blankLen = 1): UserAnswer {
  if (type === 'blank') {
    return { optionKeys: [], texts: Array.from({ length: Math.max(blankLen, 1) }, () => '') }
  }
  if (type === 'short') return { optionKeys: [], texts: [''] }
  return { optionKeys: [], texts: [] }
}
