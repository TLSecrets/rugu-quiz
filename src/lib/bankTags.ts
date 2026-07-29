/** 规范化题库标签：去空白、合并空白、去重（保序） */
export function normalizeBankTag(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

export function normalizeBankTags(tags: string[] | undefined | null): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags ?? []) {
    const t = normalizeBankTag(raw)
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** 从输入框解析标签（支持逗号、顿号、分号、换行） */
export function parseBankTagsInput(input: string): string[] {
  return normalizeBankTags(input.split(/[,，;；、\n]/))
}

export function bankHasTag(tags: string[] | undefined, tag: string): boolean {
  const needle = normalizeBankTag(tag)
  if (!needle) return false
  return (tags ?? []).some((t) => normalizeBankTag(t) === needle)
}

export function formatBankTags(tags: string[] | undefined, max = 2): string {
  const list = normalizeBankTags(tags)
  if (!list.length) return ''
  if (list.length <= max) return list.join(' · ')
  return `${list.slice(0, max).join(' · ')} +${list.length - max}`
}
