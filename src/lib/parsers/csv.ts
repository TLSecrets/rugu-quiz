import { normalizeHeader, rowsToQuestions, emptyParseResult } from './normalize'
import { createId, type ParseResult, type RawRow } from './types'

/** 简易 CSV：支持逗号分隔与双引号转义 */
export function parseCsvText(text: string, fileName?: string): ParseResult {
  const bankName = fileName?.replace(/\.[^.]+$/, '') || 'CSV 题库'
  const matrix = parseCsvMatrix(text)
  if (matrix.length < 2) {
    return {
      ...emptyParseResult(bankName),
      issues: [{ message: 'CSV 至少需要表头与一行数据' }],
    }
  }

  const headers = matrix[0].map((h) => normalizeHeader(h))
  const rows: RawRow[] = []

  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i]
    if (cells.every((c) => !c.trim())) continue
    const row: RawRow = { rowNum: i + 1 }
    headers.forEach((header, idx) => {
      if (!header) return
      row[header] = cells[idx] ?? ''
    })
    rows.push(row)
  }

  const bankId = createId('bank')
  const { questions, issues } = rowsToQuestions(rows, bankId, fileName)
  return { bankName, questions, issues }
}

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  const pushCell = () => {
    row.push(cell)
    cell = ''
  }
  const pushRow = () => {
    pushCell()
    // 跳过完全空行
    if (!(row.length === 1 && row[0] === '')) rows.push(row)
    row = []
  }

  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const next = input[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      pushCell()
    } else if (ch === '\n') {
      pushRow()
    } else if (ch === '\r') {
      // ignore
    } else {
      cell += ch
    }
  }
  if (cell.length || row.length) pushRow()
  return rows
}
