<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import QuestionCard from '@/components/question/QuestionCard.vue'
import PdfExportPanel from '@/components/bank/PdfExportPanel.vue'
import { useBanksStore } from '@/stores/banks'
import { useFavoritesStore } from '@/stores/favorites'
import { useNotesStore } from '@/stores/notes'
import { useQuizStore } from '@/stores/quiz'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const banks = useBanksStore()
const quiz = useQuizStore()
const settings = useSettingsStore()
const favorites = useFavoritesStore()
const notes = useNotesStore()

const bankIdFromRoute = computed(() => {
  const q = route.query.bankId
  return typeof q === 'string' ? q : null
})

const questionIdFromRoute = computed(() => {
  const q = route.query.questionId
  return typeof q === 'string' ? q : null
})

const scopeFromRoute = computed(() => {
  const q = route.query.scope
  return q === 'favorites' ? 'favorites' : null
})

watch(
  [() => banks.ready, bankIdFromRoute, questionIdFromRoute, scopeFromRoute],
  ([ready, bankId, questionId, scope]) => {
    if (!ready) return
    if (scope === 'favorites') {
      quiz.startFavorites(0)
      if (questionId) {
        const idx = quiz.filteredQuestions.findIndex((q) => q.id === questionId)
        if (idx >= 0) quiz.goTo(idx)
      }
      return
    }
    if (bankId && questionId) {
      quiz.openQuestion(bankId, questionId)
      return
    }
    if (bankId) {
      quiz.startBank(bankId)
      return
    }
    if (!quiz.activeBankId && quiz.mode !== 'favorites') quiz.restoreProgress()
  },
  { immediate: true },
)

const question = computed(() => quiz.currentQuestion)
const session = computed(() => quiz.currentSession)

const canPrev = computed(() => quiz.currentIndex > 0)
const canNext = computed(() => quiz.currentIndex < quiz.filteredQuestions.length - 1)

const favorited = computed(() =>
  question.value ? favorites.isFavorite(question.value.id) : false,
)

const noteContent = computed(() =>
  question.value ? (notes.getNote(question.value.id)?.content ?? '') : '',
)

const wrongIds = computed(() =>
  Object.entries(quiz.summaryVerdicts)
    .filter(([, v]) => v === 'wrong' || v === 'partial')
    .map(([id]) => id),
)

const pdfTitle = computed(() => quiz.activeBank?.name ?? '练习导出')

watch(
  () => quiz.filteredQuestions.length,
  () => {
    if (quiz.mode === 'bank' && !quiz.activeBankId) return
    const max = Math.max(quiz.filteredQuestions.length - 1, 0)
    if (quiz.currentIndex > max) quiz.goTo(max)
    else if (quiz.currentQuestion) quiz.ensureSession(quiz.currentQuestion)
  },
)

const subtitle = computed(() => {
  if (!quiz.activeBank) return '从题库、搜索或收藏进入练习'
  const { correct, wrong, partial, done, total } = quiz.stats
  const shuffle = settings.shuffleOptions ? '选项乱序开' : '选项乱序关'
  return `${quiz.activeBank.name} · ${shuffle} · 已答 ${done}/${total}（对 ${correct} / 错 ${wrong} / 半对 ${partial}）`
})

async function onToggleFavorite() {
  if (!question.value) return
  await favorites.toggle(question.value.id, question.value.bankId)
}

async function onSaveNote(content: string) {
  if (!question.value) return
  await notes.upsert(question.value.id, question.value.bankId, content)
}
</script>

<template>
  <PageHeader title="练习" :subtitle="subtitle">
    <EmptyState
      v-if="quiz.mode !== 'favorites' && !quiz.activeBankId"
      title="尚未选择题库"
      description="请先在题库页选择一套题，或从收藏夹开始练习。"
    >
      <RouterLink class="link" to="/banks">选择题库</RouterLink>
      <RouterLink class="link" to="/favorites">查看收藏</RouterLink>
    </EmptyState>

    <EmptyState
      v-else-if="!quiz.filteredQuestions.length"
      :title="quiz.mode === 'favorites' ? '收藏夹为空' : '没有可练习的题目'"
      :description="
        quiz.mode === 'favorites'
          ? '先在练习页点「收藏」，再回到这里练习。'
          : '当前题型过滤可能导致列表为空，请到设置中调整题型。'
      "
    >
      <RouterLink class="link" to="/settings">打开设置</RouterLink>
    </EmptyState>

    <QuestionCard
      v-else-if="question && session"
      :question="question"
      :session="session"
      :progress-text="quiz.progressText"
      :can-prev="canPrev"
      :can-next="canNext"
      :favorited="favorited"
      :note-content="noteContent"
      @select-single="quiz.selectSingle(question.id, $event)"
      @toggle-multiple="quiz.toggleMultiple(question.id, $event)"
      @set-text="(i, v) => quiz.setText(question.id, i, v)"
      @submit="quiz.submitCurrent()"
      @self-grade="quiz.selfGrade($event)"
      @prev="quiz.prev()"
      @next="quiz.next()"
      @toggle-favorite="onToggleFavorite"
      @save-note="onSaveNote"
    />

    <PdfExportPanel
      v-if="quiz.filteredQuestions.length"
      class="pdf-panel"
      :title="pdfTitle"
      :questions="quiz.filteredQuestions"
      :current="question"
      :wrong-ids="wrongIds"
    />
  </PageHeader>
</template>

<style scoped>
.link {
  min-height: var(--touch-min);
  display: inline-flex;
  align-items: center;
  margin-right: var(--space-3);
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.pdf-panel {
  margin-top: var(--space-5);
}
</style>
