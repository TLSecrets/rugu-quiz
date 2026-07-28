import type {
  Question,
  QuestionMedia,
  QuestionOption,
  QuestionType,
} from '@/types/question'
import {
  TYPE_ALIASES,
  createId,
  type ParseIssue,
  type ParseResult,
  type RawRow,
} from './types'

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const
const OPTION_HEADERS = ['选项A', '选项B', '选项C', '选项D', '选项E', '选项F'] as const

function cell(row: RawRow, key: string): string {
  const v = row[key]
  if (v == null) return ''
  return String(v).trim()
}

function parseType(raw: string, issues: ParseIssue[], rowNum: number): QuestionType | null {
  const key = raw.trim().toLowerCase()
  const mapped = TYPE_ALIASES[raw.trim()] ?? TYPE_ALIASES[key]
  if (!mapped) {
    issues.push({ row: rowNum, message: `无法识别题型「${raw}」` })
    return null
  }
  return mapped
}

function parseTags(raw: string): string[] | undefined {
  if (!raw.trim()) return undefined
  return raw
    .split(/[,，;；]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function parseMediaField(raw: string, questionId: string): {
  media: QuestionMedia[]
  answerMedia: QuestionMedia[]
} {
  const media: QuestionMedia[] = []
  const answerMedia: QuestionMedia[] = []
  if (!raw.trim()) return { media, answerMedia }

  const parts = raw
    .split(/[;；]/)
    .map((p) => p.trim())
    .filter(Boolean)

  parts.forEach((part, index) => {
    const isAnswer = /^答案[:：]/i.test(part)
    const src = part.replace(/^答案[:：]\s*/i, '').trim()
    if (!src) return
    const item: QuestionMedia = {
      id: `${questionId}-img-${index}`,
      mime: guessMime(src),
      src,
      placement: isAnswer ? 'in-answer' : 'unknown',
      alt: isAnswer ? '答案配图' : '题目配图',
    }
    if (isAnswer) answerMedia.push(item)
    else media.push(item)
  })

  return { media, answerMedia }
}

function guessMime(src: string): string {
  const lower = src.toLowerCase()
  if (lower.startsWith('data:image/')) {
    const m = /^data:([^;]+)/.exec(src)
    return m?.[1] ?? 'image/*'
  }
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  return 'image/*'
}

function buildOptions(row: RawRow, type: QuestionType): QuestionOption[] | undefined {
  if (type === 'blank' || type === 'short') return undefined

  if (type === 'judge') {
    const a = cell(row, '选项A') || '正确'
    const b = cell(row, '选项B') || '错误'
    return [
      { id: createId('opt'), key: 'true', label: 'A', content: a },
      { id: createId('opt'), key: 'false', label: 'B', content: b },
    ]
  }

  const options: QuestionOption[] = []
  OPTION_HEADERS.forEach((header, i) => {
    const content = cell(row, header)
    if (!content) return
    const key = OPTION_KEYS[i]
    options.push({
      id: createId('opt'),
      key,
      label: header.replace('选项', ''),
      content,
    })
  })
  return options.length ? options : undefined
}

function parseAnswer(
  type: QuestionType,
  raw: string,
  options: QuestionOption[] | undefined,
  issues: ParseIssue[],
  rowNum: number,
): { optionKeys?: string[]; texts?: string[] } {
  const answer = raw.trim()
  if (!answer) {
    if (type !== 'short') {
      issues.push({ row: rowNum, message: '缺少答案' })
    }
    return type === 'blank' || type === 'short' ? { texts: [] } : { optionKeys: [] }
  }

  if (type === 'blank' || type === 'short') {
    const texts = answer
      .split(/[|｜]/)
      .map((t) => t.trim())
      .filter(Boolean)
    return { texts }
  }

  if (type === 'judge') {
    const normalized = answer.replace(/\s/g, '')
    const truthy = ['对', '正确', '是', 'true', 't', '√', '对的', 'A', 'a']
    const falsy = ['错', '错误', '否', 'false', 'f', '×', 'B', 'b']
    if (truthy.includes(normalized)) return { optionKeys: ['true'] }
    if (falsy.includes(normalized)) return { optionKeys: ['false'] }
    issues.push({ row: rowNum, message: `判断题答案无法识别「${answer}」` })
    return { optionKeys: [] }
  }

  // single / multiple: A,C or 1,2 or keys
  const tokens = answer
    .split(/[,，、\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  const optionKeys: string[] = []
  for (const token of tokens) {
    const upper = token.toUpperCase()
    if (/^[A-F]$/.test(upper)) {
      const idx = upper.charCodeAt(0) - 65
      const key = OPTION_KEYS[idx]
      if (key) optionKeys.push(key)
      continue
    }
    const byContent = options?.find((o) => o.content === token || o.key === token.toLowerCase())
    if (byContent) {
      optionKeys.push(byContent.key)
      continue
    }
    issues.push({ row: rowNum, message: `无法映射答案标记「${token}」` })
  }

  return { optionKeys: [...new Set(optionKeys)] }
}

export function rowsToQuestions(
  rows: RawRow[],
  bankId: string,
  fileName?: string,
): { questions: Question[]; issues: ParseIssue[] } {
  const questions: Question[] = []
  const issues: ParseIssue[] = []

  for (const row of rows) {
    const stem = cell(row, '题干')
    const typeRaw = cell(row, '题型')
    if (!stem && !typeRaw) continue

    if (!typeRaw) {
      issues.push({ row: row.rowNum, message: '缺少题型' })
      continue
    }
    if (!stem) {
      issues.push({ row: row.rowNum, message: '缺少题干' })
      continue
    }

    const type = parseType(typeRaw, issues, row.rowNum)
    if (!type) continue

    const id = createId('q')
    const options = buildOptions(row, type)
    if ((type === 'single' || type === 'multiple') && (!options || options.length < 2)) {
      issues.push({ row: row.rowNum, message: '选择题至少需要两个选项' })
      continue
    }

    const parsedAnswer = parseAnswer(type, cell(row, '答案'), options, issues, row.rowNum)
    const { media, answerMedia } = parseMediaField(cell(row, '图片'), id)
    const explanation = cell(row, '解析') || undefined

    questions.push({
      id,
      bankId,
      type,
      stem,
      media,
      options,
      answer: {
        ...parsedAnswer,
        explanation,
        media: answerMedia.length ? answerMedia : undefined,
      },
      tags: parseTags(cell(row, '标签')),
      sourceMeta: { fileName, row: row.rowNum },
    })
  }

  return { questions, issues }
}

export function emptyParseResult(bankName: string): ParseResult {
  return { bankName, questions: [], issues: [] }
}

/** 规范化表头别名 */
export function normalizeHeader(header: string): string {
  const h = header.trim()
  const map: Record<string, string> = {
    type: '题型',
    类型: '题型',
    stem: '题干',
    题目: '题干',
    question: '题干',
    answer: '答案',
    正确答案: '答案',
    explanation: '解析',
    详解: '解析',
    tags: '标签',
    tag: '标签',
    images: '图片',
    image: '图片',
    配图: '图片',
    optiona: '选项A',
    optionb: '选项B',
    optionc: '选项C',
    optiond: '选项D',
    optione: '选项E',
    optionf: '选项F',
  }
  const lower = h.toLowerCase().replace(/\s/g, '')
  return map[lower] ?? map[h] ?? h
}
