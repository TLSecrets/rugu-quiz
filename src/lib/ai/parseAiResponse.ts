import { parseJsonText } from '@/lib/parsers/json'
import type { ParseResult } from '@/lib/parsers/types'

/** 从模型返回文本中提取 JSON（兼容偶发 code fence） */
export function extractJsonPayload(text: string): string {
  const trimmed = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed)
  if (fence) return fence[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)

  return trimmed
}

export function parseAiImportResponse(content: string): ParseResult {
  const jsonText = extractJsonPayload(content)
  return parseJsonText(jsonText, 'AI 导入')
}
