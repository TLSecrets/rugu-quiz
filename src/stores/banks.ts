import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
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

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const list = await db.banks.orderBy('updatedAt').reverse().toArray()
      banks.value = list

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

  async function putBankWithQuestions(bank: Bank, questions: Question[]) {
    const now = Date.now()
    const next: Bank = {
      ...bank,
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
    refresh,
    getBank,
    getQuestions,
    putBankWithQuestions,
    removeBank,
  }
})
