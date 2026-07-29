<script setup lang="ts">
import { computed } from 'vue'
import {
  ALL_QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type Question,
  type QuestionType,
} from '@/types/question'
import type { ParseIssue } from '@/lib/parsers/types'

const props = defineProps<{
  questions: Question[]
  issues: ParseIssue[]
}>()

const emit = defineEmits<{
  'update:questions': [value: Question[]]
  remove: [index: number]
}>()

const uncertainCount = computed(
  () => props.questions.filter((q) => q.sourceMeta?.uncertain || q.sourceMeta?.inferredType).length,
)

function updateAt(index: number, patch: Partial<Question>) {
  const next = props.questions.map((q, i) => {
    if (i !== index) return q
    const merged = { ...q, ...patch }
    if (patch.type && patch.type !== q.type) {
      merged.sourceMeta = {
        ...merged.sourceMeta,
        inferredType: false,
        uncertain: false,
      }
    }
    if (patch.answer !== undefined) {
      merged.sourceMeta = {
        ...merged.sourceMeta,
        uncertain: false,
      }
    }
    return merged
  })
  emit('update:questions', next)
}

function updateAnswerText(index: number, value: string) {
  const q = props.questions[index]
  if (!q) return
  if (q.type === 'blank' || q.type === 'short') {
    const texts = value
      .split(/[|｜]/)
      .map((t) => t.trim())
      .filter(Boolean)
    updateAt(index, { answer: { ...q.answer, texts } })
    return
  }
  if (q.type === 'judge') {
    const n = value.replace(/\s/g, '')
    const truthy = ['对', '正确', '是', 'A', 'a', 'true']
    const keys = truthy.includes(n) ? ['true'] : ['false']
    updateAt(index, { answer: { ...q.answer, optionKeys: keys } })
    return
  }
  const keys = value
    .toUpperCase()
    .split(/[,，、\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => /^[a-h]$/.test(t))
  updateAt(index, { answer: { ...q.answer, optionKeys: keys } })
}

function answerDisplay(q: Question): string {
  if (q.type === 'blank' || q.type === 'short') return (q.answer.texts ?? []).join('|')
  if (q.type === 'judge') {
    return q.answer.optionKeys?.[0] === 'false' ? '错误' : '正确'
  }
  return (q.answer.optionKeys ?? []).map((k) => k.toUpperCase()).join(',')
}

function onTypeChange(index: number, type: QuestionType) {
  updateAt(index, { type })
}

function issueLevelClass(level?: string) {
  if (level === 'error') return 'issue--error'
  if (level === 'warn') return 'issue--warn'
  return 'issue--info'
}
</script>

<template>
  <div class="preview-editor">
    <p class="meta">
      共 {{ questions.length }} 题
      <template v-if="uncertainCount"> · {{ uncertainCount }} 题建议核对（高亮）</template>
    </p>

    <ul v-if="issues.length" class="issues">
      <li
        v-for="(issue, i) in issues.slice(0, 20)"
        :key="i"
        class="issue"
        :class="issueLevelClass(issue.level)"
      >
        <template v-if="issue.row">第 {{ issue.row }} 行：</template>{{ issue.message }}
      </li>
    </ul>

    <div class="cards">
      <article
        v-for="(q, index) in questions"
        :key="q.id"
        class="card"
        :class="{ 'card--uncertain': q.sourceMeta?.uncertain || q.sourceMeta?.inferredType }"
      >
        <header class="card__head">
          <span class="idx">#{{ index + 1 }}</span>
          <select
            class="type"
            :value="q.type"
            @change="onTypeChange(index, ($event.target as HTMLSelectElement).value as QuestionType)"
          >
            <option v-for="t in ALL_QUESTION_TYPES" :key="t" :value="t">
              {{ QUESTION_TYPE_LABELS[t] }}
            </option>
          </select>
          <span v-if="q.sourceMeta?.inferredType" class="tag">已推断</span>
          <span v-if="q.sourceMeta?.uncertain" class="tag tag--warn">待核对</span>
          <button type="button" class="btn-remove" @click="emit('remove', index)">移除</button>
        </header>

        <label class="field">
          <span>题干</span>
          <textarea
            :value="q.stem"
            rows="3"
            @change="updateAt(index, { stem: ($event.target as HTMLTextAreaElement).value })"
          />
        </label>

        <div class="row2">
          <label class="field">
            <span>答案</span>
            <input
              :value="answerDisplay(q)"
              type="text"
              :placeholder="q.type === 'blank' || q.type === 'short' ? '多空用 | 分隔' : '如 A 或 A,C'"
              @change="updateAnswerText(index, ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>

        <p v-if="q.options?.length" class="opts">
          <span v-for="opt in q.options" :key="opt.id" class="opt">
            {{ opt.label }}. {{ opt.content }}
          </span>
        </p>
      </article>
    </div>
  </div>
</template>

<style scoped>
.preview-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.issues {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-1);
  max-height: 10rem;
  overflow: auto;
}

.issue {
  font-size: var(--font-size-xs);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-muted);
}

.issue--info {
  border-left: 3px solid var(--color-accent);
}

.issue--warn {
  border-left: 3px solid #c9842e;
  color: var(--color-text-secondary);
}

.issue--error {
  border-left: 3px solid var(--color-danger);
  color: var(--color-danger);
}

.cards {
  display: grid;
  gap: var(--space-3);
}

.card {
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  display: grid;
  gap: var(--space-3);
}

.card--uncertain {
  border-color: color-mix(in srgb, #c9842e 55%, var(--color-border));
  background: color-mix(in srgb, #c9842e 8%, var(--color-bg));
}

.card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.idx {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--color-text-muted);
}

.type {
  min-height: 32px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-accent);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: var(--color-accent-soft);
}

.tag--warn {
  color: #c9842e;
  background: color-mix(in srgb, #c9842e 18%, transparent);
}

.btn-remove {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  min-height: 32px;
  padding: 0 var(--space-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.field textarea,
.field input {
  min-height: 36px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.field textarea {
  min-height: 4.5rem;
  resize: vertical;
  line-height: 1.5;
}

.row2 {
  display: grid;
  gap: var(--space-3);
}

@media (min-width: 640px) {
  .row2 {
    grid-template-columns: 1fr 1fr;
  }
}

.opts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.opt {
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
</style>
