import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { createSupabaseClient } from '@/lib/supabase'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { SqueegeeAsset, SqueegeeAssetPayload } from './types'
import { DEFAULT_SQUEEGEE_USE_LIMIT } from './types'
import {
  canApplySqueegeeUsage,
  mapSqueegeeAssetRow,
  normalizeSqueegeeBarcode,
  sortSqueegeeAssets,
} from './utils'

export type FetchSqueegeesResult =
  | { ok: true; assets: SqueegeeAsset[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FindSqueegeeResult =
  | { ok: true; asset: SqueegeeAsset | null }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveSqueegeeResult =
  | { ok: true; asset: SqueegeeAsset }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type ApplySqueegeeUsageResult =
  | { ok: true; asset: SqueegeeAsset }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export function isMissingSqueegeesTable(detail: string) {
  return (
    detail.includes('squeegee_assets') ||
    detail.includes('squeegee_usage_logs') ||
    detail.includes('schema cache')
  )
}

function missingEnvResult(): { ok: false; reason: 'env'; detail: string } {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export async function fetchSqueegeeAssets(options?: {
  activeOnly?: boolean
}): Promise<FetchSqueegeesResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    let query = supabase.from('squeegee_assets').select('*').order('created_at', { ascending: false })
    if (options?.activeOnly) {
      query = query.eq('status', 'active')
    }

    const { data, error } = await query
    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const assets = sortSqueegeeAssets((data || []).map((row) => mapSqueegeeAssetRow(row)))
    return { ok: true, assets }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function findSqueegeeByBarcode(barcode: string): Promise<FindSqueegeeResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const key = normalizeSqueegeeBarcode(barcode)
  if (!key) {
    return { ok: true, asset: null }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('squeegee_assets')
      .select('*')
      .eq('barcode', key)
      .maybeSingle()

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, asset: data ? mapSqueegeeAssetRow(data) : null }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createSqueegeeAsset(payload: SqueegeeAssetPayload): Promise<SaveSqueegeeResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'production_smt', action: 'create' })
  if (!gate.ok) return gate

  const barcode = normalizeSqueegeeBarcode(payload.barcode)
  if (!barcode) {
    return { ok: false, reason: 'validation', detail: '바코드를 입력해 주세요.' }
  }

  const useLimit = Math.max(1, Math.floor(Number(payload.useLimit) || DEFAULT_SQUEEGEE_USE_LIMIT))
  const name = String(payload.name || '').trim()
  const note = String(payload.note || '').trim()

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('squeegee_assets')
      .insert({
        barcode,
        name,
        use_limit: useLimit,
        use_count: 0,
        status: 'active',
        note,
      })
      .select('*')
      .single()

    if (error || !data) {
      if (error?.message?.includes('squeegee_assets_barcode_unique') || error?.message?.includes('duplicate')) {
        return { ok: false, reason: 'validation', detail: '이미 등록된 바코드입니다.' }
      }
      return {
        ok: false,
        reason: 'query',
        detail: error?.message || '스퀴즈 등록에 실패했습니다.',
      }
    }

    return { ok: true, asset: mapSqueegeeAssetRow(data) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function retireSqueegeeAsset(assetId: string): Promise<SaveSqueegeeResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'production_smt', action: 'update' })
  if (!gate.ok) return gate

  const id = String(assetId || '').trim()
  if (!id) {
    return { ok: false, reason: 'validation', detail: '스퀴즈를 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('squeegee_assets')
      .update({ status: 'retired', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()

    if (error || !data) {
      return {
        ok: false,
        reason: 'query',
        detail: error?.message || '상태 변경에 실패했습니다.',
      }
    }

    return { ok: true, asset: mapSqueegeeAssetRow(data) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function applySqueegeeUsage(input: {
  barcode: string
  deltaQty: number
  smtProductionRecordId?: string | null
  recordDate?: string
}): Promise<ApplySqueegeeUsageResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'production_smt', action: 'update' })
  if (!gate.ok) return gate

  const barcode = normalizeSqueegeeBarcode(input.barcode)
  if (!barcode) {
    return { ok: false, reason: 'validation', detail: '스퀴즈 바코드를 스캔해 주세요.' }
  }

  const deltaQty = Math.floor(Number(input.deltaQty) || 0)

  try {
    const supabase = createSupabaseClient()
    const { data: row, error: findError } = await supabase
      .from('squeegee_assets')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle()

    if (findError) {
      return { ok: false, reason: 'query', detail: findError.message }
    }
    if (!row) {
      return {
        ok: false,
        reason: 'validation',
        detail: '등록되지 않은 스퀴즈 바코드입니다. SMT → 마스크·스퀴즈에서 먼저 등록해 주세요.',
      }
    }

    const asset = mapSqueegeeAssetRow(row)
    const check = canApplySqueegeeUsage(asset, deltaQty)
    if (!check.ok) {
      return { ok: false, reason: 'validation', detail: check.detail }
    }

    const nextCount = asset.useCount + deltaQty
    const { data: updated, error: updateError } = await supabase
      .from('squeegee_assets')
      .update({
        use_count: nextCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', asset.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      return {
        ok: false,
        reason: 'query',
        detail: updateError?.message || '사용 횟수 갱신에 실패했습니다.',
      }
    }

    const { error: logError } = await supabase.from('squeegee_usage_logs').insert({
      asset_id: asset.id,
      delta_qty: deltaQty,
      record_date: input.recordDate?.trim() || todayYmdSeoul(),
      smt_production_record_id: input.smtProductionRecordId?.trim() || null,
    })

    if (logError) {
      await supabase
        .from('squeegee_assets')
        .update({ use_count: asset.useCount, updated_at: new Date().toISOString() })
        .eq('id', asset.id)
      return { ok: false, reason: 'query', detail: logError.message }
    }

    return { ok: true, asset: mapSqueegeeAssetRow(updated) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
