<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PdfExportPanel from '@/components/bank/PdfExportPanel.vue'
import { formatBankTags } from '@/lib/bankTags'
import { useBanksStore } from '@/stores/banks'
import { useQuizStore } from '@/stores/quiz'
import { useWrongsStore } from '@/stores/wrongs'
import { QUESTION_TYPE_LABELS, type Question } from '@/types/question'

const router = useRouter()
const banks = useBanksStore()
const quiz = useQuizStore()
const wrongs = useWrongsStore()

const filterWrongCount = ref(0)
const selectedIds = ref<Set<string>>(new Set())

function questionOf(id: string, bankId: string): Question | undefined {
  return banks.getQuestions(bankId).find((q) => q.id === id)
}

const filteredList = computed(() => {
  const min = filterWrongCount.value
  return wrongs.activeItems.filter((item) => {
    if (min <= 0) return true
    if (min >= 3) return item.wrongCount >= 3
    return item.wrongCount === min
  })
})

const questionsForPdf = computed(() => {
  const list: Question[] = []
  for (const rec of wrongs.activeItems) {
    const q = questionOf(rec.questionId, rec.bankId)
    if (q) list.push(q)
  }
  return list
})

const wrongIdsForPdf = computed(() => wrongs.activeItems.map((r) => r.questionId))

const allChecked = computed(
  () => filteredList.value.length > 0 && filteredList.value.every((r) => selectedIds.value.has(r.questionId)),
)

function toggleSelect(questionId: string) {
  const next = new Set(selectedIds.value)
  if (next.has(questionId)) next.delete(questionId)
  else next.add(questionId)
  selectedIds.value = next
}

function toggleAll() {
  if (allChecked.value) {
    selectedIds.value = new Set()
    return
  }
  selectedIds.value = new Set(filteredList.value.map((r) => r.questionId))
}

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function stemPreview(q: Question | undefined, fallback: string) {
  if (!q) return fallback
  const plain = q.stem.replace(/[#*_`$]/g, '').replace(/\s+/g, ' ').trim()
  return plain.length > 120 ? `${plain.slice(0, 120)}…` : plain
}

function practiceAll() {
  quiz.startWrong(0)
  void router.push({ name: 'practice', query: { scope: 'wrong' } })
}

function practiceOne(bankId: string, questionId: string) {
  quiz.openQuestion(bankId, questionId, 'wrong')
  void router.push({
    name: 'practice',
    query: { scope: 'wrong', questionId },
  })
}

async function removeOne(questionId: string) {
  await wrongs.remove(questionId)
  selectedIds.value = new Set([...selectedIds.value].filter((id) => id !== questionId))
}

async function removeSelected() {
  if (!selectedIds.value.size) return
  if (!confirm(`将移出选中的 ${selectedIds.value.size} 道错题（再次答错会重新加入）。确定？`)) return
  await wrongs.removeMany([...selectedIds.value])
  selectedIds.value = new Set()
}

async function clearAll() {
  if (!wrongs.activeItems.length) return
  if (!confirm('将清空全部错题记录。此操作不可恢复。确定？')) return
  await wrongs.clearAll()
  selectedIds.value = new Set()
}
</script>

<template>
  <PageHeader title="错题" subtitle="答错或半对的题目会自动收录。可专项练习，或手动移出。">
    <div v-if="wrongs.activeItems.length" class="toolbar">
      <button type="button" class="btn btn--primary" @click="practiceAll">错题专项训练</button>
      <button type="button" class="btn btn--danger" @click="clearAll">清空全部</button>
      <p class="toolbar__meta">共 {{ wrongs.activeItems.length }} 题</p>
    </div>

    <EmptyState
      v-if="!wrongs.activeItems.length"
      title="错题本为空"
      description="练习中答错或半对的题目会出现在这里。"
    >
      <RouterLink class="link" to="/practice">去练习</RouterLink>
    </EmptyState>

    <template v-else>
      <div class="batch">
        <label class="batch__check">
          <input type="checkbox" :checked="allChecked" @change="toggleAll" />
          全选
        </label>
        <select v-model.number="filterWrongCount" class="batch__select">
          <option :value="0">全部次数</option>
          <option :value="1">答错 1 次</option>
          <option :value="2">答错 2 次</option>
          <option :value="3">答错 3 次及以上</option>
        </select>
        <button
          type="button"
          class="btn btn--danger"
          :disabled="!selectedIds.size"
          @click="removeSelected"
        >
          移出选中（{{ selectedIds.size }}）
        </button>
      </div>

      <EmptyState
        v-if="!filteredList.length"
        title="没有符合筛选的错题"
        description="试试调整错误次数筛选。"
      />

      <ul v-else class="list">
        <li v-for="item in filteredList" :key="item.questionId" class="row">
          <label class="row__check">
            <input
              type="checkbox"
              :checked="selectedIds.has(item.questionId)"
              @change="toggleSelect(item.questionId)"
            />
          </label>
          <button
            type="button"
            class="row__main"
            @click="practiceOne(item.bankId, item.questionId)"
          >
            <p class="row__meta">
              <span class="row__type">
                {{
                  questionOf(item.questionId, item.bankId)
                    ? QUESTION_TYPE_LABELS[questionOf(item.questionId, item.bankId)!.type]
                    : '题目'
                }}
              </span>
              <span class="row__count">答错 {{ item.wrongCount }} 次</span>
              <span class="row__date">{{ formatDate(item.lastWrongAt) }}</span>
            </p>
            <p class="row__stem">
              {{ stemPreview(questionOf(item.questionId, item.bankId), item.questionId) }}
            </p>
            <p class="row__bank">
              {{ banks.getBank(item.bankId)?.name ?? item.bankId }}
              <template v-if="formatBankTags(banks.getBank(item.bankId)?.tags)">
                · {{ formatBankTags(banks.getBank(item.bankId)?.tags) }}
              </template>
            </p>
            <p v-if="!questionOf(item.questionId, item.bankId)" class="row__missing">
              原题已不在题库中
            </p>
          </button>
          <button type="button" class="btn" @click="removeOne(item.questionId)">移出</button>
        </li>
      </ul>

      <PdfExportPanel
        v-if="questionsForPdf.length"
        class="pdf-panel"
        title="错题本"
        :questions="questionsForPdf"
        :wrong-ids="wrongIdsForPdf"
      />
    </template>
  </PageHeader>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.toolbar__meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.batch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
}

.batch__check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  min-height: var(--touch-min);
}

.batch__select {
  min-height: var(--touch-min);
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-3);
}

.row {
  display: flex;
  gap: var(--space-3);
  align-items: stretch;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.row__check {
  display: grid;
  place-items: center;
  padding-inline: var(--space-1);
}

.row__main {
  flex: 1;
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  min-width: 0;
}

.row__main:hover {
  background: var(--color-surface-muted);
}

.row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.row__type {
  color: var(--color-accent);
  font-weight: 600;
}

.row__count {
  color: var(--color-danger, #e07171);
  font-weight: 600;
}

.row__stem {
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
}

.row__bank {
  margin-top: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.row__missing {
  margin-top: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-danger, #e07171);
}

.btn {
  flex-shrink: 0;
  align-self: center;
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
  border-color: transparent;
  font-weight: 600;
}

.btn--danger {
  color: var(--color-danger, #e07171);
  border-color: color-mix(in srgb, var(--color-danger, #e07171) 35%, var(--color-border));
}

.link {
  min-height: var(--touch-min);
  display: inline-flex;
  align-items: center;
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.pdf-panel {
  margin-top: var(--space-5);
}
</style>
