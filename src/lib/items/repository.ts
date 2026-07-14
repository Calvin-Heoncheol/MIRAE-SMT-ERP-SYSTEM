import { createSupabaseClient } from '@/lib/supabase'
import type { Item, ItemPayload, UpdateItemPayload } from './types'
import { isManualItemCodeCategory, isOptionalItemCodeCategory, ITEM_CATEGORY_CODE_PREFIX } from './types'
import {
  findMaxItemCodeSequence,
  formatItemCode,
  mapItemRecord,
  normalizeItemCategory,
  toItemInsertRow,
  toItemUpdateRow,
} from './utils'

export type FetchItemsResult =
  | { ok: true; items: Item[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveItemResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export type DeleteItemResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export function isMissingItemsTable(detail: string) {
  return detail.includes('items') || detail.includes('schema cache')
}

function missingEnvResult<T extends { ok: false; reason: 'env'; detail: string }>(): T {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  } as T
}

function mapDuplicateError(detail: string) {
  if (detail.includes('items_pkey') || detail.includes('duplicate key')) {
    return '이미 등록된 품목코드입니다.'
  }
  return detail
}

async function fetchItemIdsByPrefix(
  supabase: ReturnType<typeof createSupabaseClient>,
  prefix: string,
): Promise<{ ok: true; ids: string[] } | { ok: false; detail: string }> {
  const { data, error } = await supabase.from('items').select('id').ilike('id', `${prefix}%`)

  if (error) {
    return { ok: false, detail: error.message }
  }

  return { ok: true, ids: (data || []).map((row) => row.id) }
}

async function resolveCreateItemId(
  supabase: ReturnType<typeof createSupabaseClient>,
  payload: ItemPayload,
): Promise<{ ok: true; id: string } | { ok: false; detail: string }> {
  const category = normalizeItemCategory(payload.itemCategory)
  if (!category) {
    return { ok: false, detail: '품목구분을 선택해 주세요.' }
  }

  if (isManualItemCodeCategory(category)) {
    const id = payload.id.trim()
    if (!id) {
      return { ok: false, detail: '품목코드를 입력해 주세요.' }
    }
    return { ok: true, id }
  }

  const optionalId = payload.id.trim()
  if (isOptionalItemCodeCategory(category) && optionalId) {
    return { ok: true, id: optionalId }
  }

  const prefix = ITEM_CATEGORY_CODE_PREFIX[category]
  if (!prefix) {
    return { ok: false, detail: '품목코드를 생성할 수 없습니다.' }
  }

  const idsResult = await fetchItemIdsByPrefix(supabase, prefix)
  if (!idsResult.ok) {
    return { ok: false, detail: idsResult.detail }
  }

  const nextSequence = findMaxItemCodeSequence(idsResult.ids.map((id) => ({ id })), prefix) + 1
  return { ok: true, id: formatItemCode(prefix, nextSequence) }
}

export async function fetchItems(activeOnly = true): Promise<FetchItemsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    let query = supabase.from('items').select('*').order('name', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, items: (data || []).map((row) => mapItemRecord(row)) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createItem(payload: ItemPayload): Promise<SaveItemResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  if (!payload.id.trim() && isManualItemCodeCategory(payload.itemCategory)) {
    return { ok: false, reason: 'validation', detail: '품목코드를 입력해 주세요.' }
  }
  if (!payload.name.trim()) {
    return { ok: false, reason: 'validation', detail: '품목명을 입력해 주세요.' }
  }
  if (!normalizeItemCategory(payload.itemCategory)) {
    return { ok: false, reason: 'validation', detail: '품목구분을 선택해 주세요.' }
  }

  try {
    const supabase = createSupabaseClient()

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const resolved = await resolveCreateItemId(supabase, payload)
      if (!resolved.ok) {
        return { ok: false, reason: 'validation', detail: resolved.detail }
      }

      const insertPayload: ItemPayload = { ...payload, id: resolved.id }
      const { data, error } = await supabase
        .from('items')
        .insert(toItemInsertRow(insertPayload))
        .select('id')
        .single()

      if (!error) {
        return { ok: true, id: data.id }
      }

      const isDuplicate =
        error.message.includes('items_pkey') || error.message.includes('duplicate key')
      if (!isDuplicate || attempt === 2) {
        return { ok: false, reason: 'query', detail: mapDuplicateError(error.message) }
      }
    }

    return { ok: false, reason: 'query', detail: '품목코드 생성에 실패했습니다. 다시 시도해 주세요.' }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export type CreateItemsResult =
  | { ok: true; ids: string[] }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string; savedCount: number }

/** 일괄 등록 — 행 단위로 순차 저장 (중간 실패 시 이미 저장된 건수 포함) */
export async function createItems(payloads: ItemPayload[]): Promise<CreateItemsResult> {
  if (!payloads.length) {
    return { ok: false, reason: 'validation', detail: '등록할 품목이 없습니다.', savedCount: 0 }
  }

  const ids: string[] = []
  for (let index = 0; index < payloads.length; index += 1) {
    const result = await createItem(payloads[index])
    if (!result.ok) {
      return {
        ok: false,
        reason: result.reason,
        detail: `${index + 1}행: ${result.detail}`,
        savedCount: ids.length,
      }
    }
    ids.push(result.id)
  }

  return { ok: true, ids }
}

export async function updateItem(id: string, payload: UpdateItemPayload): Promise<SaveItemResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const key = id.trim()
  if (!key) {
    return { ok: false, reason: 'validation', detail: '품목코드를 찾을 수 없습니다.' }
  }
  if (!payload.name.trim()) {
    return { ok: false, reason: 'validation', detail: '품목명을 입력해 주세요.' }
  }
  if (!normalizeItemCategory(payload.itemCategory)) {
    return { ok: false, reason: 'validation', detail: '품목구분을 선택해 주세요.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('items').update(toItemUpdateRow(payload)).eq('id', key)

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, id: key }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteItem(id: string): Promise<DeleteItemResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const key = id.trim()
  if (!key) {
    return { ok: false, reason: 'validation', detail: '품목코드를 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('items').delete().eq('id', key)

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
