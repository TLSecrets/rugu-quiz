import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { gradeQuestion, type GradeVerdict, type UserAnswer } from '@/lib/grade'
import { shuffleArray } from '@/lib/shuffle'
import { useBanksStore } from '@/stores/banks'
import { useSettingsStore } from '@/stores/settings'
import { useWrongsStore } from '@/stores/wrongs'
import {
  emptyTypeSlots,
  emptyUserAnswer,
  type ExamItem,
  type ExamItemResult,
  type ExamPhase,
  type TypeSlotConfig,
} from '@/types/exam'
import {
  ALL_QUESTION_TYPES,
  type Question,
  type QuestionType,
} from '@/types/question'

const EXAM_KEY = 'rugu-exam-session'

interface PersistedExam {
  phase: ExamPhase
  items: ExamItem[]
  answers: Record<string, UserAnswer>
  results: Record<string, ExamItemResult>
  currentIndex: number
  title: string
}

function blankLen(q: Question) {
  return Math.max(q.answer.texts?.length ?? 1, 1)
}

function earnedScore(verdict: GradeVerdict, score: number): number {
  if (verdict === 'correct') return score
  if (verdict === 'partial') return Math.round(score * 50) / 100
  return 0
}

export const useExamStore = defineStore('exam', () => {
  const banks = useBanksStore()
  const settings = useSettingsStore()
  const wrongs = useWrongsStore()

  const phase = ref<ExamPhase>('compose')
  const typeConfig = ref(emptyTypeSlots())
  const selectedBankIds = ref<string[]>([])
  const items = ref<ExamItem[]>([])
  const answers = ref<Record<string, UserAnswer>>({})
  const results = ref<Record<string, ExamItemResult>>({})
  const currentIndex = ref(0)
  const title = ref('模拟考试')

  const questionMap = computed(() => {
    const map = new Map<string, Question>()
    for (const list of Object.values(banks.questionsByBank)) {
      for (const q of list) map.set(q.id, q)
    }
    return map
  })

  const questions = computed(() => {
    const list: Question[] = []
    for (const item of items.value) {
      const q = questionMap.value.get(item.questionId)
      if (q) list.push(q)
    }
    return list
  })

  const currentItem = computed(() => items.value[currentIndex.value])
  const currentQuestion = computed(() => {
    const item = currentItem.value
    if (!item) return undefined
    return questionMap.value.get(item.questionId)
  })

  const totalScore = computed(() => items.value.reduce((s, i) => s + i.score, 0))
  const earnedTotal = computed(() =>
    items.value.reduce((s, i) => s + (results.value[i.questionId]?.earned ?? 0), 0),
  )

  const answeredCount = computed(() => {
    let n = 0
    for (const item of items.value) {
      const a = answers.value[item.questionId]
      if (!a) continue
      if (a.optionKeys.length) n++
      else if (a.texts.some((t) => t.trim())) n++
    }
    return n
  })

  const statsByType = computed(() => {
    const map: Record<
      QuestionType,
      { count: number; correct: number; wrong: number; partial: number; pending: number; score: number; earned: number }
    > = {
      single: { count: 0, correct: 0, wrong: 0, partial: 0, pending: 0, score: 0, earned: 0 },
      multiple: { count: 0, correct: 0, wrong: 0, partial: 0, pending: 0, score: 0, earned: 0 },
      judge: { count: 0, correct: 0, wrong: 0, partial: 0, pending: 0, score: 0, earned: 0 },
      blank: { count: 0, correct: 0, wrong: 0, partial: 0, pending: 0, score: 0, earned: 0 },
      short: { count: 0, correct: 0, wrong: 0, partial: 0, pending: 0, score: 0, earned: 0 },
    }
    for (const item of items.value) {
      const row = map[item.type]
      row.count++
      row.score += item.score
      const r = results.value[item.questionId]
      if (!r) continue
      row.earned += r.earned
      if (r.verdict === 'correct') row.correct++
      else if (r.verdict === 'wrong') row.wrong++
      else if (r.verdict === 'partial') row.partial++
      else row.pending++
    }
    return map
  })

  const wrongQuestionIds = computed(() =>
    items.value
      .filter((i) => {
        const v = results.value[i.questionId]?.verdict
        return v === 'wrong' || v === 'partial'
      })
      .map((i) => i.questionId),
  )

  function activeBankIds(): string[] {
    return selectedBankIds.value
  }

  function countAvailable(type: QuestionType, excludeIds?: Set<string>) {
    let n = 0
    for (const bankId of activeBankIds()) {
      for (const q of banks.getQuestions(bankId)) {
        if (q.type !== type) continue
        if (excludeIds?.has(q.id)) continue
        n++
      }
    }
    return n
  }

  function pickQuestions(type: QuestionType, count: number, used: Set<string>): Question[] {
    const pool: Question[] = []
    for (const bankId of activeBankIds()) {
      for (const q of banks.getQuestions(bankId)) {
        if (q.type !== type) continue
        if (used.has(q.id)) continue
        pool.push(q)
      }
    }
    return shuffleArray(pool).slice(0, Math.max(0, count))
  }

  function previewCompose(): { items: ExamItem[]; totalScore: number; totalCount: number } {
    const draft: ExamItem[] = []
    const used = new Set<string>()

    for (const type of ALL_QUESTION_TYPES) {
      const slot = typeConfig.value[type]
      if (!slot.enabled || slot.count <= 0) continue
      const picked = pickQuestions(type, slot.count, used)
      for (const q of picked) {
        used.add(q.id)
        draft.push({
          questionId: q.id,
          bankId: q.bankId,
          type: q.type,
          score: Math.max(0, slot.score),
        })
      }
    }

    return {
      items: draft,
      totalScore: draft.reduce((s, i) => s + i.score, 0),
      totalCount: draft.length,
    }
  }

  function persist() {
    const payload: PersistedExam = {
      phase: phase.value,
      items: items.value,
      answers: answers.value,
      results: results.value,
      currentIndex: currentIndex.value,
      title: title.value,
    }
    sessionStorage.setItem(EXAM_KEY, JSON.stringify(payload))
  }

  function clearPersist() {
    sessionStorage.removeItem(EXAM_KEY)
  }

  function restore(): boolean {
    try {
      const raw = sessionStorage.getItem(EXAM_KEY)
      if (!raw) return false
      const parsed = JSON.parse(raw) as PersistedExam
      if (!parsed.items?.length) return false
      phase.value = parsed.phase
      items.value = parsed.items
      answers.value = parsed.answers ?? {}
      results.value = parsed.results ?? {}
      currentIndex.value = parsed.currentIndex ?? 0
      title.value = parsed.title || '模拟考试'
      return true
    } catch {
      return false
    }
  }

  function ensureBankSelection() {
    if (!selectedBankIds.value.length && banks.banks.length) {
      selectedBankIds.value = banks.banks.map((b) => b.id)
    }
  }

  function setSelectedBankIds(ids: string[]) {
    selectedBankIds.value = [...ids]
  }

  function resetCompose() {
    phase.value = 'compose'
    items.value = []
    answers.value = {}
    results.value = {}
    currentIndex.value = 0
    clearPersist()
  }

  function startExam(paperTitle = '模拟考试'): { ok: true } | { ok: false; message: string } {
    const preview = previewCompose()
    if (!preview.totalCount) {
      return { ok: false, message: '请至少选择一道可抽取的题目' }
    }
    const ans: Record<string, UserAnswer> = {}
    for (const item of preview.items) {
      const q = questionMap.value.get(item.questionId)
      ans[item.questionId] = emptyUserAnswer(item.type, q ? blankLen(q) : 1)
    }
    items.value = preview.items
    answers.value = ans
    results.value = {}
    currentIndex.value = 0
    title.value = paperTitle
    phase.value = 'taking'
    persist()
    return { ok: true }
  }

  function goTo(index: number) {
    const max = Math.max(items.value.length - 1, 0)
    currentIndex.value = Math.min(Math.max(index, 0), max)
    persist()
  }

  function next() {
    goTo(currentIndex.value + 1)
  }

  function prev() {
    goTo(currentIndex.value - 1)
  }

  function ensureAnswer(questionId: string, type: QuestionType, len = 1): UserAnswer {
    const existing = answers.value[questionId]
    if (existing) return existing
    const created = emptyUserAnswer(type, len)
    answers.value = { ...answers.value, [questionId]: created }
    return created
  }

  function selectSingle(questionId: string, key: string) {
    const q = questionMap.value.get(questionId)
    if (!q) return
    ensureAnswer(questionId, q.type, blankLen(q))
    answers.value = {
      ...answers.value,
      [questionId]: { ...answers.value[questionId], optionKeys: [key] },
    }
    persist()
  }

  function toggleMultiple(questionId: string, key: string) {
    const q = questionMap.value.get(questionId)
    if (!q) return
    const cur = ensureAnswer(questionId, q.type, blankLen(q))
    const set = new Set(cur.optionKeys)
    if (set.has(key)) set.delete(key)
    else set.add(key)
    answers.value = {
      ...answers.value,
      [questionId]: { ...cur, optionKeys: [...set] },
    }
    persist()
  }

  function setText(questionId: string, index: number, value: string) {
    const q = questionMap.value.get(questionId)
    if (!q) return
    const cur = ensureAnswer(questionId, q.type, blankLen(q))
    const texts = [...cur.texts]
    texts[index] = value
    answers.value = { ...answers.value, [questionId]: { ...cur, texts } }
    persist()
  }

  async function submitPaper() {
    const nextResults: Record<string, ExamItemResult> = { ...results.value }
    for (const item of items.value) {
      const q = questionMap.value.get(item.questionId)
      if (!q) continue
      const answer = answers.value[item.questionId] ?? emptyUserAnswer(item.type)
      if (q.type === 'short') {
        const existing = nextResults[item.questionId]
        if (existing && existing.verdict !== 'ungraded') continue
        nextResults[item.questionId] = {
          verdict: 'ungraded',
          earned: 0,
          message: '待自评',
        }
        continue
      }
      const graded = gradeQuestion(q, answer, { blankLooseMatch: settings.blankLooseMatch })
      nextResults[item.questionId] = {
        verdict: graded.verdict,
        earned: earnedScore(graded.verdict, item.score),
        message: graded.message,
      }
      if (graded.verdict === 'wrong' || graded.verdict === 'partial') {
        await wrongs.recordFailure(q.id, q.bankId, graded.verdict)
      }
    }
    results.value = nextResults
    phase.value = 'result'
    persist()
  }

  async function selfGrade(questionId: string, verdict: 'correct' | 'wrong' | 'partial') {
    const item = items.value.find((i) => i.questionId === questionId)
    const q = questionMap.value.get(questionId)
    if (!item || !q || q.type !== 'short') return
    results.value = {
      ...results.value,
      [questionId]: {
        verdict,
        earned: earnedScore(verdict, item.score),
        message: '已自评',
      },
    }
    if (verdict === 'wrong' || verdict === 'partial') {
      await wrongs.recordFailure(q.id, q.bankId, verdict)
    }
    persist()
  }

  function exitExam(clear = true) {
    phase.value = 'compose'
    items.value = []
    answers.value = {}
    results.value = {}
    currentIndex.value = 0
    if (clear) clearPersist()
  }

  return {
    phase,
    typeConfig,
    selectedBankIds,
    items,
    answers,
    results,
    currentIndex,
    title,
    questions,
    currentItem,
    currentQuestion,
    totalScore,
    earnedTotal,
    answeredCount,
    statsByType,
    wrongQuestionIds,
    countAvailable,
    previewCompose,
    ensureBankSelection,
    setSelectedBankIds,
    resetCompose,
    startExam,
    goTo,
    next,
    prev,
    selectSingle,
    toggleMultiple,
    setText,
    submitPaper,
    selfGrade,
    exitExam,
    restore,
    persist,
  }
})

export type { TypeSlotConfig }
