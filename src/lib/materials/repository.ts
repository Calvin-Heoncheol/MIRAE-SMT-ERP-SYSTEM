import { createSupabaseClient } from '@/lib/supabase'
import type { CreateMaterialPayload, Material, MaterialAlternateMpn, MaterialPayload } from './types'
import { mapMaterialAlternateMpnRecord, mapMaterialRecord, toMaterialInsertRow, toMaterialRow } from './utils'

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
  return (
    detail.includes('materials') ||
    detail.includes('material_mpns') ||
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

export async function fetchMaterials(): Promise<FetchMaterialsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('materials')
      .select(
        `
        *,
        material_mpns (
          id,
          material_id,
          mpn,
          sort_order,
          note,
          created_at
        )
      `,
      )
      .order('customer', { ascending: true })
      .order('material_name', { ascending: true })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const materials = (data || []).map((row) => mapMaterialRecord(row))
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
      .from('materials')
      .insert(toMaterialInsertRow(payload))
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
    const { error } = await supabase.from('materials').update(toMaterialRow(payload)).eq('id', id)

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
  materialId: string,
  mpn: string,
  sortOrder = 0,
): Promise<AddAlternateMpnResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const trimmed = mpn.trim()
  if (!trimmed) {
    return { ok: false, reason: 'query', detail: '대체 MPN이 비어 있습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('material_mpns')
      .insert({ material_id: materialId, mpn: trimmed, sort_order: sortOrder })
      .select('id, material_id, mpn, sort_order, note, created_at')
      .single()

    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate')) {
        return { ok: false, reason: 'duplicate', detail: '이미 등록된 MPN입니다.' }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, row: mapMaterialAlternateMpnRecord(data) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function removeAlternateMpn(id: string): Promise<RemoveAlternateMpnResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('material_mpns').delete().eq('id', id)

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

export async function deleteMaterial(id: string): Promise<DeleteMaterialResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('materials').delete().eq('id', id)

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
