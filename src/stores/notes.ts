import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
import type { NoteRecord } from '@/types/question'

export const useNotesStore = defineStore('notes', () => {
  const items = ref<NoteRecord[]>([])
  const ready = ref(false)

  const byQuestionId = computed(() => {
    const map = new Map<string, NoteRecord>()
    for (const note of items.value) map.set(note.questionId, note)
    return map
  })

  async function refresh() {
    items.value = await db.notes.orderBy('updatedAt').reverse().toArray()
    ready.value = true
  }

  function getNote(questionId: string) {
    return byQuestionId.value.get(questionId)
  }

  async function upsert(questionId: string, bankId: string, content: string) {
    const existing = await db.notes.where('questionId').equals(questionId).first()
    const updatedAt = Date.now()
    if (existing?.id != null) {
      if (!content.trim()) {
        await db.notes.delete(existing.id)
      } else {
        await db.notes.update(existing.id, { content, updatedAt, bankId })
      }
    } else if (content.trim()) {
      await db.notes.add({ questionId, bankId, content, updatedAt })
    }
    await refresh()
  }

  async function remove(questionId: string) {
    const existing = await db.notes.where('questionId').equals(questionId).first()
    if (existing?.id != null) await db.notes.delete(existing.id)
    await refresh()
  }

  return {
    items,
    ready,
    byQuestionId,
    refresh,
    getNote,
    upsert,
    remove,
  }
})
