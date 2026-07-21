import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 생산계획 자동 마감 로그 (production_plan_close_logs).
 * 지난 계획을 실적에 맞춰 조정/삭제할 때 원래 계획 수량을 남겨
 * 리포트의 "계획 달성률" 계산에 사용한다.
 */

export type PlanCloseLogModule = 'smt' | 'post_process'

export type PlanCloseLogInsert = {
  module: PlanCloseLogModule
  plannedDate: string
  /** 후공정 팀명. SMT는 빈 값 (생산1팀) */
  team?: string
  orderId?: string
  originalQuantity: number
  producedQuantity: number
}

function isMissingCloseLogTable(message: string): boolean {
  const text = message.toLowerCase()
  return (
    text.includes('production_plan_close_logs') &&
    (text.includes('does not exist') || text.includes('could not find') || text.includes('schema cache'))
  )
}

/**
 * 마감 로그 기록. 로그 테이블이 아직 없으면 조용히 건너뛴다
 * (setup-production-plan-close-logs.sql 실행 전에도 마감 자체는 동작해야 함).
 */
export async function insertPlanCloseLogs(
  supabase: SupabaseClient,
  rows: PlanCloseLogInsert[],
): Promise<void> {
  const payload = rows
    .filter((row) => row.originalQuantity > 0)
    .map((row) => ({
      module: row.module,
      planned_date: row.plannedDate,
      team: row.team?.trim() || '',
      order_id: row.orderId?.trim() || '',
      original_quantity: Math.floor(row.originalQuantity),
      produced_quantity: Math.max(0, Math.floor(row.producedQuantity)),
    }))
  if (!payload.length) return

  const { error } = await supabase.from('production_plan_close_logs').insert(payload)
  if (error && !isMissingCloseLogTable(error.message)) {
    // 로그 실패로 마감을 막지 않는다 — 달성률 통계만 일부 누락됨
    console.error('[plan-close-log] insert failed:', error.message)
  }
}

export type PlanCloseLogRow = {
  module: PlanCloseLogModule
  plannedDate: string
  team: string
  originalQuantity: number
  producedQuantity: number
}

/** 기간 내 마감 로그 조회. 테이블이 없으면 빈 배열 */
export async function fetchPlanCloseLogsRange(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
): Promise<{ ok: true; logs: PlanCloseLogRow[] } | { ok: false; detail: string }> {
  const { data, error } = await supabase
    .from('production_plan_close_logs')
    .select('module, planned_date, team, original_quantity, produced_quantity')
    .gte('planned_date', startDate)
    .lte('planned_date', endDate)

  if (error) {
    if (isMissingCloseLogTable(error.message)) {
      return { ok: true, logs: [] }
    }
    return { ok: false, detail: error.message }
  }

  return {
    ok: true,
    logs: (data || []).map((row) => ({
      module: row.module === 'post_process' ? 'post_process' : 'smt',
      plannedDate: String(row.planned_date ?? ''),
      team: String(row.team ?? '').trim(),
      originalQuantity: Math.max(0, Math.floor(Number(row.original_quantity) || 0)),
      producedQuantity: Math.max(0, Math.floor(Number(row.produced_quantity) || 0)),
    })),
  }
}
