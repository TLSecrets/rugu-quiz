<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { clearAllLocalData, clearLearningData } from '@/db/bootstrap'
import { useBanksStore } from '@/stores/banks'
import { useFavoritesStore } from '@/stores/favorites'
import { useNotesStore } from '@/stores/notes'
import { useWrongsStore } from '@/stores/wrongs'
import { useSettingsStore, type ThemeMode } from '@/stores/settings'
import { ALL_QUESTION_TYPES, QUESTION_TYPE_LABELS } from '@/types/question'
import { FONT_SIZE_MAX, FONT_SIZE_MIN } from '@/types/settings'

const settings = useSettingsStore()
const banks = useBanksStore()
const favorites = useFavoritesStore()
const notes = useNotesStore()
const wrongs = useWrongsStore()

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: '深色' },
  { value: 'light', label: '浅色' },
  { value: 'system', label: '跟随系统' },
]

const busy = ref(false)
const dataMsg = ref<string | null>(null)
const dataErr = ref<string | null>(null)

function isTypeEnabled(type: (typeof ALL_QUESTION_TYPES)[number]) {
  if (!settings.enabledTypes.length) return true
  return settings.enabledTypes.includes(type)
}

function onTypeToggle(type: (typeof ALL_QUESTION_TYPES)[number]) {
  if (!settings.enabledTypes.length) {
    settings.enabledTypes = ALL_QUESTION_TYPES.filter((t) => t !== type)
    return
  }
  settings.toggleType(type)
  if (settings.enabledTypes.length === ALL_QUESTION_TYPES.length) {
    settings.enabledTypes = []
  }
}

async function refreshStores() {
  await Promise.all([banks.refresh(), favorites.refresh(), notes.refresh(), wrongs.refresh()])
}

async function onClearLearning() {
  dataMsg.value = null
  dataErr.value = null
  if (
    !confirm(
      '将清空题库、收藏、笔记、错题与练习进度，并重新写入示例题。设置与 API Key 会保留。确定？',
    )
  ) {
    return
  }
  busy.value = true
  try {
    await clearLearningData()
    await refreshStores()
    dataMsg.value = '已清空学习数据，并恢复示例题库。'
  } catch (e) {
    dataErr.value = e instanceof Error ? e.message : '操作失败'
  } finally {
    busy.value = false
  }
}

async function onClearAll() {
  dataMsg.value = null
  dataErr.value = null
  if (
    !confirm(
      '将删除本机全部数据（含设置与 API Key），页面将重新加载。此操作不可撤销。确定？',
    )
  ) {
    return
  }
  busy.value = true
  try {
    await clearAllLocalData()
    location.reload()
  } catch (e) {
    dataErr.value = e instanceof Error ? e.message : '操作失败'
    busy.value = false
  }
}
</script>

<template>
  <PageHeader title="设置" subtitle="偏好写入 IndexedDB；主题缓存到 localStorage 以免闪烁。">
    <section class="card">
      <h3 class="card__title">外观</h3>
      <p class="card__desc">
        浅色 / 深色 / 跟随系统
        <template v-if="settings.theme === 'system'">
          （当前：{{ settings.resolvedTheme === 'dark' ? '深色' : '浅色' }}）
        </template>
      </p>
      <div class="segment" role="radiogroup" aria-label="主题">
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          type="button"
          class="segment__btn"
          :class="{ 'segment__btn--active': settings.theme === opt.value }"
          role="radio"
          :aria-checked="settings.theme === opt.value"
          @click="settings.setTheme(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <div class="font-row">
        <div>
          <p class="card__desc">
            阅读字号（{{ settings.fontSize }}px，{{ FONT_SIZE_MIN }}–{{ FONT_SIZE_MAX }}）。优先用这里放大：整站文字与按钮会一起变大且布局更稳。浏览器缩放（Ctrl +
            滚轮）也能放大，但桌面宽度变「窄」时可能切到底部导航，观感容易乱。
          </p>
        </div>
        <div class="font-controls" role="group" aria-label="阅读字号">
          <button
            type="button"
            class="btn"
            :disabled="settings.fontSize <= FONT_SIZE_MIN"
            @click="settings.adjustFontSize(-1)"
          >
            A−
          </button>
          <input
            class="font-slider"
            type="range"
            :min="FONT_SIZE_MIN"
            :max="FONT_SIZE_MAX"
            :value="settings.fontSize"
            @input="settings.setFontSize(Number(($event.target as HTMLInputElement).value))"
          />
          <button
            type="button"
            class="btn"
            :disabled="settings.fontSize >= FONT_SIZE_MAX"
            @click="settings.adjustFontSize(1)"
          >
            A+
          </button>
        </div>
      </div>
    </section>

    <section class="card">
      <h3 class="card__title">题库标签筛选</h3>
      <p class="card__desc">
        题库列表、练习、考试等多选标签时的匹配方式。默认「或」：选中任一标签即可；「与」则须同时包含全部所选标签。
      </p>
      <div class="segment" role="radiogroup" aria-label="标签匹配方式">
        <button
          type="button"
          class="segment__btn"
          :class="{ 'segment__btn--active': settings.bankTagMatchMode === 'or' }"
          role="radio"
          :aria-checked="settings.bankTagMatchMode === 'or'"
          @click="settings.bankTagMatchMode = 'or'"
        >
          或运算
        </button>
        <button
          type="button"
          class="segment__btn"
          :class="{ 'segment__btn--active': settings.bankTagMatchMode === 'and' }"
          role="radio"
          :aria-checked="settings.bankTagMatchMode === 'and'"
          @click="settings.bankTagMatchMode = 'and'"
        >
          与运算
        </button>
      </div>
    </section>

    <section class="card">
      <h3 class="card__title">练习</h3>
      <label class="toggle">
        <input v-model="settings.shuffleOptions" type="checkbox" />
        <span>选项乱序</span>
      </label>
      <label class="toggle">
        <input v-model="settings.blankLooseMatch" type="checkbox" />
        <span>填空宽松匹配（去空格 / 忽略大小写）</span>
      </label>
      <label class="toggle">
        <input v-model="settings.autoNextEnabled" type="checkbox" />
        <span>默认答题后自动下一题</span>
      </label>
      <label class="field">
        <span>自动下一题延迟（秒，0 = 立即）</span>
        <input
          v-model.number="settings.autoNextDelay"
          type="number"
          min="0"
          max="30"
        />
      </label>
      <label class="field">
        <span>默认答案展示</span>
        <select v-model="settings.showAnswerMode">
          <option value="instant">即时显示</option>
          <option value="manual">手动确认</option>
        </select>
      </label>

      <div>
        <p class="card__desc">默认题型过滤（不选或全选 = 全部题型）</p>
        <div class="chips">
          <button
            v-for="type in ALL_QUESTION_TYPES"
            :key="type"
            type="button"
            class="chip"
            :class="{ 'chip--on': isTypeEnabled(type) }"
            @click="onTypeToggle(type)"
          >
            {{ QUESTION_TYPE_LABELS[type] }}
          </button>
        </div>
      </div>

      <div class="row">
        <button type="button" class="btn" @click="settings.resetPracticeDefaults()">
          恢复练习默认项
        </button>
      </div>
    </section>

    <section class="card">
      <h3 class="card__title">AI 接口（OpenAI 兼容）</h3>
      <p class="card__desc">
        默认对接 DeepSeek（OpenAI 兼容 Chat Completions）。Key 仅保存在本机；导入导出页的「AI
        辅助导入」由浏览器直连，不经第三方；费用由你的账户结算。也可改 Base URL / 模型指向其他兼容接口。
        DeepSeek 申请：
        <a
          class="ext"
          href="https://platform.deepseek.com/api_keys"
          target="_blank"
          rel="noopener noreferrer"
        >platform.deepseek.com</a>
      </p>

      <label class="field">
        <span>API Key</span>
        <input
          v-model="settings.deepseek.apiKey"
          type="password"
          autocomplete="off"
          placeholder="sk-..."
        />
      </label>
      <label class="field">
        <span>Base URL</span>
        <input v-model="settings.deepseek.baseUrl" type="url" spellcheck="false" />
      </label>
      <label class="field">
        <span>模型</span>
        <input v-model="settings.deepseek.model" type="text" spellcheck="false" />
      </label>

      <div class="row">
        <button type="button" class="btn" @click="settings.clearApiKey()">清除 Key</button>
        <button type="button" class="btn" @click="settings.resetDeepseek()">恢复默认接口</button>
      </div>
    </section>

    <section class="card card--danger">
      <h3 class="card__title">数据管理</h3>
      <p class="card__desc">数据只存在当前浏览器。清除后无法从云端恢复。</p>
      <div class="row">
        <button type="button" class="btn" :disabled="busy" @click="onClearLearning">
          清空题库与学习数据
        </button>
        <button type="button" class="btn btn--danger" :disabled="busy" @click="onClearAll">
          重置全部本地数据
        </button>
      </div>
      <p v-if="dataMsg" class="flash flash--ok">{{ dataMsg }}</p>
      <p v-if="dataErr" class="flash flash--err">{{ dataErr }}</p>
    </section>

    <section class="card">
      <h3 class="card__title">关于</h3>
      <p class="card__desc">
        如故题库 · 纯前端刷题站 · 数据仅存当前浏览器 · 部署于 GitHub Pages。不提供账号登录、考试限时与云同步。
      </p>
      <ul class="about-list">
        <li>版本阶段：Phase A–E（错题本、练习配置、模拟考试、导入增强、设置打磨）</li>
        <li>
          <RouterLink class="ext" to="/guide">使用手册</RouterLink>
          · 开源仓库可在 GitHub 查看 Actions 部署记录
        </li>
      </ul>
    </section>
  </PageHeader>
</template>

<style scoped>
.card {
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.card--danger {
  border-color: color-mix(in srgb, var(--color-danger) 30%, var(--color-border));
}

.card__title {
  font-size: var(--font-size-md);
}

.card__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.ext {
  color: var(--color-accent);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.font-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.font-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.font-slider {
  flex: 1;
  min-width: 0;
  accent-color: var(--color-accent);
}

.about-list {
  margin: 0;
  padding-left: 1.2em;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
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
  font-weight: 500;
  color: var(--color-text-secondary);
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

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
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

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.field input {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
}

.field select {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-strong);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn--danger {
  border-color: color-mix(in srgb, var(--color-danger) 50%, var(--color-border));
  color: var(--color-danger);
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
