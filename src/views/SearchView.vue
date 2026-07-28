<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { fieldLabel, searchQuestions, splitHighlight } from '@/lib/search'
import { useBanksStore } from '@/stores/banks'
import { useQuizStore } from '@/stores/quiz'
import { QUESTION_TYPE_LABELS } from '@/types/question'

const router = useRouter()
const banks = useBanksStore()
const quiz = useQuizStore()

const input = ref('')
const keyword = ref('')
let timer: ReturnType<typeof setTimeout> | null = null

watch(input, (value) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    keyword.value = value.trim()
  }, 280)
})

onMounted(() => {
  if (!banks.ready) void banks.refresh()
})

const allQuestions = computed(() =>
  banks.banks.flatMap((b) => banks.getQuestions(b.id)),
)

const hits = computed(() =>
  searchQuestions(
    allQuestions.value,
    (bankId) => banks.getBank(bankId)?.name ?? '未知题库',
    keyword.value,
  ),
)

function openHit(bankId: string, questionId: string) {
  quiz.openQuestion(bankId, questionId)
  void router.push({ name: 'practice', query: { bankId, questionId } })
}
</script>

<template>
  <PageHeader title="搜索" subtitle="检索本机已加载题库的题干、选项、解析与标签。">
    <div class="search">
      <label class="search__label" for="q">关键词</label>
      <input
        id="q"
        v-model="input"
        class="search__input"
        type="search"
        placeholder="输入关键字…"
        autocomplete="off"
      />
      <p v-if="keyword" class="search__meta">
        「{{ keyword }}」· {{ hits.length }} 条结果
      </p>
    </div>

    <EmptyState
      v-if="!keyword"
      title="输入关键字开始搜索"
      description="支持题干、选项、解析、标签。点击结果可跳转练习并定位到该题。"
    />
    <EmptyState
      v-else-if="!hits.length"
      title="没有匹配题目"
      description="试试更短的关键词，或先导入更多题库。"
    />

    <ul v-else class="results">
      <li v-for="hit in hits" :key="hit.question.id" class="hit">
        <button type="button" class="hit__btn" @click="openHit(hit.bankId, hit.question.id)">
          <div class="hit__top">
            <span class="hit__type">{{ QUESTION_TYPE_LABELS[hit.question.type] }}</span>
            <span class="hit__bank">{{ hit.bankName }}</span>
            <span class="hit__field">{{ fieldLabel(hit.field) }}</span>
          </div>
          <p class="hit__stem">
            <template v-for="(part, i) in splitHighlight(hit.question.stem, keyword)" :key="i">
              <mark v-if="part.hit">{{ part.text }}</mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </p>
          <p v-if="hit.field !== 'stem'" class="hit__snippet">
            <template v-for="(part, i) in splitHighlight(hit.snippet, keyword)" :key="i">
              <mark v-if="part.hit">{{ part.text }}</mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </p>
        </button>
      </li>
    </ul>
  </PageHeader>
</template>

<style scoped>
.search {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.search__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.search__input {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.search__meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-3);
}

.hit__btn {
  width: 100%;
  text-align: left;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  display: grid;
  gap: var(--space-2);
  min-height: var(--touch-min);
}

.hit__btn:hover {
  border-color: var(--color-accent);
}

.hit__top {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.hit__type {
  color: var(--color-accent);
  font-weight: 600;
}

.hit__stem {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: 1.5;
}

.hit__snippet {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: 1.45;
}

mark {
  background: color-mix(in srgb, var(--color-warning) 35%, transparent);
  color: inherit;
  padding: 0 0.1em;
  border-radius: 2px;
}
</style>
