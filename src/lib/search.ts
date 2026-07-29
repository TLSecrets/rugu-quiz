import type { Question } from '@/types/question'
import { stripRichText } from '@/lib/richtext'

export interface SearchHit {
  question: Question
  bankId: string
  bankName: string
  /** 命中字段摘要 */
  snippet: string
  field: 'stem' | 'option' | 'explanation' | 'tag'
}

function haystacks(q: Question): Array<{ field: SearchHit['field']; text: string }> {
  const list: Array<{ field: SearchHit['field']; text: string }> = [
    { field: 'stem', text: stripRichText(q.stem) },
  ]
  for (const opt of q.options ?? []) {
    list.push({ field: 'option', text: `${opt.label}. ${stripRichText(opt.content)}` })
  }
  if (q.answer.explanation) {
    list.push({ field: 'explanation', text: stripRichText(q.answer.explanation) })
  }
  for (const tag of q.tags ?? []) {
    list.push({ field: 'tag', text: tag })
  }
  if (q.domain) {
    list.push({ field: 'tag', text: q.domain })
  }
  for (const t of q.answer.texts ?? []) {
    list.push({ field: 'explanation', text: stripRichText(t) })
  }
  return list
}

export function searchQuestions(
  questions: Question[],
  bankNameOf: (bankId: string) => string,
  keyword: string,
  options?: { domain?: string; limit?: number },
): SearchHit[] {
  const q = keyword.trim().toLowerCase()
  const domain = options?.domain?.trim()
  const limit = options?.limit ?? 50
  if (!q && !domain) return []

  const hits: SearchHit[] = []
  for (const question of questions) {
    if (domain && question.domain !== domain) continue
    if (!q) {
      hits.push({
        question,
        bankId: question.bankId,
        bankName: bankNameOf(question.bankId),
        snippet: question.domain || '',
        field: 'tag',
      })
      if (hits.length >= limit) break
      continue
    }
    for (const part of haystacks(question)) {
      if (!part.text.toLowerCase().includes(q)) continue
      hits.push({
        question,
        bankId: question.bankId,
        bankName: bankNameOf(question.bankId),
        snippet: part.text,
        field: part.field,
      })
      break
    }
    if (hits.length >= limit) break
  }
  return hits
}

const FIELD_LABEL: Record<SearchHit['field'], string> = {
  stem: '题干',
  option: '选项',
  explanation: '解析/答案',
  tag: '标签',
}

export function fieldLabel(field: SearchHit['field']): string {
  return FIELD_LABEL[field]
}

/** 将纯文本按关键词拆成片段，供高亮渲染（大小写不敏感） */
export function splitHighlight(text: string, keyword: string): Array<{ text: string; hit: boolean }> {
  const q = keyword.trim()
  if (!q) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  const parts: Array<{ text: string; hit: boolean }> = []
  let start = 0
  let idx = lower.indexOf(needle, start)
  while (idx !== -1) {
    if (idx > start) parts.push({ text: text.slice(start, idx), hit: false })
    parts.push({ text: text.slice(idx, idx + q.length), hit: true })
    start = idx + needle.length
    idx = lower.indexOf(needle, start)
  }
  if (start < text.length) parts.push({ text: text.slice(start), hit: false })
  return parts.length ? parts : [{ text, hit: false }]
}
