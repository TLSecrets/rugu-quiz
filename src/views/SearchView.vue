<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { formatBankTags } from '@/lib/bankTags'
import { fieldLabel, searchQuestions, splitHighlight } from '@/lib/search'
import { useBanksStore } from '@/stores/banks'
import { useQuizStore } from '@/stores/quiz'
import { QUESTION_TYPE_LABELS } from '@/types/question'

const router = useRouter()
const banks = useBanksStore()
const quiz = useQuizStore()

const input = ref('')
const keyword = ref('')
const bankFilter = ref('')
const tagFilter = ref('')
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
    (bankId) => {
      const b = banks.getBank(bankId)
      return { name: b?.name ?? '未知题库', tags: b?.tags }
    },
    keyword.value,
    {
      bankId: bankFilter.value || undefined,
      bankTag: tagFilter.value || undefined,
    },
  ),
)

const hasFilter = computed(() => !!(keyword.value || bankFilter.value || tagFilter.value))

function openHit(bankId: string, questionId: string) {
  quiz.openQuestion(bankId, questionId)
  void router.push({ name: 'practice', query: { bankId, questionId } })
}
</script>

<template>
  <PageHeader title="搜索" subtitle="按关键词检索，可按题库或题库标签缩小范围。">
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

      <label v-if="banks.banks.length" class="search__label" for="bank">题库</label>
      <select
        v-if="banks.banks.length"
        id="bank"
        v-model="bankFilter"
        class="search__select"
      >
        <option value="">全部题库</option>
        <option v-for="b in banks.banks" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>

      <label v-if="banks.allBankTags.length" class="search__label" for="bank-tag">题库标签</label>
      <select
        v-if="banks.allBankTags.length"
        id="bank-tag"
        v-model="tagFilter"
        class="search__select"
      >
        <option value="">全部标签</option>
        <option v-for="t in banks.allBankTags" :key="t" :value="t">{{ t }}</option>
      </select>

      <p v-if="hasFilter" class="search__meta">
        <template v-if="keyword">「{{ keyword }}」</template>
        <template v-if="bankFilter">
          · {{ banks.getBank(bankFilter)?.name ?? '题库' }}
        </template>
        <template v-if="tagFilter"> · 标签 {{ tagFilter }}</template>
        · {{ hits.length }} 条结果
      </p>
    </div>

    <EmptyState
      v-if="!hasFilter"
      title="输入关键字或选择题库 / 标签"
      description="支持题干、选项、解析、题目标签。点击结果可跳转练习并定位到该题。"
    />
    <EmptyState
      v-else-if="!hits.length"
      title="没有匹配题目"
      description="试试更短的关键词，或调整题库 / 标签筛选。"
    />

    <ul v-else class="results">
      <li v-for="hit in hits" :key="hit.question.id" class="hit">
        <button type="button" class="hit__btn" @click="openHit(hit.bankId, hit.question.id)">
          <div class="hit__top">
            <span class="hit__type">{{ QUESTION_TYPE_LABELS[hit.question.type] }}</span>
            <span class="hit__bank">{{ hit.bankName }}</span>
            <span v-if="hit.bankTags?.length" class="hit__tags">{{
              formatBankTags(hit.bankTags, 2)
            }}</span>
            <span class="hit__field">{{ fieldLabel(hit.field) }}</span>
          </div>
          <p class="hit__stem">
            <template v-for="(part, i) in splitHighlight(hit.question.stem, keyword)" :key="i">
              <mark v-if="part.hit">{{ part.text }}</mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </p>
          <p v-if="hit.field !== 'stem' && keyword" class="hit__snippet">
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
  margin-bottom: var(--space-5);
}

.search__label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.search__input,
.search__select {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-md);
}

.search__meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-3);
}

.hit {
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow: hidden;
}

.hit__btn {
  width: 100%;
  text-align: left;
  padding: var(--space-4);
}

.hit__btn:hover {
  background: var(--color-surface-muted);
}

.hit__top {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-weight: 600;
}

.hit__type {
  color: var(--color-accent);
}

.hit__tags {
  color: var(--color-text-secondary);
}

.hit__stem {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  line-height: 1.55;
}

.hit__snippet {
  margin-top: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

mark {
  background: color-mix(in srgb, var(--color-accent) 28%, transparent);
  color: inherit;
  padding: 0 0.1em;
  border-radius: 2px;
}
</style>
