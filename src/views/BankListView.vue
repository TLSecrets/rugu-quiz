<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import MediaBlock from '@/components/question/MediaBlock.vue'
import RichText from '@/components/common/RichText.vue'
import BankTagsField from '@/components/bank/BankTagsField.vue'
import BankTagManager from '@/components/bank/BankTagManager.vue'
import { bankMatchesTags, bankTagMatchModeLabel, normalizeBankTags } from '@/lib/bankTags'
import { useBanksStore } from '@/stores/banks'
import { useQuizStore } from '@/stores/quiz'
import { useSettingsStore } from '@/stores/settings'
import { QUESTION_TYPE_LABELS, type Bank, type Question } from '@/types/question'

const banks = useBanksStore()
const quiz = useQuizStore()
const settings = useSettingsStore()

const previewBankId = ref<string | null>(null)
const filterTags = ref<string[]>([])
const editingId = ref<string | null>(null)
const editForm = reactive({
  name: '',
  description: '',
  tags: [] as string[],
})
const editBusy = ref(false)
const editError = ref<string | null>(null)

onMounted(() => {
  if (!banks.ready) void banks.refresh()
})

watch(
  () => banks.allBankTags,
  (tags) => {
    const set = new Set(tags)
    filterTags.value = filterTags.value.filter((t) => set.has(t))
  },
)

const visibleBanks = computed(() => {
  if (!filterTags.value.length) return banks.banks
  return banks.banks.filter((b) =>
    bankMatchesTags(b.tags, filterTags.value, settings.bankTagMatchMode),
  )
})

const tagMatchHint = computed(() => bankTagMatchModeLabel(settings.bankTagMatchMode))

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

function toggleFilterTag(tag: string) {
  const set = new Set(filterTags.value)
  if (set.has(tag)) set.delete(tag)
  else set.add(tag)
  filterTags.value = [...set]
}

function beginEdit(bank: Bank) {
  editingId.value = bank.id
  editForm.name = bank.name
  editForm.description = bank.description ?? ''
  editForm.tags = normalizeBankTags(bank.tags)
  editError.value = null
  previewBankId.value = null
}

function cancelEdit() {
  editingId.value = null
  editError.value = null
}

async function saveEdit() {
  if (!editingId.value) return
  editBusy.value = true
  editError.value = null
  try {
    await banks.updateBankMeta(editingId.value, {
      name: editForm.name,
      description: editForm.description,
      tags: editForm.tags,
    })
    editingId.value = null
  } catch (e) {
    editError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    editBusy.value = false
  }
}
</script>

<template>
  <PageHeader
    title="题库"
    subtitle="可管理标签（添加 / 修改 / 删除），再挂到各题库；练习、考试、搜索均可按标签筛选。"
  >
    <LoadingState v-if="banks.loading" label="正在加载题库…" />
    <ErrorState
      v-else-if="banks.error"
      title="题库加载失败"
      :message="banks.error"
      retryable
      @retry="banks.refresh()"
    />

    <template v-else>
      <BankTagManager />

      <EmptyState
        v-if="!banks.banks.length"
        title="暂无题库"
        description="示例题库应在首次打开时自动写入。若仍为空，请刷新页面或前往导入。"
      >
        <RouterLink class="link" to="/import-export">去导入</RouterLink>
      </EmptyState>

      <template v-else>
      <div v-if="banks.allBankTags.length" class="filter">
        <p class="filter__label">按标签筛选题库</p>
        <p class="filter__hint">{{ tagMatchHint }} · 可在设置中切换</p>
        <div class="chips">
          <button
            v-for="tag in banks.allBankTags"
            :key="tag"
            type="button"
            class="chip"
            :class="{ 'chip--on': filterTags.includes(tag) }"
            @click="toggleFilterTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </div>

      <EmptyState
        v-if="!visibleBanks.length"
        title="没有匹配的题库"
        description="换一组标签，或清除筛选后再看。"
      >
        <button type="button" class="link" @click="filterTags = []">清除筛选</button>
      </EmptyState>

      <ul v-else class="list">
        <li v-for="bank in visibleBanks" :key="bank.id" class="card">
          <div class="card__top">
            <div>
              <p class="card__badge">{{ sourceLabel(bank.source) }}</p>
              <h3 class="card__title">{{ bank.name }}</h3>
              <p v-if="bank.description" class="card__desc">{{ bank.description }}</p>
              <div v-if="bank.tags?.length" class="tag-row">
                <span v-for="tag in bank.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
            </div>
            <p class="card__count">
              <strong>{{ bank.questionCount }}</strong>
              题
            </p>
          </div>

          <div v-if="editingId === bank.id" class="edit">
            <label class="field">
              <span>名称</span>
              <input v-model="editForm.name" type="text" maxlength="80" />
            </label>
            <label class="field">
              <span>简介</span>
              <textarea v-model="editForm.description" rows="2" maxlength="200" />
            </label>
            <div class="field">
              <span>标签</span>
              <BankTagsField v-model="editForm.tags" :suggestions="banks.allBankTags" />
            </div>
            <p v-if="editError" class="err">{{ editError }}</p>
            <div class="card__actions">
              <button type="button" class="btn btn--primary" :disabled="editBusy" @click="saveEdit">
                {{ editBusy ? '保存中…' : '保存' }}
              </button>
              <button type="button" class="btn btn--ghost" :disabled="editBusy" @click="cancelEdit">
                取消
              </button>
            </div>
          </div>

          <div v-else class="card__actions">
            <RouterLink
              class="btn btn--primary"
              :to="{ name: 'practice', query: { bankId: bank.id } }"
              @click="startPractice(bank.id)"
            >
              开始练习
            </RouterLink>
            <button type="button" class="btn btn--ghost" @click="beginEdit(bank)">编辑</button>
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
      </template>
    </template>
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
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.filter {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.filter__label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.filter__hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.chips {
  display: flex;
  flex-wrap: nowrap;
  gap: var(--space-2);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 2px;
  max-width: 100%;
}

.chip {
  min-height: var(--touch-min);
  padding: 0 var(--space-3);
  flex: 0 0 auto;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  background: var(--color-surface);
}

.chip--on {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-soft);
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

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.tag {
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--color-accent-soft);
  color: var(--color-accent);
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

.edit {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-border);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.field input,
.field textarea {
  min-height: var(--touch-min);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
}

.err {
  font-size: var(--font-size-sm);
  color: var(--color-danger);
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

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
