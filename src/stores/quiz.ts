import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { emptyAnswer, gradeQuestion, type GradeResult, type GradeVerdict, type UserAnswer } from '@/lib/grade'
import { prepareOptions } from '@/lib/shuffle'
import { useBanksStore } from '@/stores/banks'
import { useFavoritesStore } from '@/stores/favorites'
import { useSettingsStore } from '@/stores/settings'
import type { Question, QuestionOption } from '@/types/question'

const PROGRESS_KEY = 'rugu-practice-progress'
const RESULTS_KEY = 'rugu-practice-results'

export type PracticeMode = 'bank' | 'favorites'

interface PracticeProgress {
  mode: PracticeMode
  bankId: string | null
  index: number
}

export interface QuestionSession {
  answer: UserAnswer
  submitted: boolean
  result: GradeResult | null
  selfVerdict: GradeVerdict | null
  displayOptions: QuestionOption[]
}

interface PersistedResults {
  key: string
  verdicts: Record<string, GradeVerdict>
}

function readProgress(): PracticeProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PracticeProgress & { bankId?: string }
    // 兼容 Phase 3 旧格式
    if (!parsed.mode && parsed.bankId) {
      return { mode: 'bank', bankId: parsed.bankId, index: parsed.index ?? 0 }
    }
    return parsed
  } catch {
    return null
  }
}

function readResults(): PersistedResults | null {
  try {
    const raw = localStorage.getItem(RESULTS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedResults & { bankId?: string }
    if (!parsed.key && parsed.bankId) {
      return { key: `bank:${parsed.bankId}`, verdicts: parsed.verdicts ?? {} }
    }
    return parsed
  } catch {
    return null
  }
}

function blankCount(question: Question): number {
  if (question.type === 'blank') {
    return Math.max(question.answer.texts?.length ?? 1, 1)
  }
  if (question.type === 'short') return 1
  return 0
}

export const useQuizStore = defineStore('quiz', () => {
  const banks = useBanksStore()
  const settings = useSettingsStore()
  const favorites = useFavoritesStore()

  const mode = ref<PracticeMode>('bank')
  const activeBankId = ref<string | null>(null)
  const currentIndex = ref(0)
  const sessions = ref<Record<string, QuestionSession>>({})
  const summaryVerdicts = ref<Record<string, GradeVerdict>>({})

  const resultsKey = computed(() =>
    mode.value === 'favorites' ? 'favorites' : `bank:${activeBankId.value ?? ''}`,
  )

  const activeBank = computed(() => {
    if (mode.value === 'favorites') {
      return {
        id: '__favorites__',
        name: '收藏夹练习',
        description: '来自收藏的题目',
        source: 'builtin' as const,
        questionCount: filteredQuestions.value.length,
        createdAt: 0,
        updatedAt: 0,
      }
    }
    return activeBankId.value ? banks.getBank(activeBankId.value) : undefined
  })

  const filteredQuestions = computed(() => {
    const enabled = settings.enabledTypes
    const matchType = (q: Question) => !enabled.length || enabled.includes(q.type)

    if (mode.value === 'favorites') {
      const list: Question[] = []
      for (const fav of favorites.items) {
        const q = banks.getQuestions(fav.bankId).find((item) => item.id === fav.questionId)
        if (q && matchType(q)) list.push(q)
      }
      return list
    }

    if (!activeBankId.value) return [] as Question[]
    return banks.getQuestions(activeBankId.value).filter(matchType)
  })

  const currentQuestion = computed(() => filteredQuestions.value[currentIndex.value])

  const currentSession = computed(() => {
    const q = currentQuestion.value
    if (!q) return null
    return sessions.value[q.id] ?? null
  })

  const progressText = computed(() => {
    const total = filteredQuestions.value.length
    if (!total) return '0 / 0'
    return `${currentIndex.value + 1} / ${total}`
  })

  const stats = computed(() => {
    let correct = 0
    let wrong = 0
    let partial = 0
    let done = 0
    for (const q of filteredQuestions.value) {
      const v = summaryVerdicts.value[q.id]
      if (!v || v === 'ungraded') continue
      done++
      if (v === 'correct') correct++
      else if (v === 'wrong') wrong++
      else if (v === 'partial') partial++
    }
    return { correct, wrong, partial, done, total: filteredQuestions.value.length }
  })

  function persistProgress() {
    if (mode.value === 'bank' && !activeBankId.value) {
      localStorage.removeItem(PROGRESS_KEY)
      return
    }
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        mode: mode.value,
        bankId: activeBankId.value,
        index: currentIndex.value,
      } satisfies PracticeProgress),
    )
  }

  function persistResults() {
    localStorage.setItem(
      RESULTS_KEY,
      JSON.stringify({
        key: resultsKey.value,
        verdicts: { ...summaryVerdicts.value },
      } satisfies PersistedResults),
    )
  }

  function loadResultsForCurrentKey() {
    const saved = readResults()
    summaryVerdicts.value =
      saved?.key === resultsKey.value ? { ...saved.verdicts } : {}
  }

  function ensureSession(question: Question): QuestionSession {
    const existing = sessions.value[question.id]
    if (existing) return existing

    const displayOptions = prepareOptions(question.options, settings.shuffleOptions)
    const texts = Array.from({ length: blankCount(question) }, () => '')
    const session: QuestionSession = {
      answer: { ...emptyAnswer(), texts },
      submitted: false,
      result: null,
      selfVerdict: null,
      displayOptions,
    }
    sessions.value = { ...sessions.value, [question.id]: session }
    return session
  }

  function touchCurrent() {
    const q = currentQuestion.value
    if (q) ensureSession(q)
  }

  function clampIndex(index: number) {
    const max = Math.max(filteredQuestions.value.length - 1, 0)
    currentIndex.value = Math.min(Math.max(index, 0), max)
  }

  function startBank(bankId: string, index = 0) {
    const switching = mode.value !== 'bank' || activeBankId.value !== bankId
    mode.value = 'bank'
    activeBankId.value = bankId
    if (switching) {
      sessions.value = {}
      loadResultsForCurrentKey()
    }
    clampIndex(index)
    touchCurrent()
    persistProgress()
  }

  function startFavorites(index = 0) {
    const switching = mode.value !== 'favorites'
    mode.value = 'favorites'
    activeBankId.value = null
    if (switching) {
      sessions.value = {}
      loadResultsForCurrentKey()
    }
    clampIndex(index)
    touchCurrent()
    persistProgress()
  }

  /** 打开指定题目所在题库并定位；若当前已在收藏模式且题目在列表中则仅跳转 */
  function openQuestion(bankId: string, questionId: string, preferFavorites = false) {
    if (preferFavorites || mode.value === 'favorites') {
      startFavorites(0)
      const idx = filteredQuestions.value.findIndex((q) => q.id === questionId)
      if (idx >= 0) {
        goTo(idx)
        return
      }
    }
    startBank(bankId, 0)
    const idx = filteredQuestions.value.findIndex((q) => q.id === questionId)
    goTo(idx >= 0 ? idx : 0)
  }

  function restoreProgress() {
    const saved = readProgress()
    if (!saved) return
    if (saved.mode === 'favorites') {
      startFavorites(saved.index)
      return
    }
    if (!saved.bankId || !banks.getBank(saved.bankId)) return
    startBank(saved.bankId, saved.index)
  }

  function goTo(index: number) {
    if (!filteredQuestions.value.length) return
    clampIndex(index)
    touchCurrent()
    persistProgress()
  }

  function next() {
    goTo(currentIndex.value + 1)
  }

  function prev() {
    goTo(currentIndex.value - 1)
  }

  function updateSession(questionId: string, patch: Partial<QuestionSession>) {
    const prevSession = sessions.value[questionId]
    if (!prevSession) return
    sessions.value = {
      ...sessions.value,
      [questionId]: { ...prevSession, ...patch },
    }
  }

  function selectSingle(questionId: string, key: string) {
    const s = sessions.value[questionId]
    if (!s || s.submitted) return
    updateSession(questionId, {
      answer: { ...s.answer, optionKeys: [key] },
    })
  }

  function toggleMultiple(questionId: string, key: string) {
    const s = sessions.value[questionId]
    if (!s || s.submitted) return
    const set = new Set(s.answer.optionKeys)
    if (set.has(key)) set.delete(key)
    else set.add(key)
    updateSession(questionId, {
      answer: { ...s.answer, optionKeys: [...set] },
    })
  }

  function setText(questionId: string, index: number, value: string) {
    const s = sessions.value[questionId]
    if (!s || s.submitted) return
    const texts = [...s.answer.texts]
    texts[index] = value
    updateSession(questionId, {
      answer: { ...s.answer, texts },
    })
  }

  function submitCurrent() {
    const q = currentQuestion.value
    if (!q) return
    const s = ensureSession(q)
    if (s.submitted) return

    const result = gradeQuestion(q, s.answer, {
      blankLooseMatch: settings.blankLooseMatch,
    })

    updateSession(q.id, { submitted: true, result })

    if (q.type !== 'short' && result.verdict !== 'ungraded') {
      summaryVerdicts.value = { ...summaryVerdicts.value, [q.id]: result.verdict }
      persistResults()
    }
  }

  function selfGrade(verdict: 'correct' | 'wrong' | 'partial') {
    const q = currentQuestion.value
    if (!q || q.type !== 'short') return
    const s = ensureSession(q)
    if (!s.submitted) {
      updateSession(q.id, {
        submitted: true,
        result: { verdict: 'ungraded', message: '已自评' },
      })
    }
    updateSession(q.id, { selfVerdict: verdict })
    summaryVerdicts.value = { ...summaryVerdicts.value, [q.id]: verdict }
    persistResults()
  }

  function reshuffleCurrentIfNeeded() {
    const q = currentQuestion.value
    if (!q) return
    const s = sessions.value[q.id]
    if (!s || s.submitted) return
    if (!q.options?.length) return
    updateSession(q.id, {
      displayOptions: prepareOptions(q.options, settings.shuffleOptions),
      answer: { ...s.answer, optionKeys: [] },
    })
  }

  watch(
    () => settings.shuffleOptions,
    () => {
      reshuffleCurrentIfNeeded()
    },
  )

  return {
    mode,
    activeBankId,
    currentIndex,
    sessions,
    summaryVerdicts,
    activeBank,
    filteredQuestions,
    currentQuestion,
    currentSession,
    progressText,
    stats,
    startBank,
    startFavorites,
    openQuestion,
    restoreProgress,
    goTo,
    next,
    prev,
    persistProgress,
    ensureSession,
    selectSingle,
    toggleMultiple,
    setText,
    submitCurrent,
    selfGrade,
  }
})
