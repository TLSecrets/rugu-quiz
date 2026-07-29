import Dexie, { type EntityTable } from 'dexie'
import type { Bank, FavoriteRecord, NoteRecord, Question, WrongRecord } from '@/types/question'
import type { AppSettings } from '@/types/settings'

/** 题库标签目录（可独立增删改，不依赖是否已挂到题库） */
export interface TagCatalogEntry {
  name: string
  createdAt: number
}

export class RuguDatabase extends Dexie {
  banks!: EntityTable<Bank, 'id'>
  questions!: EntityTable<Question, 'id'>
  favorites!: EntityTable<FavoriteRecord, 'id'>
  notes!: EntityTable<NoteRecord, 'id'>
  settings!: EntityTable<AppSettings & { id: string }, 'id'>
  wrongRecords!: EntityTable<WrongRecord, 'questionId'>
  tagCatalog!: EntityTable<TagCatalogEntry, 'name'>

  constructor() {
    super('rugu-quiz')
    this.version(1).stores({
      banks: 'id, name, source, updatedAt',
      questions: 'id, bankId, type',
      favorites: '++id, questionId, bankId, createdAt',
      notes: '++id, questionId, bankId, updatedAt',
      settings: 'id',
    })
    this.version(2).stores({
      banks: 'id, name, source, updatedAt',
      questions: 'id, bankId, type, domain',
      favorites: '++id, questionId, bankId, createdAt',
      notes: '++id, questionId, bankId, updatedAt',
      settings: 'id',
      wrongRecords: 'questionId, bankId, wrongCount, lastWrongAt, removed',
    })
    this.version(3).stores({
      banks: 'id, name, source, updatedAt',
      questions: 'id, bankId, type, domain',
      favorites: '++id, questionId, bankId, createdAt',
      notes: '++id, questionId, bankId, updatedAt',
      settings: 'id',
      wrongRecords: 'questionId, bankId, wrongCount, lastWrongAt, removed',
      tagCatalog: 'name, createdAt',
    })
  }
}

export const db = new RuguDatabase()

export const SETTINGS_ROW_ID = 'app'
