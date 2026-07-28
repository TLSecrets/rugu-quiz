<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useBanksStore } from '@/stores/banks'
import { useNotesStore } from '@/stores/notes'
import { useQuizStore } from '@/stores/quiz'

const router = useRouter()
const banks = useBanksStore()
const notes = useNotesStore()
const quiz = useQuizStore()

const editingId = ref<string | null>(null)
const draft = ref('')

function stemOf(questionId: string) {
  for (const list of Object.values(banks.questionsByBank)) {
    const found = list.find((q) => q.id === questionId)
    if (found) return found.stem
  }
  return questionId
}

function bankIdOf(questionId: string) {
  const note = notes.getNote(questionId)
  if (note) return note.bankId
  for (const list of Object.values(banks.questionsByBank)) {
    const found = list.find((q) => q.id === questionId)
    if (found) return found.bankId
  }
  return ''
}

function startEdit(questionId: string, content: string) {
  editingId.value = questionId
  draft.value = content
}

async function saveEdit(questionId: string) {
  const bankId = bankIdOf(questionId)
  await notes.upsert(questionId, bankId, draft.value)
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
  draft.value = ''
}

function openQuestion(questionId: string) {
  const bankId = bankIdOf(questionId)
  if (!bankId) return
  quiz.openQuestion(bankId, questionId)
  void router.push({ name: 'practice', query: { bankId, questionId } })
}
</script>

<template>
  <PageHeader title="笔记" subtitle="按题目绑定，支持编辑与删除；可跳转回练习页。">
    <EmptyState
      v-if="!notes.items.length"
      title="暂无笔记"
      description="在练习页下方笔记框书写，内容会自动保存到这里。"
    >
      <RouterLink class="link" to="/practice">去练习</RouterLink>
    </EmptyState>

    <ul v-else class="list">
      <li v-for="note in notes.items" :key="note.questionId" class="card">
        <button type="button" class="card__stem" @click="openQuestion(note.questionId)">
          {{ stemOf(note.questionId) }}
        </button>

        <template v-if="editingId === note.questionId">
          <textarea v-model="draft" class="card__editor" rows="5" />
          <div class="card__actions">
            <button type="button" class="btn btn--primary" @click="saveEdit(note.questionId)">
              保存
            </button>
            <button type="button" class="btn" @click="cancelEdit">取消</button>
          </div>
        </template>
        <template v-else>
          <p class="card__body">{{ note.content }}</p>
          <div class="card__actions">
            <button type="button" class="btn" @click="startEdit(note.questionId, note.content)">
              编辑
            </button>
            <button type="button" class="btn" @click="openQuestion(note.questionId)">练习</button>
            <button type="button" class="btn" @click="notes.remove(note.questionId)">删除</button>
          </div>
        </template>
      </li>
    </ul>
  </PageHeader>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-3);
}

.card {
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  display: grid;
  gap: var(--space-3);
}

.card__stem {
  text-align: left;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.card__stem:hover {
  color: var(--color-accent);
}

.card__body {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  white-space: pre-wrap;
}

.card__editor {
  min-height: 120px;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.55;
  resize: vertical;
}

.card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.btn--primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
  border-color: transparent;
  font-weight: 600;
}

.link {
  min-height: var(--touch-min);
  display: inline-flex;
  align-items: center;
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 600;
}
</style>
