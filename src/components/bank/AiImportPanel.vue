<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { chatCompletions, DeepseekError } from '@/lib/ai/deepseek'
import { AI_IMPORT_SYSTEM_PROMPT, buildAiImportUserPrompt } from '@/lib/ai/importPrompt'
import { parseAiImportResponse } from '@/lib/ai/parseAiResponse'
import { createId } from '@/lib/parsers/types'
import { useBanksStore } from '@/stores/banks'
import { useSettingsStore } from '@/stores/settings'
import { QUESTION_TYPE_LABELS, type Bank, type Question } from '@/types/question'

const emit = defineEmits<{
  imported: [bankName: string, count: number]
}>()

const settings = useSettingsStore()
const banks = useBanksStore()

const rawText = ref('')
const bankName = ref('AI 导入题库')
const converting = ref(false)
const importing = ref(false)
const error = ref<string | null>(null)
const info = ref<string | null>(null)
const usageText = ref<string | null>(null)
const previewQuestions = ref<Question[]>([])
const previewIssues = ref<Array<{ row?: number; message: string }>>([])
const rawModelOutput = ref('')
const showRaw = ref(false)

let abort: AbortController | null = null

const hasKey = computed(() => !!settings.deepseek.apiKey.trim())
const canConvert = computed(() => hasKey.value && rawText.value.trim().length >= 8 && !converting.value)

const sampleHint = `1. 下列哪个是质能方程？
A. E=mc^2
B. F=ma
C. PV=nRT
答案：A
解析：爱因斯坦质能方程。

2. 判断：GitHub Pages 适合托管纯静态站点。
答案：正确`

function fillSample() {
  rawText.value = sampleHint
}

async function convert() {
  error.value = null
  info.value = null
  usageText.value = null
  previewQuestions.value = []
  previewIssues.value = []
  rawModelOutput.value = ''

  if (!hasKey.value) {
    error.value = '请先在设置中填写 API Key（OpenAI 兼容接口，仅存本机，浏览器直连）。'
    return
  }
  if (rawText.value.trim().length < 8) {
    error.value = '请粘贴更完整的题目文本。'
    return
  }

  converting.value = true
  abort?.abort()
  abort = new AbortController()

  try {
    const result = await chatCompletions(
      {
        apiKey: settings.deepseek.apiKey,
        baseUrl: settings.deepseek.baseUrl,
        model: settings.deepseek.model,
      },
      [
        { role: 'system', content: AI_IMPORT_SYSTEM_PROMPT },
        { role: 'user', content: buildAiImportUserPrompt(rawText.value) },
      ],
      { signal: abort.signal },
    )

    rawModelOutput.value = result.content
    const parsed = parseAiImportResponse(result.content)
    previewQuestions.value = parsed.questions
    previewIssues.value = parsed.issues
    if (parsed.bankName) bankName.value = parsed.bankName

    if (result.usage?.total_tokens != null) {
      usageText.value = `本次约消耗 ${result.usage.total_tokens} tokens（prompt ${result.usage.prompt_tokens ?? '-'} / completion ${result.usage.completion_tokens ?? '-'}）。费用由你的 API 账户结算，本站不代扣。`
    } else {
      usageText.value = '费用由你的 API 账户结算，本站不代扣、不中转 Key。'
    }

    if (!parsed.questions.length) {
      error.value = '未能解析出有效题目，可展开「模型原始输出」检查后重试。'
    } else {
      info.value = `已转换 ${parsed.questions.length} 题，请确认后入库。`
    }
  } catch (e) {
    error.value = e instanceof DeepseekError || e instanceof Error ? e.message : '转换失败'
  } finally {
    converting.value = false
  }
}

function cancel() {
  abort?.abort()
  converting.value = false
}

async function confirmImport() {
  if (!previewQuestions.value.length) return
  importing.value = true
  error.value = null
  try {
    const now = Date.now()
    const bank: Bank = {
      id: createId('bank'),
      name: bankName.value.trim() || 'AI 导入题库',
      description: '由 AI 辅助导入',
      source: 'import',
      questionCount: previewQuestions.value.length,
      createdAt: now,
      updatedAt: now,
    }
    const questions = previewQuestions.value.map((q) => ({ ...q, bankId: bank.id }))
    await banks.putBankWithQuestions(bank, questions)
    emit('imported', bank.name, questions.length)
    info.value = `已导入「${bank.name}」，共 ${questions.length} 题。`
    previewQuestions.value = []
    previewIssues.value = []
    rawText.value = ''
    rawModelOutput.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '入库失败'
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <section class="ai">
    <div class="ai__head">
      <h3 class="ai__title">AI 辅助导入（OpenAI 兼容）</h3>
      <p class="ai__desc">
        粘贴杂乱文本，由模型转为结构化题目。Key 仅存本机，浏览器直连你配置的接口（默认 DeepSeek），不经第三方。
      </p>
    </div>

    <div v-if="!hasKey" class="gate">
      <p>尚未配置 API Key。请先到设置填写 Key、Base URL 与模型。</p>
      <RouterLink class="link" to="/settings">前往设置</RouterLink>
    </div>

    <template v-else>
      <label class="field">
        <span>题目原文</span>
        <textarea
          v-model="rawText"
          rows="10"
          placeholder="粘贴题目文本、不规范表格说明等…"
          :disabled="converting || importing"
        />
      </label>

      <div class="row">
        <button type="button" class="btn" :disabled="converting" @click="fillSample">
          填入示例
        </button>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="!canConvert"
          @click="convert"
        >
          {{ converting ? '转换中…' : '转换为题目' }}
        </button>
        <button
          v-if="converting"
          type="button"
          class="btn"
          @click="cancel"
        >
          取消
        </button>
      </div>

      <p class="hint">
        当前模型：{{ settings.deepseek.model || 'deepseek-chat' }} ·
        {{ settings.deepseek.baseUrl || 'https://api.deepseek.com' }}
      </p>
    </template>

    <div v-if="previewQuestions.length || previewIssues.length" class="preview">
      <label class="field">
        <span>题库名称</span>
        <input v-model="bankName" type="text" :disabled="importing" />
      </label>

      <p class="status">预览 {{ previewQuestions.length }} 题</p>
      <ul v-if="previewIssues.length" class="issues">
        <li v-for="(issue, i) in previewIssues.slice(0, 8)" :key="i">
          <template v-if="issue.row">第 {{ issue.row }} 题：</template>{{ issue.message }}
        </li>
      </ul>

      <ul class="qlist">
        <li v-for="q in previewQuestions.slice(0, 8)" :key="q.id">
          <span class="qtype">{{ QUESTION_TYPE_LABELS[q.type] }}</span>
          {{ q.stem }}
        </li>
      </ul>
      <p v-if="previewQuestions.length > 8" class="hint">
        仅显示前 8 题预览，入库将包含全部 {{ previewQuestions.length }} 题。
      </p>

      <div class="row">
        <button
          type="button"
          class="btn btn--primary"
          :disabled="!previewQuestions.length || importing"
          @click="confirmImport"
        >
          {{ importing ? '入库中…' : '确认导入' }}
        </button>
        <button type="button" class="btn" :disabled="converting" @click="convert">
          重新转换
        </button>
      </div>
    </div>

    <button
      v-if="rawModelOutput"
      type="button"
      class="raw-toggle"
      @click="showRaw = !showRaw"
    >
      {{ showRaw ? '收起' : '展开' }}模型原始输出
    </button>
    <pre v-if="showRaw && rawModelOutput" class="raw">{{ rawModelOutput }}</pre>

    <p v-if="usageText" class="usage">{{ usageText }}</p>
    <p v-if="info" class="flash flash--ok">{{ info }}</p>
    <p v-if="error" class="flash flash--err">{{ error }}</p>
  </section>
</template>

<style scoped>
.ai {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.ai__title {
  font-size: var(--font-size-md);
}

.ai__desc {
  margin-top: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.gate {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  border: 1px dashed var(--color-border-strong);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.link {
  color: var(--color-accent);
  font-weight: 600;
  width: fit-content;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.field textarea,
.field input {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
  resize: vertical;
}

.field textarea {
  min-height: 180px;
  line-height: 1.55;
}

.field input {
  min-height: var(--touch-min);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-strong);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg);
}

.btn--primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
  border-color: transparent;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.hint,
.status,
.usage {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.preview {
  display: grid;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px dashed var(--color-border);
}

.issues,
.qlist {
  margin: 0;
  padding-left: 1.1em;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  display: grid;
  gap: var(--space-1);
}

.qtype {
  color: var(--color-accent);
  font-weight: 600;
  margin-right: var(--space-2);
}

.raw-toggle {
  align-self: start;
  font-size: var(--font-size-xs);
  color: var(--color-accent);
  font-weight: 600;
  min-height: 32px;
}

.raw {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  white-space: pre-wrap;
  color: var(--color-text-secondary);
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
