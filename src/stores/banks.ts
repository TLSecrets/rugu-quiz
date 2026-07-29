import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
import { bankHasTag, normalizeBankTags } from '@/lib/bankTags'
import type { Bank, Question } from '@/types/question'

export const useBanksStore = defineStore('banks', () => {
  const banks = ref<Bank[]>([])
  const questionsByBank = ref<Record<string, Question[]>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const ready = ref(false)

  const totalQuestions = computed(() =>
    banks.value.reduce((sum, bank) => sum + bank.questionCount, 0),
  )

  const allBankTags = computed(() => {
    const set = new Set<string>()
    for (const bank of banks.value) {
      for (const tag of normalizeBankTags(bank.tags)) set.add(tag)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const list = await db.banks.orderBy('updatedAt').reverse().toArray()
      banks.value = list.map((b) => ({
        ...b,
        tags: normalizeBankTags(b.tags),
      }))

      const map: Record<string, Question[]> = {}
      for (const bank of list) {
        map[bank.id] = await db.questions.where('bankId').equals(bank.id).toArray()
      }
      questionsByBank.value = map
      ready.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载题库失败'
    } finally {
      loading.value = false
    }
  }

  function getBank(id: string) {
    return banks.value.find((b) => b.id === id)
  }

  function getQuestions(bankId: string) {
    return questionsByBank.value[bankId] ?? []
  }

  function banksMatchingTags(tags: string[]): Bank[] {
    const need = normalizeBankTags(tags)
    if (!need.length) return banks.value
    return banks.value.filter((b) => need.every((t) => bankHasTag(b.tags, t)))
  }

  async function putBankWithQuestions(bank: Bank, questions: Question[]) {
    const now = Date.now()
    const next: Bank = {
      ...bank,
      tags: normalizeBankTags(bank.tags),
      questionCount: questions.length,
      updatedAt: now,
      createdAt: bank.createdAt || now,
    }
    await db.transaction('rw', db.banks, db.questions, async () => {
      await db.questions.where('bankId').equals(next.id).delete()
      await db.banks.put(next)
      await db.questions.bulkPut(questions.map((q) => ({ ...q, bankId: next.id })))
    })
    await refresh()
  }

  async function updateBankMeta(
    id: string,
    patch: { name?: string; description?: string; tags?: string[] },
  ) {
    const existing = await db.banks.get(id)
    if (!existing) throw new Error('题库不存在')
    const next: Bank = {
      ...existing,
      name: patch.name !== undefined ? patch.name.trim() || existing.name : existing.name,
      description:
        patch.description !== undefined
          ? patch.description.trim() || undefined
          : existing.description,
      tags: patch.tags !== undefined ? normalizeBankTags(patch.tags) : normalizeBankTags(existing.tags),
      updatedAt: Date.now(),
    }
    await db.banks.put(next)
    const idx = banks.value.findIndex((b) => b.id === id)
    if (idx >= 0) {
      banks.value = banks.value.map((b) => (b.id === id ? next : b))
    } else {
      await refresh()
    }
  }

  async function removeBank(bankId: string) {
    await db.transaction('rw', db.banks, db.questions, db.favorites, db.notes, async () => {
      await db.questions.where('bankId').equals(bankId).delete()
      await db.favorites.where('bankId').equals(bankId).delete()
      await db.notes.where('bankId').equals(bankId).delete()
      await db.banks.delete(bankId)
    })
    await refresh()
  }

  return {
    banks,
    questionsByBank,
    loading,
    error,
    ready,
    totalQuestions,
    allBankTags,
    refresh,
    getBank,
    getQuestions,
    banksMatchingTags,
    putBankWithQuestions,
    updateBankMeta,
    removeBank,
  }
})
