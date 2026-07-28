import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { loadSettingsFromDb, saveSettingsToDb } from '@/db/bootstrap'
import { DEFAULT_SETTINGS, type AppSettings, type ThemeMode } from '@/types/settings'
import type { QuestionType } from '@/types/question'

const THEME_CACHE_KEY = 'rugu-theme'

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }
  localStorage.setItem(THEME_CACHE_KEY, mode)
}

function readThemeCache(): ThemeMode {
  const v = localStorage.getItem(THEME_CACHE_KEY)
  if (v === 'light' || v === 'dark' || v === 'system') return v
  return DEFAULT_SETTINGS.theme
}

export type { ThemeMode }

export const useSettingsStore = defineStore('settings', () => {
  const ready = ref(false)
  const theme = ref<ThemeMode>(readThemeCache())
  const shuffleOptions = ref(DEFAULT_SETTINGS.shuffleOptions)
  const enabledTypes = ref<QuestionType[]>([...DEFAULT_SETTINGS.enabledTypes])
  const blankLooseMatch = ref(DEFAULT_SETTINGS.blankLooseMatch)
  const deepseek = reactive({ ...DEFAULT_SETTINGS.deepseek })

  applyTheme(theme.value)

  const themeLabel = computed(() => {
    if (theme.value === 'light') return '浅色'
    if (theme.value === 'dark') return '深色'
    return '跟随系统'
  })

  const snapshot = computed<AppSettings>(() => ({
    theme: theme.value,
    shuffleOptions: shuffleOptions.value,
    enabledTypes: [...enabledTypes.value],
    blankLooseMatch: blankLooseMatch.value,
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

  watch([theme, shuffleOptions, enabledTypes, blankLooseMatch], schedulePersist, { deep: true })
  watch(deepseek, schedulePersist, { deep: true })

  watch(theme, (value) => applyTheme(value))

  async function init() {
    const loaded = await loadSettingsFromDb()
    theme.value = loaded.theme
    shuffleOptions.value = loaded.shuffleOptions
    enabledTypes.value = [...loaded.enabledTypes]
    blankLooseMatch.value = loaded.blankLooseMatch
    Object.assign(deepseek, loaded.deepseek)
    applyTheme(theme.value)
    ready.value = true
  }

  function setTheme(mode: ThemeMode) {
    theme.value = mode
  }

  function cycleTheme() {
    const order: ThemeMode[] = ['dark', 'light', 'system']
    theme.value = order[(order.indexOf(theme.value) + 1) % order.length]
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

  return {
    ready,
    theme,
    shuffleOptions,
    enabledTypes,
    blankLooseMatch,
    deepseek,
    themeLabel,
    snapshot,
    init,
    setTheme,
    cycleTheme,
    toggleType,
    clearApiKey,
    resetDeepseek,
  }
})
