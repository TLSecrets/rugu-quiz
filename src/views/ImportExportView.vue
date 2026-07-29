<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import {
  downloadBlob,
  exportBankAsJson,
  exportBankAsXlsx,
  safeFileName,
} from '@/lib/exportBank'
import { parseImportFile, type ParseResult } from '@/lib/parsers'
import { createId } from '@/lib/parsers/types'
import PdfExportPanel from '@/components/bank/PdfExportPanel.vue'
import AiImportPanel from '@/components/bank/AiImportPanel.vue'
import ImportPreviewEditor from '@/components/bank/ImportPreviewEditor.vue'
import BankTagsField from '@/components/bank/BankTagsField.vue'
import { useBanksStore } from '@/stores/banks'
import type { Bank, Question } from '@/types/question'

const banks = useBanksStore()

const templates = [
  { name: '综合题型.xlsx', href: `${import.meta.env.BASE_URL}templates/综合题型.xlsx` },
  { name: '单选题与多选题.xlsx', href: `${import.meta.env.BASE_URL}templates/单选题与多选题.xlsx` },
  { name: '判断题.xlsx', href: `${import.meta.env.BASE_URL}templates/判断题.xlsx` },
  { name: '填空与简答.xlsx', href: `${import.meta.env.BASE_URL}templates/填空与简答.xlsx` },
  { name: '题库模板.csv', href: `${import.meta.env.BASE_URL}templates/题库模板.csv` },
  { name: '题库模板.json', href: `${import.meta.env.BASE_URL}templates/题库模板.json` },
  { name: '题库模板.docx', href: `${import.meta.env.BASE_URL}templates/题库模板.docx` },
  { name: '字段说明.md', href: `${import.meta.env.BASE_URL}templates/字段说明.md` },
]

const parsing = ref(false)
const importing = ref(false)
const parseResult = ref<ParseResult | null>(null)
const editableQuestions = ref<Question[]>([])
const fileName = ref('')
const bankName = ref('')
const bankTags = ref<string[]>([])
const mode = ref<'create' | 'replace'>('create')
const replaceBankId = ref('')
const message = ref<string | null>(null)
const error = ref<string | null>(null)

const exportBankId = ref('')

const pdfBankId = computed(() => exportBankId.value || banks.banks[0]?.id || '')
const pdfBank = computed(() => (pdfBankId.value ? banks.getBank(pdfBankId.value) : undefined))
const pdfQuestions = computed(() =>
  pdfBankId.value ? banks.getQuestions(pdfBankId.value) : [],
)

async function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  message.value = null
  error.value = null
  parseResult.value = null
  editableQuestions.value = []
  if (!file) return

  parsing.value = true
  fileName.value = file.name
  try {
    const result = await parseImportFile(file)
    parseResult.value = result
    editableQuestions.value = result.questions.map((q) => ({ ...q }))
    bankName.value = result.bankName
    bankTags.value = []
    if (!result.questions.length && result.issues.length) {
      error.value = '未能解析出有效题目，请查看下方问题列表。'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '解析失败'
  } finally {
    parsing.value = false
    input.value = ''
  }
}

function onPreviewUpdate(list: Question[]) {
  editableQuestions.value = list
  if (parseResult.value) {
    parseResult.value = { ...parseResult.value, questions: list }
  }
}

function onPreviewRemove(index: number) {
  const list = editableQuestions.value.filter((_, i) => i !== index)
  onPreviewUpdate(list)
}

async function confirmImport() {
  if (!editableQuestions.value.length) return
  importing.value = true
  error.value = null
  message.value = null
  try {
    const now = Date.now()
    let bank: Bank

    if (mode.value === 'replace' && replaceBankId.value) {
      const existing = banks.getBank(replaceBankId.value)
      if (!existing) throw new Error('要覆盖的题库不存在')
      bank = {
        ...existing,
        name: bankName.value.trim() || existing.name,
        description: parseResult.value?.description || existing.description,
        tags: bankTags.value.length ? bankTags.value : existing.tags,
        source: 'import',
        updatedAt: now,
        questionCount: editableQuestions.value.length,
      }
    } else {
      bank = {
        id: createId('bank'),
        name: bankName.value.trim() || parseResult.value?.bankName || '导入题库',
        description: parseResult.value?.description,
        tags: bankTags.value,
        source: 'import',
        questionCount: editableQuestions.value.length,
        createdAt: now,
        updatedAt: now,
      }
    }

    const questions = editableQuestions.value.map((q) => ({
      ...q,
      bankId: bank.id,
      sourceMeta: {
        ...q.sourceMeta,
        uncertain: false,
        inferredType: false,
      },
    }))

    await banks.putBankWithQuestions(bank, questions)
    message.value = `已导入「${bank.name}」，共 ${questions.length} 题。`
    parseResult.value = null
    editableQuestions.value = []
    fileName.value = ''
    bankTags.value = []
  } catch (e) {
    error.value = e instanceof Error ? e.message : '导入失败'
  } finally {
    importing.value = false
  }
}

function doExport(format: 'json' | 'xlsx') {
  const id = exportBankId.value || banks.banks[0]?.id
  if (!id) {
    error.value = '没有可导出的题库'
    return
  }
  const bank = banks.getBank(id)
  if (!bank) return
  const questions = banks.getQuestions(id)
  const base = safeFileName(bank.name)
  if (format === 'json') {
    downloadBlob(exportBankAsJson(bank, questions), `${base}.json`)
  } else {
    downloadBlob(exportBankAsXlsx(bank, questions), `${base}.xlsx`)
  }
  message.value = `已导出 ${bank.name}（${format.toUpperCase()}）`
}

function onAiImported(name: string, count: number) {
  message.value = `AI 已导入「${name}」，共 ${count} 题。`
  error.value = null
}

const templateBusy = ref<string | null>(null)

async function downloadTemplate(item: (typeof templates)[number]) {
  templateBusy.value = item.name
  error.value = null
  try {
    const res = await fetch(item.href)
    if (!res.ok) throw new Error(`下载失败（${res.status}）`)
    const blob = await res.blob()
    downloadBlob(blob, item.name)
    message.value = `已下载「${item.name}」`
  } catch (e) {
    error.value = e instanceof Error ? e.message : '模板下载失败'
  } finally {
    templateBusy.value = null
  }
}
</script>

<template>
  <PageHeader
    title="导入导出"
    subtitle="支持 Excel / Word / CSV / JSON；可选 DeepSeek 辅助导入；仓库 banks/ 经构建扫描后也会自动入库。"
  >
    <section class="block">
      <h3 class="block__title">导入模板</h3>
      <ul class="list">
        <li v-for="item in templates" :key="item.name" class="list__item">
          <span class="list__name">{{ item.name }}</span>
          <button
            type="button"
            class="list__link"
            :disabled="templateBusy === item.name"
            @click="downloadTemplate(item)"
          >
            {{ templateBusy === item.name ? '下载中…' : '下载' }}
          </button>
        </li>
      </ul>
    </section>

    <section class="block card">
      <h3 class="block__title">导入题库</h3>
      <p class="hint">
        选择 .xlsx / .xls / .csv / .json / .docx；题型可空（自动推断）；选项支持 A–H。解析后可逐题修改再入库。
      </p>
      <label class="file">
        <span class="btn">选择文件</span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.json,.docx,application/json,text/csv"
          :disabled="parsing || importing"
          @change="onFileChange"
        />
      </label>
      <p v-if="parsing" class="status">正在解析…</p>
      <p v-else-if="fileName" class="status">已选择：{{ fileName }}</p>
    </section>

    <AiImportPanel @imported="onAiImported" />

    <section v-if="parseResult" class="block card">
      <h3 class="block__title">预览与确认</h3>
      <label class="field">
        <span>题库名称</span>
        <input v-model="bankName" type="text" />
      </label>
      <div class="field">
        <span>题库标签（如学年）</span>
        <BankTagsField v-model="bankTags" :suggestions="banks.allBankTags" />
      </div>

      <div class="segment">
        <button
          type="button"
          class="segment__btn"
          :class="{ 'segment__btn--active': mode === 'create' }"
          @click="mode = 'create'"
        >
          新建题库
        </button>
        <button
          type="button"
          class="segment__btn"
          :class="{ 'segment__btn--active': mode === 'replace' }"
          :disabled="!banks.banks.length"
          @click="mode = 'replace'"
        >
          覆盖已有
        </button>
      </div>

      <label v-if="mode === 'replace'" class="field">
        <span>覆盖目标</span>
        <select v-model="replaceBankId">
          <option disabled value="">请选择</option>
          <option v-for="b in banks.banks" :key="b.id" :value="b.id">
            {{ b.name }}（{{ b.questionCount }} 题）
          </option>
        </select>
      </label>

      <ImportPreviewEditor
        :questions="editableQuestions"
        :issues="parseResult.issues"
        @update:questions="onPreviewUpdate"
        @remove="onPreviewRemove"
      />

      <button
        type="button"
        class="btn btn--primary"
        :disabled="!editableQuestions.length || importing || (mode === 'replace' && !replaceBankId)"
        @click="confirmImport"
      >
        {{ importing ? '导入中…' : '确认导入' }}
      </button>
    </section>

    <section class="block card">
      <h3 class="block__title">导出题库</h3>
      <EmptyState
        v-if="!banks.banks.length"
        title="暂无可导出题库"
        description="请先导入或等待构建收录。"
      />
      <template v-else>
        <label class="field">
          <span>选择题库</span>
          <select v-model="exportBankId">
            <option value="">默认第一套</option>
            <option v-for="b in banks.banks" :key="b.id" :value="b.id">
              {{ b.name }}（{{ b.questionCount }} 题）
            </option>
          </select>
        </label>
        <div class="row">
          <button type="button" class="btn" @click="doExport('json')">导出 JSON</button>
          <button type="button" class="btn btn--primary" @click="doExport('xlsx')">
            导出 Excel
          </button>
        </div>
      </template>
    </section>

    <PdfExportPanel
      v-if="pdfQuestions.length"
      :title="pdfBank?.name ?? '题库'"
      :questions="pdfQuestions"
    />

    <p v-if="message" class="flash flash--ok">{{ message }}</p>
    <p v-if="error" class="flash flash--err">{{ error }}</p>
  </PageHeader>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.block__title {
  font-size: var(--font-size-md);
}

.card {
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.hint,
.status {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface);
}

.list__item {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-4) var(--space-5);
  min-height: var(--touch-min);
  border-bottom: 1px solid var(--color-border);
}

.list__item:last-child {
  border-bottom: none;
}

.list__name {
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.list__link {
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 600;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  min-height: var(--touch-min);
}

.list__link:disabled {
  opacity: 0.5;
  cursor: wait;
}

.file {
  position: relative;
  display: inline-flex;
  width: fit-content;
}

.file input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.field input,
.field select {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
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
}

.issues,
.preview {
  margin: 0;
  padding-left: 1.1em;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  display: grid;
  gap: var(--space-1);
}

.preview__type {
  color: var(--color-accent);
  font-weight: 600;
  margin-right: var(--space-2);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.flash {
  font-size: var(--font-size-sm);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
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
