import { createSupabaseClient } from '@/lib/supabase'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { MetalMaskAsset, MetalMaskAssetPayload, MetalMaskPcbSide } from './types'
import { DEFAULT_METAL_MASK_USE_LIMIT } from './types'
import {
  canApplyMetalMaskUsage,
  mapMetalMaskAssetRow,
  normalizeMetalMaskBarcode,
  normalizeMetalMaskPcbSide,
  sortMetalMaskAssets,
} from './utils'

export type FetchMetalMasksResult =
  | { ok: true; assets: MetalMaskAsset[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FindMetalMaskResult =
  | { ok: true; asset: MetalMaskAsset | null }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveMetalMaskResult =
  | { ok: true; asset: MetalMaskAsset }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export type ApplyMetalMaskUsageResult =
  | { ok: true; asset: MetalMaskAsset }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export function isMissingMetalMasksTable(detail: string) {
  return (
    detail.includes('metal_mask_assets') ||
    detail.includes('metal_mask_usage_logs') ||
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

export async function fetchMetalMaskAssets(options?: {
  activeOnly?: boolean
}): Promise<FetchMetalMasksResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    let query = supabase.from('metal_mask_assets').select('*').order('created_at', { ascending: false })
    if (options?.activeOnly) {
      query = query.eq('status', 'active')
    }

    const { data, error } = await query
    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const assets = sortMetalMaskAssets((data || []).map((row) => mapMetalMaskAssetRow(row)))
    return { ok: true, assets }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function findMetalMaskByBarcode(barcode: string): Promise<FindMetalMaskResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const key = normalizeMetalMaskBarcode(barcode)
  if (!key) {
    return { ok: true, asset: null }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('metal_mask_assets')
      .select('*')
      .eq('barcode', key)
      .maybeSingle()

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, asset: data ? mapMetalMaskAssetRow(data) : null }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createMetalMaskAsset(payload: MetalMaskAssetPayload): Promise<SaveMetalMaskResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const barcode = normalizeMetalMaskBarcode(payload.barcode)
  if (!barcode) {
    return { ok: false, reason: 'validation', detail: '바코드를 입력해 주세요.' }
  }

  const pcbSide = normalizeMetalMaskPcbSide(payload.pcbSide)
  const useLimit = Math.max(1, Math.floor(Number(payload.useLimit) || DEFAULT_METAL_MASK_USE_LIMIT))
  const name = String(payload.name || '').trim()
  const note = String(payload.note || '').trim()
  const itemId = String(payload.itemId || '').trim() || null

  if (!itemId) {
    return { ok: false, reason: 'validation', detail: '기초등록 반제품 목록에서 품명을 선택해 주세요.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('metal_mask_assets')
      .insert({
        barcode,
        name,
        item_id: itemId,
        pcb_side: pcbSide,
        use_limit: useLimit,
        use_count: 0,
        status: 'active',
        note,
      })
      .select('*')
      .single()

    if (error || !data) {
      if (error?.message?.includes('metal_mask_assets_barcode_unique') || error?.message?.includes('duplicate')) {
        return { ok: false, reason: 'validation', detail: '이미 등록된 바코드입니다.' }
      }
      return {
        ok: false,
        reason: 'query',
        detail: error?.message || '메탈마스크 등록에 실패했습니다.',
      }
    }

    return { ok: true, asset: mapMetalMaskAssetRow(data) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function retireMetalMaskAsset(assetId: string): Promise<SaveMetalMaskResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const id = String(assetId || '').trim()
  if (!id) {
    return { ok: false, reason: 'validation', detail: '마스크를 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('metal_mask_assets')
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

    return { ok: true, asset: mapMetalMaskAssetRow(data) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function applyMetalMaskUsage(input: {
  barcode: string
  pcbSide: MetalMaskPcbSide
  deltaQty: number
  smtProductionRecordId?: string | null
  recordDate?: string
}): Promise<ApplyMetalMaskUsageResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const barcode = normalizeMetalMaskBarcode(input.barcode)
  if (!barcode) {
    return { ok: false, reason: 'validation', detail: '메탈마스크 바코드를 스캔해 주세요.' }
  }

  const pcbSide = normalizeMetalMaskPcbSide(input.pcbSide)
  const deltaQty = Math.floor(Number(input.deltaQty) || 0)

  try {
    const supabase = createSupabaseClient()
    const { data: row, error: findError } = await supabase
      .from('metal_mask_assets')
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
        detail: '등록되지 않은 마스크 바코드입니다. SMT → 마스크·스퀴즈에서 먼저 등록해 주세요.',
      }
    }

    const asset = mapMetalMaskAssetRow(row)
    const check = canApplyMetalMaskUsage(asset, pcbSide, deltaQty)
    if (!check.ok) {
      return { ok: false, reason: 'validation', detail: check.detail }
    }

    const nextCount = asset.useCount + deltaQty
    const { data: updated, error: updateError } = await supabase
      .from('metal_mask_assets')
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

    const { error: logError } = await supabase.from('metal_mask_usage_logs').insert({
      asset_id: asset.id,
      smt_production_record_id: input.smtProductionRecordId || null,
      pcb_side: pcbSide,
      delta_qty: deltaQty,
      record_date: input.recordDate?.trim() || todayYmdSeoul(),
    })

    if (logError) {
      // 로그 실패 시 카운트 롤백 시도
      await supabase
        .from('metal_mask_assets')
        .update({ use_count: asset.useCount, updated_at: new Date().toISOString() })
        .eq('id', asset.id)
      return { ok: false, reason: 'query', detail: logError.message }
    }

    return { ok: true, asset: mapMetalMaskAssetRow(updated) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function previewMetalMaskForSide(
  barcode: string,
  pcbSide: MetalMaskPcbSide,
): Promise<
  | { ok: true; asset: MetalMaskAsset }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }
> {
  const found = await findMetalMaskByBarcode(barcode)
  if (!found.ok) return found
  if (!found.asset) {
    return {
      ok: false,
      reason: 'validation',
      detail: '등록되지 않은 마스크 바코드입니다.',
    }
  }
  const check = canApplyMetalMaskUsage(found.asset, pcbSide, 1)
  if (!check.ok) {
    return { ok: false, reason: 'validation', detail: check.detail }
  }
  return { ok: true, asset: found.asset }
}
