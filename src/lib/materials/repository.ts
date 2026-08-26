import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { createSupabaseClient } from '@/lib/supabase'
import { parseItemMpnFields } from '@/lib/items/utils'
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
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

export type DeleteMaterialResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

export type AddAlternateMpnResult =
  | { ok: true; row: MaterialAlternateMpn }
  | { ok: false; reason: 'env' | 'query' | 'duplicate' | 'auth'; detail: string }

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

  const gate = await assertCanWrite({ module: 'master', action: 'create' })
  if (!gate.ok) return gate

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

  const gate = await assertCanWrite({ module: 'master', action: 'update' })
  if (!gate.ok) return gate

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
  materialId: string,
  mpn: string,
  _sortOrder = 0,
): Promise<AddAlternateMpnResult> {
  const id = materialId.trim()
  const nextMpn = mpn.trim()
  if (!id || !nextMpn) {
    return { ok: false, reason: 'query', detail: '자재와 대체 MPN을 입력해 주세요.' }
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'master', action: 'update' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase.from('items').select('mpn').eq('id', id).maybeSingle()
    if (error) return { ok: false, reason: 'query', detail: error.message }
    if (!data) return { ok: false, reason: 'query', detail: '자재를 찾을 수 없습니다.' }

    const parsed = parseItemMpnFields(String(data.mpn || ''))
    const already =
      parsed.mpn.toLowerCase() === nextMpn.toLowerCase() ||
      parsed.alternateMpns.some((value) => value.toLowerCase() === nextMpn.toLowerCase())
    if (already) {
      return { ok: false, reason: 'duplicate', detail: '이미 등록된 MPN입니다.' }
    }

    const encoded = [parsed.mpn, ...parsed.alternateMpns, nextMpn].filter(Boolean).join('\n')
    const { error: updateError } = await supabase.from('items').update({ mpn: encoded }).eq('id', id)
    if (updateError) return { ok: false, reason: 'query', detail: updateError.message }

    return {
      ok: true,
      row: {
        id: `${id}:${nextMpn}`,
        materialId: id,
        mpn: nextMpn,
        sortOrder: parsed.alternateMpns.length,
        note: '',
        createdAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
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

  const gate = await assertCanWrite({ module: 'master', action: 'delete' })
  if (!gate.ok) return gate

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
