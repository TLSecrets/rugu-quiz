import * as XLSX from 'xlsx'
import { normalizeHeader, rowsToQuestions, emptyParseResult } from './normalize'
import { createId, type ParseResult, type RawRow } from './types'

export async function parseXlsxArrayBuffer(
  buffer: ArrayBuffer,
  fileName?: string,
): Promise<ParseResult> {
  const bankName = fileName?.replace(/\.[^.]+$/, '') || 'Excel 题库'
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return { ...emptyParseResult(bankName), issues: [{ message: '工作簿中没有工作表' }] }
    }

    const sheet = workbook.Sheets[sheetName]
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as (string | number | null)[][]

    if (matrix.length < 2) {
      return {
        ...emptyParseResult(bankName),
        issues: [{ message: `工作表「${sheetName}」缺少数据行` }],
      }
    }

    const headers = (matrix[0] ?? []).map((h) => normalizeHeader(String(h ?? '')))
    const rows: RawRow[] = []

    for (let i = 1; i < matrix.length; i++) {
      const cells = matrix[i] ?? []
      if (cells.every((c) => String(c ?? '').trim() === '')) continue
      const row: RawRow = { rowNum: i + 1 }
      headers.forEach((header, idx) => {
        if (!header) return
        row[header] = String(cells[idx] ?? '').trim()
      })
      rows.push(row)
    }

    const bankId = createId('bank')
    const { questions, issues } = rowsToQuestions(rows, bankId, fileName)
    return {
      bankName,
      description: `来自工作表「${sheetName}」`,
      questions,
      issues,
    }
  } catch (e) {
    return {
      ...emptyParseResult(bankName),
      issues: [{ message: e instanceof Error ? e.message : 'Excel 解析失败' }],
    }
  }
}
