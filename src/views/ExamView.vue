<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import QuestionCard from '@/components/question/QuestionCard.vue'
import QuestionNavigator from '@/components/practice/QuestionNavigator.vue'
import { emptyAnswer } from '@/lib/grade'
import { bankMatchesTags, bankTagMatchModeLabel } from '@/lib/bankTags'
import { exportQuestionsPdf } from '@/lib/exportPdf'
import { prepareOptions } from '@/lib/shuffle'
import { useBanksStore } from '@/stores/banks'
import { useExamStore } from '@/stores/exam'
import { useSettingsStore } from '@/stores/settings'
import { type QuestionSession } from '@/stores/quiz'
import {
  ALL_QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type Question,
  type QuestionType,
} from '@/types/question'

const router = useRouter()
const banks = useBanksStore()
const exam = useExamStore()
const settings = useSettingsStore()

const pdfBusy = ref(false)
const pdfMsg = ref<string | null>(null)
const pdfErr = ref<string | null>(null)
const composeError = ref<string | null>(null)
const tagFilter = ref<string[]>([])
const desktopMq =
  typeof window !== 'undefined' ? window.matchMedia('(min-width: 56.25rem)') : null
const navOpen = ref(desktopMq?.matches ?? false)
const paperTitle = ref('模拟考试')

function onDesktopMqChange(e: MediaQueryListEvent) {
  navOpen.value = e.matches
}

if (desktopMq) {
  desktopMq.addEventListener('change', onDesktopMqChange)
}

onBeforeUnmount(() => {
  desktopMq?.removeEventListener('change', onDesktopMqChange)
})

onMounted(() => {
  if (!exam.items.length) exam.restore()
  if (exam.phase === 'result' && exam.items.length) {
    void router.replace({ name: 'exam-result' })
  }
  exam.ensureBankSelection()
})

watch(
  () => banks.banks,
  () => exam.ensureBankSelection(),
  { deep: true },
)

watch(
  () => exam.phase,
  (p) => {
    if (p === 'result') void router.push({ name: 'exam-result' })
  },
)

const filteredBankList = computed(() => {
  if (!tagFilter.value.length) return banks.banks
  return banks.banks.filter((b) =>
    bankMatchesTags(b.tags, tagFilter.value, settings.bankTagMatchMode),
  )
})

const tagMatchHint = computed(() => bankTagMatchModeLabel(settings.bankTagMatchMode))

const allBanksChecked = computed(
  () =>
    filteredBankList.value.length > 0 &&
    filteredBankList.value.every((b) => exam.selectedBankIds.includes(b.id)),
)

const preview = computed(() => exam.previewCompose())

function typeCount(type: QuestionType) {
  return exam.countAvailable(type)
}

function toggleFilterTag(tag: string) {
  const set = new Set(tagFilter.value)
  if (set.has(tag)) set.delete(tag)
  else set.add(tag)
  tagFilter.value = [...set]
}

function toggleAllBanks() {
  const ids = filteredBankList.value.map((b) => b.id)
  if (allBanksChecked.value) {
    const drop = new Set(ids)
    exam.setSelectedBankIds(exam.selectedBankIds.filter((id) => !drop.has(id)))
  } else {
    const set = new Set(exam.selectedBankIds)
    for (const id of ids) set.add(id)
    exam.setSelectedBankIds([...set])
  }
}

function toggleBank(id: string) {
  const set = new Set(exam.selectedBankIds)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  exam.setSelectedBankIds([...set])
}

function onStart() {
  composeError.value = null
  if (!exam.selectedBankIds.length) {
    composeError.value = '请至少选择题库'
    return
  }
  const res = exam.startExam(paperTitle.value.trim() || '模拟考试')
  if (!res.ok) composeError.value = res.message
}

async function onExportBlank() {
  pdfMsg.value = null
  pdfErr.value = null
  const draft = exam.previewCompose()
  if (!draft.totalCount) {
    pdfErr.value = '请先配置可抽取的题目'
    return
  }
  const questions: Question[] = []
  const scoreMap: Record<string, number> = {}
  for (const item of draft.items) {
    const q = banks.getQuestions(item.bankId).find((x) => x.id === item.questionId)
    if (!q) continue
    questions.push(q)
    scoreMap[item.questionId] = item.score
  }
  pdfBusy.value = true
  try {
    await exportQuestionsPdf({
      title: `${paperTitle.value || '模拟考试'}-空白试卷`,
      questions,
      includeAnswers: false,
      scoreByQuestionId: scoreMap,
    })
    pdfMsg.value = `已导出空白试卷（${questions.length} 题 / ${draft.totalScore} 分）`
  } catch (e) {
    pdfErr.value = e instanceof Error ? e.message : '导出失败'
  } finally {
    pdfBusy.value = false
  }
}

async function onSubmit() {
  if (!confirm(`已答 ${exam.answeredCount} / ${exam.items.length} 题。确认交卷？（不限时）`)) return
  await exam.submitPaper()
}

function onExitTaking() {
  if (!confirm('退出将结束本场考试并返回组卷。确定？')) return
  exam.exitExam(true)
}

const canPrev = computed(() => exam.currentIndex > 0)
const canNext = computed(() => exam.currentIndex < exam.items.length - 1)

const examSession = computed<QuestionSession | null>(() => {
  const q = exam.currentQuestion
  if (!q) return null
  const answer = exam.answers[q.id] ?? emptyAnswer()
  return {
    answer: {
      optionKeys: [...(answer.optionKeys ?? [])],
      texts: answer.texts?.length ? [...answer.texts] : [''],
    },
    submitted: false,
    result: null,
    selfVerdict: null,
    displayOptions: prepareOptions(q.options, false),
    answerRevealed: false,
  }
})

const submittedIds = computed(() => {
  const set = new Set<string>()
  for (const item of exam.items) {
    const a = exam.answers[item.questionId]
    if (!a) continue
    if (a.optionKeys.length || a.texts.some((t) => t.trim())) set.add(item.questionId)
  }
  return set
})

const favoriteIds = computed(() => new Set<string>())
const progressText = computed(() => `${exam.currentIndex + 1} / ${exam.items.length}`)
const scoreLabel = computed(() => {
  const item = exam.currentItem
  return item ? `${item.score} 分` : ''
})
</script>

<template>
  <PageHeader
    title="模拟考试"
    :subtitle="
      exam.phase === 'taking'
        ? `${exam.title} · 已答 ${exam.answeredCount}/${exam.items.length} · 不限时`
        : '按题库 + 题型组卷，可导出空白试卷后开考（无倒计时）'
    "
  >
    <template v-if="exam.phase === 'compose'">
      <section class="panel">
        <label class="field">
          <span>试卷标题</span>
          <input v-model="paperTitle" type="text" maxlength="40" />
        </label>

        <div class="bank-block">
          <div class="bank-block__head">
            <p class="block-label">题库范围</p>
            <button type="button" class="text-btn" @click="toggleAllBanks">
              {{ allBanksChecked ? '取消全选' : '全选当前列表' }}
            </button>
          </div>
          <div v-if="banks.allBankTags.length" class="chips">
            <p class="hint" style="width: 100%; margin: 0 0 0.25rem">
              标签筛选：{{ tagMatchHint }}
            </p>
            <button
              v-for="tag in banks.allBankTags"
              :key="tag"
              type="button"
              class="chip"
              :class="{ 'chip--on': tagFilter.includes(tag) }"
              @click="toggleFilterTag(tag)"
            >
              {{ tag }}
            </button>
            <button
              v-if="tagFilter.length"
              type="button"
              class="chip chip--ghost"
              @click="tagFilter = []"
            >
              清除标签筛选
            </button>
          </div>
          <p v-if="!filteredBankList.length" class="hint">当前标签下没有题库。</p>
          <div v-else class="checks">
            <label v-for="bank in filteredBankList" :key="bank.id" class="check">
              <input
                type="checkbox"
                :checked="exam.selectedBankIds.includes(bank.id)"
                @change="toggleBank(bank.id)"
              />
              <span>{{ bank.name }}</span>
              <span class="muted">({{ bank.questionCount }})</span>
              <span v-if="bank.tags?.length" class="muted">· {{ bank.tags.join(' · ') }}</span>
            </label>
          </div>
        </div>

        <div class="slots">
          <p class="block-label">题型与分值</p>
          <div v-for="type in ALL_QUESTION_TYPES" :key="type" class="slot">
            <label class="check">
              <input v-model="exam.typeConfig[type].enabled" type="checkbox" />
              <span>{{ QUESTION_TYPE_LABELS[type] }}</span>
            </label>
            <span class="muted">可用 {{ typeCount(type) }} 题</span>
            <template v-if="exam.typeConfig[type].enabled">
              <label class="mini">
                每题
                <input v-model.number="exam.typeConfig[type].score" type="number" min="0" step="0.5" />
                分
              </label>
              <label class="mini">
                抽
                <input
                  v-model.number="exam.typeConfig[type].count"
                  type="number"
                  min="1"
                  :max="Math.max(typeCount(type), 1)"
                />
                题
              </label>
              <span class="sub">
                = {{ exam.typeConfig[type].score * exam.typeConfig[type].count }} 分
              </span>
            </template>
          </div>
        </div>

        <div v-if="preview.totalCount" class="preview">
          <p>
            预计 <strong>{{ preview.totalCount }}</strong> 题 · 总分
            <strong>{{ preview.totalScore }}</strong>
          </p>
          <p class="muted">实际抽题以题库可用量为上限；开考与导出时各自随机抽取。</p>
        </div>

        <p v-if="composeError" class="err">{{ composeError }}</p>
        <p v-if="pdfMsg" class="ok">{{ pdfMsg }}</p>
        <p v-if="pdfErr" class="err">{{ pdfErr }}</p>

        <div class="actions">
          <button
            type="button"
            class="btn"
            :disabled="pdfBusy || !preview.totalCount"
            @click="onExportBlank"
          >
            {{ pdfBusy ? '导出中…' : '导出空白试卷 PDF' }}
          </button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="!preview.totalCount"
            @click="onStart"
          >
            开始考试
          </button>
        </div>
      </section>
    </template>

    <template v-else-if="exam.phase === 'taking' && exam.currentQuestion && examSession">
      <div class="toolbar">
        <button type="button" class="btn" @click="navOpen = !navOpen">
          {{ navOpen ? '收起题号' : '题号导航' }}
        </button>
        <span class="muted">已答 {{ exam.answeredCount }} / {{ exam.items.length }}</span>
        <button type="button" class="btn btn--primary" @click="onSubmit">交卷</button>
        <button type="button" class="btn" @click="onExitTaking">退出</button>
      </div>

      <div class="layout">
        <div class="layout__main">
          <QuestionCard
            variant="exam"
            :question="exam.currentQuestion"
            :session="examSession"
            :progress-text="progressText"
            :can-prev="canPrev"
            :can-next="canNext"
            :favorited="false"
            note-content=""
            :show-answer-detail="false"
            :score-label="scoreLabel"
            @select-single="exam.selectSingle(exam.currentQuestion.id, $event)"
            @toggle-multiple="exam.toggleMultiple(exam.currentQuestion.id, $event)"
            @set-text="(i, v) => exam.setText(exam.currentQuestion!.id, i, v)"
            @prev="exam.prev()"
            @next="exam.next()"
          />
        </div>
        <aside v-show="navOpen" class="layout__nav">
          <QuestionNavigator
            :questions="exam.questions"
            :current-index="exam.currentIndex"
            :verdicts="{}"
            :favorite-ids="favoriteIds"
            :submitted-ids="submittedIds"
            @jump="exam.goTo($event)"
          />
        </aside>
      </div>
    </template>
  </PageHeader>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.field input {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
}

.bank-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.bank-block__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
}

.block-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.text-btn {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  font-weight: 600;
  min-height: var(--touch-min);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.chip {
  min-height: 36px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  background: var(--color-bg);
}

.chip--on {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-soft);
}

.chip--ghost {
  border-style: dashed;
  color: var(--color-text-secondary);
}

.checks {
  display: grid;
  gap: var(--space-2);
}

.slots {
  display: grid;
  gap: var(--space-3);
}

.slot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.check input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
}

.mini {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.mini input {
  width: 4rem;
  min-height: 32px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.sub {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  font-weight: 600;
}

.preview {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-accent-soft);
  font-size: var(--font-size-sm);
}

.actions,
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.toolbar {
  margin-bottom: var(--space-4);
}

.layout {
  display: grid;
  gap: var(--space-4);
}

@media (min-width: 56.25rem) {
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

.muted {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.err {
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}

.ok {
  font-size: var(--font-size-sm);
  color: var(--color-success);
}
</style>
