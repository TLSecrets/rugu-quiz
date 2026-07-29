<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MediaBlock from '@/components/question/MediaBlock.vue'
import RichText from '@/components/common/RichText.vue'
import type { QuestionSession } from '@/stores/quiz'
import { QUESTION_TYPE_LABELS, type Question } from '@/types/question'
import type { GradeVerdict } from '@/lib/grade'

const props = withDefaults(
  defineProps<{
    question: Question
    session: QuestionSession
    progressText: string
    canPrev: boolean
    canNext: boolean
    favorited: boolean
    noteContent: string
    /** 是否展示正确答案与解析（手动模式可能为 false） */
    showAnswerDetail: boolean
    /** 考试模式：可改答、无单题提交与解析区 */
    variant?: 'practice' | 'exam'
    /** 考试模式下显示分值 */
    scoreLabel?: string
  }>(),
  { variant: 'practice' },
)

const emit = defineEmits<{
  selectSingle: [key: string]
  toggleMultiple: [key: string]
  setText: [index: number, value: string]
  submit: []
  selfGrade: [verdict: 'correct' | 'wrong' | 'partial']
  prev: []
  next: []
  toggleFavorite: []
  saveNote: [content: string]
  revealAnswer: []
  finishExam: []
}>()

const noteDraft = ref(props.noteContent)
const noteSavedHint = ref(false)
let noteTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.noteContent,
  (v) => {
    noteDraft.value = v
  },
)

watch(
  () => props.question.id,
  () => {
    noteDraft.value = props.noteContent
    noteSavedHint.value = false
  },
)

watch(noteDraft, (value) => {
  if (noteTimer) clearTimeout(noteTimer)
  noteTimer = setTimeout(() => {
    emit('saveNote', value)
    noteSavedHint.value = true
    setTimeout(() => {
      noteSavedHint.value = false
    }, 1200)
  }, 450)
})

const isChoice = computed(
  () =>
    props.question.type === 'single' ||
    props.question.type === 'multiple' ||
    props.question.type === 'judge',
)

const isMultiple = computed(() => props.question.type === 'multiple')
const isBlank = computed(() => props.question.type === 'blank')
const isShort = computed(() => props.question.type === 'short')
const isExam = computed(() => props.variant === 'exam')
const submitted = computed(() => (isExam.value ? false : props.session.submitted))
const locked = computed(() => props.session.submitted && !isExam.value)

const effectiveVerdict = computed<GradeVerdict | null>(() => {
  if (props.session.selfVerdict) return props.session.selfVerdict
  return props.session.result?.verdict ?? null
})

const verdictLabel = computed(() => {
  const v = effectiveVerdict.value
  if (v === 'correct') return '正确'
  if (v === 'wrong') return '错误'
  if (v === 'partial') return '部分正确'
  if (v === 'ungraded') return '待自评'
  return ''
})

function isSelected(key: string) {
  return props.session.answer.optionKeys.includes(key)
}

function isCorrectKey(key: string) {
  return props.question.answer.optionKeys?.includes(key) ?? false
}

function optionClass(key: string) {
  const selected = isSelected(key)
  if (!submitted.value) return selected ? 'opt--selected' : ''
  if (!props.showAnswerDetail) return selected ? 'opt--selected' : ''
  if (isCorrectKey(key)) return 'opt--correct'
  if (selected) return 'opt--wrong'
  return ''
}

function onOptionClick(key: string) {
  if (locked.value) return
  if (isMultiple.value) emit('toggleMultiple', key)
  else emit('selectSingle', key)
}

const canSubmit = computed(() => {
  if (isExam.value || props.session.submitted) return false
  if (isChoice.value) return props.session.answer.optionKeys.length > 0
  if (isBlank.value || isShort.value) {
    return props.session.answer.texts.some((t) => t.trim().length > 0)
  }
  return false
})

const answerKeysText = computed(() => {
  const keys = props.question.answer.optionKeys ?? []
  if (!keys.length) return ''
  return keys
    .map((key) => {
      const opt = props.session.displayOptions.find((o) => o.key === key)
      return opt ? `${opt.label}（${opt.content}）` : key
    })
    .join('、')
})
</script>

<template>
  <article class="card">
    <header class="card__meta">
      <span class="card__type">
        {{ QUESTION_TYPE_LABELS[question.type] }}
        <template v-if="scoreLabel"> · {{ scoreLabel }}</template>
      </span>
      <div class="card__meta-right">
        <button
          v-if="!isExam"
          type="button"
          class="fav"
          :class="{ 'fav--on': favorited }"
          :aria-pressed="favorited"
          @click="emit('toggleFavorite')"
        >
          {{ favorited ? '已收藏' : '收藏' }}
        </button>
        <span>{{ progressText }}</span>
      </div>
    </header>

    <RichText class="card__stem" :source="question.stem" />

    <MediaBlock :items="question.media" :placement="['after-stem', 'unknown', 'inline']" />

    <ul v-if="isChoice" class="opts" role="list">
      <li v-for="opt in session.displayOptions" :key="opt.id">
        <button
          type="button"
          class="opt"
          :class="optionClass(opt.key)"
          :disabled="locked"
          :aria-pressed="isSelected(opt.key)"
          @click="onOptionClick(opt.key)"
        >
          <span class="opt__label">{{ opt.label }}</span>
          <span class="opt__body">
            <RichText :source="opt.content" />
            <MediaBlock v-if="opt.media?.length" :items="opt.media" />
          </span>
        </button>
      </li>
    </ul>

    <div v-else-if="isBlank" class="blanks">
      <label v-for="(_, i) in session.answer.texts" :key="i" class="field">
        <span>第 {{ i + 1 }} 空</span>
        <input
          :value="session.answer.texts[i]"
          type="text"
          :disabled="locked"
          autocomplete="off"
          @input="emit('setText', i, ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>

    <div v-else-if="isShort" class="short">
      <label class="field">
        <span>你的回答</span>
        <textarea
          :value="session.answer.texts[0] ?? ''"
          rows="5"
          :disabled="locked"
          @input="emit('setText', 0, ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </div>

    <MediaBlock :items="question.media" placement="after-options" />

    <section
      v-if="!isExam && submitted"
      class="result"
      :data-verdict="effectiveVerdict || 'ungraded'"
    >
      <p class="result__badge">{{ verdictLabel || '已提交' }}</p>
      <p v-if="session.result?.message && showAnswerDetail" class="result__msg">
        {{ session.result.message }}
      </p>

      <button
        v-if="!showAnswerDetail"
        type="button"
        class="btn btn--reveal"
        @click="emit('revealAnswer')"
      >
        查看答案
      </button>

      <template v-if="showAnswerDetail">
        <div v-if="isChoice && answerKeysText" class="result__block">
          <p class="result__label">正确答案</p>
          <p>{{ answerKeysText }}</p>
        </div>

        <div v-if="(isBlank || isShort) && question.answer.texts?.length" class="result__block">
          <p class="result__label">参考答案</p>
          <ul class="result__texts">
            <li v-for="(t, i) in question.answer.texts" :key="i">
              <RichText :source="t" />
            </li>
          </ul>
        </div>

        <div v-if="question.answer.explanation" class="result__block">
          <p class="result__label">解析</p>
          <RichText :source="question.answer.explanation" />
        </div>

        <MediaBlock
          v-if="question.answer.media?.length"
          :items="question.answer.media"
          placement="in-answer"
          caption="答案配图"
        />
      </template>

      <div v-if="isShort" class="self">
        <p class="result__label">自评</p>
        <div class="self__row">
          <button
            type="button"
            class="chip"
            :class="{ 'chip--on': session.selfVerdict === 'correct' }"
            @click="emit('selfGrade', 'correct')"
          >
            对
          </button>
          <button
            type="button"
            class="chip"
            :class="{ 'chip--on': session.selfVerdict === 'partial' }"
            @click="emit('selfGrade', 'partial')"
          >
            半对
          </button>
          <button
            type="button"
            class="chip"
            :class="{ 'chip--on': session.selfVerdict === 'wrong' }"
            @click="emit('selfGrade', 'wrong')"
          >
            错
          </button>
        </div>
      </div>
    </section>

    <section v-if="!isExam" class="note">
      <div class="note__head">
        <p class="note__title">笔记</p>
        <span v-if="noteSavedHint" class="note__saved">已保存</span>
      </div>
      <textarea
        v-model="noteDraft"
        class="note__input"
        rows="4"
        placeholder="记录思路、易错点…（自动保存到本机）"
      />
    </section>

    <footer class="card__foot">
      <button type="button" class="btn" :disabled="!canPrev" @click="emit('prev')">上一题</button>
      <template v-if="isExam">
        <button
          type="button"
          class="btn btn--primary"
          :disabled="!canNext"
          @click="emit('next')"
        >
          {{ canNext ? '下一题' : '已是最后一题' }}
        </button>
      </template>
      <template v-else>
        <button
          v-if="!session.submitted"
          type="button"
          class="btn btn--primary"
          :disabled="!canSubmit"
          @click="emit('submit')"
        >
          提交
        </button>
        <button
          v-else
          type="button"
          class="btn btn--primary"
          :disabled="!canNext"
          @click="emit('next')"
        >
          {{ canNext ? '下一题' : '已是最后一题' }}
        </button>
      </template>
    </footer>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.card__meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-weight: 600;
}

.card__meta-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.card__type {
  color: var(--color-accent);
}

.fav {
  min-height: var(--touch-min);
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.fav--on {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-soft);
}

.card__stem {
  font-size: var(--font-size-lg);
  line-height: 1.55;
}

.opts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-2);
}

.opt {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-3);
  align-items: start;
  width: 100%;
  min-height: var(--touch-min);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  text-align: left;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.opt:disabled {
  cursor: default;
}

.opt--selected {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.opt--correct {
  border-color: var(--color-success);
  background: var(--color-success-soft);
}

.opt--wrong {
  border-color: var(--color-danger);
  background: var(--color-danger-soft);
}

.opt__label {
  font-weight: 700;
  color: var(--color-accent);
  min-width: 1.2em;
}

.opt__body {
  display: grid;
  gap: var(--space-2);
}

.blanks,
.short {
  display: grid;
  gap: var(--space-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.field input,
.field textarea,
.note__input {
  min-height: var(--touch-min);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  resize: vertical;
}

.field textarea {
  min-height: 7.5rem;
  line-height: 1.55;
}

.result {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
}

.result[data-verdict='correct'] {
  border-color: color-mix(in srgb, var(--color-success) 45%, var(--color-border));
}

.result[data-verdict='wrong'] {
  border-color: color-mix(in srgb, var(--color-danger) 45%, var(--color-border));
}

.result[data-verdict='partial'] {
  border-color: color-mix(in srgb, var(--color-warning) 45%, var(--color-border));
}

.result__badge {
  font-weight: 700;
  font-size: var(--font-size-sm);
}

.result[data-verdict='correct'] .result__badge {
  color: var(--color-success);
}

.result[data-verdict='wrong'] .result__badge {
  color: var(--color-danger);
}

.result[data-verdict='partial'] .result__badge {
  color: var(--color-warning);
}

.result__msg,
.result__block {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.result__label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
}

.result__texts {
  margin: 0;
  padding-left: 1.1em;
  display: grid;
  gap: var(--space-1);
}

.self__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.chip {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: var(--color-bg);
}

.chip--on {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-soft);
}

.note {
  display: grid;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-border);
}

.note__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.note__title {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.note__saved {
  font-size: var(--font-size-xs);
  color: var(--color-success);
}

.note__input {
  min-height: 6rem;
  line-height: 1.55;
  font-size: var(--font-size-sm);
}

.card__foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-strong);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn--primary {
  margin-left: auto;
  background: var(--color-accent);
  color: var(--color-accent-text);
  border-color: transparent;
}

.btn--reveal {
  align-self: flex-start;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-color: color-mix(in srgb, var(--color-accent) 35%, var(--color-border));
}
</style>
