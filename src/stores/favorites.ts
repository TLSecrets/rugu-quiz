import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
import type { FavoriteRecord } from '@/types/question'

export const useFavoritesStore = defineStore('favorites', () => {
  const items = ref<FavoriteRecord[]>([])
  const ready = ref(false)

  const questionIdSet = computed(() => new Set(items.value.map((i) => i.questionId)))

  async function refresh() {
    items.value = await db.favorites.orderBy('createdAt').reverse().toArray()
    ready.value = true
  }

  function isFavorite(questionId: string) {
    return questionIdSet.value.has(questionId)
  }

  async function toggle(questionId: string, bankId: string) {
    const existing = await db.favorites.where('questionId').equals(questionId).first()
    if (existing?.id != null) {
      await db.favorites.delete(existing.id)
    } else {
      await db.favorites.add({
        questionId,
        bankId,
        createdAt: Date.now(),
      })
    }
    await refresh()
  }

  return {
    items,
    ready,
    questionIdSet,
    refresh,
    isFavorite,
    toggle,
  }
})
