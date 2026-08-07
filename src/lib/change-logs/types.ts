export type ChangeLogEntityType = 'order' | 'item' | 'quote'

export type ChangeLogRecord = {
  id: string
  entityType: ChangeLogEntityType
  entityId: string
  title: string
  detail: string
  changedByName: string
  changedAt: string
}

export type InsertChangeLogInput = {
  entityType: ChangeLogEntityType
  entityId: string
  title: string
  detail?: string
  reason?: string
  beforeData?: Record<string, unknown> | null
  afterData?: Record<string, unknown> | null
}
