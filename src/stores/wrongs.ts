import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
import type { WrongRecord } from '@/types/question'
import type { GradeVerdict } from '@/lib/grade'

function shouldRecordWrong(verdict: GradeVerdict): boolean {
  return verdict === 'wrong' || verdict === 'partial'
}

export const useWrongsStore = defineStore('wrongs', () => {
  const items = ref<WrongRecord[]>([])
  const ready = ref(false)

  /** 未手动移除的活跃错题，按错误次数降序 */
  const activeItems = computed(() =>
    items.value
      .filter((r) => !r.removed)
      .slice()
      .sort((a, b) => b.wrongCount - a.wrongCount || b.lastWrongAt - a.lastWrongAt),
  )

  const activeQuestionIds = computed(() => new Set(activeItems.value.map((r) => r.questionId)))

  async function refresh() {
    items.value = await db.wrongRecords.toArray()
    ready.value = true
  }

  function isActiveWrong(questionId: string) {
    return activeQuestionIds.value.has(questionId)
  }

  /** 答错 / 半对时写入或累加；已移除的记录会重新激活 */
  async function recordFailure(questionId: string, bankId: string, verdict: GradeVerdict) {
    if (!shouldRecordWrong(verdict)) return

    const now = Date.now()
    const existing = await db.wrongRecords.get(questionId)
    if (!existing) {
      await db.wrongRecords.put({
        questionId,
        bankId,
        wrongCount: 1,
        lastWrongAt: now,
        removed: false,
      })
    } else if (existing.removed) {
      await db.wrongRecords.put({
        ...existing,
        bankId,
        wrongCount: existing.wrongCount + 1,
        lastWrongAt: now,
        removed: false,
      })
    } else {
      await db.wrongRecords.put({
        ...existing,
        bankId,
        wrongCount: existing.wrongCount + 1,
        lastWrongAt: now,
      })
    }
    await refresh()
  }

  async function remove(questionId: string) {
    const existing = await db.wrongRecords.get(questionId)
    if (!existing) return
    await db.wrongRecords.put({ ...existing, removed: true })
    await refresh()
  }

  async function removeMany(questionIds: string[]) {
    await db.transaction('rw', db.wrongRecords, async () => {
      for (const id of questionIds) {
        const existing = await db.wrongRecords.get(id)
        if (existing && !existing.removed) {
          await db.wrongRecords.put({ ...existing, removed: true })
        }
      }
    })
    await refresh()
  }

  async function clearAll() {
    await db.wrongRecords.clear()
    await refresh()
  }

  return {
    items,
    ready,
    activeItems,
    activeQuestionIds,
    refresh,
    isActiveWrong,
    recordFailure,
    remove,
    removeMany,
    clearAll,
  }
})
