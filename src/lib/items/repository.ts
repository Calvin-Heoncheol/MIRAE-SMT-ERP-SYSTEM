import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { createSupabaseClient } from '@/lib/supabase'
import { syncFinishedParentsUsingChild } from '@/lib/bom/repository'
import type { Item, ItemPayload, UpdateItemPayload } from './types'
import { isManualItemCodeCategory } from './types'
import {
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
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type DeleteItemResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

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
    return '이미 등록된 품목코드입니다. 품목명을 바꾸거나 품목코드를 직접 입력해 주세요.'
  }
  return detail
}

/** 품목코드(PK) 변경 시 참조 테이블도 함께 갱신 */
async function rekeyItemReferences(
  supabase: ReturnType<typeof createSupabaseClient>,
  oldId: string,
  newId: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const updates: Array<PromiseLike<{ error: { message: string } | null }>> = [
    supabase.from('bom_items').update({ parent_product_id: newId }).eq('parent_product_id', oldId),
    supabase.from('bom_items').update({ child_product_id: newId }).eq('child_product_id', oldId),
    supabase
      .from('order_assembly_groups')
      .update({ parent_product_id: newId })
      .eq('parent_product_id', oldId),
    supabase
      .from('order_assembly_group_lines')
      .update({ child_product_id: newId })
      .eq('child_product_id', oldId),
    supabase.from('order_lines').update({ product_id: newId }).eq('product_id', oldId),
    supabase.from('order_lines').update({ product_code: newId }).eq('product_code', oldId),
    supabase.from('metal_mask_assets').update({ item_id: newId }).eq('item_id', oldId),
    supabase.from('material_inbound_lines').update({ material_id: newId }).eq('material_id', oldId),
    supabase.from('material_outbound_lines').update({ material_id: newId }).eq('material_id', oldId),
    supabase
      .from('material_purchase_order_lines')
      .update({ material_id: newId })
      .eq('material_id', oldId),
  ]

  for (const pending of updates) {
    const { error } = await pending
    if (error) {
      // 테이블이 없는 환경도 있어 스키마 오류는 무시하고, 그 외는 실패 처리
      const message = error.message || ''
      if (
        message.includes('schema cache') ||
        message.includes('does not exist') ||
        message.includes('Could not find')
      ) {
        continue
      }
      return { ok: false, detail: message }
    }
  }

  return { ok: true }
}

async function replaceItemId(
  supabase: ReturnType<typeof createSupabaseClient>,
  oldId: string,
  newId: string,
  payload: UpdateItemPayload,
): Promise<SaveItemResult> {
  const { data: existing, error: fetchError } = await supabase
    .from('items')
    .select('*')
    .eq('id', oldId)
    .maybeSingle()

  if (fetchError) {
    return { ok: false, reason: 'query', detail: fetchError.message }
  }
  if (!existing) {
    return { ok: false, reason: 'validation', detail: '기존 품목을 찾을 수 없습니다.' }
  }

  const { data: conflict, error: conflictError } = await supabase
    .from('items')
    .select('id')
    .eq('id', newId)
    .maybeSingle()

  if (conflictError) {
    return { ok: false, reason: 'query', detail: conflictError.message }
  }
  if (conflict) {
    return {
      ok: false,
      reason: 'validation',
      detail: `이미 등록된 품목코드입니다: ${newId}`,
    }
  }

  const insertPayload: ItemPayload = {
    ...payload,
    id: newId,
  }

  const { error: insertError } = await supabase.from('items').insert({
    ...toItemInsertRow(insertPayload),
    is_active: existing.is_active !== false,
  })

  if (insertError) {
    return { ok: false, reason: 'query', detail: mapDuplicateError(insertError.message) }
  }

  const rekey = await rekeyItemReferences(supabase, oldId, newId)
  if (!rekey.ok) {
    await supabase.from('items').delete().eq('id', newId)
    return { ok: false, reason: 'query', detail: rekey.detail }
  }

  const { error: deleteError } = await supabase.from('items').delete().eq('id', oldId)
  if (deleteError) {
    return {
      ok: false,
      reason: 'query',
      detail: `새 코드는 반영됐지만 이전 코드 삭제에 실패했습니다: ${deleteError.message}`,
    }
  }

  return { ok: true, id: newId }
}

function resolveCreateItemId(
  payload: ItemPayload,
): { ok: true; id: string } | { ok: false; detail: string } {
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

  const explicitId = payload.id.trim()
  if (explicitId) {
    return { ok: true, id: explicitId }
  }

  // 품목코드 미입력 시 품목명을 코드로 사용 (기존 SFG-/FG- 일련번호 대체)
  const nameAsId = payload.name.trim()
  if (!nameAsId) {
    return { ok: false, detail: '품목명을 입력해 주세요.' }
  }
  return { ok: true, id: nameAsId }
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

  const gate = await assertCanWrite({ module: 'master', action: 'create' })
  if (!gate.ok) return gate

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
      const resolved = resolveCreateItemId(payload)
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
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string; savedCount: number }

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

export async function updateItem(
  id: string,
  payload: UpdateItemPayload,
  options?: { nextId?: string },
): Promise<SaveItemResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'master', action: 'update' })
  if (!gate.ok) return gate

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

  const nextId = String(options?.nextId || '').trim()

  try {
    const supabase = createSupabaseClient()

    if (nextId && nextId !== key) {
      const replaced = await replaceItemId(supabase, key, nextId, payload)
      if (!replaced.ok) return replaced

      if (normalizeItemCategory(payload.itemCategory) === 3) {
        const syncResult = await syncFinishedParentsUsingChild(replaced.id)
        if (!syncResult.ok) {
          return { ok: false, reason: 'query', detail: syncResult.detail }
        }
      }
      return replaced
    }

    const { error } = await supabase.from('items').update(toItemUpdateRow(payload)).eq('id', key)

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    // 반제품 단가 변경 → 이 반제품을 쓰는 완제품 단가(BOM 합산) 재동기화
    if (normalizeItemCategory(payload.itemCategory) === 3) {
      const syncResult = await syncFinishedParentsUsingChild(key)
      if (!syncResult.ok) {
        return { ok: false, reason: 'query', detail: syncResult.detail }
      }
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

export async function setItemActive(id: string, isActive: boolean): Promise<SaveItemResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const key = id.trim()
  if (!key) {
    return { ok: false, reason: 'validation', detail: '품목코드를 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('items').update({ is_active: isActive }).eq('id', key)

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

  const gate = await assertCanWrite({ module: 'master', action: 'delete' })
  if (!gate.ok) return gate

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
