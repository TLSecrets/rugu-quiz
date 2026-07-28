import type { Question, QuestionMedia, QuestionOption, QuestionType } from '@/types/question'
import { rowsToQuestions, emptyParseResult } from './normalize'
import { TYPE_ALIASES, createId, type ParseResult, type RawRow } from './types'

interface JsonBankFile {
  name?: string
  description?: string
  questions?: unknown[]
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function asString(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function mapStructuredQuestion(
  raw: Record<string, unknown>,
  bankId: string,
  index: number,
  fileName?: string,
): { question?: Question; issue?: string } {
  const typeRaw = asString(raw.type ?? raw.题型)
  const type = TYPE_ALIASES[typeRaw] ?? TYPE_ALIASES[typeRaw.toLowerCase()]
  if (!type) return { issue: `第 ${index + 1} 题题型无效` }

  const stem = asString(raw.stem ?? raw.题干)
  if (!stem) return { issue: `第 ${index + 1} 题缺少题干` }

  const id = asString(raw.id) || createId('q')
  let options: QuestionOption[] | undefined
  if (Array.isArray(raw.options)) {
    options = raw.options.map((opt, i) => {
      const o: Record<string, unknown> = isPlainObject(opt) ? opt : { content: opt }
      const key = asString(o.key) || String.fromCharCode(97 + i)
      return {
        id: asString(o.id) || createId('opt'),
        key,
        label: asString(o.label) || String.fromCharCode(65 + i),
        content: asString(o.content ?? o.text),
        media: Array.isArray(o.media) ? (o.media as QuestionMedia[]) : undefined,
      }
    })
  }

  if (type === 'judge' && !options?.length) {
    options = [
      { id: createId('opt'), key: 'true', label: 'A', content: '正确' },
      { id: createId('opt'), key: 'false', label: 'B', content: '错误' },
    ]
  }

  const answerRaw = isPlainObject(raw.answer) ? raw.answer : {}
  const optionKeys = Array.isArray(answerRaw.optionKeys)
    ? answerRaw.optionKeys.map(asString)
    : undefined
  const texts = Array.isArray(answerRaw.texts)
    ? answerRaw.texts.map(asString)
    : asString(raw.答案)
      ? asString(raw.答案)
          .split(/[|｜]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined

  const media = Array.isArray(raw.media) ? (raw.media as QuestionMedia[]) : []

  return {
    question: {
      id,
      bankId,
      type: type as QuestionType,
      stem,
      media,
      options,
      answer: {
        optionKeys,
        texts,
        explanation: asString(answerRaw.explanation ?? raw.解析) || undefined,
        media: Array.isArray(answerRaw.media) ? (answerRaw.media as QuestionMedia[]) : undefined,
      },
      tags: Array.isArray(raw.tags) ? raw.tags.map(asString).filter(Boolean) : undefined,
      sourceMeta: { fileName, row: index + 1 },
    },
  }
}

function tableArrayToRows(list: unknown[]): RawRow[] {
  return list.map((item, i) => {
    const row: RawRow = { rowNum: i + 1 }
    if (!isPlainObject(item)) return row
    for (const [k, v] of Object.entries(item)) {
      row[k] = v == null ? '' : String(v)
    }
    return row
  })
}

export function parseJsonText(text: string, fileName?: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return {
      ...emptyParseResult(fileName?.replace(/\.[^.]+$/, '') || 'JSON 题库'),
      issues: [{ message: 'JSON 解析失败，请检查文件格式' }],
    }
  }

  const bankId = createId('bank')
  const baseName = fileName?.replace(/\.[^.]+$/, '') || 'JSON 题库'

  // 数组：可能是结构化题目，或表格式行
  if (Array.isArray(data)) {
    const looksTabular = data.some(
      (item) => isPlainObject(item) && ('题干' in item || '题型' in item),
    )
    if (looksTabular) {
      const { questions, issues } = rowsToQuestions(tableArrayToRows(data), bankId, fileName)
      return { bankName: baseName, questions, issues }
    }

    const questions: Question[] = []
    const issues: ParseResult['issues'] = []
    data.forEach((item, i) => {
      if (!isPlainObject(item)) {
        issues.push({ row: i + 1, message: '题目项必须是对象' })
        return
      }
      const mapped = mapStructuredQuestion(item, bankId, i, fileName)
      if (mapped.issue) issues.push({ row: i + 1, message: mapped.issue })
      if (mapped.question) questions.push(mapped.question)
    })
    return { bankName: baseName, questions, issues }
  }

  if (!isPlainObject(data)) {
    return {
      bankName: baseName,
      questions: [],
      issues: [{ message: 'JSON 根节点应为对象或数组' }],
    }
  }

  const file = data as JsonBankFile
  const bankName = asString(file.name) || baseName
  const description = asString(file.description) || undefined
  const list = Array.isArray(file.questions) ? file.questions : []

  const questions: Question[] = []
  const issues: ParseResult['issues'] = []

  const looksTabular = list.some(
    (item) => isPlainObject(item) && ('题干' in item || '题型' in item),
  )

  if (looksTabular) {
    const mapped = rowsToQuestions(tableArrayToRows(list), bankId, fileName)
    return { bankName, description, questions: mapped.questions, issues: mapped.issues }
  }

  list.forEach((item, i) => {
    if (!isPlainObject(item)) {
      issues.push({ row: i + 1, message: '题目项必须是对象' })
      return
    }
    const mapped = mapStructuredQuestion(item, bankId, i, fileName)
    if (mapped.issue) issues.push({ row: i + 1, message: mapped.issue })
    if (mapped.question) questions.push(mapped.question)
  })

  return { bankName, description, questions, issues }
}
