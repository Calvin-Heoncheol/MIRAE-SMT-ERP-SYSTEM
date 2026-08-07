import { resolveCreatedBySnapshot } from '@/lib/auth/created-by'
import { createSupabaseClient } from '@/lib/supabase'
import type { ChangeLogEntityType, ChangeLogRecord, InsertChangeLogInput } from './types'

export type FetchChangeLogsResult =
  | { ok: true; rows: ChangeLogRecord[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

function isMissingChangeLogsTable(detail: string) {
  return (
    detail.includes('entity_change_logs') ||
    detail.includes('schema cache') ||
    detail.includes('does not exist')
  )
}

function mapRow(row: {
  id: string
  entity_type: string
  entity_id: string
  title: string
  detail: string
  changed_by_name?: string | null
  changed_at: string
}): ChangeLogRecord {
  return {
    id: row.id,
    entityType: row.entity_type as ChangeLogEntityType,
    entityId: row.entity_id,
    title: row.title || '',
    detail: row.detail || '',
    changedByName: (row.changed_by_name || '').trim(),
    changedAt: row.changed_at,
  }
}

/** 대시보드용 최근 변경사항 */
export async function fetchRecentChangeLogs(limit = 30): Promise<FetchChangeLogsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('entity_change_logs')
      .select('id, entity_type, entity_id, title, detail, changed_by_name, changed_at')
      .order('changed_at', { ascending: false })
      .limit(Math.max(1, Math.min(100, limit)))

    if (error) {
      if (isMissingChangeLogsTable(error.message)) {
        return { ok: true, rows: [] }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, rows: (data || []).map(mapRow) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/** 특정 엔티티(주문서·품목·견적)의 변경이력 */
export async function fetchChangeLogsForEntity(
  entityType: ChangeLogEntityType,
  entityId: string,
  limit = 50,
): Promise<FetchChangeLogsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const id = String(entityId || '').trim()
  if (!id) return { ok: true, rows: [] }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('entity_change_logs')
      .select('id, entity_type, entity_id, title, detail, changed_by_name, changed_at')
      .eq('entity_type', entityType)
      .eq('entity_id', id)
      .order('changed_at', { ascending: false })
      .limit(Math.max(1, Math.min(100, limit)))

    if (error) {
      if (isMissingChangeLogsTable(error.message)) {
        return { ok: true, rows: [] }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, rows: (data || []).map(mapRow) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 변경 이력 기록. 실패해도 호출부 저장은 막지 않음 (테이블 미적용 포함).
 */
export async function insertChangeLog(input: InsertChangeLogInput): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return
  }

  const entityId = String(input.entityId || '').trim()
  const title = String(input.title || '').trim()
  if (!entityId || !title) return

  try {
    const snapshot = await resolveCreatedBySnapshot()
    const supabase = createSupabaseClient()
    const detailBase = String(input.detail || '').trim()
    const reason = String(input.reason || '').trim()
    const detail = reason
      ? detailBase
        ? `${detailBase}\n사유: ${reason}`
        : `사유: ${reason}`
      : detailBase

    const { error } = await supabase.from('entity_change_logs').insert({
      entity_type: input.entityType,
      entity_id: entityId,
      title,
      detail,
      before_data: input.beforeData ?? null,
      after_data: {
        ...(input.afterData || {}),
        ...(reason ? { reason } : {}),
      },
      changed_by: snapshot.createdBy,
      changed_by_name: snapshot.createdByName,
    })

    if (error && !isMissingChangeLogsTable(error.message)) {
      console.warn('[change-logs] insert failed:', error.message)
    }
  } catch (error) {
    console.warn(
      '[change-logs] insert failed:',
      error instanceof Error ? error.message : String(error),
    )
  }
}
