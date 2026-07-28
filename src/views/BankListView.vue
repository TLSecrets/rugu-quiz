<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import MediaBlock from '@/components/question/MediaBlock.vue'
import RichText from '@/components/common/RichText.vue'
import { useBanksStore } from '@/stores/banks'
import { useQuizStore } from '@/stores/quiz'
import { QUESTION_TYPE_LABELS, type Question } from '@/types/question'

const banks = useBanksStore()
const quiz = useQuizStore()

const previewBankId = ref<string | null>(null)

onMounted(() => {
  if (!banks.ready) void banks.refresh()
})

function sourceLabel(source: string) {
  if (source === 'builtin') return '内置'
  if (source === 'import') return '导入'
  return '构建'
}

function startPractice(bankId: string) {
  quiz.startBank(bankId, 0)
}

function togglePreview(bankId: string) {
  previewBankId.value = previewBankId.value === bankId ? null : bankId
}

function previewQuestions(bankId: string): Question[] {
  return banks.getQuestions(bankId).slice(0, 3)
}
</script>

<template>
  <PageHeader title="题库" subtitle="数据保存在本机 IndexedDB。内置示例题可预览配图与公式。">
    <LoadingState v-if="banks.loading" label="正在加载题库…" />
    <ErrorState
      v-else-if="banks.error"
      title="题库加载失败"
      :message="banks.error"
      retryable
      @retry="banks.refresh()"
    />

    <EmptyState
      v-else-if="!banks.banks.length"
      title="暂无题库"
      description="示例题库应在首次打开时自动写入。若仍为空，请刷新页面或前往导入。"
    >
      <RouterLink class="link" to="/import-export">去导入</RouterLink>
    </EmptyState>

    <ul v-else class="list">
      <li v-for="bank in banks.banks" :key="bank.id" class="card">
        <div class="card__top">
          <div>
            <p class="card__badge">{{ sourceLabel(bank.source) }}</p>
            <h3 class="card__title">{{ bank.name }}</h3>
            <p v-if="bank.description" class="card__desc">{{ bank.description }}</p>
          </div>
          <p class="card__count">
            <strong>{{ bank.questionCount }}</strong>
            题
          </p>
        </div>

        <div class="card__actions">
          <RouterLink
            class="btn btn--primary"
            :to="{ name: 'practice', query: { bankId: bank.id } }"
            @click="startPractice(bank.id)"
          >
            开始练习
          </RouterLink>
          <button type="button" class="btn btn--ghost" @click="togglePreview(bank.id)">
            {{ previewBankId === bank.id ? '收起预览' : '预览样题' }}
          </button>
        </div>

        <div v-if="previewBankId === bank.id" class="preview">
          <article
            v-for="q in previewQuestions(bank.id)"
            :key="q.id"
            class="preview__item"
          >
            <p class="preview__type">{{ QUESTION_TYPE_LABELS[q.type] }}</p>
            <RichText class="preview__stem" :source="q.stem" />
            <MediaBlock
              :items="q.media"
              :placement="['after-stem', 'unknown', 'after-options', 'inline']"
              caption="题目配图"
            />
            <MediaBlock
              v-if="q.answer.media?.length"
              :items="q.answer.media"
              placement="in-answer"
              caption="答案配图"
            />
          </article>
        </div>
      </li>
    </ul>
  </PageHeader>
</template>

<style scoped>
.link {
  min-height: var(--touch-min);
  display: inline-flex;
  align-items: center;
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-4);
}

.card {
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.card__top {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.card__badge {
  display: inline-block;
  margin-bottom: var(--space-2);
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  letter-spacing: 0.06em;
}

.card__title {
  font-size: var(--font-size-lg);
}

.card__desc {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  max-width: 40em;
}

.card__count {
  flex-shrink: 0;
  text-align: right;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.card__count strong {
  display: block;
  font-size: var(--font-size-2xl);
  color: var(--color-text);
  font-family: var(--font-display);
  line-height: 1;
}

.card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.btn--primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
}

.btn--ghost {
  border: 1px solid var(--color-border-strong);
  color: var(--color-text-secondary);
}

.preview {
  display: grid;
  gap: var(--space-4);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-border);
}

.preview__item {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.preview__type {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  font-weight: 600;
}

.preview__stem {
  font-size: var(--font-size-sm);
  color: var(--color-text);
}
</style>
