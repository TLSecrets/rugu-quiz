import * as XLSX from 'xlsx'
import type { Bank, Question } from '@/types/question'
import { QUESTION_TYPE_LABELS } from '@/types/question'

function optionContent(q: Question, key: string): string {
  return q.options?.find((o) => o.key === key)?.content ?? ''
}

function answerToCell(q: Question): string {
  if (q.type === 'blank' || q.type === 'short') {
    return (q.answer.texts ?? []).join('|')
  }
  if (q.type === 'judge') {
    const key = q.answer.optionKeys?.[0]
    return key === 'false' ? '错误' : '正确'
  }
  return (q.answer.optionKeys ?? [])
    .map((k) => k.toUpperCase())
    .join(',')
}

function mediaToCell(q: Question): string {
  const parts: string[] = []
  for (const m of q.media ?? []) {
    if (m.src) parts.push(m.src)
  }
  for (const m of q.answer.media ?? []) {
    if (m.src) parts.push(`答案:${m.src}`)
  }
  return parts.join(';')
}

export function questionsToRows(questions: Question[]): Record<string, string>[] {
  return questions.map((q) => ({
    题型: QUESTION_TYPE_LABELS[q.type],
    题干: q.stem,
    选项A: optionContent(q, q.type === 'judge' ? 'true' : 'a'),
    选项B: optionContent(q, q.type === 'judge' ? 'false' : 'b'),
    选项C: optionContent(q, 'c'),
    选项D: optionContent(q, 'd'),
    选项E: optionContent(q, 'e'),
    选项F: optionContent(q, 'f'),
    选项G: optionContent(q, 'g'),
    选项H: optionContent(q, 'h'),
    答案: answerToCell(q),
    解析: q.answer.explanation ?? '',
    图片: mediaToCell(q),
    标签: (q.tags ?? []).join(','),
    领域: q.domain ?? '',
  }))
}

export function exportBankAsJson(bank: Bank, questions: Question[]): Blob {
  const payload = {
    name: bank.name,
    description: bank.description ?? '',
    exportedAt: new Date().toISOString(),
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      stem: q.stem,
      media: q.media,
      options: q.options,
      answer: q.answer,
      tags: q.tags,
      domain: q.domain,
    })),
  }
  return new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
}

export function exportBankAsXlsx(_bank: Bank, questions: Question[]): Blob {
  const rows = questionsToRows(questions)
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, '题库')
  const out = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || '题库'
}
