<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import {
  ALL_QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type QuestionType,
} from '@/types/question'
import type { PracticeOrder } from '@/stores/quiz'
import type { ShowAnswerMode } from '@/types/settings'
import { useBanksStore } from '@/stores/banks'
import { useQuizStore } from '@/stores/quiz'
import { useSettingsStore } from '@/stores/settings'

const emit = defineEmits<{
  start: []
}>()

const banks = useBanksStore()
const quiz = useQuizStore()
const settings = useSettingsStore()

const form = reactive({
  order: 'sequential' as PracticeOrder,
  bankIds: [] as string[],
  types: [] as QuestionType[],
  domains: [] as string[],
  shuffleOptions: settings.shuffleOptions,
  autoNextEnabled: settings.autoNextEnabled,
  autoNextDelay: settings.autoNextDelay,
  showAnswerMode: settings.showAnswerMode as ShowAnswerMode,
})

watch(
  () => banks.banks,
  (list) => {
    if (!form.bankIds.length && list.length) {
      form.bankIds = list.map((b) => b.id)
    }
  },
  { immediate: true },
)

watch(
  () => settings.enabledTypes,
  (types) => {
    if (!form.types.length && types.length) form.types = [...types]
  },
  { immediate: true },
)

const allBanksChecked = computed(
  () => banks.banks.length > 0 && form.bankIds.length === banks.banks.length,
)

const previewCount = computed(() => {
  const mode = form.bankIds.length === 1 ? 'bank' : 'multi'
  const cfg = {
    mode: mode as 'bank' | 'multi',
    bankIds: form.bankIds,
    types: form.types,
    domains: form.domains,
    order: form.order,
    shuffleOptions: form.shuffleOptions,
    autoNextEnabled: form.autoNextEnabled,
    autoNextDelay: form.autoNextDelay,
    showAnswerMode: form.showAnswerMode,
  }
  return quiz.buildPool(cfg).length
})

function toggleAllBanks() {
  if (allBanksChecked.value) form.bankIds = []
  else form.bankIds = banks.banks.map((b) => b.id)
}

function toggleBank(id: string) {
  const set = new Set(form.bankIds)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  form.bankIds = [...set]
}

function isTypeOn(type: QuestionType) {
  if (!form.types.length) return true
  return form.types.includes(type)
}

function toggleType(type: QuestionType) {
  if (!form.types.length) {
    form.types = ALL_QUESTION_TYPES.filter((t) => t !== type)
    return
  }
  const set = new Set(form.types)
  if (set.has(type)) set.delete(type)
  else set.add(type)
  form.types = [...set]
  if (form.types.length === ALL_QUESTION_TYPES.length) form.types = []
}

function toggleDomain(domain: string) {
  const set = new Set(form.domains)
  if (set.has(domain)) set.delete(domain)
  else set.add(domain)
  form.domains = [...set]
}

function onStart() {
  if (!form.bankIds.length) return
  quiz.startPractice({
    bankIds: [...form.bankIds],
    types: [...form.types],
    domains: [...form.domains],
    order: form.order,
    shuffleOptions: form.shuffleOptions,
    autoNextEnabled: form.autoNextEnabled,
    autoNextDelay: Math.min(30, Math.max(0, Number(form.autoNextDelay) || 0)),
    showAnswerMode: form.showAnswerMode,
  })
  emit('start')
}
</script>

<template>
  <section class="setup">
    <h3 class="setup__title">开始练习</h3>
    <p class="setup__desc">选择题库与范围后开始；随机模式会固定本次题序，刷新不会重新洗牌。</p>

    <div class="block">
      <p class="block__label">练习模式</p>
      <div class="segment">
        <button
          type="button"
          class="segment__btn"
          :class="{ 'segment__btn--active': form.order === 'sequential' }"
          @click="form.order = 'sequential'"
        >
          顺序
        </button>
        <button
          type="button"
          class="segment__btn"
          :class="{ 'segment__btn--active': form.order === 'random' }"
          @click="form.order = 'random'"
        >
          随机
        </button>
      </div>
    </div>

    <div class="block">
      <div class="block__head">
        <p class="block__label">题库</p>
        <button type="button" class="text-btn" @click="toggleAllBanks">
          {{ allBanksChecked ? '取消全选' : '全选' }}
        </button>
      </div>
      <p v-if="!banks.banks.length" class="hint">还没有题库，请先导入。</p>
      <div v-else class="checks">
        <label v-for="bank in banks.banks" :key="bank.id" class="check">
          <input
            type="checkbox"
            :checked="form.bankIds.includes(bank.id)"
            @change="toggleBank(bank.id)"
          />
          <span>{{ bank.name }}</span>
          <span class="muted">({{ bank.questionCount }})</span>
        </label>
      </div>
    </div>

    <div class="block">
      <p class="block__label">题型（不选或全选 = 全部）</p>
      <div class="chips">
        <button
          v-for="type in ALL_QUESTION_TYPES"
          :key="type"
          type="button"
          class="chip"
          :class="{ 'chip--on': isTypeOn(type) }"
          @click="toggleType(type)"
        >
          {{ QUESTION_TYPE_LABELS[type] }}
        </button>
      </div>
    </div>

    <div v-if="quiz.allDomains.length" class="block">
      <p class="block__label">领域（不选 = 全部）</p>
      <div class="chips">
        <button
          v-for="domain in quiz.allDomains"
          :key="domain"
          type="button"
          class="chip"
          :class="{ 'chip--on': form.domains.includes(domain) }"
          @click="toggleDomain(domain)"
        >
          {{ domain }}
        </button>
      </div>
    </div>

    <div class="block">
      <p class="block__label">选项</p>
      <label class="check">
        <input v-model="form.shuffleOptions" type="checkbox" />
        <span>打乱选项顺序</span>
      </label>
      <label class="check">
        <input v-model="form.autoNextEnabled" type="checkbox" />
        <span>答题后自动下一题</span>
      </label>
      <label v-if="form.autoNextEnabled" class="field-inline">
        <span>延迟</span>
        <input v-model.number="form.autoNextDelay" type="number" min="0" max="30" />
        <span>秒</span>
      </label>
      <label class="field-inline">
        <span>答案展示</span>
        <select v-model="form.showAnswerMode">
          <option value="instant">即时显示</option>
          <option value="manual">手动确认</option>
        </select>
      </label>
    </div>

    <div class="setup__foot">
      <p class="muted">预计 {{ previewCount }} 题</p>
      <button
        type="button"
        class="btn btn--primary"
        :disabled="!form.bankIds.length || previewCount === 0"
        @click="onStart"
      >
        开始练习
      </button>
    </div>
  </section>
</template>

<style scoped>
.setup {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.setup__title {
  font-size: var(--font-size-lg);
}

.setup__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: calc(var(--space-2) * -1);
}

.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.block__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
}

.block__label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.segment {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  padding: var(--space-1);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
}

.segment__btn {
  min-height: var(--touch-min);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.segment__btn--active {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}

.checks {
  display: grid;
  gap: var(--space-2);
}

.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-min);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.check input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-accent);
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

.field-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.field-inline input,
.field-inline select {
  min-height: 36px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  width: 5.5rem;
}

.field-inline select {
  width: auto;
  min-width: 8rem;
}

.setup__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
}

.btn--primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
  border-color: transparent;
  font-weight: 600;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.text-btn {
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  font-weight: 600;
  min-height: var(--touch-min);
}

.muted {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
