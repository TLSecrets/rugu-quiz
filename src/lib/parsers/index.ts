import { parseCsvText } from './csv'
import { parseDocxArrayBuffer } from './docx'
import { parseJsonText } from './json'
import { parseXlsxArrayBuffer } from './xlsx'
import type { ParseResult } from './types'

export type SupportedImportExt = 'json' | 'csv' | 'xlsx' | 'xls' | 'docx'

export function detectExt(fileName: string): SupportedImportExt | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.csv')) return 'csv'
  if (lower.endsWith('.xlsx')) return 'xlsx'
  if (lower.endsWith('.xls')) return 'xls'
  if (lower.endsWith('.docx')) return 'docx'
  return null
}

export async function parseImportFile(file: File): Promise<ParseResult> {
  const ext = detectExt(file.name)
  if (!ext) {
    return {
      bankName: file.name,
      questions: [],
      issues: [{ message: '不支持的文件类型。请使用 .xlsx / .xls / .csv / .json / .docx' }],
    }
  }

  if (ext === 'json') {
    return parseJsonText(await file.text(), file.name)
  }
  if (ext === 'csv') {
    return parseCsvText(await file.text(), file.name)
  }
  if (ext === 'docx') {
    return parseDocxArrayBuffer(await file.arrayBuffer(), file.name)
  }
  return parseXlsxArrayBuffer(await file.arrayBuffer(), file.name)
}

export type { ParseResult, ParseIssue } from './types'
