<script setup lang="ts">
import { computed, ref } from 'vue'
import { exportQuestionsPdf, type PdfScope } from '@/lib/exportPdf'
import type { Question } from '@/types/question'

const props = defineProps<{
  title: string
  questions: Question[]
  /** 当前题（可选） */
  current?: Question | null
  /** 错题 id */
  wrongIds?: string[]
}>()

const scope = ref<PdfScope>('bank')
const includeAnswers = ref(true)
const busy = ref(false)
const progress = ref('')
const error = ref<string | null>(null)
const message = ref<string | null>(null)

const wrongSet = computed(() => new Set(props.wrongIds ?? []))

const canWrong = computed(() => (props.wrongIds?.length ?? 0) > 0)
const canCurrent = computed(() => !!props.current)

async function runExport() {
  error.value = null
  message.value = null
  let list: Question[] = []
  if (scope.value === 'current') {
    if (!props.current) {
      error.value = '当前没有可导出的题目'
      return
    }
    list = [props.current]
  } else if (scope.value === 'wrong') {
    list = props.questions.filter((q) => wrongSet.value.has(q.id))
    if (!list.length) {
      error.value = '暂无错题可导出'
      return
    }
  } else {
    list = props.questions
  }

  busy.value = true
  progress.value = `0 / ${list.length}`
  try {
    await exportQuestionsPdf({
      title: props.title,
      questions: list,
      includeAnswers: includeAnswers.value,
      onProgress: (done, total) => {
        progress.value = `${done} / ${total}`
      },
    })
    message.value = `已导出 PDF（${list.length} 题）`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'PDF 导出失败'
  } finally {
    busy.value = false
    progress.value = ''
  }
}
</script>

<template>
  <section class="pdf">
    <h3 class="pdf__title">导出 PDF</h3>
    <p class="pdf__desc">
      可导出当前题、会话/题库内错题或整表；错题本页导出范围为持久错题。支持是否包含答案与解析。
    </p>

    <div class="segment" role="radiogroup" aria-label="导出范围">
      <button
        type="button"
        class="segment__btn"
        :class="{ 'segment__btn--active': scope === 'current' }"
        :disabled="!canCurrent"
        @click="scope = 'current'"
      >
        当前题
      </button>
      <button
        type="button"
        class="segment__btn"
        :class="{ 'segment__btn--active': scope === 'wrong' }"
        :disabled="!canWrong"
        @click="scope = 'wrong'"
      >
        错题集
      </button>
      <button
        type="button"
        class="segment__btn"
        :class="{ 'segment__btn--active': scope === 'bank' }"
        :disabled="!questions.length"
        @click="scope = 'bank'"
      >
        整库
      </button>
    </div>

    <label class="toggle">
      <input v-model="includeAnswers" type="checkbox" />
      <span>包含答案与解析</span>
    </label>

    <button
      type="button"
      class="btn"
      :disabled="busy || !questions.length"
      @click="runExport"
    >
      {{ busy ? `导出中 ${progress}` : '下载 PDF' }}
    </button>

    <p v-if="message" class="flash flash--ok">{{ message }}</p>
    <p v-if="error" class="flash flash--err">{{ error }}</p>
  </section>
</template>

<style scoped>
.pdf {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.pdf__title {
  font-size: var(--font-size-md);
}

.pdf__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.segment {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

.segment__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.segment__btn--active {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-sm);
}

.toggle {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--touch-min);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.toggle input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-accent);
}

.btn {
  align-self: start;
  min-height: var(--touch-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-accent-text);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.flash {
  font-size: var(--font-size-sm);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.flash--ok {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.flash--err {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
</style>
