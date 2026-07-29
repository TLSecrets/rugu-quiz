import { db, SETTINGS_ROW_ID } from '@/db'
import { sampleBank, sampleQuestions, SAMPLE_BANK_ID } from '@/data/sample-bank'
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings'
import type { Bank, Question } from '@/types/question'

export async function loadSettingsFromDb(): Promise<AppSettings> {
  const row = await db.settings.get(SETTINGS_ROW_ID)
  if (!row) {
    await db.settings.put({ id: SETTINGS_ROW_ID, ...DEFAULT_SETTINGS })
    return {
      ...DEFAULT_SETTINGS,
      deepseek: { ...DEFAULT_SETTINGS.deepseek },
      enabledTypes: [],
    }
  }
  return {
    theme: row.theme ?? DEFAULT_SETTINGS.theme,
    shuffleOptions: row.shuffleOptions ?? DEFAULT_SETTINGS.shuffleOptions,
    enabledTypes: row.enabledTypes ?? [],
    blankLooseMatch: row.blankLooseMatch ?? DEFAULT_SETTINGS.blankLooseMatch,
    autoNextDelay: row.autoNextDelay ?? DEFAULT_SETTINGS.autoNextDelay,
    autoNextEnabled: row.autoNextEnabled ?? DEFAULT_SETTINGS.autoNextEnabled,
    showAnswerMode: row.showAnswerMode ?? DEFAULT_SETTINGS.showAnswerMode,
    fontSize: row.fontSize ?? DEFAULT_SETTINGS.fontSize,
    deepseek: { ...DEFAULT_SETTINGS.deepseek, ...row.deepseek },
  }
}

export async function saveSettingsToDb(settings: AppSettings): Promise<void> {
  await db.settings.put({ id: SETTINGS_ROW_ID, ...settings })
}

/** 写入 / 补齐示例题库（不覆盖已有同 id 题目内容以外的用户题库） */
export async function ensureSampleBank(): Promise<void> {
  const existing = await db.banks.get(SAMPLE_BANK_ID)
  const now = Date.now()

  if (!existing) {
    await db.transaction('rw', db.banks, db.questions, async () => {
      await db.banks.put({
        ...sampleBank,
        createdAt: now,
        updatedAt: now,
        questionCount: sampleQuestions.length,
      })
      await db.questions.bulkPut(sampleQuestions)
    })
    return
  }

  // 补齐后续阶段新增的示例题（如公式样例），不删除用户未改动的旧题
  await db.transaction('rw', db.banks, db.questions, async () => {
    for (const q of sampleQuestions) {
      const has = await db.questions.get(q.id)
      if (!has) await db.questions.put(q)
    }
    const count = await db.questions.where('bankId').equals(SAMPLE_BANK_ID).count()
    await db.banks.update(SAMPLE_BANK_ID, {
      questionCount: count,
      description: sampleBank.description,
      tags: existing.tags?.length ? existing.tags : sampleBank.tags,
      updatedAt: now,
    })
  })
}

interface GeneratedManifest {
  banks: Array<{
    id: string
    dataFile: string
  }>
}

interface GeneratedPayload {
  bank: Bank
  questions: Question[]
}

/** 拉取构建产物题库；已存在同 id 则跳过，避免覆盖用户导入 */
export async function syncGeneratedBanks(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}generated/manifest.json`, {
      cache: 'no-cache',
    })
    if (!res.ok) return
    const manifest = (await res.json()) as GeneratedManifest
    if (!manifest.banks?.length) return

    for (const item of manifest.banks) {
      const existing = await db.banks.get(item.id)
      if (existing) continue

      const dataRes = await fetch(`${import.meta.env.BASE_URL}generated/${item.dataFile}`, {
        cache: 'no-cache',
      })
      if (!dataRes.ok) continue
      const payload = (await dataRes.json()) as GeneratedPayload
      if (!payload.bank || !payload.questions?.length) continue

      const now = Date.now()
      await db.transaction('rw', db.banks, db.questions, async () => {
        await db.banks.put({
          ...payload.bank,
          source: 'generated',
          createdAt: payload.bank.createdAt || now,
          updatedAt: now,
          questionCount: payload.questions.length,
        })
        await db.questions.bulkPut(
          payload.questions.map((q) => ({ ...q, bankId: payload.bank.id })),
        )
      })
    }
  } catch {
    // 开发时可能尚无 generated，静默跳过
  }
}

export async function bootstrapDatabase(): Promise<void> {
  await ensureSampleBank()
  await syncGeneratedBanks()
}

/** 清空题库 / 收藏 / 笔记 / 错题与练习进度（保留设置与 API Key） */
export async function clearLearningData(): Promise<void> {
  await db.transaction(
    'rw',
    db.banks,
    db.questions,
    db.favorites,
    db.notes,
    db.wrongRecords,
    async () => {
      await db.favorites.clear()
      await db.notes.clear()
      await db.wrongRecords.clear()
      await db.questions.clear()
      await db.banks.clear()
    },
  )
  localStorage.removeItem('rugu-practice-progress')
  localStorage.removeItem('rugu-practice-results')
  await ensureSampleBank()
  await syncGeneratedBanks()
}

/** 危险：清空全部本地数据（含设置与 API Key） */
export async function clearAllLocalData(): Promise<void> {
  await db.delete()
  localStorage.removeItem('rugu-practice-progress')
  localStorage.removeItem('rugu-practice-results')
  localStorage.removeItem('rugu-theme')
  localStorage.removeItem('rugu-settings')
}
