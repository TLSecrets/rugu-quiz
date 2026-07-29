import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { emptyAnswer, gradeQuestion, type GradeResult, type GradeVerdict, type UserAnswer } from '@/lib/grade'
import { prepareOptions, shuffleArray } from '@/lib/shuffle'
import { useBanksStore } from '@/stores/banks'
import { useFavoritesStore } from '@/stores/favorites'
import { useSettingsStore } from '@/stores/settings'
import { useWrongsStore } from '@/stores/wrongs'
import type { Question, QuestionOption, QuestionType } from '@/types/question'
import type { ShowAnswerMode } from '@/types/settings'

const PROGRESS_KEY = 'rugu-practice-progress'
const RESULTS_KEY = 'rugu-practice-results'

export type PracticeMode = 'bank' | 'multi' | 'favorites' | 'wrong'
export type PracticeOrder = 'sequential' | 'random'

export interface PracticeConfig {
  mode: PracticeMode
  bankIds: string[]
  types: QuestionType[]
  domains: string[]
  order: PracticeOrder
  shuffleOptions: boolean
  autoNextEnabled: boolean
  autoNextDelay: number
  showAnswerMode: ShowAnswerMode
}

export interface QuestionSession {
  answer: UserAnswer
  submitted: boolean
  result: GradeResult | null
  selfVerdict: GradeVerdict | null
  displayOptions: QuestionOption[]
  /** 手动模式下是否已点「查看答案」 */
  answerRevealed: boolean
}

interface PracticeProgressV2 {
  version: 2
  active: boolean
  config: PracticeConfig
  questionIds: string[]
  index: number
}

interface PersistedResults {
  key: string
  verdicts: Record<string, GradeVerdict>
}

function blankCount(question: Question): number {
  if (question.type === 'blank') {
    return Math.max(question.answer.texts?.length ?? 1, 1)
  }
  if (question.type === 'short') return 1
  return 0
}

function resultsKeyOf(config: PracticeConfig, questionIds: string[]): string {
  if (config.mode === 'favorites') return 'favorites'
  if (config.mode === 'wrong') return 'wrong'
  const banks = [...config.bankIds].sort().join(',')
  const types = [...config.types].sort().join(',')
  const domains = [...config.domains].sort().join(',')
  const head = questionIds.slice(0, 8).join(',')
  return `${config.mode}|${banks}|${types}|${domains}|${config.order}|n${questionIds.length}|${head}`
}

function readProgress(): PracticeProgressV2 | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PracticeProgressV2 & {
      mode?: PracticeMode
      bankId?: string | null
      index?: number
    }
    if (parsed.version === 2 && parsed.config && Array.isArray(parsed.questionIds)) {
      return parsed
    }
    // 兼容旧格式
    if (parsed.mode === 'favorites') {
      return {
        version: 2,
        active: true,
        config: defaultConfigFromLegacy('favorites'),
        questionIds: [],
        index: parsed.index ?? 0,
      }
    }
    if (parsed.mode === 'wrong') {
      return {
        version: 2,
        active: true,
        config: defaultConfigFromLegacy('wrong'),
        questionIds: [],
        index: parsed.index ?? 0,
      }
    }
    if (parsed.bankId) {
      return {
        version: 2,
        active: true,
        config: {
          ...defaultConfigFromLegacy('bank'),
          mode: 'bank',
          bankIds: [parsed.bankId],
        },
        questionIds: [],
        index: parsed.index ?? 0,
      }
    }
    return null
  } catch {
    return null
  }
}

function defaultConfigFromLegacy(mode: PracticeMode): PracticeConfig {
  return {
    mode,
    bankIds: [],
    types: [],
    domains: [],
    order: 'sequential',
    shuffleOptions: true,
    autoNextEnabled: false,
    autoNextDelay: 0,
    showAnswerMode: 'instant',
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

function matchType(q: Question, types: QuestionType[]) {
  return !types.length || types.includes(q.type)
}

function matchDomain(q: Question, domains: string[]) {
  if (!domains.length) return true
  return !!q.domain && domains.includes(q.domain)
}

export const useQuizStore = defineStore('quiz', () => {
  const banks = useBanksStore()
  const settings = useSettingsStore()
  const favorites = useFavoritesStore()
  const wrongs = useWrongsStore()

  const sessionActive = ref(false)
  const config = ref<PracticeConfig | null>(null)
  const questionIds = ref<string[]>([])
  const currentIndex = ref(0)
  const sessions = ref<Record<string, QuestionSession>>({})
  const summaryVerdicts = ref<Record<string, GradeVerdict>>({})
  /** 进入练习页时若有可恢复会话，先挂起供弹窗选择 */
  const pendingResume = ref<PracticeProgressV2 | null>(null)

  const mode = computed(() => config.value?.mode ?? 'multi')
  const activeBankId = computed(() => {
    if (!config.value) return null
    if (config.value.mode === 'bank' && config.value.bankIds.length === 1) {
      return config.value.bankIds[0]
    }
    return null
  })

  const questionMap = computed(() => {
    const map = new Map<string, Question>()
    for (const list of Object.values(banks.questionsByBank)) {
      for (const q of list) map.set(q.id, q)
    }
    return map
  })

  const filteredQuestions = computed(() => {
    const list: Question[] = []
    for (const id of questionIds.value) {
      const q = questionMap.value.get(id)
      if (q) list.push(q)
    }
    return list
  })

  const resultsKey = computed(() =>
    config.value ? resultsKeyOf(config.value, questionIds.value) : '',
  )

  const activeBank = computed(() => {
    if (!sessionActive.value || !config.value) return undefined
    const total = filteredQuestions.value.length
    if (config.value.mode === 'favorites') {
      return {
        id: '__favorites__',
        name: '收藏夹练习',
        description: '来自收藏的题目',
        source: 'builtin' as const,
        questionCount: total,
        createdAt: 0,
        updatedAt: 0,
      }
    }
    if (config.value.mode === 'wrong') {
      return {
        id: '__wrong__',
        name: '错题专项',
        description: '来自错题本的题目',
        source: 'builtin' as const,
        questionCount: total,
        createdAt: 0,
        updatedAt: 0,
      }
    }
    if (config.value.mode === 'bank' && config.value.bankIds.length === 1) {
      const bank = banks.getBank(config.value.bankIds[0])
      if (bank) return { ...bank, questionCount: total }
    }
    const names = config.value.bankIds
      .map((id) => banks.getBank(id)?.name)
      .filter(Boolean)
    return {
      id: '__multi__',
      name: names.length ? names.join(' · ') : '多题库练习',
      description: config.value.order === 'random' ? '随机练习' : '顺序练习',
      source: 'builtin' as const,
      questionCount: total,
      createdAt: 0,
      updatedAt: 0,
    }
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

  const allDomains = computed(() => {
    const set = new Set<string>()
    for (const list of Object.values(banks.questionsByBank)) {
      for (const q of list) {
        if (q.domain) set.add(q.domain)
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  function buildPool(cfg: PracticeConfig): Question[] {
    const types = cfg.types
    const domains = cfg.domains
    let pool: Question[] = []

    if (cfg.mode === 'favorites') {
      for (const fav of favorites.items) {
        const q = banks.getQuestions(fav.bankId).find((item) => item.id === fav.questionId)
        if (q && matchType(q, types) && matchDomain(q, domains)) pool.push(q)
      }
    } else if (cfg.mode === 'wrong') {
      for (const rec of wrongs.activeItems) {
        const q = banks.getQuestions(rec.bankId).find((item) => item.id === rec.questionId)
        if (q && matchType(q, types) && matchDomain(q, domains)) pool.push(q)
      }
    } else {
      const ids = cfg.bankIds.length ? cfg.bankIds : banks.banks.map((b) => b.id)
      for (const bankId of ids) {
        for (const q of banks.getQuestions(bankId)) {
          if (matchType(q, types) && matchDomain(q, domains)) pool.push(q)
        }
      }
    }

    if (cfg.order === 'random') pool = shuffleArray(pool)
    return pool
  }

  function persistProgress() {
    if (!sessionActive.value || !config.value) {
      // 保留 pending 时不清除；仅主动结束时清除
      return
    }
    const payload: PracticeProgressV2 = {
      version: 2,
      active: true,
      config: { ...config.value },
      questionIds: [...questionIds.value],
      index: currentIndex.value,
    }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(payload))
  }

  function clearPersistedProgress() {
    localStorage.removeItem(PROGRESS_KEY)
  }

  function rememberWrong(question: Question, verdict: GradeVerdict) {
    void wrongs.recordFailure(question.id, question.bankId, verdict)
  }

  function persistResults() {
    if (!resultsKey.value) return
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

    const shuffle = config.value?.shuffleOptions ?? settings.shuffleOptions
    const displayOptions = prepareOptions(question.options, shuffle)
    const texts = Array.from({ length: blankCount(question) }, () => '')
    const session: QuestionSession = {
      answer: { ...emptyAnswer(), texts },
      submitted: false,
      result: null,
      selfVerdict: null,
      displayOptions,
      answerRevealed: false,
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

  function applySession(cfg: PracticeConfig, ids: string[], index: number, resetSessions: boolean) {
    config.value = { ...cfg }
    questionIds.value = [...ids]
    sessionActive.value = true
    pendingResume.value = null
    if (resetSessions) {
      sessions.value = {}
      loadResultsForCurrentKey()
    }
    clampIndex(index)
    touchCurrent()
    persistProgress()
  }

  function startWithConfig(cfg: PracticeConfig, options?: { reset?: boolean; index?: number }) {
    const pool = buildPool(cfg)
    const ids = pool.map((q) => q.id)
    applySession(cfg, ids, options?.index ?? 0, options?.reset !== false)
  }

  /** 多库 / 顺序随机练习入口 */
  function startPractice(partial: Partial<PracticeConfig> & Pick<PracticeConfig, 'bankIds'>) {
    const cfg: PracticeConfig = {
      mode: partial.bankIds.length === 1 ? 'bank' : 'multi',
      bankIds: [...partial.bankIds],
      types: partial.types ?? [...settings.enabledTypes],
      domains: partial.domains ?? [],
      order: partial.order ?? 'sequential',
      shuffleOptions: partial.shuffleOptions ?? settings.shuffleOptions,
      autoNextEnabled: partial.autoNextEnabled ?? settings.autoNextEnabled,
      autoNextDelay: partial.autoNextDelay ?? settings.autoNextDelay,
      showAnswerMode: partial.showAnswerMode ?? settings.showAnswerMode,
    }
    startWithConfig(cfg, { reset: true })
  }

  function startBank(bankId: string, index = 0) {
    startWithConfig(
      {
        mode: 'bank',
        bankIds: [bankId],
        types: [...settings.enabledTypes],
        domains: [],
        order: 'sequential',
        shuffleOptions: settings.shuffleOptions,
        autoNextEnabled: settings.autoNextEnabled,
        autoNextDelay: settings.autoNextDelay,
        showAnswerMode: settings.showAnswerMode,
      },
      { reset: true, index },
    )
  }

  function startFavorites(index = 0) {
    startWithConfig(
      {
        mode: 'favorites',
        bankIds: [],
        types: [...settings.enabledTypes],
        domains: [],
        order: 'sequential',
        shuffleOptions: settings.shuffleOptions,
        autoNextEnabled: settings.autoNextEnabled,
        autoNextDelay: settings.autoNextDelay,
        showAnswerMode: settings.showAnswerMode,
      },
      { reset: true, index },
    )
  }

  function startWrong(index = 0) {
    startWithConfig(
      {
        mode: 'wrong',
        bankIds: [],
        types: [...settings.enabledTypes],
        domains: [],
        order: 'sequential',
        shuffleOptions: settings.shuffleOptions,
        autoNextEnabled: settings.autoNextEnabled,
        autoNextDelay: settings.autoNextDelay,
        showAnswerMode: settings.showAnswerMode,
      },
      { reset: true, index },
    )
  }

  function openQuestion(
    bankId: string,
    questionId: string,
    prefer: 'favorites' | 'wrong' | false = false,
  ) {
    if (prefer === 'favorites' || (prefer === false && mode.value === 'favorites' && sessionActive.value)) {
      startFavorites(0)
      const idx = filteredQuestions.value.findIndex((q) => q.id === questionId)
      if (idx >= 0) {
        goTo(idx)
        return
      }
    }
    if (prefer === 'wrong' || (prefer === false && mode.value === 'wrong' && sessionActive.value)) {
      startWrong(0)
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

  function peekResume(): PracticeProgressV2 | null {
    const saved = readProgress()
    if (!saved?.active || !saved.config) return null
    if (saved.questionIds.length) {
      const alive = saved.questionIds.filter((id) => questionMap.value.has(id))
      if (!alive.length) return null
      return { ...saved, questionIds: alive }
    }
    // 旧进度无 questionIds：尝试按 config 重建池但不自动开局
    const pool = buildPool(saved.config)
    if (!pool.length) return null
    return {
      ...saved,
      questionIds: pool.map((q) => q.id),
    }
  }

  /** 进入练习页时探测可恢复会话（不自动开局） */
  function checkResumeOffer() {
    pendingResume.value = peekResume()
    return pendingResume.value
  }

  function resumePending() {
    const saved = pendingResume.value ?? peekResume()
    if (!saved) return false
    applySession(saved.config, saved.questionIds, saved.index, true)
    // 恢复已提交状态标记：有 verdict 的题标记为 submitted（简化：仅记 verdict，进入题时不回填作答细节）
    return true
  }

  function discardPendingAndShowSetup() {
    pendingResume.value = null
    clearPersistedProgress()
    endSession(false)
  }

  function restartCurrent() {
    if (!config.value) return
    startWithConfig(config.value, { reset: true, index: 0 })
  }

  function endSession(clearStorage = true) {
    sessionActive.value = false
    config.value = null
    questionIds.value = []
    currentIndex.value = 0
    sessions.value = {}
    summaryVerdicts.value = {}
    if (clearStorage) clearPersistedProgress()
  }

  /** 回到配置页，但保留 localStorage 进度以便「继续上次」 */
  function pauseToSetup() {
    if (sessionActive.value && config.value) persistProgress()
    sessionActive.value = false
    config.value = null
    questionIds.value = []
    currentIndex.value = 0
    sessions.value = {}
    // 保留 summaryVerdicts 无妨；关键是 storage
  }

  /** @deprecated 兼容旧调用：改为探测恢复 */
  function restoreProgress() {
    const saved = peekResume()
    if (!saved) return
    applySession(saved.config, saved.questionIds, saved.index, true)
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

  function revealAnswer(questionId?: string) {
    const id = questionId ?? currentQuestion.value?.id
    if (!id) return
    updateSession(id, { answerRevealed: true })
  }

  function shouldReveal(session: QuestionSession | null): boolean {
    if (!session?.submitted) return false
    const modeShow = config.value?.showAnswerMode ?? settings.showAnswerMode
    if (modeShow === 'instant') return true
    return session.answerRevealed
  }

  function submitCurrent() {
    const q = currentQuestion.value
    if (!q) return
    const s = ensureSession(q)
    if (s.submitted) return

    const result = gradeQuestion(q, s.answer, {
      blankLooseMatch: settings.blankLooseMatch,
    })

    const instant = (config.value?.showAnswerMode ?? settings.showAnswerMode) === 'instant'
    updateSession(q.id, {
      submitted: true,
      result,
      answerRevealed: instant,
    })

    if (q.type !== 'short' && result.verdict !== 'ungraded') {
      summaryVerdicts.value = { ...summaryVerdicts.value, [q.id]: result.verdict }
      persistResults()
      rememberWrong(q, result.verdict)
    }
  }

  function selfGrade(verdict: 'correct' | 'wrong' | 'partial') {
    const q = currentQuestion.value
    if (!q || q.type !== 'short') return
    const s = ensureSession(q)
    if (!s.submitted) {
      const instant = (config.value?.showAnswerMode ?? settings.showAnswerMode) === 'instant'
      updateSession(q.id, {
        submitted: true,
        result: { verdict: 'ungraded', message: '已自评' },
        answerRevealed: instant,
      })
    }
    updateSession(q.id, { selfVerdict: verdict })
    summaryVerdicts.value = { ...summaryVerdicts.value, [q.id]: verdict }
    persistResults()
    rememberWrong(q, verdict)
  }

  function updateRuntimeFlags(patch: Partial<Pick<PracticeConfig, 'autoNextEnabled' | 'showAnswerMode' | 'shuffleOptions'>>) {
    if (!config.value) return
    config.value = { ...config.value, ...patch }
    if (patch.shuffleOptions != null) reshuffleCurrentIfNeeded()
    persistProgress()
  }

  function reshuffleCurrentIfNeeded() {
    const q = currentQuestion.value
    if (!q) return
    const s = sessions.value[q.id]
    if (!s || s.submitted) return
    if (!q.options?.length) return
    const shuffle = config.value?.shuffleOptions ?? settings.shuffleOptions
    updateSession(q.id, {
      displayOptions: prepareOptions(q.options, shuffle),
      answer: { ...s.answer, optionKeys: [] },
    })
  }

  watch(
    () => settings.shuffleOptions,
    () => {
      if (!config.value) return
      // 仅当会话未单独改过时跟随全局：简单起见，全局变化时若会话仍在用全局值则重排
    },
  )

  return {
    sessionActive,
    config,
    questionIds,
    currentIndex,
    sessions,
    summaryVerdicts,
    pendingResume,
    mode,
    activeBankId,
    activeBank,
    filteredQuestions,
    currentQuestion,
    currentSession,
    progressText,
    stats,
    allDomains,
    startPractice,
    startBank,
    startFavorites,
    startWrong,
    openQuestion,
    checkResumeOffer,
    resumePending,
    discardPendingAndShowSetup,
    restartCurrent,
    endSession,
    pauseToSetup,
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
    revealAnswer,
    shouldReveal,
    updateRuntimeFlags,
    buildPool,
  }
})
