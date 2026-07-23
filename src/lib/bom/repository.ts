import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { createSupabaseClient } from '@/lib/supabase'
import type { ItemCategory } from '@/lib/items/types'
import { normalizeItemCategory } from '@/lib/items/utils'
import type { BomLine, BomLinePayload } from './types'
import { isValidBomPair, sumBomComponentUnitPrices } from './utils'

export type FetchBomResult =
  | { ok: true; lines: BomLine[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveBomResult =
  | { ok: true; parentProductId: string; lineCount: number }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type DeleteBomResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export function isMissingBomTable(detail: string) {
  return (
    detail.includes('bom_items') ||
    detail.includes('bom_detail') ||
    detail.includes('schema cache')
  )
}

function missingEnvResult<T extends { ok: false; reason: 'env'; detail: string }>(): T {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  } as T
}

function mapBomDetailRow(row: {
  parent_product_id: string
  parent_product_name?: string | null
  parent_item_category?: number | string | null
  child_product_id: string
  child_product_name?: string | null
  child_item_category?: number | string | null
  child_mpn?: string | null
  quantity_per?: number | string | null
  note?: string | null
}): BomLine | null {
  const parentItemCategory = normalizeItemCategory(row.parent_item_category)
  const childItemCategory = normalizeItemCategory(row.child_item_category)
  if (!parentItemCategory || !childItemCategory) return null

  return {
    parentProductId: String(row.parent_product_id || '').trim(),
    childProductId: String(row.child_product_id || '').trim(),
    quantityPer: Math.max(0, Number(row.quantity_per) || 0) || 1,
    note: String(row.note || '').trim(),
    parentProductName: String(row.parent_product_name || '').trim(),
    parentItemCategory,
    childProductName: String(row.child_product_name || '').trim(),
    childItemCategory,
    childMpn: String(row.child_mpn || '').trim(),
  }
}

async function fetchBomFromItemsTable(): Promise<FetchBomResult> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('bom_items')
    .select('parent_product_id, child_product_id, quantity_per, note')
    .order('parent_product_id', { ascending: true })

  if (error) {
    return { ok: false, reason: 'query', detail: error.message }
  }

  const rows = data || []
  const ids = [
    ...new Set(
      rows.flatMap((row) => [
        String(row.parent_product_id || '').trim(),
        String(row.child_product_id || '').trim(),
      ]),
    ),
  ].filter(Boolean)

  const itemById: Record<
    string,
    { name: string; itemCategory: ItemCategory; mpn: string }
  > = {}

  if (ids.length) {
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, name, item_category, mpn')
      .in('id', ids)

    if (itemsError) {
      return { ok: false, reason: 'query', detail: itemsError.message }
    }

    for (const item of items || []) {
      const category = normalizeItemCategory(item.item_category)
      if (!category) continue
      itemById[String(item.id)] = {
        name: String(item.name || '').trim(),
        itemCategory: category,
        mpn: String(item.mpn || '').trim(),
      }
    }
  }

  const lines: BomLine[] = []
  for (const row of rows) {
    const parentId = String(row.parent_product_id || '').trim()
    const childId = String(row.child_product_id || '').trim()
    const parent = itemById[parentId]
    const child = itemById[childId]
    if (!parent || !child) continue

    lines.push({
      parentProductId: parentId,
      childProductId: childId,
      quantityPer: Math.max(0, Number(row.quantity_per) || 0) || 1,
      note: String(row.note || '').trim(),
      parentProductName: parent.name,
      parentItemCategory: parent.itemCategory,
      childProductName: child.name,
      childItemCategory: child.itemCategory,
      childMpn: child.mpn,
    })
  }

  return { ok: true, lines }
}

export async function fetchBomLines(): Promise<FetchBomResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('bom_detail')
      .select(
        'parent_product_id, parent_product_name, parent_item_category, child_product_id, child_product_name, child_item_category, child_mpn, quantity_per, note',
      )

    if (!error) {
      return {
        ok: true,
        lines: (data || [])
          .map((row) => mapBomDetailRow(row))
          .filter((line): line is BomLine => Boolean(line?.parentProductId && line.childProductId)),
      }
    }

    if (!isMissingBomTable(error.message)) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return fetchBomFromItemsTable()
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

async function loadItemCategories(
  supabase: ReturnType<typeof createSupabaseClient>,
  ids: string[],
): Promise<
  | { ok: true; byId: Record<string, ItemCategory> }
  | { ok: false; detail: string }
> {
  if (!ids.length) return { ok: true, byId: {} }

  const { data, error } = await supabase.from('items').select('id, item_category').in('id', ids)
  if (error) return { ok: false, detail: error.message }

  const byId: Record<string, ItemCategory> = {}
  for (const row of data || []) {
    const category = normalizeItemCategory(row.item_category)
    if (category) byId[String(row.id)] = category
  }
  return { ok: true, byId }
}

export type CalcBomUnitPriceResult =
  | { ok: true; unitPrice: number; lineCount: number }
  | { ok: false; reason: 'env' | 'query'; detail: string }

/** 부모 품목 BOM 구성의 (단가 × 소요량) 합산 */
export async function calcParentUnitPriceFromBom(
  parentProductId: string,
): Promise<CalcBomUnitPriceResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const parentId = parentProductId.trim()
  if (!parentId) {
    return { ok: true, unitPrice: 0, lineCount: 0 }
  }

  try {
    const supabase = createSupabaseClient()
    const { data: bomRows, error: bomError } = await supabase
      .from('bom_items')
      .select('child_product_id, quantity_per')
      .eq('parent_product_id', parentId)

    if (bomError) {
      return { ok: false, reason: 'query', detail: bomError.message }
    }

    const lines = (bomRows || [])
      .map((row) => ({
        childProductId: String(row.child_product_id || '').trim(),
        quantityPer: Math.max(0, Number(row.quantity_per) || 0) || 1,
      }))
      .filter((row) => row.childProductId)

    if (!lines.length) {
      return { ok: true, unitPrice: 0, lineCount: 0 }
    }

    const childIds = [...new Set(lines.map((line) => line.childProductId))]
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, unit_price')
      .in('id', childIds)

    if (itemsError) {
      return { ok: false, reason: 'query', detail: itemsError.message }
    }

    const priceById: Record<string, number> = {}
    for (const item of items || []) {
      priceById[String(item.id)] = Math.max(0, Number(item.unit_price) || 0)
    }

    const unitPrice = sumBomComponentUnitPrices(
      lines.map((line) => ({
        quantityPer: line.quantityPer,
        childUnitPrice: priceById[line.childProductId] ?? 0,
      })),
    )

    return { ok: true, unitPrice, lineCount: lines.length }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/** 완제품 단가를 BOM 합산값으로 items.unit_price 에 반영 */
export async function syncFinishedParentUnitPriceFromBom(
  parentProductId: string,
): Promise<CalcBomUnitPriceResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const parentId = parentProductId.trim()
  if (!parentId) {
    return { ok: false, reason: 'query', detail: '부모 품목을 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const categoriesResult = await loadItemCategories(supabase, [parentId])
    if (!categoriesResult.ok) {
      return { ok: false, reason: 'query', detail: categoriesResult.detail }
    }

    if (categoriesResult.byId[parentId] !== 4) {
      return { ok: true, unitPrice: 0, lineCount: 0 }
    }

    const calc = await calcParentUnitPriceFromBom(parentId)
    if (!calc.ok) return calc

    const { error } = await supabase
      .from('items')
      .update({ unit_price: calc.unitPrice })
      .eq('id', parentId)

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return calc
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/** 반제품 단가 변경 시, 해당 반제품을 쓰는 완제품들의 단가 재계산 */
export async function syncFinishedParentsUsingChild(
  childProductId: string,
): Promise<{ ok: true } | { ok: false; reason: 'env' | 'query'; detail: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const childId = childProductId.trim()
  if (!childId) return { ok: true }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('bom_items')
      .select('parent_product_id')
      .eq('child_product_id', childId)

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const parentIds = [
      ...new Set(
        (data || [])
          .map((row) => String(row.parent_product_id || '').trim())
          .filter(Boolean),
      ),
    ]

    for (const parentId of parentIds) {
      const synced = await syncFinishedParentUnitPriceFromBom(parentId)
      if (!synced.ok) return synced
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

export type SyncAllFinishedUnitPricesResult =
  | { ok: true; updated: number; pricesById: Record<string, number> }
  | { ok: false; reason: 'env' | 'query'; detail: string }

/** 모든 완제품 단가를 BOM 합산으로 일괄 동기화 */
export async function syncAllFinishedUnitPricesFromBom(): Promise<SyncAllFinishedUnitPricesResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data: finishedRows, error: finishedError } = await supabase
      .from('items')
      .select('id, unit_price')
      .eq('item_category', 4)

    if (finishedError) {
      return { ok: false, reason: 'query', detail: finishedError.message }
    }

    const finished = (finishedRows || []).map((row) => ({
      id: String(row.id || '').trim(),
      unitPrice: Math.max(0, Number(row.unit_price) || 0),
    })).filter((row) => row.id)

    if (!finished.length) {
      return { ok: true, updated: 0, pricesById: {} }
    }

    const finishedIds = finished.map((row) => row.id)
    const { data: bomRows, error: bomError } = await supabase
      .from('bom_items')
      .select('parent_product_id, child_product_id, quantity_per')
      .in('parent_product_id', finishedIds)

    if (bomError) {
      return { ok: false, reason: 'query', detail: bomError.message }
    }

    const bomByParent = new Map<string, Array<{ childProductId: string; quantityPer: number }>>()
    const childIds = new Set<string>()

    for (const row of bomRows || []) {
      const parentId = String(row.parent_product_id || '').trim()
      const childId = String(row.child_product_id || '').trim()
      if (!parentId || !childId) continue
      childIds.add(childId)
      const list = bomByParent.get(parentId) || []
      list.push({
        childProductId: childId,
        quantityPer: Math.max(0, Number(row.quantity_per) || 0) || 1,
      })
      bomByParent.set(parentId, list)
    }

    const priceByChildId: Record<string, number> = {}
    if (childIds.size) {
      const { data: childItems, error: childError } = await supabase
        .from('items')
        .select('id, unit_price')
        .in('id', [...childIds])

      if (childError) {
        return { ok: false, reason: 'query', detail: childError.message }
      }

      for (const item of childItems || []) {
        priceByChildId[String(item.id)] = Math.max(0, Number(item.unit_price) || 0)
      }
    }

    const pricesById: Record<string, number> = {}
    let updated = 0

    for (const item of finished) {
      const lines = bomByParent.get(item.id) || []
      const unitPrice = sumBomComponentUnitPrices(
        lines.map((line) => ({
          quantityPer: line.quantityPer,
          childUnitPrice: priceByChildId[line.childProductId] ?? 0,
        })),
      )
      pricesById[item.id] = unitPrice

      if (Math.round(item.unitPrice) === unitPrice) continue

      const { error: updateError } = await supabase
        .from('items')
        .update({ unit_price: unitPrice })
        .eq('id', item.id)

      if (updateError) {
        return { ok: false, reason: 'query', detail: updateError.message }
      }
      updated += 1
    }

    return { ok: true, updated, pricesById }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function saveBomForParent(
  parentProductId: string,
  lines: BomLinePayload[],
): Promise<SaveBomResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'master', action: 'update' })
  if (!gate.ok) return gate

  const parentId = parentProductId.trim()
  if (!parentId) {
    return { ok: false, reason: 'validation', detail: '부모 품목을 선택해 주세요.' }
  }
  if (!lines.length) {
    return { ok: false, reason: 'validation', detail: '구성 품목을 하나 이상 추가해 주세요.' }
  }

  try {
    const supabase = createSupabaseClient()
    const childIds = lines.map((line) => line.childProductId.trim()).filter(Boolean)
    const categoriesResult = await loadItemCategories(supabase, [parentId, ...childIds])
    if (!categoriesResult.ok) {
      return { ok: false, reason: 'query', detail: categoriesResult.detail }
    }

    const parentCategory = categoriesResult.byId[parentId]
    if (!parentCategory || (parentCategory !== 3 && parentCategory !== 4)) {
      return {
        ok: false,
        reason: 'validation',
        detail: '부모 품목은 반제품 또는 완제품만 선택할 수 있습니다.',
      }
    }

    const normalized: BomLinePayload[] = []
    const seen = new Set<string>()

    for (const line of lines) {
      const childId = line.childProductId.trim()
      if (!childId) continue
      if (childId === parentId) {
        return {
          ok: false,
          reason: 'validation',
          detail: '부모 품목과 같은 품목을 구성에 넣을 수 없습니다.',
        }
      }

      const childCategory = categoriesResult.byId[childId]
      if (!childCategory) {
        return { ok: false, reason: 'validation', detail: `구성 품목 ${childId} 을(를) 찾을 수 없습니다.` }
      }
      if (!isValidBomPair(parentCategory, childCategory)) {
        return {
          ok: false,
          reason: 'validation',
          detail:
            parentCategory === 4
              ? '완제품 BOM의 구성은 반제품만 가능합니다.'
              : '반제품 BOM의 구성은 원자재·부자재만 가능합니다.',
        }
      }

      const quantityPer = Number(line.quantityPer)
      if (!Number.isFinite(quantityPer) || quantityPer <= 0) {
        return { ok: false, reason: 'validation', detail: '소요량은 0보다 큰 숫자여야 합니다.' }
      }
      if (seen.has(childId)) {
        return { ok: false, reason: 'validation', detail: `구성 품목 ${childId} 이(가) 중복되었습니다.` }
      }
      seen.add(childId)
      normalized.push({
        childProductId: childId,
        quantityPer,
        note: line.note.trim(),
      })
    }

    if (!normalized.length) {
      return { ok: false, reason: 'validation', detail: '구성 품목을 하나 이상 추가해 주세요.' }
    }

    const { data: existing, error: existingError } = await supabase
      .from('bom_items')
      .select('child_product_id')
      .eq('parent_product_id', parentId)

    if (existingError) {
      return { ok: false, reason: 'query', detail: existingError.message }
    }

    const nextChildIds = new Set(normalized.map((line) => line.childProductId))
    const toDelete = (existing || [])
      .map((row) => String(row.child_product_id || '').trim())
      .filter((childId) => childId && !nextChildIds.has(childId))

    if (toDelete.length) {
      const { error: deleteError } = await supabase
        .from('bom_items')
        .delete()
        .eq('parent_product_id', parentId)
        .in('child_product_id', toDelete)

      if (deleteError) {
        return { ok: false, reason: 'query', detail: deleteError.message }
      }
    }

    const { error: upsertError } = await supabase.from('bom_items').upsert(
      normalized.map((line) => ({
        parent_product_id: parentId,
        child_product_id: line.childProductId,
        quantity_per: line.quantityPer,
        note: line.note,
      })),
      { onConflict: 'parent_product_id,child_product_id' },
    )

    if (upsertError) {
      return { ok: false, reason: 'query', detail: upsertError.message }
    }

    if (parentCategory === 4) {
      const syncResult = await syncFinishedParentUnitPriceFromBom(parentId)
      if (!syncResult.ok) {
        return { ok: false, reason: 'query', detail: syncResult.detail }
      }
    }

    return { ok: true, parentProductId: parentId, lineCount: normalized.length }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteBomForParent(parentProductId: string): Promise<DeleteBomResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'master', action: 'delete' })
  if (!gate.ok) return gate

  const parentId = parentProductId.trim()
  if (!parentId) {
    return { ok: false, reason: 'validation', detail: '부모 품목을 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const categoriesResult = await loadItemCategories(supabase, [parentId])
    if (!categoriesResult.ok) {
      return { ok: false, reason: 'query', detail: categoriesResult.detail }
    }

    const { error } = await supabase.from('bom_items').delete().eq('parent_product_id', parentId)

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    if (categoriesResult.byId[parentId] === 4) {
      const { error: priceError } = await supabase
        .from('items')
        .update({ unit_price: 0 })
        .eq('id', parentId)

      if (priceError) {
        return { ok: false, reason: 'query', detail: priceError.message }
      }
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
