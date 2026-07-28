import type { Question } from '@/types/question'

export type GradeVerdict = 'correct' | 'wrong' | 'partial' | 'ungraded'

export interface UserAnswer {
  /** 选择题 / 判断：选中的 option.key */
  optionKeys: string[]
  /** 填空：按空顺序；简答：单段文本 */
  texts: string[]
}

export interface GradeResult {
  verdict: GradeVerdict
  /** 供 UI 展示的提示 */
  message: string
}

function normalizeBlank(text: string, loose: boolean): string {
  const trimmed = text.trim()
  if (!loose) return trimmed
  return trimmed.replace(/\s+/g, '').toLowerCase()
}

function sameKeySet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((k) => set.has(k))
}

/** 客观题自动判分；简答返回 ungraded，由用户自评 */
export function gradeQuestion(
  question: Question,
  answer: UserAnswer,
  options: { blankLooseMatch: boolean },
): GradeResult {
  switch (question.type) {
    case 'single':
    case 'judge': {
      const expected = question.answer.optionKeys ?? []
      const selected = answer.optionKeys
      if (!selected.length) {
        return { verdict: 'wrong', message: '未作答' }
      }
      const ok = sameKeySet(expected, selected)
      return {
        verdict: ok ? 'correct' : 'wrong',
        message: ok ? '回答正确' : '回答错误',
      }
    }
    case 'multiple': {
      const expected = question.answer.optionKeys ?? []
      const selected = answer.optionKeys
      if (!selected.length) {
        return { verdict: 'wrong', message: '未作答' }
      }
      const ok = sameKeySet(expected, selected)
      return {
        verdict: ok ? 'correct' : 'wrong',
        message: ok ? '全部选对' : '多选需与标准答案完全一致',
      }
    }
    case 'blank': {
      const expected = question.answer.texts ?? []
      if (!expected.length) {
        return { verdict: 'ungraded', message: '本题无标准填空答案' }
      }
      const blanks = Math.max(expected.length, 1)
      const filled = Array.from({ length: blanks }, (_, i) => answer.texts[i] ?? '')
      if (filled.every((t) => !t.trim())) {
        return { verdict: 'wrong', message: '未作答' }
      }
      let hit = 0
      for (let i = 0; i < expected.length; i++) {
        const a = normalizeBlank(filled[i] ?? '', options.blankLooseMatch)
        const b = normalizeBlank(expected[i] ?? '', options.blankLooseMatch)
        if (a && a === b) hit++
      }
      if (hit === expected.length) {
        return { verdict: 'correct', message: '填空全部正确' }
      }
      if (hit > 0) {
        return { verdict: 'partial', message: `部分正确（${hit}/${expected.length}）` }
      }
      return { verdict: 'wrong', message: '填空不正确' }
    }
    case 'short':
      return {
        verdict: 'ungraded',
        message: '请对照参考答案自评',
      }
    default:
      return { verdict: 'ungraded', message: '未知题型' }
  }
}

export function emptyAnswer(): UserAnswer {
  return { optionKeys: [], texts: [] }
}
