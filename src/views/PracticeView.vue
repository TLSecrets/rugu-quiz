<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import QuestionCard from '@/components/question/QuestionCard.vue'
import PdfExportPanel from '@/components/bank/PdfExportPanel.vue'
import PracticeSetup from '@/components/practice/PracticeSetup.vue'
import QuestionNavigator from '@/components/practice/QuestionNavigator.vue'
import { useBanksStore } from '@/stores/banks'
import { useFavoritesStore } from '@/stores/favorites'
import { useNotesStore } from '@/stores/notes'
import { useQuizStore } from '@/stores/quiz'

const route = useRoute()
const banks = useBanksStore()
const quiz = useQuizStore()
const favorites = useFavoritesStore()
const notes = useNotesStore()

const showResumeDialog = ref(false)
const navOpen = ref(
  typeof window !== 'undefined' && window.matchMedia('(min-width: 960px)').matches,
)
let autoNextTimer: ReturnType<typeof setTimeout> | null = null

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
  if (q === 'favorites' || q === 'wrong') return q
  return null
})

const hasDeepLink = computed(
  () => !!(scopeFromRoute.value || bankIdFromRoute.value || questionIdFromRoute.value),
)

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
      showResumeDialog.value = false
      return
    }
    if (scope === 'wrong') {
      quiz.startWrong(0)
      if (questionId) {
        const idx = quiz.filteredQuestions.findIndex((q) => q.id === questionId)
        if (idx >= 0) quiz.goTo(idx)
      }
      showResumeDialog.value = false
      return
    }
    if (bankId && questionId) {
      quiz.openQuestion(bankId, questionId)
      showResumeDialog.value = false
      return
    }
    if (bankId) {
      quiz.startBank(bankId)
      showResumeDialog.value = false
      return
    }

    // 无深链：若已有活跃会话则保持；否则探测恢复
    if (quiz.sessionActive) {
      showResumeDialog.value = false
      return
    }
    const pending = quiz.checkResumeOffer()
    showResumeDialog.value = !!pending
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

const showAnswerDetail = computed(() => quiz.shouldReveal(session.value))

const favoriteIdSet = computed(() => favorites.questionIdSet)

const submittedIds = computed(() => {
  const set = new Set<string>()
  for (const [id, s] of Object.entries(quiz.sessions)) {
    if (s.submitted) set.add(id)
  }
  for (const [id, v] of Object.entries(quiz.summaryVerdicts)) {
    if (v && v !== 'ungraded') set.add(id)
  }
  return set
})

watch(
  () => quiz.filteredQuestions.length,
  () => {
    if (!quiz.sessionActive) return
    const max = Math.max(quiz.filteredQuestions.length - 1, 0)
    if (quiz.currentIndex > max) quiz.goTo(max)
    else if (quiz.currentQuestion) quiz.ensureSession(quiz.currentQuestion)
  },
)

const subtitle = computed(() => {
  if (!quiz.sessionActive) return '配置范围后开始，或继续上次未完成的练习'
  if (!quiz.activeBank) return '练习中'
  const { correct, wrong, partial, done, total } = quiz.stats
  const order = quiz.config?.order === 'random' ? '随机' : '顺序'
  const shuffle = quiz.config?.shuffleOptions ? '选项乱序' : '选项原序'
  return `${quiz.activeBank.name} · ${order} · ${shuffle} · 已答 ${done}/${total}（对 ${correct} / 错 ${wrong} / 半对 ${partial}）`
})

function clearAutoNext() {
  if (autoNextTimer) {
    clearTimeout(autoNextTimer)
    autoNextTimer = null
  }
}

function scheduleAutoNext() {
  clearAutoNext()
  if (!quiz.config?.autoNextEnabled) return
  if (!canNext.value) return
  const delaySec = Math.min(30, Math.max(0, quiz.config.autoNextDelay ?? 0))
  autoNextTimer = setTimeout(() => {
    quiz.next()
    autoNextTimer = null
  }, delaySec * 1000)
}

function onSubmit() {
  quiz.submitCurrent()
  const q = question.value
  if (!q) return
  // 简答需自评后再自动下一题
  if (q.type === 'short') return
  scheduleAutoNext()
}

function onSelfGrade(verdict: 'correct' | 'wrong' | 'partial') {
  quiz.selfGrade(verdict)
  scheduleAutoNext()
}

watch(
  () => question.value?.id,
  () => {
    clearAutoNext()
  },
)

onBeforeUnmount(() => {
  clearAutoNext()
})

async function onToggleFavorite() {
  if (!question.value) return
  await favorites.toggle(question.value.id, question.value.bankId)
}

async function onSaveNote(content: string) {
  if (!question.value) return
  await notes.upsert(question.value.id, question.value.bankId, content)
}

function onContinue() {
  quiz.resumePending()
  showResumeDialog.value = false
}

function onRestartFresh() {
  quiz.discardPendingAndShowSetup()
  showResumeDialog.value = false
}

function onExitToSetup() {
  clearAutoNext()
  if (!confirm('结束当前练习并返回配置？进度仍会保留，下次可继续。')) return
  quiz.pauseToSetup()
  showResumeDialog.value = false
}

function onRestartConfirm() {
  if (!confirm('重新开始将清空本场作答记录（题序保持）。确定？')) return
  clearAutoNext()
  quiz.restartCurrent()
}
</script>

<template>
  <PageHeader title="练习" :subtitle="subtitle">
    <div v-if="showResumeDialog && quiz.pendingResume" class="dialog">
      <p class="dialog__title">发现未完成的练习</p>
      <p class="dialog__text">
        进度第 {{ (quiz.pendingResume.index ?? 0) + 1 }} /
        {{ quiz.pendingResume.questionIds.length }} 题。继续上次，或重新配置？
      </p>
      <div class="dialog__actions">
        <button type="button" class="btn btn--primary" @click="onContinue">继续上次</button>
        <button type="button" class="btn" @click="onRestartFresh">重新开始</button>
      </div>
    </div>

    <PracticeSetup v-else-if="!quiz.sessionActive && !hasDeepLink" />

    <EmptyState
      v-else-if="quiz.sessionActive && !quiz.filteredQuestions.length"
      :title="
        quiz.mode === 'favorites'
          ? '收藏夹为空'
          : quiz.mode === 'wrong'
            ? '错题本为空'
            : '没有可练习的题目'
      "
      :description="
        quiz.mode === 'favorites'
          ? '先在练习页点「收藏」，再回来练习。'
          : quiz.mode === 'wrong'
            ? '答错题目后会出现在错题本。'
            : '当前筛选没有题目，请返回调整配置。'
      "
    >
      <button type="button" class="linkish" @click="quiz.endSession(true)">返回配置</button>
    </EmptyState>

    <template v-else-if="quiz.sessionActive && question && session">
      <div class="toolbar">
        <button type="button" class="btn" @click="navOpen = !navOpen">
          {{ navOpen ? '收起题号' : '题号导航' }}
        </button>
        <label class="toggle">
          <input
            type="checkbox"
            :checked="!!quiz.config?.autoNextEnabled"
            @change="
              quiz.updateRuntimeFlags({
                autoNextEnabled: ($event.target as HTMLInputElement).checked,
              })
            "
          />
          <span>自动下一题</span>
        </label>
        <label class="toggle">
          <span>答案</span>
          <select
            :value="quiz.config?.showAnswerMode ?? 'instant'"
            @change="
              quiz.updateRuntimeFlags({
                showAnswerMode: ($event.target as HTMLSelectElement).value as 'instant' | 'manual',
              })
            "
          >
            <option value="instant">即时</option>
            <option value="manual">手动</option>
          </select>
        </label>
        <button type="button" class="btn" @click="onRestartConfirm">重新开始</button>
        <button type="button" class="btn" @click="onExitToSetup">返回配置</button>
      </div>

      <div class="layout">
        <div class="layout__main">
          <QuestionCard
            :question="question"
            :session="session"
            :progress-text="quiz.progressText"
            :can-prev="canPrev"
            :can-next="canNext"
            :favorited="favorited"
            :note-content="noteContent"
            :show-answer-detail="showAnswerDetail"
            @select-single="quiz.selectSingle(question.id, $event)"
            @toggle-multiple="quiz.toggleMultiple(question.id, $event)"
            @set-text="(i, v) => quiz.setText(question.id, i, v)"
            @submit="onSubmit"
            @self-grade="onSelfGrade"
            @prev="quiz.prev()"
            @next="quiz.next()"
            @toggle-favorite="onToggleFavorite"
            @save-note="onSaveNote"
            @reveal-answer="quiz.revealAnswer()"
          />
        </div>

        <aside v-show="navOpen" class="layout__nav">
          <QuestionNavigator
            :questions="quiz.filteredQuestions"
            :current-index="quiz.currentIndex"
            :verdicts="quiz.summaryVerdicts"
            :favorite-ids="favoriteIdSet"
            :submitted-ids="submittedIds"
            @jump="quiz.goTo($event)"
          />
        </aside>
      </div>

      <PdfExportPanel
        class="pdf-panel"
        :title="pdfTitle"
        :questions="quiz.filteredQuestions"
        :current="question"
        :wrong-ids="wrongIds"
      />
    </template>

    <EmptyState
      v-else-if="!quiz.sessionActive && hasDeepLink"
      title="正在打开练习"
      description="若长时间无响应，请返回题库重新进入。"
    />
  </PageHeader>
</template>

<style scoped>
.dialog {
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 32rem;
}

.dialog__title {
  font-size: var(--font-size-md);
  font-weight: 600;
}

.dialog__text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  min-height: var(--touch-min);
}

.toggle input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
}

.toggle select {
  min-height: 36px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.layout {
  display: grid;
  gap: var(--space-4);
}

@media (min-width: 960px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) minmax(11rem, 14rem);
    align-items: start;
  }

  .layout__nav {
    position: sticky;
    top: calc(var(--header-height, 4rem) + var(--space-3));
  }
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

.linkish {
  min-height: var(--touch-min);
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.pdf-panel {
  margin-top: var(--space-5);
}
</style>
