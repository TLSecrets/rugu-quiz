import { defineStore } from 'pinia'
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { loadSettingsFromDb, saveSettingsToDb } from '@/db/bootstrap'
import {
  DEFAULT_SETTINGS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  type AppSettings,
  type BankTagMatchMode,
  type ShowAnswerMode,
  type ThemeMode,
} from '@/types/settings'
import type { QuestionType } from '@/types/question'

const THEME_CACHE_KEY = 'rugu-theme'
const FONT_CACHE_KEY = 'rugu-font-size'

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  const resolved = resolveTheme(mode)
  root.setAttribute('data-theme', resolved)
  root.dataset.themeSource = mode
  root.style.colorScheme = resolved
  localStorage.setItem(THEME_CACHE_KEY, mode)
}

function clampFontSize(px: number): number {
  const n = Math.round(Number(px) || DEFAULT_SETTINGS.fontSize)
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, n))
}

function applyFontSize(px: number) {
  const size = clampFontSize(px)
  document.documentElement.style.fontSize = `${size}px`
  localStorage.setItem(FONT_CACHE_KEY, String(size))
}

function readThemeCache(): ThemeMode {
  const v = localStorage.getItem(THEME_CACHE_KEY)
  if (v === 'light' || v === 'dark' || v === 'system') return v
  return DEFAULT_SETTINGS.theme
}

function readFontCache(): number {
  const raw = localStorage.getItem(FONT_CACHE_KEY)
  if (!raw) return DEFAULT_SETTINGS.fontSize
  return clampFontSize(Number(raw))
}

export type { ThemeMode }

export const useSettingsStore = defineStore('settings', () => {
  const ready = ref(false)
  const theme = ref<ThemeMode>(readThemeCache())
  const shuffleOptions = ref(DEFAULT_SETTINGS.shuffleOptions)
  const enabledTypes = ref<QuestionType[]>([...DEFAULT_SETTINGS.enabledTypes])
  const blankLooseMatch = ref(DEFAULT_SETTINGS.blankLooseMatch)
  const autoNextDelay = ref(DEFAULT_SETTINGS.autoNextDelay)
  const autoNextEnabled = ref(DEFAULT_SETTINGS.autoNextEnabled)
  const showAnswerMode = ref<ShowAnswerMode>(DEFAULT_SETTINGS.showAnswerMode)
  const fontSize = ref(readFontCache())
  const bankTagMatchMode = ref<BankTagMatchMode>(DEFAULT_SETTINGS.bankTagMatchMode)
  const deepseek = reactive({ ...DEFAULT_SETTINGS.deepseek })

  applyTheme(theme.value)
  applyFontSize(fontSize.value)

  const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
  const onSystemThemeChange = () => {
    if (theme.value === 'system') applyTheme('system')
  }
  media?.addEventListener('change', onSystemThemeChange)
  onScopeDispose(() => {
    media?.removeEventListener('change', onSystemThemeChange)
  })

  const themeLabel = computed(() => {
    if (theme.value === 'light') return '浅色'
    if (theme.value === 'dark') return '深色'
    return '跟随系统'
  })

  const resolvedTheme = computed(() => resolveTheme(theme.value))

  const snapshot = computed<AppSettings>(() => ({
    theme: theme.value,
    shuffleOptions: shuffleOptions.value,
    enabledTypes: [...enabledTypes.value],
    blankLooseMatch: blankLooseMatch.value,
    autoNextDelay: autoNextDelay.value,
    autoNextEnabled: autoNextEnabled.value,
    showAnswerMode: showAnswerMode.value,
    fontSize: fontSize.value,
    bankTagMatchMode: bankTagMatchMode.value,
    deepseek: { ...deepseek },
  }))

  let persistTimer: ReturnType<typeof setTimeout> | null = null

  function schedulePersist() {
    if (!ready.value) return
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      void saveSettingsToDb(snapshot.value)
    }, 200)
  }

  watch(
    [
      theme,
      shuffleOptions,
      enabledTypes,
      blankLooseMatch,
      autoNextDelay,
      autoNextEnabled,
      showAnswerMode,
      fontSize,
      bankTagMatchMode,
    ],
    schedulePersist,
    { deep: true },
  )
  watch(deepseek, schedulePersist, { deep: true })

  watch(theme, (value) => applyTheme(value))
  watch(fontSize, (value) => applyFontSize(value))

  async function init() {
    const loaded = await loadSettingsFromDb()
    theme.value = loaded.theme
    shuffleOptions.value = loaded.shuffleOptions
    enabledTypes.value = [...loaded.enabledTypes]
    blankLooseMatch.value = loaded.blankLooseMatch
    autoNextDelay.value = loaded.autoNextDelay
    autoNextEnabled.value = loaded.autoNextEnabled
    showAnswerMode.value = loaded.showAnswerMode
    fontSize.value = clampFontSize(loaded.fontSize)
    bankTagMatchMode.value = loaded.bankTagMatchMode
    Object.assign(deepseek, loaded.deepseek)
    applyTheme(theme.value)
    applyFontSize(fontSize.value)
    ready.value = true
  }

  function setTheme(mode: ThemeMode) {
    theme.value = mode
  }

  function cycleTheme() {
    const order: ThemeMode[] = ['dark', 'light', 'system']
    theme.value = order[(order.indexOf(theme.value) + 1) % order.length]
  }

  function setFontSize(px: number) {
    fontSize.value = clampFontSize(px)
  }

  function adjustFontSize(delta: number) {
    setFontSize(fontSize.value + delta)
  }

  function toggleType(type: QuestionType) {
    const set = new Set(enabledTypes.value)
    if (set.has(type)) set.delete(type)
    else set.add(type)
    enabledTypes.value = [...set]
  }

  function clearApiKey() {
    deepseek.apiKey = ''
  }

  function resetDeepseek() {
    Object.assign(deepseek, DEFAULT_SETTINGS.deepseek)
  }

  function resetPracticeDefaults() {
    shuffleOptions.value = DEFAULT_SETTINGS.shuffleOptions
    blankLooseMatch.value = DEFAULT_SETTINGS.blankLooseMatch
    autoNextDelay.value = DEFAULT_SETTINGS.autoNextDelay
    autoNextEnabled.value = DEFAULT_SETTINGS.autoNextEnabled
    showAnswerMode.value = DEFAULT_SETTINGS.showAnswerMode
    enabledTypes.value = [...DEFAULT_SETTINGS.enabledTypes]
    bankTagMatchMode.value = DEFAULT_SETTINGS.bankTagMatchMode
  }

  return {
    ready,
    theme,
    shuffleOptions,
    enabledTypes,
    blankLooseMatch,
    autoNextDelay,
    autoNextEnabled,
    showAnswerMode,
    fontSize,
    bankTagMatchMode,
    deepseek,
    themeLabel,
    resolvedTheme,
    snapshot,
    init,
    setTheme,
    cycleTheme,
    setFontSize,
    adjustFontSize,
    toggleType,
    clearApiKey,
    resetDeepseek,
    resetPracticeDefaults,
  }
})
