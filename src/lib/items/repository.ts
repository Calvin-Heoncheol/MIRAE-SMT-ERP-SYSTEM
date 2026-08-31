import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { createSupabaseClient } from '@/lib/supabase'
import { insertChangeLog, formatChangeLogWarning } from '@/lib/change-logs/repository'
import {
  buildItemChangeDataPayload,
  buildItemChangeDetail,
  buildItemChangeTitle,
} from '@/lib/change-logs/utils'
import { syncFinishedParentsUsingChild } from '@/lib/bom/repository'
import type { Item, ItemCategory, ItemPayload, UpdateItemPayload } from './types'
import {
  ITEM_CATEGORY_CODE_PREFIX,
  isRawMaterialItemCategory,
  isFinishedItemCategory,
  isSemiFinishedItemCategory,
} from './types'
import {
  findMaxItemCodeSequence,
  formatItemCode,
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
  | { ok: true; id: string; changeLogWarning?: string }
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
  if (detail.includes('items_product_customer_code_version_uidx')) {
    return '같은 고객사·품목코드·버전이 이미 있습니다.'
  }
  if (
    detail.includes('items_pkey') ||
    detail.includes('items_base_code_version_uidx') ||
    detail.includes('items_base_code_name_version_uidx') ||
    detail.includes('items_raw_material_base_code_uidx') ||
    detail.includes('duplicate key')
  ) {
    const code = itemCode?.trim()
    if (detail.includes('items_raw_material_base_code_uidx')) {
      return code
        ? `이미 등록된 원자재 품목코드입니다: ${code}`
        : '이미 등록된 원자재 품목코드입니다.'
    }
    if (detail.includes('items_base_code_version_uidx')) {
      return '같은 품목코드·버전은 품목명이 달라도 지금은 등록이 막혀 있습니다. Supabase에서 migrate-items-unique-code-name-version.sql 을 실행해 주세요.'
    }
    if (detail.includes('items_base_code_name_version_uidx')) {
      return code
        ? `이미 등록된 품목입니다 (품목코드·품명·버전 동일): ${code}`
        : '이미 등록된 품목입니다. 품목코드·품명·버전이 모두 같은 행이 있습니다.'
    }
    if (code) {
      return `이미 등록된 품목입니다: ${code}`
    }
    return '이미 등록된 품목코드·품명·버전입니다. 품명을 바꾸면 같은 코드·버전으로도 등록할 수 있습니다.'
  }
  return detail
}

/** 원자재 base_code 유일 검사 (자기 자신 excludeId 제외) */
async function assertRawMaterialBaseCodeAvailable(
  supabase: ReturnType<typeof createSupabaseClient>,
  baseCode: string,
  excludeId?: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const code = baseCode.trim()
  if (!code) {
    return { ok: false, detail: '품목코드를 입력해 주세요.' }
  }

  let query = supabase
    .from('items')
    .select('id')
    .eq('item_category', 1)
    .eq('base_code', code.toUpperCase())
    .limit(1)

  const exclude = excludeId?.trim()
  if (exclude) {
    query = query.neq('id', exclude)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    return { ok: false, detail: error.message }
  }
  if (data?.id) {
    return { ok: false, detail: `이미 등록된 원자재 품목코드입니다: ${code}` }
  }
  return { ok: true }
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
    return '이 품목은 발주서 조립 그룹에서 사용 중이라 삭제할 수 없습니다. 삭제 대신 「사용중지」를 이용해 주세요.'
  }
  if (detail.includes('order_assembly_group_lines')) {
    return '이 품목은 발주서 BOM 구성(조립 그룹 라인)에서 사용 중이라 삭제할 수 없습니다. 「사용중지」를 이용해 주세요.'
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
        detail: `이 품목은 발주서(${groupRows.map((row) => row.order_id).join(', ')})의 조립 그룹에서 사용 중이며 생산·출하 이력이 있어 삭제할 수 없습니다. 「사용중지」를 이용해 주세요.`,
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

async function fetchNextBaseCodeForCategory(
  supabase: ReturnType<typeof createSupabaseClient>,
  category: ItemCategory,
  reserved: string[] = [],
): Promise<{ ok: true; baseCode: string } | { ok: false; detail: string }> {
  const prefix = ITEM_CATEGORY_CODE_PREFIX[category]
  if (!prefix) {
    return { ok: false, detail: '품목구분에 맞는 코드 접두사가 없습니다.' }
  }

  const { data, error } = await supabase
    .from('items')
    .select('id, base_code')
    .ilike('base_code', `${prefix}%`)

  if (error) {
    return { ok: false, detail: error.message }
  }

  const existing = (data || []).map((row) => ({
    id: String(row.id || ''),
    baseCode: String(row.base_code || '').trim(),
  }))
  for (const code of reserved) {
    existing.push({ id: '', baseCode: code })
  }

  return {
    ok: true,
    baseCode: formatItemCode(prefix, findMaxItemCodeSequence(existing, prefix) + 1),
  }
}

function resolveCreateItemBaseCode(
  payload: ItemPayload,
): { ok: true; baseCode: string; version: string; needsAutoCode: boolean } | { ok: false; detail: string } {
  const category = normalizeItemCategory(payload.itemCategory)
  if (!category) {
    return { ok: false, detail: '품목구분을 선택해 주세요.' }
  }

  const typedCode = payload.baseCode.trim() || payload.id.trim()
  const version = isRawMaterialItemCategory(category)
    ? ''
    : normalizeVersionLabel(payload.version)

  if (typedCode) {
    return { ok: true, baseCode: typedCode, version, needsAutoCode: false }
  }

  return { ok: true, baseCode: '', version, needsAutoCode: true }
}

const ITEMS_PAGE_SIZE = 1000

async function attachItemCustomerNames(
  supabase: ReturnType<typeof createSupabaseClient>,
  items: Item[],
): Promise<Item[]> {
  const ids = [...new Set(items.map((item) => item.customerId).filter(Boolean))]
  if (!ids.length) return items

  const names = new Map<string, string>()
  const chunkSize = 100
  for (let offset = 0; offset < ids.length; offset += chunkSize) {
    const chunk = ids.slice(offset, offset + chunkSize)
    const { data, error } = await supabase
      .from('business_partners')
      .select('id, name')
      .in('id', chunk)
    if (error) break
    for (const row of data || []) {
      const id = String(row.id || '').trim()
      if (id) names.set(id, String(row.name || '').trim())
    }
  }

  return items.map((item) => ({
    ...item,
    customerName: names.get(item.customerId) || item.customerName,
  }))
}

export async function fetchItems(activeOnly = true): Promise<FetchItemsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const items: Item[] = []
    let from = 0

    for (;;) {
      const to = from + ITEMS_PAGE_SIZE - 1
      let query = supabase
        .from('items')
        .select('*')
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)

      if (activeOnly) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query
      if (error) {
        return { ok: false, reason: 'query', detail: error.message }
      }

      const rows = data || []
      for (const row of rows) {
        items.push(mapItemRecord(row))
      }

      if (rows.length < ITEMS_PAGE_SIZE) break
      from += ITEMS_PAGE_SIZE
    }

    return { ok: true, items: await attachItemCustomerNames(supabase, items) }
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

  if (!payload.name.trim()) {
    return { ok: false, reason: 'validation', detail: '품목명을 입력해 주세요.' }
  }
  if (!normalizeItemCategory(payload.itemCategory)) {
    return { ok: false, reason: 'validation', detail: '품목구분을 선택해 주세요.' }
  }

  try {
    const supabase = createSupabaseClient()
    const resolved = resolveCreateItemBaseCode(payload)
    if (!resolved.ok) {
      return { ok: false, reason: 'validation', detail: resolved.detail }
    }

    let baseCode = resolved.baseCode
    if (resolved.needsAutoCode) {
      const category = normalizeItemCategory(payload.itemCategory)
      if (!category) {
        return { ok: false, reason: 'validation', detail: '품목구분을 선택해 주세요.' }
      }
      const allocated = await fetchNextBaseCodeForCategory(supabase, category)
      if (!allocated.ok) {
        return { ok: false, reason: 'query', detail: allocated.detail }
      }
      baseCode = allocated.baseCode
    }

    const isRaw = isRawMaterialItemCategory(payload.itemCategory)

    if (isRaw) {
      const rawCheck = await assertRawMaterialBaseCodeAvailable(supabase, baseCode)
      if (!rawCheck.ok) {
        return { ok: false, reason: 'validation', detail: rawCheck.detail }
      }
    }

    const insertPayload: ItemPayload = {
      ...payload,
      id: '',
      baseCode,
      version: resolved.version,
    }
    const insertRow = toItemInsertRow(insertPayload)
    let { data, error } = await supabase.from('items').insert(insertRow).select('id').single()

    if (error && /setup_unit_price/i.test(error.message)) {
      const { setup_unit_price: _omitSetup, ...withoutSetup } = insertRow as Record<string, unknown>
      const retry = await supabase.from('items').insert(withoutSetup).select('id').single()
      data = retry.data
      error = retry.error
    }

    if (error && /baseline_quote_id/i.test(error.message)) {
      const { baseline_quote_id: _omitBaseline, ...withoutBaseline } = insertRow as Record<
        string,
        unknown
      >
      const retry = await supabase.from('items').insert(withoutBaseline).select('id').single()
      data = retry.data
      error = retry.error
    }

    if (error && /smt_quote_parts/i.test(error.message)) {
      const { smt_quote_parts: _omit, ...withoutParts } = insertRow as Record<string, unknown>
      const retry = await supabase.from('items').insert(withoutParts).select('id').single()
      data = retry.data
      error = retry.error
    }

    if (!error && data?.id) {
      return { ok: true, id: data.id }
    }

    return {
      ok: false,
      reason: 'query',
      detail: mapDuplicateError(error?.message || '품목 저장에 실패했습니다.', insertPayload.baseCode),
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export type CreateItemsResult =
  | { ok: true; ids: string[]; skippedCount?: number }
  | {
      ok: false
      reason: 'env' | 'query' | 'validation' | 'auth'
      detail: string
      savedCount: number
      /** DB에 이미 있거나, 붙여넣기 목록 안에서 중복인 품목코드 */
      duplicateCodes?: string[]
      /** true면 「이미 등록된 것 제외하고 등록」 가능 */
      canSkipExisting?: boolean
    }

function formatDuplicateItemCodesDetail(codes: string[], prefix: string) {
  const unique = [...new Set(codes.map((code) => code.trim()).filter(Boolean))]
  if (!unique.length) return prefix
  return `${prefix}: ${unique.join(', ')} (총 ${unique.length}개)`
}

function buildCreateInsertPayload(
  payload: ItemPayload,
): { ok: true; payload: ItemPayload } | { ok: false; detail: string } {
  if (!payload.name.trim()) {
    return { ok: false, detail: '품목명을 입력해 주세요.' }
  }
  if (!normalizeItemCategory(payload.itemCategory)) {
    return { ok: false, detail: '품목구분을 선택해 주세요.' }
  }

  const resolved = resolveCreateItemBaseCode(payload)
  if (!resolved.ok) {
    return { ok: false, detail: resolved.detail }
  }

  return {
    ok: true,
    payload: {
      ...payload,
      id: '',
      baseCode: resolved.baseCode,
      version: resolved.version,
    },
  }
}

function itemIdentityKey(row: Pick<ItemPayload, 'baseCode' | 'name' | 'version'>) {
  return [
    row.baseCode.trim().toLowerCase(),
    row.name.trim().toLowerCase(),
    row.version.trim().toLowerCase(),
  ].join('\0')
}

/** 일괄 중복 키 — 원자재는 품목코드만, 그 외는 코드+품명+버전 */
function itemBatchDedupKey(row: ItemPayload) {
  if (isRawMaterialItemCategory(row.itemCategory)) {
    return `raw\0${row.baseCode.trim().toLowerCase()}`
  }
  return `row\0${itemIdentityKey(row)}`
}

function formatBatchDedupLabel(row: ItemPayload) {
  if (isRawMaterialItemCategory(row.itemCategory)) {
    return row.baseCode.trim()
  }
  const version = row.version.trim()
  return version ? `${row.baseCode}-${version}(${row.name})` : `${row.baseCode}(${row.name})`
}

async function fetchExistingItemIdentities(
  supabase: ReturnType<typeof createSupabaseClient>,
  baseCodes: string[],
): Promise<
  | {
      ok: true
      identities: Set<string>
      ids: Set<string>
      rawBaseCodes: Set<string>
    }
  | { ok: false; detail: string }
> {
  const identities = new Set<string>()
  const ids = new Set<string>()
  const rawBaseCodes = new Set<string>()
  const uniqueCodes = [
    ...new Set(baseCodes.map((code) => code.trim().toUpperCase()).filter(Boolean)),
  ]
  const chunkSize = 100

  for (let offset = 0; offset < uniqueCodes.length; offset += chunkSize) {
    const chunk = uniqueCodes.slice(offset, offset + chunkSize)
    const { data, error } = await supabase
      .from('items')
      .select('id, base_code, name, version, item_category')
      .in('base_code', chunk)
    if (error) {
      return { ok: false, detail: error.message }
    }
    for (const row of data || []) {
      const id = String(row.id || '').trim()
      if (id) ids.add(id)
      const baseCode = String(row.base_code || '').trim()
      const category = normalizeItemCategory(row.item_category)
      if (category === 1 && baseCode) {
        rawBaseCodes.add(baseCode.toLowerCase())
      }
      identities.add(
        itemIdentityKey({
          baseCode,
          name: String(row.name || '').trim(),
          version: normalizeVersionLabel(String(row.version || '')),
        }),
      )
    }
  }

  return { ok: true, identities, ids, rawBaseCodes }
}

function isBatchRowAlreadyRegistered(
  row: ItemPayload,
  existing: {
    identities: Set<string>
    rawBaseCodes: Set<string>
  },
) {
  if (isRawMaterialItemCategory(row.itemCategory)) {
    return existing.rawBaseCodes.has(row.baseCode.trim().toLowerCase())
  }
  return existing.identities.has(itemIdentityKey(row))
}

/**
 * 일괄 등록 — 원자재는 품목코드만 유일, 반·조립·부자재는 코드+품명+버전 조합.
 */
export async function createItems(
  payloads: ItemPayload[],
  options?: { skipExisting?: boolean },
): Promise<CreateItemsResult> {
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
  const autoReservedByCategory: Partial<Record<ItemCategory, string[]>> = {}
  const supabase = createSupabaseClient()

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

    let row = built.payload
    if (!row.baseCode.trim()) {
      const category = normalizeItemCategory(row.itemCategory)
      if (!category) {
        return {
          ok: false,
          reason: 'validation',
          detail: `${index + 1}행: 품목구분을 선택해 주세요.`,
          savedCount: 0,
        }
      }
      const reserved = autoReservedByCategory[category] || []
      const allocated = await fetchNextBaseCodeForCategory(supabase, category, reserved)
      if (!allocated.ok) {
        return {
          ok: false,
          reason: 'query',
          detail: `${index + 1}행: ${allocated.detail}`,
          savedCount: 0,
        }
      }
      reserved.push(allocated.baseCode)
      autoReservedByCategory[category] = reserved
      row = { ...row, baseCode: allocated.baseCode }
    }

    prepared.push(row)
  }

  const dedupCounts = new Map<string, { count: number; label: string }>()
  for (const row of prepared) {
    const key = itemBatchDedupKey(row)
    const prev = dedupCounts.get(key)
    if (prev) {
      prev.count += 1
    } else {
      dedupCounts.set(key, { count: 1, label: formatBatchDedupLabel(row) })
    }
  }
  const batchDuplicates = [...dedupCounts.values()]
    .filter((entry) => entry.count > 1)
    .map((entry) => entry.label)
  if (batchDuplicates.length) {
    const hasRawDup = prepared.some(
      (row) =>
        isRawMaterialItemCategory(row.itemCategory) &&
        (dedupCounts.get(itemBatchDedupKey(row))?.count ?? 0) > 1,
    )
    return {
      ok: false,
      reason: 'validation',
      detail: formatDuplicateItemCodesDetail(
        batchDuplicates,
        hasRawDup
          ? '붙여넣기 목록에 중복 원자재 품목코드가 있습니다'
          : '붙여넣기 목록에 중복 품목(코드·품명·버전)이 있습니다',
      ),
      savedCount: 0,
      duplicateCodes: batchDuplicates,
    }
  }

  try {
    const existingResult = await fetchExistingItemIdentities(
      supabase,
      prepared.map((row) => row.baseCode),
    )
    if (!existingResult.ok) {
      return { ok: false, reason: 'query', detail: existingResult.detail, savedCount: 0 }
    }

    const alreadyRegistered = prepared
      .filter((row) => isBatchRowAlreadyRegistered(row, existingResult))
      .map((row) => formatBatchDedupLabel(row))

    let toInsert = prepared
    if (alreadyRegistered.length) {
      if (!options?.skipExisting) {
        return {
          ok: false,
          reason: 'validation',
          detail: formatDuplicateItemCodesDetail(alreadyRegistered, '이미 등록된 품목입니다'),
          savedCount: 0,
          duplicateCodes: alreadyRegistered,
          canSkipExisting: true,
        }
      }

      toInsert = prepared.filter((row) => !isBatchRowAlreadyRegistered(row, existingResult))
      if (!toInsert.length) {
        return {
          ok: false,
          reason: 'validation',
          detail: formatDuplicateItemCodesDetail(
            alreadyRegistered,
            '이미 등록된 품목만 있어 등록할 항목이 없습니다',
          ),
          savedCount: 0,
          duplicateCodes: alreadyRegistered,
        }
      }
    }

    const ids: string[] = []
    for (let index = 0; index < toInsert.length; index += 1) {
      const result = await createItem(toInsert[index])
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

    return {
      ok: true,
      ids,
      skippedCount: options?.skipExisting ? alreadyRegistered.length || undefined : undefined,
    }
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
  options?: { nextId?: string; reason?: string },
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

  try {
    const supabase = createSupabaseClient()
    const { data: beforeRow } = await supabase.from('items').select('*').eq('id', key).maybeSingle()
    const beforeItem = beforeRow ? mapItemRecord(beforeRow) : null

    if (isRawMaterialItemCategory(payload.itemCategory)) {
      const rawBaseCode =
        payload.baseCode.trim() || parseItemVersionCode(key).base || key
      const rawCheck = await assertRawMaterialBaseCodeAvailable(supabase, rawBaseCode, key)
      if (!rawCheck.ok) {
        return { ok: false, reason: 'validation', detail: rawCheck.detail }
      }
    }

    const updatePayload =
      beforeItem && isFinishedItemCategory(payload.itemCategory)
        ? { ...payload, unitPrice: beforeItem.unitPrice }
        : payload

    const { error } = await supabase.from('items').update(toItemUpdateRow(updatePayload)).eq('id', key)

    if (error) {
      if (/setup_unit_price/i.test(error.message)) {
        const row = toItemUpdateRow(updatePayload) as Record<string, unknown>
        const { setup_unit_price: _omitSetup, ...withoutSetup } = row
        const retrySetup = await supabase.from('items').update(withoutSetup).eq('id', key)
        if (retrySetup.error && /baseline_quote_id/i.test(retrySetup.error.message)) {
          const { baseline_quote_id: _omitBaseline, ...withoutBaseline } = withoutSetup
          const retryBaseline = await supabase.from('items').update(withoutBaseline).eq('id', key)
          if (retryBaseline.error && /smt_quote_parts/i.test(retryBaseline.error.message)) {
            const { smt_quote_parts: _omit, ...withoutParts } = withoutBaseline
            const retry = await supabase.from('items').update(withoutParts).eq('id', key)
            if (retry.error) {
              return { ok: false, reason: 'query', detail: retry.error.message }
            }
          } else if (retryBaseline.error) {
            return { ok: false, reason: 'query', detail: retryBaseline.error.message }
          }
        } else if (retrySetup.error && /smt_quote_parts/i.test(retrySetup.error.message)) {
          const { smt_quote_parts: _omit, ...withoutParts } = withoutSetup
          const retry = await supabase.from('items').update(withoutParts).eq('id', key)
          if (retry.error) {
            return { ok: false, reason: 'query', detail: retry.error.message }
          }
        } else if (retrySetup.error) {
          return { ok: false, reason: 'query', detail: retrySetup.error.message }
        }
      } else if (/baseline_quote_id/i.test(error.message)) {
        const row = toItemUpdateRow(updatePayload) as Record<string, unknown>
        const { baseline_quote_id: _omitBaseline, ...withoutBaseline } = row
        const retryBaseline = await supabase.from('items').update(withoutBaseline).eq('id', key)
        if (retryBaseline.error && /smt_quote_parts/i.test(retryBaseline.error.message)) {
          const { smt_quote_parts: _omit, ...withoutParts } = withoutBaseline
          const retry = await supabase.from('items').update(withoutParts).eq('id', key)
          if (retry.error) {
            return { ok: false, reason: 'query', detail: retry.error.message }
          }
        } else if (retryBaseline.error) {
          return { ok: false, reason: 'query', detail: retryBaseline.error.message }
        }
      } else if (/smt_quote_parts/i.test(error.message)) {
        const row = toItemUpdateRow(updatePayload) as Record<string, unknown>
        const { smt_quote_parts: _omit, ...withoutParts } = row
        const retry = await supabase.from('items').update(withoutParts).eq('id', key)
        if (retry.error) {
          return { ok: false, reason: 'query', detail: retry.error.message }
        }
      } else {
        return { ok: false, reason: 'query', detail: error.message }
      }
    }

    let changeLogWarning: string | undefined
    if (beforeItem) {
      // 변경이력 — 단가는 품목에서 관리 (원자재·부자재는 0 유지)
      const snapshot = {
        before: {
          name: beforeItem.name,
          unitPrice: beforeItem.unitPrice,
          setupUnitPrice: beforeItem.setupUnitPrice,
          smdUnitPrice: beforeItem.smdUnitPrice,
          dipUnitPrice: beforeItem.dipUnitPrice,
          materialUnitPrice: beforeItem.materialUnitPrice,
          otherUnitPrice: beforeItem.setupUnitPrice,
        },
        after: {
          name: updatePayload.name,
          unitPrice: updatePayload.unitPrice,
          setupUnitPrice: updatePayload.setupUnitPrice,
          smdUnitPrice: updatePayload.smdUnitPrice,
          dipUnitPrice: updatePayload.dipUnitPrice,
          materialUnitPrice: updatePayload.materialUnitPrice,
          otherUnitPrice: updatePayload.setupUnitPrice,
        },
      }
      const { beforeData, afterData } = buildItemChangeDataPayload(snapshot)
      const changeLogResult = await insertChangeLog({
        entityType: 'item',
        entityId: key,
        title: buildItemChangeTitle(payload.itemCategory, key),
        detail: buildItemChangeDetail(snapshot),
        reason: options?.reason,
        beforeData,
        afterData,
      })
      changeLogWarning = formatChangeLogWarning(changeLogResult)
    }

    if (
      isSemiFinishedItemCategory(payload.itemCategory) &&
      (!beforeItem || beforeItem.unitPrice !== updatePayload.unitPrice)
    ) {
      const cascade = await syncFinishedParentsUsingChild(key)
      if (!cascade.ok) {
        return {
          ok: false,
          reason: 'query',
          detail: `품목은 저장됐지만 조립제품 단가 반영에 실패했습니다. ${cascade.detail}`,
        }
      }
    }

    return { ok: true, id: key, changeLogWarning }
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
          '이 품목은 발주서 조립 구성에서 사용 중이라 삭제할 수 없습니다. 「사용중지」를 이용해 주세요.',
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
