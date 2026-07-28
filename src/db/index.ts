import Dexie, { type EntityTable } from 'dexie'
import type { Bank, FavoriteRecord, NoteRecord, Question } from '@/types/question'
import type { AppSettings } from '@/types/settings'

export class RuguDatabase extends Dexie {
  banks!: EntityTable<Bank, 'id'>
  questions!: EntityTable<Question, 'id'>
  favorites!: EntityTable<FavoriteRecord, 'id'>
  notes!: EntityTable<NoteRecord, 'id'>
  settings!: EntityTable<AppSettings & { id: string }, 'id'>

  constructor() {
    super('rugu-quiz')
    this.version(1).stores({
      banks: 'id, name, source, updatedAt',
      questions: 'id, bankId, type',
      favorites: '++id, questionId, bankId, createdAt',
      notes: '++id, questionId, bankId, updatedAt',
      settings: 'id',
    })
  }
}

export const db = new RuguDatabase()

export const SETTINGS_ROW_ID = 'app'
