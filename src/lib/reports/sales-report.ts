import { fetchOrders } from '@/lib/orders/repository'
import { addDaysYmd } from '@/lib/orders/utils'
import { createSupabaseClient } from '@/lib/supabase'

export type SalesReportCustomerRow = {
  customer: string
  /** 기간 내 수주 주문 수 */
  orderCount: number
  /** 기간 내 수주 금액 (주문서 금액 합) */
  orderAmount: number
  /** 기간 내 출하 수량 */
  shippedQuantity: number
  /** 기간 내 출하 금액 (수량 × 판매 단가) */
  shippedAmount: number
}

export type SalesReportShipmentRow = {
  recordDate: string
  deliveryId: string
  orderNumber: string
  customer: string
  productName: string
  quantity: number
  unitPrice: number
  amount: number
}

export type SalesReportDailyRow = {
  date: string
  orderCount: number
  orderAmount: number
  shippedQuantity: number
  shippedAmount: number
}

export type SalesReportData = {
  startDate: string
  endDate: string
  totalOrderCount: number
  totalOrderAmount: number
  totalShippedQuantity: number
  totalShippedAmount: number
  customers: SalesReportCustomerRow[]
  daily: SalesReportDailyRow[]
  shipments: SalesReportShipmentRow[]
}

export type FetchSalesReportResult =
  | { ok: true; data: SalesReportData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

type DeliveryRecordRow = {
  id: string
  record_date: string
  assembly_group_id: string | null
  quantity: number
}

type GroupInfo = {
  orderId: string
  customer: string
  parentProductId: string
  productName: string
  itemUnitPrice: number
}

const IN_CHUNK_SIZE = 150

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function normalizeCustomer(value: string | null | undefined): string {
  return String(value ?? '').trim() || '(고객사 미지정)'
}

export async function fetchSalesReportData(
  startDate: string,
  endDate: string,
): Promise<FetchSalesReportResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 필요합니다.',
    }
  }

  try {
    const supabase = createSupabaseClient()

    // ── 1. 기간 내 수주 (주문일 기준) + 출하 기록 ────────────────
    const [ordersResult, deliveryResult] = await Promise.all([
      fetchOrders(),
      supabase
        .from('delivery_records')
        .select('id, record_date, assembly_group_id, quantity')
        .gte('record_date', startDate)
        .lte('record_date', endDate),
    ])

    if (!ordersResult.ok) {
      return ordersResult
    }
    if (deliveryResult.error) {
      return { ok: false, reason: 'query', detail: deliveryResult.error.message }
    }

    const periodOrders = ordersResult.orders.filter(
      (order) => order.orderDate >= startDate && order.orderDate <= endDate,
    )
    const deliveryRows = (deliveryResult.data || []) as DeliveryRecordRow[]

    // ── 2. 출하 기록 → 조립그룹(주문·고객사·완제품) ──────────────
    const groupIds = [
      ...new Set(deliveryRows.map((row) => row.assembly_group_id).filter(Boolean)),
    ] as string[]
    const groupInfoById = new Map<string, GroupInfo>()

    for (const ids of chunk(groupIds, IN_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('order_assembly_groups')
        .select(
          'id, order_id, parent_product_id, items!order_assembly_groups_parent_product_id_fkey(name, unit_price), orders(customer)',
        )
        .in('id', ids)
      if (error) {
        return { ok: false, reason: 'query', detail: error.message }
      }
      for (const row of data || []) {
        const items = row.items as
          | { name?: string | null; unit_price?: number | null }
          | { name?: string | null; unit_price?: number | null }[]
          | null
        const item = Array.isArray(items) ? items[0] : items
        const orders = row.orders as { customer?: string | null } | { customer?: string | null }[] | null
        const customer = Array.isArray(orders) ? orders[0]?.customer : orders?.customer
        groupInfoById.set(String(row.id), {
          orderId: String(row.order_id ?? ''),
          customer: String(customer ?? '').trim(),
          parentProductId: String(row.parent_product_id ?? '').trim(),
          productName: String(item?.name ?? '').trim() || String(row.parent_product_id ?? ''),
          itemUnitPrice: Math.max(0, Math.round(Number(item?.unit_price) || 0)),
        })
      }
    }

    // ── 3. 출하 판매 단가: 주문라인(완제품) 우선, 품목 단가 폴백 ──
    const shipOrderIds = [...new Set([...groupInfoById.values()].map((info) => info.orderId).filter(Boolean))]
    /** orderId → (productId → unitPrice) */
    const linePriceByOrder = new Map<string, Map<string, number>>()

    for (const ids of chunk(shipOrderIds, IN_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('order_lines')
        .select('order_id, product_id, product_code, unit_price, derived_from_line_id')
        .in('order_id', ids)
      if (error) {
        return { ok: false, reason: 'query', detail: error.message }
      }
      for (const row of data || []) {
        const orderId = String(row.order_id ?? '')
        const unitPrice = Math.max(0, Math.round(Number(row.unit_price) || 0))
        const keys = [row.product_id, row.product_code]
          .map((value) => String(value ?? '').trim())
          .filter(Boolean)
        if (!linePriceByOrder.has(orderId)) {
          linePriceByOrder.set(orderId, new Map())
        }
        const priceByProduct = linePriceByOrder.get(orderId)!
        for (const key of keys) {
          const existing = priceByProduct.get(key)
          if (existing == null || (existing <= 0 && unitPrice > 0 && !row.derived_from_line_id)) {
            priceByProduct.set(key, unitPrice)
          }
        }
      }
    }

    function resolveShipUnitPrice(info: GroupInfo): number {
      const fromLine = linePriceByOrder.get(info.orderId)?.get(info.parentProductId) ?? 0
      if (fromLine > 0) return fromLine
      return info.itemUnitPrice
    }

    // ── 4. 출하 상세 행 ─────────────────────────────────────────
    const shipments: SalesReportShipmentRow[] = []
    for (const row of deliveryRows) {
      const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0))
      if (quantity <= 0) continue
      const info = row.assembly_group_id ? groupInfoById.get(String(row.assembly_group_id)) : undefined
      const unitPrice = info ? resolveShipUnitPrice(info) : 0
      shipments.push({
        recordDate: String(row.record_date ?? ''),
        deliveryId: String(row.id ?? ''),
        orderNumber: info?.orderId ?? '',
        customer: info?.customer ?? '',
        productName: info?.productName ?? '',
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
      })
    }
    shipments.sort((a, b) => a.recordDate.localeCompare(b.recordDate))

    // ── 5. 거래처별 집계 ────────────────────────────────────────
    const customerMap = new Map<string, SalesReportCustomerRow>()

    function customerRow(customer: string): SalesReportCustomerRow {
      const key = normalizeCustomer(customer)
      const existing = customerMap.get(key)
      if (existing) return existing
      const created: SalesReportCustomerRow = {
        customer: key,
        orderCount: 0,
        orderAmount: 0,
        shippedQuantity: 0,
        shippedAmount: 0,
      }
      customerMap.set(key, created)
      return created
    }

    for (const order of periodOrders) {
      const row = customerRow(order.customer)
      row.orderCount += 1
      row.orderAmount += Math.max(0, Math.round(order.totalAmount))
    }

    for (const shipment of shipments) {
      const row = customerRow(shipment.customer)
      row.shippedQuantity += shipment.quantity
      row.shippedAmount += shipment.amount
    }

    const customers = [...customerMap.values()].sort(
      (a, b) => b.orderAmount + b.shippedAmount - (a.orderAmount + a.shippedAmount),
    )

    // ── 6. 일별 추이 ────────────────────────────────────────────
    const dailyMap = new Map<string, SalesReportDailyRow>()
    // 안전장치: 잘못된 날짜 형식으로 무한루프 방지 (최대 62일)
    for (
      let date = startDate, steps = 0;
      date <= endDate && steps < 62;
      date = addDaysYmd(date, 1), steps += 1
    ) {
      dailyMap.set(date, {
        date,
        orderCount: 0,
        orderAmount: 0,
        shippedQuantity: 0,
        shippedAmount: 0,
      })
    }

    for (const order of periodOrders) {
      const row = dailyMap.get(order.orderDate)
      if (!row) continue
      row.orderCount += 1
      row.orderAmount += Math.max(0, Math.round(order.totalAmount))
    }

    for (const shipment of shipments) {
      const row = dailyMap.get(shipment.recordDate)
      if (!row) continue
      row.shippedQuantity += shipment.quantity
      row.shippedAmount += shipment.amount
    }

    const daily = [...dailyMap.values()]

    return {
      ok: true,
      data: {
        startDate,
        endDate,
        totalOrderCount: periodOrders.length,
        totalOrderAmount: periodOrders.reduce(
          (sum, order) => sum + Math.max(0, Math.round(order.totalAmount)),
          0,
        ),
        totalShippedQuantity: shipments.reduce((sum, row) => sum + row.quantity, 0),
        totalShippedAmount: shipments.reduce((sum, row) => sum + row.amount, 0),
        customers,
        daily,
        shipments,
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
