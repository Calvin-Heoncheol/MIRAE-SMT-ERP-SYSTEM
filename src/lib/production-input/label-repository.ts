import {
  assertCanWrite,
  postProcessTeamToAccessModule,
} from '@/lib/auth/assert-can-write'
import { resolveCreatedBySnapshot } from '@/lib/auth/created-by'
import { normalizePostProcessTeam, type PostProcessTeam } from '@/lib/post-process/teams'
import {
  buildSequentialBarcodes,
  suggestNextCustomBarcodeStart,
} from '@/lib/production-input/production-label-code'
import { createSupabaseClient } from '@/lib/supabase'

export type ProductionUnitLabelRow = {
  id: string
  barcode: string
  assemblyGroupId: string
  team: PostProcessTeam
  planId: string | null
  jobBaseCode: string
  scannedAt: string | null
}

export type IssueProductionUnitLabelsInput = {
  barcodes: string[]
  assemblyGroupId: string
  team: string
  planId?: string | null
  jobBaseCode: string
}

export type IssueProductionUnitLabelsResult =
  | { ok: true; count: number }
  | { ok: false; reason: 'env' | 'auth' | 'validation' | 'query'; detail: string }

export type LookupProductionUnitLabelResult =
  | { ok: true; label: ProductionUnitLabelRow }
  | { ok: false; reason: 'env' | 'query' | 'not_found'; detail: string }

export type MarkProductionUnitLabelScannedResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'auth' | 'validation' | 'query' | 'already'; detail: string }

export type SuggestNextBarcodeStartResult =
  | { ok: true; start: string }
  | { ok: false; reason: 'env' | 'query'; detail: string }

function missingEnvResult<T extends { ok: false; reason: 'env'; detail: string }>(): T {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  } as T
}

function normalizeBarcode(raw: string) {
  return String(raw || '').trim().toUpperCase()
}

function mapRow(raw: Record<string, unknown>): ProductionUnitLabelRow {
  return {
    id: String(raw.id || ''),
    barcode: String(raw.barcode || ''),
    assemblyGroupId: String(raw.assembly_group_id || ''),
    team: normalizePostProcessTeam(String(raw.team || '')),
    planId: raw.plan_id ? String(raw.plan_id) : null,
    jobBaseCode: String(raw.job_base_code || ''),
    scannedAt: raw.scanned_at ? String(raw.scanned_at) : null,
  }
}

export function isMissingProductionUnitLabelsTable(detail: string) {
  return (
    detail.includes('production_unit_labels') &&
    (detail.includes('schema cache') ||
      detail.includes('does not exist') ||
      detail.includes('Could not find'))
  )
}

/** ERP 라벨 출력 시 바코드 일괄 발급 (다른 PC 스캔용) */
export async function issueProductionUnitLabels(
  input: IssueProductionUnitLabelsInput,
): Promise<IssueProductionUnitLabelsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const team = normalizePostProcessTeam(input.team)
  const gate = await assertCanWrite({
    module: postProcessTeamToAccessModule(team),
    action: 'create',
  })
  if (!gate.ok) return gate

  const assemblyGroupId = String(input.assemblyGroupId || '').trim()
  const jobBaseCode = String(input.jobBaseCode || '').trim()
  const planId = String(input.planId || '').trim() || null
  const barcodes = [
    ...new Set(
      (input.barcodes || [])
        .map(normalizeBarcode)
        .filter(Boolean),
    ),
  ]

  if (!assemblyGroupId) {
    return { ok: false, reason: 'validation', detail: '조립 그룹을 찾을 수 없습니다.' }
  }
  if (!jobBaseCode) {
    return { ok: false, reason: 'validation', detail: '건 식별 코드가 없습니다.' }
  }
  if (barcodes.length < 1) {
    return { ok: false, reason: 'validation', detail: '발급할 바코드가 없습니다.' }
  }

  try {
    const snap = await resolveCreatedBySnapshot()
    const supabase = createSupabaseClient()
    const rows = barcodes.map((barcode) => ({
      barcode,
      assembly_group_id: assemblyGroupId,
      team,
      plan_id: planId,
      job_base_code: jobBaseCode,
      created_by: snap.createdBy,
      created_by_name: snap.createdByName,
    }))

    const { error } = await supabase.from('production_unit_labels').insert(rows)
    if (error) {
      if (isMissingProductionUnitLabelsTable(error.message)) {
        return {
          ok: false,
          reason: 'query',
          detail:
            'production_unit_labels 테이블이 없습니다. setup-production-unit-labels.sql 을 실행하세요.',
        }
      }
      if (
        error.message.includes('duplicate') ||
        error.message.includes('unique') ||
        error.code === '23505'
      ) {
        return {
          ok: false,
          reason: 'validation',
          detail: '이미 발급된 바코드가 포함되어 있습니다. 시작 번호를 바꿔 주세요.',
        }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, count: barcodes.length }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : '라벨 발급에 실패했습니다.',
    }
  }
}

export async function lookupProductionUnitLabel(
  barcodeRaw: string,
): Promise<LookupProductionUnitLabelResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const barcode = normalizeBarcode(barcodeRaw)
  if (!barcode) {
    return { ok: false, reason: 'not_found', detail: '바코드가 비어 있습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('production_unit_labels')
      .select(
        'id, barcode, assembly_group_id, team, plan_id, job_base_code, scanned_at',
      )
      .eq('barcode', barcode)
      .maybeSingle()

    if (error) {
      if (isMissingProductionUnitLabelsTable(error.message)) {
        return {
          ok: false,
          reason: 'query',
          detail:
            'production_unit_labels 테이블이 없습니다. setup-production-unit-labels.sql 을 실행하세요.',
        }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }
    if (!data) {
      return {
        ok: false,
        reason: 'not_found',
        detail: 'ERP에서 출력한 라벨이 아닙니다. 라벨 출력 후 스캔하세요.',
      }
    }

    return { ok: true, label: mapRow(data as Record<string, unknown>) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : '바코드 조회에 실패했습니다.',
    }
  }
}

export async function markProductionUnitLabelScanned(
  barcodeRaw: string,
  teamHint?: string,
): Promise<MarkProductionUnitLabelScannedResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const barcode = normalizeBarcode(barcodeRaw)
  if (!barcode) {
    return { ok: false, reason: 'validation', detail: '바코드가 비어 있습니다.' }
  }

  const team = normalizePostProcessTeam(teamHint)
  const gate = await assertCanWrite({
    module: postProcessTeamToAccessModule(team),
    action: 'update',
  })
  if (!gate.ok) return gate

  try {
    const snap = await resolveCreatedBySnapshot()
    const supabase = createSupabaseClient()

    const { data: existing, error: findError } = await supabase
      .from('production_unit_labels')
      .select('id, scanned_at, team')
      .eq('barcode', barcode)
      .maybeSingle()

    if (findError) {
      if (isMissingProductionUnitLabelsTable(findError.message)) {
        return {
          ok: false,
          reason: 'query',
          detail:
            'production_unit_labels 테이블이 없습니다. setup-production-unit-labels.sql 을 실행하세요.',
        }
      }
      return { ok: false, reason: 'query', detail: findError.message }
    }
    if (!existing) {
      return {
        ok: false,
        reason: 'validation',
        detail: 'ERP에서 출력한 라벨이 아닙니다.',
      }
    }
    if (existing.scanned_at) {
      return { ok: false, reason: 'already', detail: '이미 스캔한 라벨입니다.' }
    }

    const { data: updated, error } = await supabase
      .from('production_unit_labels')
      .update({
        scanned_at: new Date().toISOString(),
        scanned_by: snap.createdBy,
        scanned_by_name: snap.createdByName,
      })
      .eq('barcode', barcode)
      .is('scanned_at', null)
      .select('id')
      .maybeSingle()

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }
    if (!updated) {
      return { ok: false, reason: 'already', detail: '이미 스캔한 라벨입니다.' }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : '스캔 완료 처리에 실패했습니다.',
    }
  }
}

/** 양품 등록 실패 시 스캔 점유 해제 */
export async function unmarkProductionUnitLabelScanned(
  barcodeRaw: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, detail: '환경 변수가 없습니다.' }
  }
  const barcode = normalizeBarcode(barcodeRaw)
  if (!barcode) return { ok: false, detail: '바코드가 비어 있습니다.' }
  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase
      .from('production_unit_labels')
      .update({
        scanned_at: null,
        scanned_by: null,
        scanned_by_name: '',
      })
      .eq('barcode', barcode)
    if (error) return { ok: false, detail: error.message }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : '스캔 해제에 실패했습니다.',
    }
  }
}

/** 해당 건에서 다음에 이어 쓸 시작 바코드 (다른 PC 포함) */
export async function suggestNextBarcodeStart(
  assemblyGroupId: string,
  teamRaw: string,
): Promise<SuggestNextBarcodeStartResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const assemblyId = String(assemblyGroupId || '').trim()
  const team = normalizePostProcessTeam(teamRaw)
  if (!assemblyId) {
    return { ok: true, start: '' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('production_unit_labels')
      .select('barcode')
      .eq('assembly_group_id', assemblyId)
      .eq('team', team)
      .order('created_at', { ascending: false })
      .limit(40)

    if (error) {
      if (isMissingProductionUnitLabelsTable(error.message)) {
        return { ok: true, start: '' }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    const barcodes = (data || [])
      .map((row) => String((row as { barcode?: string }).barcode || '').trim())
      .filter(Boolean)
    if (!barcodes.length) {
      return { ok: true, start: '' }
    }

    // 숫자 끝자리 기준 최대값의 다음
    let best = barcodes[0]!
    let bestNum = -1
    for (const code of barcodes) {
      const match = code.match(/^(.*?)(\d+)$/)
      if (!match) continue
      const num = Number(match[2])
      if (Number.isFinite(num) && num > bestNum) {
        bestNum = num
        best = code
      }
    }

    const next = suggestNextCustomBarcodeStart([best])
    if (next) return { ok: true, start: next }

    const fallback = buildSequentialBarcodes(best, 2)
    return { ok: true, start: fallback[1] || '' }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : '시작 번호 조회에 실패했습니다.',
    }
  }
}
