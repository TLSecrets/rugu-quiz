<script setup lang="ts">
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { formatBankTags } from '@/lib/bankTags'
import { useBanksStore } from '@/stores/banks'
import { useFavoritesStore } from '@/stores/favorites'
import { useQuizStore } from '@/stores/quiz'
import { QUESTION_TYPE_LABELS } from '@/types/question'

const router = useRouter()
const banks = useBanksStore()
const favorites = useFavoritesStore()
const quiz = useQuizStore()

function questionOf(id: string) {
  for (const list of Object.values(banks.questionsByBank)) {
    const found = list.find((q) => q.id === id)
    if (found) return found
  }
  return undefined
}

function practiceAll() {
  quiz.startFavorites(0)
  void router.push({ name: 'practice', query: { scope: 'favorites' } })
}

function practiceOne(bankId: string, questionId: string) {
  quiz.openQuestion(bankId, questionId, 'favorites')
  void router.push({
    name: 'practice',
    query: { scope: 'favorites', questionId },
  })
}
</script>

<template>
  <PageHeader title="收藏" subtitle="收藏保存在本机。可单题跳转，或整夹练习。">
    <div v-if="favorites.items.length" class="toolbar">
      <button type="button" class="btn btn--primary" @click="practiceAll">练习全部收藏</button>
      <p class="toolbar__meta">共 {{ favorites.items.length }} 题</p>
    </div>

    <EmptyState
      v-if="!favorites.items.length"
      title="还没有收藏"
      description="在练习页点击「收藏」，题目会出现在这里。"
    >
      <RouterLink class="link" to="/practice">去练习</RouterLink>
    </EmptyState>

    <ul v-else class="list">
      <li v-for="item in favorites.items" :key="item.questionId" class="row">
        <button type="button" class="row__main" @click="practiceOne(item.bankId, item.questionId)">
          <p class="row__type">
            {{
              questionOf(item.questionId)
                ? QUESTION_TYPE_LABELS[questionOf(item.questionId)!.type]
                : '题目'
            }}
          </p>
          <p class="row__stem">
            {{ questionOf(item.questionId)?.stem ?? item.questionId }}
          </p>
          <p class="row__bank">
            {{ banks.getBank(item.bankId)?.name ?? item.bankId }}
            <template v-if="formatBankTags(banks.getBank(item.bankId)?.tags)">
              · {{ formatBankTags(banks.getBank(item.bankId)?.tags) }}
            </template>
          </p>
        </button>
        <button
          type="button"
          class="btn"
          @click="favorites.toggle(item.questionId, item.bankId)"
        >
          取消
        </button>
      </li>
    </ul>
  </PageHeader>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.toolbar__meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-3);
}

.row {
  display: flex;
  gap: var(--space-3);
  align-items: stretch;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.row__main {
  flex: 1;
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  min-width: 0;
}

.row__main:hover {
  background: var(--color-surface-muted);
}

.row__type {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  font-weight: 600;
}

.row__stem {
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
}

.row__bank {
  margin-top: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.btn {
  flex-shrink: 0;
  align-self: center;
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

.link {
  min-height: var(--touch-min);
  display: inline-flex;
  align-items: center;
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 600;
}
</style>
