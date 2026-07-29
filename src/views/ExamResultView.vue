<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import QuestionCard from '@/components/question/QuestionCard.vue'
import PdfExportPanel from '@/components/bank/PdfExportPanel.vue'
import { emptyAnswer, type GradeResult } from '@/lib/grade'
import { prepareOptions } from '@/lib/shuffle'
import { useExamStore } from '@/stores/exam'
import type { QuestionSession } from '@/stores/quiz'
import {
  ALL_QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type QuestionType,
} from '@/types/question'

const router = useRouter()
const exam = useExamStore()

const reviewId = ref<string | null>(null)

onMounted(() => {
  if (!exam.items.length) exam.restore()
  if (!exam.items.length || exam.phase !== 'result') {
    void router.replace({ name: 'exam' })
  }
})

const accuracy = computed(() => {
  const graded = exam.items.filter((i) => {
    const v = exam.results[i.questionId]?.verdict
    return v && v !== 'ungraded'
  })
  if (!graded.length) return null
  const correct = graded.filter((i) => exam.results[i.questionId]?.verdict === 'correct').length
  return Math.round((correct / graded.length) * 1000) / 10
})

const pendingShort = computed(() =>
  exam.items.filter((i) => {
    if (i.type !== 'short') return false
    const v = exam.results[i.questionId]?.verdict
    return !v || v === 'ungraded'
  }),
)

const reviewQuestion = computed(() => {
  if (!reviewId.value) return undefined
  return exam.questions.find((q) => q.id === reviewId.value)
})

const reviewItem = computed(() => exam.items.find((i) => i.questionId === reviewId.value))

const reviewSession = computed<QuestionSession | null>(() => {
  const q = reviewQuestion.value
  if (!q) return null
  const answer = exam.answers[q.id] ?? emptyAnswer()
  const r = exam.results[q.id]
  const result: GradeResult | null = r
    ? { verdict: r.verdict, message: r.message }
    : null
  return {
    answer: {
      optionKeys: [...(answer.optionKeys ?? [])],
      texts: [...(answer.texts ?? [''])],
    },
    submitted: true,
    result,
    selfVerdict: q.type === 'short' && r && r.verdict !== 'ungraded' ? r.verdict : null,
    displayOptions: prepareOptions(q.options, false),
    answerRevealed: true,
  }
})

function typeLabel(type: QuestionType) {
  return QUESTION_TYPE_LABELS[type]
}

function verdictText(id: string) {
  const v = exam.results[id]?.verdict
  if (v === 'correct') return '正确'
  if (v === 'wrong') return '错误'
  if (v === 'partial') return '半对'
  return '待自评'
}

function onBackCompose() {
  exam.exitExam(true)
  void router.push({ name: 'exam' })
}

function openReview(id: string) {
  reviewId.value = id
}

async function onSelfGrade(verdict: 'correct' | 'wrong' | 'partial') {
  if (!reviewId.value) return
  await exam.selfGrade(reviewId.value, verdict)
}
</script>

<template>
  <PageHeader
    title="考试结果"
    :subtitle="`${exam.title} · 得分 ${exam.earnedTotal} / ${exam.totalScore}`"
  >
    <section v-if="exam.items.length" class="panel">
      <div class="score">
        <p class="score__num">{{ exam.earnedTotal }}</p>
        <p class="score__den">/ {{ exam.totalScore }} 分</p>
        <p v-if="accuracy != null" class="score__acc">客观题正确率约 {{ accuracy }}%</p>
        <p v-if="pendingShort.length" class="score__hint">
          还有 {{ pendingShort.length }} 道简答待自评
        </p>
      </div>

      <div class="stats">
        <div v-for="type in ALL_QUESTION_TYPES" :key="type" class="stat">
          <template v-if="exam.statsByType[type].count">
            <p class="stat__type">{{ typeLabel(type) }}</p>
            <p class="stat__line">
              {{ exam.statsByType[type].count }} 题 · 得分
              {{ exam.statsByType[type].earned }} / {{ exam.statsByType[type].score }}
            </p>
            <p class="stat__line muted">
              对 {{ exam.statsByType[type].correct }} · 错 {{ exam.statsByType[type].wrong }} · 半对
              {{ exam.statsByType[type].partial }}
              <template v-if="exam.statsByType[type].pending">
                · 待评 {{ exam.statsByType[type].pending }}
              </template>
            </p>
          </template>
        </div>
      </div>

      <div class="actions">
        <RouterLink class="btn" to="/wrong">查看错题本</RouterLink>
        <button type="button" class="btn btn--primary" @click="onBackCompose">再组一卷</button>
      </div>

      <ul class="list">
        <li v-for="(item, idx) in exam.items" :key="item.questionId" class="row">
          <button type="button" class="row__main" @click="openReview(item.questionId)">
            <p class="row__meta">
              <span>#{{ idx + 1 }} {{ typeLabel(item.type) }}</span>
              <span :data-v="exam.results[item.questionId]?.verdict">{{
                verdictText(item.questionId)
              }}</span>
              <span
                >{{ exam.results[item.questionId]?.earned ?? 0 }} / {{ item.score }} 分</span
              >
            </p>
            <p class="row__stem">
              {{
                exam.questions
                  .find((q) => q.id === item.questionId)
                  ?.stem.replace(/[#*_`$]/g, '')
                  .slice(0, 100)
              }}
            </p>
          </button>
        </li>
      </ul>

      <div v-if="reviewQuestion && reviewSession" class="review">
        <div class="review__head">
          <p>题目回顾</p>
          <button type="button" class="btn" @click="reviewId = null">关闭</button>
        </div>
        <QuestionCard
          :question="reviewQuestion"
          :session="reviewSession"
          :progress-text="`${(exam.items.findIndex((i) => i.questionId === reviewId) ?? 0) + 1} / ${exam.items.length}`"
          :can-prev="false"
          :can-next="false"
          :favorited="false"
          note-content=""
          :show-answer-detail="true"
          :score-label="reviewItem ? `${reviewItem.score} 分` : ''"
          @self-grade="onSelfGrade"
        />
      </div>

      <PdfExportPanel
        class="pdf"
        :title="`${exam.title}-回顾`"
        :questions="exam.questions"
        :wrong-ids="exam.wrongQuestionIds"
      />
    </section>
  </PageHeader>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.score {
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  text-align: center;
}

.score__num {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-accent);
  line-height: 1.1;
}

.score__den {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.score__acc,
.score__hint {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.stats {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
}

.stat {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.stat:empty {
  display: none;
}

.stat__type {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.stat__line {
  margin-top: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-2);
}

.row {
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.row__main {
  width: 100%;
  text-align: left;
  padding: var(--space-3) var(--space-4);
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
  font-weight: 600;
}

.row__meta [data-v='correct'] {
  color: var(--color-success);
}

.row__meta [data-v='wrong'] {
  color: var(--color-danger);
}

.row__meta [data-v='partial'] {
  color: #c9842e;
}

.row__stem {
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
}

.review {
  display: grid;
  gap: var(--space-3);
}

.review__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
}

.btn--primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
  border-color: transparent;
  font-weight: 600;
}

.muted {
  color: var(--color-text-muted);
}

.pdf {
  margin-top: var(--space-2);
}
</style>
