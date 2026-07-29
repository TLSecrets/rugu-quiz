import mammoth from 'mammoth'
import { rowsToQuestions, emptyParseResult } from './normalize'
import { createId, type ParseResult, type RawRow } from './types'

const FIELD_PATTERN =
  /^(题型|题干|选项A|选项B|选项C|选项D|选项E|选项F|选项G|选项H|答案|解析|图片|标签|领域)\s*[:：]\s*(.*)$/

/**
 * Word 约定：
 * 1) 表格：首行表头与 Excel 相同
 * 2) 或纯文本块，字段行「题型：…」，题目之间用空行或 --- 分隔
 */
export async function parseDocxArrayBuffer(
  buffer: ArrayBuffer,
  fileName?: string,
): Promise<ParseResult> {
  const bankName = fileName?.replace(/\.[^.]+$/, '') || 'Word 题库'

  try {
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
    const html = result.value
    const fromTable = parseTables(html, bankName, fileName)
    if (fromTable.questions.length) return fromTable

    const textResult = await mammoth.extractRawText({ arrayBuffer: buffer })
    return parsePlainBlocks(textResult.value, bankName, fileName)
  } catch (e) {
    return {
      ...emptyParseResult(bankName),
      issues: [{ message: e instanceof Error ? e.message : 'Word 解析失败' }],
    }
  }
}

function parseTables(html: string, bankName: string, fileName?: string): ParseResult {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return emptyParseResult(bankName)

  const trs = [...table.querySelectorAll('tr')]
  if (trs.length < 2) return emptyParseResult(bankName)

  const headers = [...(trs[0].querySelectorAll('th,td'))].map((c) => c.textContent?.trim() || '')
  const rows: RawRow[] = []

  for (let i = 1; i < trs.length; i++) {
    const cells = [...trs[i].querySelectorAll('td,th')].map((c) => c.textContent?.trim() || '')
    if (cells.every((c) => !c)) continue
    const row: RawRow = { rowNum: i + 1 }
    headers.forEach((header, idx) => {
      if (!header) return
      row[header] = cells[idx] ?? ''
    })
    rows.push(row)
  }

  const bankId = createId('bank')
  const mapped = rowsToQuestions(rows, bankId, fileName)
  return { bankName, questions: mapped.questions, issues: mapped.issues }
}

function parsePlainBlocks(text: string, bankName: string, fileName?: string): ParseResult {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*---\s*\n|\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)

  const rows: RawRow[] = []
  let rowNum = 1

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const row: RawRow = { rowNum: rowNum++ }
    let matched = false

    for (const line of lines) {
      const m = FIELD_PATTERN.exec(line)
      if (!m) continue
      matched = true
      row[m[1]] = m[2]
    }

    // 兼容「首行题干」无前缀
    if (!row.题干 && lines[0] && !FIELD_PATTERN.test(lines[0])) {
      row.题干 = lines[0]
      matched = true
    }

    if (matched && (row.题干 || row.题型)) rows.push(row)
  }

  if (!rows.length) {
    return {
      ...emptyParseResult(bankName),
      issues: [
        {
          message:
            '未识别到题目。请使用表格，或按「题型：」「题干：」「选项A：」「答案：」字段书写，题目间空行或 --- 分隔。',
        },
      ],
    }
  }

  const bankId = createId('bank')
  const mapped = rowsToQuestions(rows, bankId, fileName)
  return { bankName, questions: mapped.questions, issues: mapped.issues }
}
