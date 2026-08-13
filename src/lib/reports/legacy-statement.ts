import {
  isMissingCreatedByColumn,
  stripCreatedByFields,
  withCreatedByFields,
} from '@/lib/auth/created-by'
import { createOrder } from '@/lib/orders/repository'
import type { OrderLineItem } from '@/lib/orders/types'
import { createSupabaseClient } from '@/lib/supabase'

/** 과거 거래명세서용 주문서 source — 생산·출하등록 목록에서 제외 */
export const LEGACY_STATEMENT_ORDER_SOURCE = 'legacy_statement'

export const LEGACY_SHIPMENT_NOTE_PREFIX = 'legacy_statement:'

export function isLegacyStatementOrder(order: { source?: string | null }) {
  return String(order.source || '').trim() === LEGACY_STATEMENT_ORDER_SOURCE
}

export function isLegacyShipmentNote(note: string | null | undefined) {
  return String(note || '').trim().startsWith(LEGACY_SHIPMENT_NOTE_PREFIX)
}

export function legacyShipmentNote(orderId: string) {
  return `${LEGACY_SHIPMENT_NOTE_PREFIX}${String(orderId || '').trim()}`
}

export function orderIdFromLegacyShipmentNote(note: string | null | undefined) {
  const value = String(note || '').trim()
  if (!value.startsWith(LEGACY_SHIPMENT_NOTE_PREFIX)) return ''
  return value.slice(LEGACY_SHIPMENT_NOTE_PREFIX.length).trim()
}

const MRS_IN_ORDER_NOTE_RE = /\[MRS:(MRS-(?:[0-9]{6}-[0-9]{2}|[0-9]+))\]/

export function parseLegacyShipmentIdFromOrderNote(note: string | null | undefined) {
  const match = String(note || '').match(MRS_IN_ORDER_NOTE_RE)
  return match?.[1] || ''
}

function withMrsMarker(note: string, shipmentId: string) {
  const clean = String(note || '').replace(MRS_IN_ORDER_NOTE_RE, '').trim()
  return `[MRS:${shipmentId}]${clean ? ` ${clean}` : ''}`
}

export type LegacyStatementLineInput = {
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
}

export type CreateLegacyStatementInput = {
  customer: string
  shipDate: string
  note?: string
  /** 있으면 발주번호로 저장 (발주ID는 자동 발급) */
  orderNumber?: string
  lines: LegacyStatementLineInput[]
}

export type CreateLegacyStatementResult =
  | { ok: true; orderId: string; orderNumber: string; shipmentId: string }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export async function createLegacyStatement(
  input: CreateLegacyStatementInput,
): Promise<CreateLegacyStatementResult> {
  const customer = String(input.customer || '').trim()
  const shipDate = String(input.shipDate || '').trim()
  const note = String(input.note || '').trim()
  const orderNumber = String(input.orderNumber || '').trim().toUpperCase()

  if (!customer) {
    return { ok: false, reason: 'validation', detail: '고객사를 선택해 주세요.' }
  }
  if (!shipDate) {
    return { ok: false, reason: 'validation', detail: '출하일을 입력해 주세요.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shipDate)) {
    return { ok: false, reason: 'validation', detail: '출하일이 올바르지 않습니다.' }
  }

  const lines: OrderLineItem[] = []
  for (const [index, raw] of input.lines.entries()) {
    const productName = String(raw.productName || '').trim()
    const productCode = String(raw.productCode || '').trim() || 'TEMP'
    const quantity = Math.max(0, Math.floor(Number(raw.quantity) || 0))
    const unitPrice = Math.max(0, Math.round(Number(raw.unitPrice) || 0))
    if (!productName) {
      return { ok: false, reason: 'validation', detail: `${index + 1}행 품목명을 입력해 주세요.` }
    }
    if (quantity < 1) {
      return { ok: false, reason: 'validation', detail: `${index + 1}행 수량은 1 이상이어야 합니다.` }
    }
    lines.push({
      productId: null,
      productCode,
      productName,
      quantity,
      unitPrice,
      orderAmount: quantity * unitPrice,
      deliveryDate: shipDate,
    })
  }

  if (!lines.length) {
    return { ok: false, reason: 'validation', detail: '품목 라인을 1개 이상 입력해 주세요.' }
  }

  const result = await createOrder({
    order_date: shipDate,
    delivery_date: shipDate,
    customer,
    category: '양산',
    note: note || '과거 거래명세서',
    customer_po_number: orderNumber || '',
    source: LEGACY_STATEMENT_ORDER_SOURCE,
    items: lines,
  })

  if (!result.ok) {
    return result
  }

  const totalQty = lines.reduce((sum, line) => sum + line.quantity, 0)
  const shipmentId = await ensureLegacyShipmentNumber({
    orderId: result.orderId,
    shipDate,
    quantity: totalQty,
    orderNote: note || '과거 거래명세서',
  })

  return {
    ok: true,
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    shipmentId: shipmentId || result.orderNumber,
  }
}

export async function ensureLegacyShipmentNumber(input: {
  orderId: string
  shipDate: string
  quantity?: number
  orderNote?: string
}): Promise<string> {
  const orderId = String(input.orderId || '').trim()
  const shipDate = String(input.shipDate || '').trim()
  if (!orderId || !/^\d{4}-\d{2}-\d{2}$/.test(shipDate)) return ''

  const supabase = createSupabaseClient()
  const marker = legacyShipmentNote(orderId)

  const existing = await supabase
    .from('delivery_records')
    .select('id')
    .eq('note', marker)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!existing.error && existing.data?.id) {
    return String(existing.data.id)
  }

  const quantity = Math.max(1, Math.floor(Number(input.quantity) || 0) || 1)
  const basePayload = await withCreatedByFields({
    record_date: shipDate,
    assembly_group_id: null,
    quantity,
    source: 'manual',
    note: marker,
    shipment_id: '',
  })

  let inserted = await supabase.from('delivery_records').insert(basePayload).select('id').single()
  if (inserted.error && isMissingCreatedByColumn(inserted.error.message)) {
    inserted = await supabase
      .from('delivery_records')
      .insert(stripCreatedByFields(basePayload))
      .select('id')
      .single()
  }

  if (!inserted.error && inserted.data?.id) {
    return String(inserted.data.id)
  }

  const generated = await supabase.rpc('generate_delivery_number', { p_record_date: shipDate })
  const shipmentId = String(generated.data || '').trim()
  if (!/^MRS-([0-9]{6}-[0-9]{2}|[0-9]+)$/.test(shipmentId)) {
    return parseLegacyShipmentIdFromOrderNote(input.orderNote) || ''
  }

  const nextNote = withMrsMarker(input.orderNote || '과거 거래명세서', shipmentId)
  await supabase.from('orders').update({ note: nextNote }).eq('id', orderId)
  return shipmentId
}

export async function deleteLegacyShipmentStub(orderId: string) {
  const id = String(orderId || '').trim()
  if (!id) return
  const supabase = createSupabaseClient()
  await supabase.from('delivery_records').delete().eq('note', legacyShipmentNote(id))
}
