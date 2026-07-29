import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
import { bankHasTag, normalizeBankTag, normalizeBankTags } from '@/lib/bankTags'
import type { Bank, Question } from '@/types/question'

export const useBanksStore = defineStore('banks', () => {
  const banks = ref<Bank[]>([])
  const questionsByBank = ref<Record<string, Question[]>>({})
  const tagCatalog = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const ready = ref(false)

  const totalQuestions = computed(() =>
    banks.value.reduce((sum, bank) => sum + bank.questionCount, 0),
  )

  /** 目录标签 ∪ 题库已用标签 */
  const allBankTags = computed(() => {
    const set = new Set<string>(tagCatalog.value)
    for (const bank of banks.value) {
      for (const tag of normalizeBankTags(bank.tags)) set.add(tag)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  async function loadTagCatalog() {
    const rows = await db.tagCatalog.toArray()
    tagCatalog.value = rows
      .map((r) => normalizeBankTag(r.name))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }

  /** 把题库上已有标签补进目录 */
  async function syncCatalogFromBanks(list: Bank[]) {
    const now = Date.now()
    const existing = new Set((await db.tagCatalog.toArray()).map((r) => r.name))
    const toAdd: { name: string; createdAt: number }[] = []
    for (const bank of list) {
      for (const tag of normalizeBankTags(bank.tags)) {
        if (existing.has(tag)) continue
        existing.add(tag)
        toAdd.push({ name: tag, createdAt: now })
      }
    }
    if (toAdd.length) await db.tagCatalog.bulkPut(toAdd)
  }

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const list = await db.banks.orderBy('updatedAt').reverse().toArray()
      banks.value = list.map((b) => ({
        ...b,
        tags: normalizeBankTags(b.tags),
      }))

      await syncCatalogFromBanks(banks.value)
      await loadTagCatalog()

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
    const tags = normalizeBankTags(bank.tags)
    const next: Bank = {
      ...bank,
      tags,
      questionCount: questions.length,
      updatedAt: now,
      createdAt: bank.createdAt || now,
    }
    await db.transaction('rw', db.banks, db.questions, db.tagCatalog, async () => {
      await db.questions.where('bankId').equals(next.id).delete()
      await db.banks.put(next)
      await db.questions.bulkPut(questions.map((q) => ({ ...q, bankId: next.id })))
      for (const tag of tags) {
        const has = await db.tagCatalog.get(tag)
        if (!has) await db.tagCatalog.put({ name: tag, createdAt: now })
      }
    })
    await refresh()
  }

  async function updateBankMeta(
    id: string,
    patch: { name?: string; description?: string; tags?: string[] },
  ) {
    const existing = await db.banks.get(id)
    if (!existing) throw new Error('题库不存在')
    const tags =
      patch.tags !== undefined ? normalizeBankTags(patch.tags) : normalizeBankTags(existing.tags)
    const next: Bank = {
      ...existing,
      name: patch.name !== undefined ? patch.name.trim() || existing.name : existing.name,
      description:
        patch.description !== undefined
          ? patch.description.trim() || undefined
          : existing.description,
      tags,
      updatedAt: Date.now(),
    }
    await db.transaction('rw', db.banks, db.tagCatalog, async () => {
      await db.banks.put(next)
      for (const tag of tags) {
        const has = await db.tagCatalog.get(tag)
        if (!has) await db.tagCatalog.put({ name: tag, createdAt: Date.now() })
      }
    })
    const idx = banks.value.findIndex((b) => b.id === id)
    if (idx >= 0) {
      banks.value = banks.value.map((b) => (b.id === id ? next : b))
      await loadTagCatalog()
    } else {
      await refresh()
    }
  }

  async function addTag(raw: string) {
    const name = normalizeBankTag(raw)
    if (!name) throw new Error('标签不能为空')
    const has = await db.tagCatalog.get(name)
    if (has) throw new Error('标签已存在')
    await db.tagCatalog.put({ name, createdAt: Date.now() })
    await loadTagCatalog()
    return name
  }

  async function renameTag(fromRaw: string, toRaw: string) {
    const from = normalizeBankTag(fromRaw)
    const to = normalizeBankTag(toRaw)
    if (!from) throw new Error('原标签无效')
    if (!to) throw new Error('新标签不能为空')
    if (from === to) return

    const conflict = await db.tagCatalog.get(to)
    if (conflict) throw new Error(`标签「${to}」已存在`)

    const now = Date.now()
    await db.transaction('rw', db.banks, db.tagCatalog, async () => {
      const old = await db.tagCatalog.get(from)
      await db.tagCatalog.delete(from)
      await db.tagCatalog.put({ name: to, createdAt: old?.createdAt ?? now })

      const all = await db.banks.toArray()
      for (const bank of all) {
        const tags = normalizeBankTags(bank.tags)
        if (!tags.includes(from)) continue
        const nextTags = normalizeBankTags(tags.map((t) => (t === from ? to : t)))
        await db.banks.put({ ...bank, tags: nextTags, updatedAt: now })
      }
    })
    await refresh()
  }

  async function deleteTag(raw: string) {
    const name = normalizeBankTag(raw)
    if (!name) return
    const now = Date.now()
    await db.transaction('rw', db.banks, db.tagCatalog, async () => {
      await db.tagCatalog.delete(name)
      const all = await db.banks.toArray()
      for (const bank of all) {
        const tags = normalizeBankTags(bank.tags)
        if (!tags.includes(name)) continue
        await db.banks.put({
          ...bank,
          tags: tags.filter((t) => t !== name),
          updatedAt: now,
        })
      }
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
    tagCatalog,
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
    addTag,
    renameTag,
    deleteTag,
    removeBank,
  }
})
