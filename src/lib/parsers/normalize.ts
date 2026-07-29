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

export const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export const OPTION_HEADERS = [
  '选项A',
  '选项B',
  '选项C',
  '选项D',
  '选项E',
  '选项F',
  '选项G',
  '选项H',
] as const

const JUDGE_TRUTHY = ['对', '正确', '是', 'true', 't', '√', '对的', 'yes', 'y', '1']
const JUDGE_FALSY = ['错', '错误', '否', 'false', 'f', '×', 'no', 'n', '0']

function cell(row: RawRow, key: string): string {
  const v = row[key]
  if (v == null) return ''
  return String(v).trim()
}

function optionFilled(row: RawRow): string[] {
  return OPTION_HEADERS.map((h) => cell(row, h)).filter(Boolean)
}

function parseType(raw: string, issues: ParseIssue[], rowNum: number): QuestionType | null {
  const key = raw.trim().toLowerCase()
  const mapped = TYPE_ALIASES[raw.trim()] ?? TYPE_ALIASES[key]
  if (!mapped) {
    issues.push({ row: rowNum, level: 'error', message: `无法识别题型「${raw}」` })
    return null
  }
  return mapped
}

/** 题型列为空时按内容推断 */
export function inferQuestionType(row: RawRow): { type: QuestionType; uncertain: boolean; note: string } {
  const stem = cell(row, '题干')
  const answer = cell(row, '答案')
  const filled = optionFilled(row)
  const answerNorm = answer.replace(/\s/g, '')
  const isJudgeWord =
    JUDGE_TRUTHY.includes(answerNorm.toLowerCase()) ||
    JUDGE_FALSY.includes(answerNorm.toLowerCase()) ||
    JUDGE_TRUTHY.includes(answerNorm) ||
    JUDGE_FALSY.includes(answerNorm)

  // 1. 对错词 + 无选项 → 判断
  if (isJudgeWord && filled.length === 0) {
    return { type: 'judge', uncertain: false, note: '按对错答案推断为判断题' }
  }

  // 2. 题干含空 + 无选项 → 填空
  if (filled.length === 0 && /（\s*）|\(\s*\)|_{2,}|＿{2,}/.test(stem)) {
    return { type: 'blank', uncertain: false, note: '按题干空位推断为填空题' }
  }

  // 3. 仅 A/B
  if (filled.length === 2 && !cell(row, '选项C')) {
    const a = cell(row, '选项A')
    const b = cell(row, '选项B')
    const abJudge =
      (JUDGE_TRUTHY.includes(a) || JUDGE_FALSY.includes(a)) &&
      (JUDGE_TRUTHY.includes(b) || JUDGE_FALSY.includes(b))
    if (abJudge || isJudgeWord) {
      return { type: 'judge', uncertain: false, note: '按 A/B 对错选项推断为判断题' }
    }
    if (/^[A-Ha-h]$/.test(answerNorm) || answerNorm.length <= 2) {
      return { type: 'single', uncertain: false, note: '按双选项推断为单选题' }
    }
  }

  // 4–5. 有选项
  if (filled.length >= 2) {
    const letters = answer
      .toUpperCase()
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter((t) => /^[A-H]$/.test(t))
    if (letters.length >= 2) {
      return { type: 'multiple', uncertain: false, note: '按多字母答案推断为多选题' }
    }
    if (letters.length === 1 || /^[A-Ha-h]$/.test(answerNorm)) {
      return { type: 'single', uncertain: false, note: '按单字母答案推断为单选题' }
    }
    return { type: 'single', uncertain: true, note: '有选项但答案格式不明，暂作单选，请核对' }
  }

  // 6. 无选项、较长文本 → 简答
  if (filled.length === 0 && answer.length >= 12) {
    return { type: 'short', uncertain: false, note: '按长文本答案推断为简答题' }
  }

  // 7. 兜底填空
  if (filled.length === 0) {
    return {
      type: answer ? 'blank' : 'short',
      uncertain: true,
      note: answer ? '无法明确题型，暂作填空，请核对' : '缺少选项与答案，暂作简答，请核对',
    }
  }

  return { type: 'single', uncertain: true, note: '题型不确定，暂作单选，请核对' }
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
      issues.push({ row: rowNum, level: 'warn', message: '缺少答案' })
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
    const lower = normalized.toLowerCase()
    if (JUDGE_TRUTHY.includes(normalized) || JUDGE_TRUTHY.includes(lower) || normalized === 'A' || normalized === 'a') {
      return { optionKeys: ['true'] }
    }
    if (JUDGE_FALSY.includes(normalized) || JUDGE_FALSY.includes(lower) || normalized === 'B' || normalized === 'b') {
      return { optionKeys: ['false'] }
    }
    issues.push({ row: rowNum, level: 'warn', message: `判断题答案无法识别「${answer}」` })
    return { optionKeys: [] }
  }

  const tokens = answer
    .split(/[,，、\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  const optionKeys: string[] = []
  for (const token of tokens) {
    const upper = token.toUpperCase()
    if (/^[A-H]$/.test(upper)) {
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
    issues.push({ row: rowNum, level: 'warn', message: `无法映射答案标记「${token}」` })
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

    if (!stem) {
      issues.push({ row: row.rowNum, level: 'error', message: '缺少题干' })
      continue
    }

    let type: QuestionType | null = null
    let uncertain = false
    if (typeRaw) {
      type = parseType(typeRaw, issues, row.rowNum)
      if (!type) continue
    } else {
      const inferred = inferQuestionType(row)
      type = inferred.type
      uncertain = inferred.uncertain
      issues.push({
        row: row.rowNum,
        level: inferred.uncertain ? 'warn' : 'info',
        message: inferred.note,
      })
    }

    const id = createId('q')
    const options = buildOptions(row, type)
    if ((type === 'single' || type === 'multiple') && (!options || options.length < 2)) {
      issues.push({ row: row.rowNum, level: 'error', message: '选择题至少需要两个选项' })
      continue
    }

    const parsedAnswer = parseAnswer(type, cell(row, '答案'), options, issues, row.rowNum)
    const { media, answerMedia } = parseMediaField(cell(row, '图片'), id)
    const explanation = cell(row, '解析') || undefined
    const tags = parseTags(cell(row, '标签'))
    const domain = cell(row, '领域') || tags?.[0]

    // 括号内嵌答案冲突提示（题干末尾有（X）且另有答案列）
    const bracket = /[（(]\s*([A-Ha-h对错正确错误√×])\s*[）)]$/.exec(stem)
    if (bracket && cell(row, '答案')) {
      uncertain = true
      issues.push({
        row: row.rowNum,
        level: 'warn',
        message: '题干括号与答案列可能并存，请核对答案',
      })
    }

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
      tags,
      domain,
      sourceMeta: {
        fileName,
        row: row.rowNum,
        inferredType: !typeRaw,
        uncertain,
      },
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
    domain: '领域',
    分类: '领域',
    category: '领域',
    images: '图片',
    image: '图片',
    配图: '图片',
    optiona: '选项A',
    optionb: '选项B',
    optionc: '选项C',
    optiond: '选项D',
    optione: '选项E',
    optionf: '选项F',
    optiong: '选项G',
    optionh: '选项H',
  }
  const lower = h.toLowerCase().replace(/\s/g, '')
  return map[lower] ?? map[h] ?? h
}
