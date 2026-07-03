import { createSupabaseClient } from '@/lib/supabase'
import type { Material, MaterialPayload } from './types'
import { mapMaterialRecord, toMaterialRow } from './utils'

export type FetchMaterialsResult =
  | { ok: true; materials: Material[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveMaterialResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type DeleteMaterialResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export function isMissingMaterialsTable(detail: string) {
  return detail.includes('materials') || detail.includes('schema cache')
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
      .select('*')
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

export async function createMaterial(payload: MaterialPayload): Promise<SaveMaterialResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase.from('materials').insert(toMaterialRow(payload)).select('id').single()

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
