import { createSupabaseClient } from '@/lib/supabase'
import type { OrderLineRecord } from '@/lib/orders/types'
import { fetchProducts } from '@/lib/products/repository'
import type { Product } from '@/lib/products/types'
import {
  computeAssemblyGroupsForOrder,
  computeDerivedOrderLineSpecs,
  computeStandaloneFinishedProductGroups,
  computeStandaloneSemiProductGroups,
  isMissingAssemblyTable,
  mapAssemblyGroupRecord,
  resolveLineProductId,
} from './utils'
import type {
  AssemblyGroupLineRecord,
  BomRow,
  OrderAssemblyGroup,
  OrderAssemblyGroupRecord,
} from './types'

export type FetchAssemblyGroupsResult =
  | { ok: true; groups: OrderAssemblyGroup[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SyncAssemblyGroupsResult =
  | { ok: true; groupCount: number }
  | { ok: false; reason: 'env' | 'query'; detail: string }

function missingEnvResult<T extends { ok: false; reason: 'env'; detail: string }>(): T {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  } as T
}

async function fetchBomRowsFromItems(): Promise<
  { ok: true; rows: BomRow[] } | { ok: false; detail: string }
> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('bom_items')
    .select('parent_product_id, child_product_id, quantity_per')

  if (error) {
    return { ok: false, detail: error.message }
  }

  const rows = data || []
  const parentIds = [...new Set(rows.map((row) => String(row.parent_product_id || '').trim()).filter(Boolean))]
  const categoryById: Record<string, number> = {}

  if (parentIds.length) {
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, item_category')
      .in('id', parentIds)

    if (itemsError) {
      return { ok: false, detail: itemsError.message }
    }

    for (const item of items || []) {
      categoryById[String(item.id)] = Number(item.item_category) || 0
    }
  }

  return {
    ok: true,
    rows: rows.map((row) => ({
      parentProductId: row.parent_product_id,
      childProductId: row.child_product_id,
      quantityPer: Number(row.quantity_per) || 1,
      parentItemCategory: categoryById[String(row.parent_product_id)] || undefined,
    })),
  }
}

async function fetchBomRows(): Promise<
  { ok: true; rows: BomRow[] } | { ok: false; detail: string }
> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('bom_detail')
    .select('parent_product_id, child_product_id, quantity_per, parent_item_category')

  if (!error) {
    return {
      ok: true,
      rows: (data || []).map((row) => ({
        parentProductId: row.parent_product_id,
        childProductId: row.child_product_id,
        quantityPer: Number(row.quantity_per) || 1,
        parentItemCategory: Number(row.parent_item_category) || undefined,
      })),
    }
  }

  if (!isMissingAssemblyTable(error.message)) {
    return { ok: false, detail: error.message }
  }

  return fetchBomRowsFromItems()
}

function filterFinishedProductBomRows(rows: BomRow[], productById: Record<string, Product> = {}) {
  return rows.filter((row) => {
    if (row.parentItemCategory === 4) return true
    return productById[row.parentProductId]?.productKind === 'assembly'
  })
}

async function fetchOrderLines(orderId: string): Promise<
  { ok: true; lines: OrderLineRecord[] } | { ok: false; detail: string }
> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('order_lines')
    .select('*')
    .eq('order_id', orderId)
    .order('line_seq', { ascending: true })

  if (error) {
    return { ok: false, detail: error.message }
  }

  return { ok: true, lines: (data || []) as OrderLineRecord[] }
}

async function syncDerivedOrderLines(
  orderId: string,
  orderLines: OrderLineRecord[],
  bomRows: BomRow[],
  productById: Record<string, Product>,
): Promise<{ ok: true; lines: OrderLineRecord[] } | { ok: false; detail: string }> {
  const specs = computeDerivedOrderLineSpecs(orderLines, bomRows, productById)
  const supabase = createSupabaseClient()
  const activeParentIds = new Set(specs.map((spec) => spec.parentLineId))

  for (const line of orderLines) {
    if (!line.derived_from_line_id) continue
    if (activeParentIds.has(line.derived_from_line_id)) continue

    const { error } = await supabase.from('order_lines').delete().eq('id', line.id)
    if (error) {
      return { ok: false, detail: error.message }
    }
  }

  for (const spec of specs) {
    const existing = orderLines.find(
      (line) =>
        line.derived_from_line_id === spec.parentLineId &&
        resolveLineProductId(line) === spec.childProductId,
    )

    if (existing?.id) {
      const { error } = await supabase
        .from('order_lines')
        .update({
          product_id: spec.childProductId,
          product_code: spec.childProductId,
          product_name: spec.productName,
          quantity: spec.quantity,
          line_seq: spec.lineSeq,
          unit_price: 0,
          order_amount: 0,
        })
        .eq('id', existing.id)

      if (error) {
        return { ok: false, detail: error.message }
      }
      continue
    }

    const { error } = await supabase.from('order_lines').insert({
      order_id: orderId,
      line_seq: spec.lineSeq,
      product_id: spec.childProductId,
      product_code: spec.childProductId,
      product_name: spec.productName,
      quantity: spec.quantity,
      unit_price: 0,
      order_amount: 0,
      derived_from_line_id: spec.parentLineId,
    })

    if (error) {
      return { ok: false, detail: error.message }
    }
  }

  return fetchOrderLines(orderId)
}

export async function syncAssemblyGroupsForOrder(orderId: string): Promise<SyncAssemblyGroupsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const trimmedOrderId = orderId.trim()
  if (!trimmedOrderId) {
    return { ok: true, groupCount: 0 }
  }

  try {
    const bomResult = await fetchBomRows()
    if (!bomResult.ok) {
      return { ok: false, reason: 'query', detail: bomResult.detail }
    }

    const linesResult = await fetchOrderLines(trimmedOrderId)
    if (!linesResult.ok) {
      return { ok: false, reason: 'query', detail: linesResult.detail }
    }

    const productsResult = await fetchProducts(false)
    const productById = productsResult.ok
      ? Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
      : {}

    const finishedProductBomRows = filterFinishedProductBomRows(bomResult.rows, productById)

    const derivedResult = await syncDerivedOrderLines(
      trimmedOrderId,
      linesResult.lines,
      finishedProductBomRows,
      productById,
    )
    if (!derivedResult.ok) {
      if (derivedResult.detail.includes('derived_from_line_id')) {
        return { ok: true, groupCount: 0 }
      }
      return { ok: false, reason: 'query', detail: derivedResult.detail }
    }

    const bomGroups = computeAssemblyGroupsForOrder(derivedResult.lines, finishedProductBomRows)
    const computed = [
      ...bomGroups,
      ...computeStandaloneFinishedProductGroups(derivedResult.lines, bomGroups, productById),
      ...computeStandaloneSemiProductGroups(derivedResult.lines, bomGroups, productById),
    ]
    const supabase = createSupabaseClient()

    const { data: existingGroups, error: existingError } = await supabase
      .from('order_assembly_groups')
      .select('id, parent_product_id')
      .eq('order_id', trimmedOrderId)

    if (existingError) {
      if (isMissingAssemblyTable(existingError.message)) {
        return { ok: true, groupCount: 0 }
      }
      return { ok: false, reason: 'query', detail: existingError.message }
    }

    const existingByParent = new Map(
      (existingGroups || []).map((group) => [group.parent_product_id, group.id as string]),
    )
    const computedParentIds = new Set(computed.map((group) => group.parentProductId))

    for (const [parentProductId, groupId] of existingByParent) {
      if (!computedParentIds.has(parentProductId)) {
        const { error: removeError } = await supabase
          .from('order_assembly_groups')
          .delete()
          .eq('id', groupId)

        if (removeError) {
          return { ok: false, reason: 'query', detail: removeError.message }
        }
      }
    }

    for (let index = 0; index < computed.length; index += 1) {
      const group = computed[index]
      const existingGroupId = existingByParent.get(group.parentProductId)
      let groupId = existingGroupId

      if (existingGroupId) {
        const { error: updateError } = await supabase
          .from('order_assembly_groups')
          .update({
            target_quantity: group.targetQuantity,
            group_seq: index,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingGroupId)

        if (updateError) {
          return { ok: false, reason: 'query', detail: updateError.message }
        }

        const { error: clearLinesError } = await supabase
          .from('order_assembly_group_lines')
          .delete()
          .eq('assembly_group_id', existingGroupId)

        if (clearLinesError) {
          return { ok: false, reason: 'query', detail: clearLinesError.message }
        }
      } else {
        const { data: inserted, error: insertGroupError } = await supabase
          .from('order_assembly_groups')
          .insert({
            order_id: trimmedOrderId,
            parent_product_id: group.parentProductId,
            target_quantity: group.targetQuantity,
            group_seq: index,
          })
          .select('id')
          .single()

        if (insertGroupError || !inserted?.id) {
          return {
            ok: false,
            reason: 'query',
            detail: insertGroupError?.message || '조립 그룹 저장에 실패했습니다.',
          }
        }

        groupId = inserted.id
      }

      if (!group.lines.length || !groupId) continue

      const { error: insertLinesError } = await supabase.from('order_assembly_group_lines').insert(
        group.lines.map((line) => ({
          assembly_group_id: groupId,
          order_line_id: line.orderLineId,
          child_product_id: line.childProductId,
          quantity_per: line.quantityPer,
        })),
      )

      if (insertLinesError) {
        return { ok: false, reason: 'query', detail: insertLinesError.message }
      }
    }

    return { ok: true, groupCount: computed.length }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function ensureAssemblyGroupsForOrders(orderIds: string[]) {
  const uniqueOrderIds = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))]
  if (!uniqueOrderIds.length) return

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('order_assembly_groups')
      .select('order_id')
      .in('order_id', uniqueOrderIds)

    if (error) {
      if (isMissingAssemblyTable(error.message)) return
      return
    }

    const existingOrderIds = new Set(
      (data || []).map((row) => String(row.order_id || '').trim()).filter(Boolean),
    )
    const missingOrderIds = uniqueOrderIds.filter((orderId) => !existingOrderIds.has(orderId))
    if (!missingOrderIds.length) return

    // Vercel 서버리스 타임아웃 방지: 없는 주문만, 소량 병렬로 동기화
    const batchSize = 3
    for (let index = 0; index < missingOrderIds.length; index += batchSize) {
      const batch = missingOrderIds.slice(index, index + batchSize)
      await Promise.all(batch.map((orderId) => syncAssemblyGroupsForOrder(orderId)))
    }
  } catch {
    // 조립 그룹·BOM 펼침 동기화 실패는 목록 조회를 막지 않음
  }
}

export async function fetchAssemblyGroups(
  productById: Record<string, Product> = {},
): Promise<FetchAssemblyGroupsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('order_assembly_groups')
      .select('*')
      .order('created_at', { ascending: false })
      .order('group_seq', { ascending: true })

    if (error) {
      if (isMissingAssemblyTable(error.message)) {
        return { ok: true, groups: [] }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    const records = (data || []) as OrderAssemblyGroupRecord[]
    if (!records.length) {
      return { ok: true, groups: [] }
    }

    const groupIds = records.map((record) => record.id)
    const { data: lineRows, error: lineError } = await supabase
      .from('order_assembly_group_lines')
      .select('*')
      .in('assembly_group_id', groupIds)

    if (lineError) {
      return { ok: false, reason: 'query', detail: lineError.message }
    }

    const linesByGroupId = new Map<string, AssemblyGroupLineRecord[]>()
    for (const line of (lineRows || []) as AssemblyGroupLineRecord[]) {
      const list = linesByGroupId.get(line.assembly_group_id) ?? []
      list.push(line)
      linesByGroupId.set(line.assembly_group_id, list)
    }

    const groups = records.map((record) => {
      const mapped = mapAssemblyGroupRecord(record, productById)
      mapped.lines = (linesByGroupId.get(record.id) ?? []).map((line) => ({
        id: line.id,
        orderLineId: line.order_line_id,
        childProductId: line.child_product_id,
        quantityPer: Number(line.quantity_per) || 1,
      }))
      return mapped
    })

    return { ok: true, groups }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export { isMissingAssemblyTable }
