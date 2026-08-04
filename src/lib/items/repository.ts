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
import { normalizeVersionLabel, parseItemVersionCode } from './version-code'

export type FetchItemsResult =
  | { ok: true; items: Item[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveItemResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type DeleteItemResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth' | 'in_use'; detail: string }

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

function mapDuplicateError(detail: string, itemCode?: string) {
  if (
    detail.includes('items_pkey') ||
    detail.includes('items_base_code_version_uidx') ||
    detail.includes('duplicate key')
  ) {
    const code = itemCode?.trim()
    if (code) {
      return `이미 등록된 품목코드입니다: ${code}`
    }
    return '이미 등록된 품목코드·버전입니다. 품목코드나 버전을 바꿔 주세요.'
  }
  return detail
}

function isIgnorableSchemaError(message: string) {
  return (
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('Could not find')
  )
}

function mapItemDeleteFkError(detail: string) {
  if (detail.includes('order_assembly_groups')) {
    return '이 품목은 주문 조립 그룹에서 사용 중이라 삭제할 수 없습니다. 삭제 대신 「사용중지」를 이용해 주세요.'
  }
  if (detail.includes('order_assembly_group_lines')) {
    return '이 품목은 주문 BOM 구성(조립 그룹 라인)에서 사용 중이라 삭제할 수 없습니다. 「사용중지」를 이용해 주세요.'
  }
  if (detail.includes('bom_items')) {
    return '이 품목은 다른 BOM의 구성품으로 등록되어 있어 삭제할 수 없습니다. 먼저 해당 BOM에서 제거하거나 「사용중지」해 주세요.'
  }
  if (detail.includes('material_inbound') || detail.includes('material_outbound')) {
    return '이 품목은 자재 입·출고 이력이 있어 삭제할 수 없습니다. 「사용중지」를 이용해 주세요.'
  }
  if (detail.includes('foreign key') || detail.includes('violates foreign key')) {
    return '다른 자료에서 참조 중이라 삭제할 수 없습니다. 「사용중지」를 이용해 주세요.'
  }
  return detail
}

async function countRows(
  supabase: ReturnType<typeof createSupabaseClient>,
  table: string,
  column: string,
  value: string,
) {
  const { count, error } = await supabase
    .from(table)
    .select(column, { count: 'exact', head: true })
    .eq(column, value)

  if (error) {
    if (isIgnorableSchemaError(error.message)) return 0
    throw new Error(error.message)
  }
  return count || 0
}

async function countRowsIn(
  supabase: ReturnType<typeof createSupabaseClient>,
  table: string,
  column: string,
  values: string[],
) {
  if (!values.length) return 0
  const { count, error } = await supabase
    .from(table)
    .select(column, { count: 'exact', head: true })
    .in(column, values)

  if (error) {
    if (isIgnorableSchemaError(error.message)) return 0
    throw new Error(error.message)
  }
  return count || 0
}

/**
 * 실적·출하가 없는 주문 조립 그룹만 정리한 뒤 품목 삭제가 가능한지 확인.
 * 실적이 있으면 삭제하지 않고 안내 메시지를 반환.
 */
async function clearUnusedAssemblyGroupsForItem(
  supabase: ReturnType<typeof createSupabaseClient>,
  itemId: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const { data: groups, error: groupsError } = await supabase
    .from('order_assembly_groups')
    .select('id, order_id')
    .eq('parent_product_id', itemId)

  if (groupsError) {
    if (isIgnorableSchemaError(groupsError.message)) return { ok: true }
    return { ok: false, detail: groupsError.message }
  }

  const groupRows = groups || []
  if (!groupRows.length) return { ok: true }

  const groupIds = groupRows.map((row) => String(row.id))

  const usageTables = [
    'post_process_production_records',
    'delivery_records',
    'post_process_production_plans',
    'production_plan_board_items',
  ] as const

  for (const table of usageTables) {
    const used = await countRowsIn(supabase, table, 'assembly_group_id', groupIds)
    if (used > 0) {
      return {
        ok: false,
        detail: `이 품목은 주문(${groupRows.map((row) => row.order_id).join(', ')})의 조립 그룹에서 사용 중이며 생산·출하 이력이 있어 삭제할 수 없습니다. 「사용중지」를 이용해 주세요.`,
      }
    }
  }

  const { error: deleteError } = await supabase
    .from('order_assembly_groups')
    .delete()
    .in('id', groupIds)

  if (deleteError) {
    return {
      ok: false,
      detail: mapItemDeleteFkError(deleteError.message),
    }
  }

  return { ok: true }
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
    return { ok: false, reason: 'query', detail: mapDuplicateError(insertError.message, newId) }
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

      const insertPayload: ItemPayload = {
        ...payload,
        id: resolved.id,
        baseCode:
          payload.baseCode.trim() ||
          parseItemVersionCode(resolved.id).base ||
          resolved.id,
        version:
          payload.version ||
          normalizeVersionLabel(parseItemVersionCode(resolved.id).version || ''),
      }
      const { data, error } = await supabase
        .from('items')
        .insert(toItemInsertRow(insertPayload))
        .select('id')
        .single()

      if (!error) {
        return { ok: true, id: data.id }
      }

      const isDuplicate =
        error.message.includes('items_pkey') ||
        error.message.includes('items_base_code_version_uidx') ||
        error.message.includes('duplicate key')
      if (!isDuplicate || attempt === 2) {
        return {
          ok: false,
          reason: 'query',
          detail: mapDuplicateError(error.message, insertPayload.id),
        }
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

function formatDuplicateItemCodesDetail(codes: string[], prefix: string) {
  const unique = [...new Set(codes.map((code) => code.trim()).filter(Boolean))]
  if (!unique.length) return prefix
  return `${prefix}: ${unique.join(', ')} (총 ${unique.length}개)`
}

function buildCreateInsertPayload(
  payload: ItemPayload,
): { ok: true; payload: ItemPayload } | { ok: false; detail: string } {
  if (!payload.id.trim() && isManualItemCodeCategory(payload.itemCategory)) {
    return { ok: false, detail: '품목코드를 입력해 주세요.' }
  }
  if (!payload.name.trim()) {
    return { ok: false, detail: '품목명을 입력해 주세요.' }
  }
  if (!normalizeItemCategory(payload.itemCategory)) {
    return { ok: false, detail: '품목구분을 선택해 주세요.' }
  }

  const resolved = resolveCreateItemId(payload)
  if (!resolved.ok) {
    return { ok: false, detail: resolved.detail }
  }

  return {
    ok: true,
    payload: {
      ...payload,
      id: resolved.id,
      baseCode:
        payload.baseCode.trim() ||
        parseItemVersionCode(resolved.id).base ||
        resolved.id,
      version:
        payload.version ||
        normalizeVersionLabel(parseItemVersionCode(resolved.id).version || ''),
    },
  }
}

async function fetchExistingItemIds(
  supabase: ReturnType<typeof createSupabaseClient>,
  ids: string[],
): Promise<{ ok: true; existingIds: Set<string> } | { ok: false; detail: string }> {
  const existingIds = new Set<string>()
  const chunkSize = 200

  for (let offset = 0; offset < ids.length; offset += chunkSize) {
    const chunk = ids.slice(offset, offset + chunkSize)
    const { data, error } = await supabase.from('items').select('id').in('id', chunk)
    if (error) {
      return { ok: false, detail: error.message }
    }
    for (const row of data || []) {
      const id = String((row as { id?: string }).id || '').trim()
      if (id) existingIds.add(id)
    }
  }

  return { ok: true, existingIds }
}

/**
 * 일괄 등록 — 저장 전 중복을 전부 검사하고, 하나라도 있으면 저장하지 않는다.
 * (그 외 행 단위 오류는 기존처럼 중단 · savedCount 포함)
 */
export async function createItems(payloads: ItemPayload[]): Promise<CreateItemsResult> {
  if (!payloads.length) {
    return { ok: false, reason: 'validation', detail: '등록할 품목이 없습니다.', savedCount: 0 }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
      savedCount: 0,
    }
  }

  const gate = await assertCanWrite({ module: 'master', action: 'create' })
  if (!gate.ok) {
    return { ok: false, reason: gate.reason, detail: gate.detail, savedCount: 0 }
  }

  const prepared: ItemPayload[] = []
  for (let index = 0; index < payloads.length; index += 1) {
    const built = buildCreateInsertPayload(payloads[index])
    if (!built.ok) {
      return {
        ok: false,
        reason: 'validation',
        detail: `${index + 1}행: ${built.detail}`,
        savedCount: 0,
      }
    }
    prepared.push(built.payload)
  }

  const idCounts = new Map<string, number>()
  for (const row of prepared) {
    const id = row.id.trim()
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1)
  }
  const batchDuplicates = [...idCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
  if (batchDuplicates.length) {
    return {
      ok: false,
      reason: 'validation',
      detail: formatDuplicateItemCodesDetail(
        batchDuplicates,
        '붙여넣기 목록에 중복 품목코드가 있습니다',
      ),
      savedCount: 0,
    }
  }

  try {
    const supabase = createSupabaseClient()
    const existingResult = await fetchExistingItemIds(
      supabase,
      prepared.map((row) => row.id.trim()),
    )
    if (!existingResult.ok) {
      return { ok: false, reason: 'query', detail: existingResult.detail, savedCount: 0 }
    }

    const alreadyRegistered = prepared
      .map((row) => row.id.trim())
      .filter((id) => existingResult.existingIds.has(id))
    if (alreadyRegistered.length) {
      return {
        ok: false,
        reason: 'validation',
        detail: formatDuplicateItemCodesDetail(
          alreadyRegistered,
          '이미 등록된 품목코드입니다',
        ),
        savedCount: 0,
      }
    }

    const ids: string[] = []
    for (let index = 0; index < prepared.length; index += 1) {
      const result = await createItem(prepared[index])
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
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
      savedCount: 0,
    }
  }
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

    // 반제품 단가 변경 → 이 반제품을 쓰는 조립제품 단가(BOM 합산) 재동기화
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

    const childBomCount = await countRows(supabase, 'bom_items', 'child_product_id', key)
    if (childBomCount > 0) {
      return {
        ok: false,
        reason: 'in_use',
        detail:
          '이 품목은 다른 BOM의 구성품으로 등록되어 있어 삭제할 수 없습니다. 먼저 해당 BOM에서 제거하거나 「사용중지」해 주세요.',
      }
    }

    const inboundCount = await countRows(supabase, 'material_inbound_lines', 'material_id', key)
    const outboundCount = await countRows(supabase, 'material_outbound_lines', 'material_id', key)
    if (inboundCount > 0 || outboundCount > 0) {
      return {
        ok: false,
        reason: 'in_use',
        detail:
          '이 품목은 자재 입·출고 이력이 있어 삭제할 수 없습니다. 「사용중지」를 이용해 주세요.',
      }
    }

    const childLineCount = await countRows(
      supabase,
      'order_assembly_group_lines',
      'child_product_id',
      key,
    )
    if (childLineCount > 0) {
      return {
        ok: false,
        reason: 'in_use',
        detail:
          '이 품목은 주문 조립 구성에서 사용 중이라 삭제할 수 없습니다. 「사용중지」를 이용해 주세요.',
      }
    }

    const cleared = await clearUnusedAssemblyGroupsForItem(supabase, key)
    if (!cleared.ok) {
      return { ok: false, reason: 'in_use', detail: cleared.detail }
    }

    const { error } = await supabase.from('items').delete().eq('id', key)

    if (error) {
      return { ok: false, reason: 'query', detail: mapItemDeleteFkError(error.message) }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: mapItemDeleteFkError(error instanceof Error ? error.message : String(error)),
    }
  }
}
