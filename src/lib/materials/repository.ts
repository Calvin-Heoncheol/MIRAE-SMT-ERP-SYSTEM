import { createSupabaseClient } from '@/lib/supabase'
import type { CreateMaterialPayload, Material, MaterialAlternateMpn, MaterialPayload } from './types'
import {
  mapItemRowToMaterial,
  mapMaterialAlternateMpnRecord,
  toItemMaterialInsertRow,
  toItemMaterialUpdateRow,
} from './utils'

export type FetchMaterialsResult =
  | { ok: true; materials: Material[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveMaterialResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type DeleteMaterialResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type AddAlternateMpnResult =
  | { ok: true; row: MaterialAlternateMpn }
  | { ok: false; reason: 'env' | 'query' | 'duplicate'; detail: string }

export type RemoveAlternateMpnResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export function isMissingMaterialsTable(detail: string) {
  return detail.includes('items') || detail.includes('materials') || detail.includes('schema cache')
}

function missingEnvResult(): { ok: false; reason: 'env'; detail: string } {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export async function fetchMaterials(): Promise<FetchMaterialsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .in('item_category', [1, 2])
      .order('name', { ascending: true })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const materials = (data || []).map((row) => mapItemRowToMaterial(row))
    return { ok: true, materials }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createMaterial(payload: CreateMaterialPayload): Promise<SaveMaterialResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const id = payload.id.trim()
  if (!id) {
    return { ok: false, reason: 'query', detail: '자재코드를 입력해 주세요.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('items')
      .insert(toItemMaterialInsertRow(payload))
      .select('id')
      .single()

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, id: data.id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateMaterial(id: string, payload: MaterialPayload): Promise<SaveMaterialResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('items').update(toItemMaterialUpdateRow(payload)).eq('id', id)

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function addAlternateMpn(
  _materialId: string,
  _mpn: string,
  _sortOrder = 0,
): Promise<AddAlternateMpnResult> {
  return {
    ok: false,
    reason: 'query',
    detail: '대체 MPN은 기초등록 → 품목등록의 MPN 필드로 관리합니다.',
  }
}

export async function removeAlternateMpn(_id: string): Promise<RemoveAlternateMpnResult> {
  return {
    ok: false,
    reason: 'query',
    detail: '대체 MPN은 기초등록 → 품목등록의 MPN 필드로 관리합니다.',
  }
}

export async function deleteMaterial(id: string): Promise<DeleteMaterialResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('items').delete().eq('id', id)

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

// mapMaterialAlternateMpnRecord re-export for any legacy imports
export { mapMaterialAlternateMpnRecord }
