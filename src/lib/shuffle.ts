import type { QuestionOption } from '@/types/question'

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Fisher–Yates 打乱副本 */
export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 打乱选项并用 A/B/C… 重标；保留稳定 key 用于判题。
 * 无选项或不开启乱序时，仅规范化 label。
 */
export function prepareOptions(
  options: QuestionOption[] | undefined,
  shuffle: boolean,
): QuestionOption[] {
  if (!options?.length) return []
  const list = shuffle ? shuffleArray(options) : [...options]
  return list.map((opt, index) => ({
    ...opt,
    label: LABELS[index] ?? String(index + 1),
  }))
}
