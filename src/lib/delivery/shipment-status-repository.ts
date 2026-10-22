import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import { fetchOrders } from '@/lib/orders/repository'
import { stripDerivedOrderLines } from '@/lib/orders/utils'
import { fetchProducts } from '@/lib/products/repository'
import { createSupabaseClient } from '@/lib/supabase'
import { fetchDeliveryCumulativeCounts, isMissingDeliveryTable } from './repository'
import {
  buildShipmentStatusRows,
  groupShipmentRoundsByAssemblyGroup,
  type ShipmentRecordInput,
  type ShipmentStatusRow,
} from './shipment-status'

export type FetchShipmentStatusResult =
  | { ok: true; rows: ShipmentStatusRow[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

const RECORD_PAGE_SIZE = 1000

async function fetchShipmentRecords(): Promise<
  { ok: true; records: ShipmentRecordInput[] } | { ok: false; reason: 'query'; detail: string }
> {
  const supabase = createSupabaseClient()
  const records: ShipmentRecordInput[] = []

  for (let from = 0; ; from += RECORD_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('delivery_records')
      .select('id, shipment_id, record_date, assembly_group_id, quantity, created_at')
      .not('assembly_group_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + RECORD_PAGE_SIZE - 1)

    if (error) {
      if (isMissingDeliveryTable(error.message)) return { ok: true, records: [] }
      return { ok: false, reason: 'query', detail: error.message }
    }

    for (const row of data || []) {
      const id = String(row.id || '').trim()
      records.push({
        id,
        shipmentId: String(row.shipment_id || id).trim() || id,
        recordDate: String(row.record_date || '').slice(0, 10),
        assemblyGroupId: String(row.assembly_group_id || '').trim(),
        quantity: Math.max(0, Math.floor(Number(row.quantity) || 0)),
        createdAt: String(row.created_at || ''),
      })
    }

    if (!data || data.length < RECORD_PAGE_SIZE) break
  }

  return { ok: true, records }
}

export async function fetchShipmentStatusRows(): Promise<FetchShipmentStatusResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const [ordersResult, productsResult, deliveryCountsResult, recordsResult] = await Promise.all([
    fetchOrders(),
    fetchProducts(false),
    fetchDeliveryCumulativeCounts(),
    fetchShipmentRecords(),
  ])
  if (!ordersResult.ok) return ordersResult
  if (!productsResult.ok) return productsResult
  if (!deliveryCountsResult.ok) return deliveryCountsResult
  if (!recordsResult.ok) return recordsResult

  const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
  const assemblyResult = await fetchAssemblyGroups(productById)
  if (!assemblyResult.ok) return assemblyResult

  return {
    ok: true,
    rows: buildShipmentStatusRows(
      stripDerivedOrderLines(ordersResult.orders),
      assemblyResult.groups,
      deliveryCountsResult.counts,
      groupShipmentRoundsByAssemblyGroup(recordsResult.records),
    ),
  }
}
