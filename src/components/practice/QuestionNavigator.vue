<script setup lang="ts">
import { computed } from 'vue'
import type { GradeVerdict } from '@/lib/grade'
import type { Question } from '@/types/question'

const props = defineProps<{
  questions: Question[]
  currentIndex: number
  verdicts: Record<string, GradeVerdict>
  favoriteIds: Set<string>
  submittedIds: Set<string>
}>()

const emit = defineEmits<{
  jump: [index: number]
}>()

function statusOf(q: Question, index: number) {
  const verdict = props.verdicts[q.id]
  const submitted = props.submittedIds.has(q.id) || (!!verdict && verdict !== 'ungraded')
  let tone: 'idle' | 'answered' | 'correct' | 'wrong' | 'partial' = 'idle'
  if (verdict === 'correct') tone = 'correct'
  else if (verdict === 'wrong') tone = 'wrong'
  else if (verdict === 'partial') tone = 'partial'
  else if (submitted) tone = 'answered'
  return {
    tone,
    current: index === props.currentIndex,
    favorited: props.favoriteIds.has(q.id),
  }
}

const items = computed(() =>
  props.questions.map((q, index) => ({
    q,
    index,
    ...statusOf(q, index),
  })),
)
</script>

<template>
  <nav class="nav" aria-label="题号导航">
    <p class="nav__title">题号</p>
    <div class="nav__grid">
      <button
        v-for="item in items"
        :key="item.q.id"
        type="button"
        class="cell"
        :class="[
          `cell--${item.tone}`,
          { 'cell--current': item.current, 'cell--fav': item.favorited },
        ]"
        :aria-current="item.current ? 'true' : undefined"
        :title="`第 ${item.index + 1} 题`"
        @click="emit('jump', item.index)"
      >
        {{ item.index + 1 }}
      </button>
    </div>
    <ul class="legend">
      <li><span class="dot dot--idle" />未作答</li>
      <li><span class="dot dot--answered" />已作答</li>
      <li><span class="dot dot--correct" />正确</li>
      <li><span class="dot dot--wrong" />错误</li>
      <li><span class="dot dot--fav" />收藏</li>
    </ul>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.nav__title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
}

.nav__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(2.25rem, 1fr));
  gap: var(--space-2);
}

.cell {
  min-height: 2.25rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-bg);
}

.cell--answered {
  color: var(--color-accent);
  border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
  background: var(--color-accent-soft);
}

.cell--correct {
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 45%, var(--color-border));
  background: var(--color-success-soft);
}

.cell--wrong {
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 45%, var(--color-border));
  background: var(--color-danger-soft);
}

.cell--partial {
  color: #c9842e;
  border-color: color-mix(in srgb, #c9842e 45%, var(--color-border));
  background: color-mix(in srgb, #c9842e 16%, transparent);
}

.cell--current {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.cell--fav {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #d4a017 70%, transparent);
}

.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  font-size: 11px;
  color: var(--color-text-muted);
}

.legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 2px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}

.dot--answered {
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
}

.dot--correct {
  background: var(--color-success-soft);
  border-color: var(--color-success);
}

.dot--wrong {
  background: var(--color-danger-soft);
  border-color: var(--color-danger);
}

.dot--fav {
  box-shadow: inset 0 0 0 1px #d4a017;
}
</style>
