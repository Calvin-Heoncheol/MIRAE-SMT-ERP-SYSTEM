import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { insertChangeLog } from '@/lib/change-logs/repository'
import { deleteDeliveryRecord, updateDeliveryRecord } from '@/lib/delivery/repository'
import { parseItemVersionCode } from '@/lib/items/version-code'
import { deleteOrder } from '@/lib/orders/repository'
import {
  deleteLegacyShipmentStub,
  isLegacyStatementOrder,
  syncLegacyShipmentStubQuantity,
} from '@/lib/reports/legacy-statement'
import { createSupabaseClient } from '@/lib/supabase'

export type UpdateStatementLineInput = {
  source: 'delivery' | 'legacy'
  deliveryId: string
  orderNumber: string
  orderLineId?: string
  assemblyGroupId?: string
  recordDate: string
  customer?: string
  productCode?: string
  productId?: string
  productName?: string
  quantity: number
  unitPrice: number
  /** 추가작업(금액 전용) — 출하 기록 없이 발주 라인 단가만 수정 */
  billingOnly?: boolean
}

export type UpdateStatementLinesOptions = {
  reason?: string
}

export type StatementEditResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

type OrderLineMatch = {
  id: string
  quantity: number
  product_id: string | null
  product_code: string | null
  product_name?: string | null
  derived_from_line_id: string | null
  unit_price: number | null
}

function missingEnvResult(): StatementEditResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

function codesEqual(left: string, right: string) {
  const a = String(left || '').trim()
  const b = String(right || '').trim()
  if (!a || !b) return false
  if (a === b) return true
  const aBase = parseItemVersionCode(a).base
  const bBase = parseItemVersionCode(b).base
  return Boolean(aBase && bBase && (aBase === b || bBase === a || aBase === bBase))
}

function matchOrderLine(
  lines: OrderLineMatch[],
  options: {
    orderLineId?: string
    productCode?: string
    productId?: string
    productName?: string
  },
): OrderLineMatch | undefined {
  const usable = lines.filter((line) => !line.derived_from_line_id)
  const lineId = String(options.orderLineId || '').trim()
  if (lineId) {
    const byId = usable.find((line) => line.id === lineId) || lines.find((line) => line.id === lineId)
    if (byId) return byId
  }

  const productId = String(options.productId || '').trim()
  if (productId) {
    const byProductId = usable.find((line) => String(line.product_id || '').trim() === productId)
    if (byProductId) return byProductId
  }

  const productCode = String(options.productCode || '').trim()
  if (productCode) {
    const byCode =
      usable.find(
        (line) =>
          Boolean(String(line.product_id || '').trim()) &&
          (codesEqual(String(line.product_id || ''), productCode) ||
            codesEqual(String(line.product_code || ''), productCode)),
      ) ||
      usable.find(
        (line) =>
          codesEqual(String(line.product_id || ''), productCode) ||
          codesEqual(String(line.product_code || ''), productCode),
      )
    if (byCode) return byCode
  }

  const productName = String(options.productName || '').trim()
  if (productName) {
    const nameMatches = usable.filter(
      (line) => String(line.product_name || '').trim() === productName,
    )
    if (nameMatches.length === 1) return nameMatches[0]
  }

  return undefined
}

async function resolveParentProductIdFromAssembly(assemblyGroupId: string) {
  const id = String(assemblyGroupId || '').trim()
  if (!id) return { orderId: '', parentProductId: '' }

  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('order_assembly_groups')
    .select('order_id, parent_product_id')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return { orderId: '', parentProductId: '' }
  return {
    orderId: String(data.order_id || '').trim(),
    parentProductId: String(data.parent_product_id || '').trim(),
  }
}

async function resolveAssemblyGroupIdFromDelivery(deliveryId: string) {
  const id = String(deliveryId || '').trim()
  if (!id) return ''

  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('delivery_records')
    .select('assembly_group_id')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return ''
  return String(data.assembly_group_id || '').trim()
}

async function updateOrderLineUnitPrice(input: {
  orderNumber: string
  orderLineId?: string
  assemblyGroupId?: string
  deliveryId?: string
  productCode?: string
  productId?: string
  productName?: string
  unitPrice: number
  reason?: string
  /** true면 라인을 못 찾을 때 실패. false면 단가 갱신만 건너뜀 */
  requireMatch?: boolean
}): Promise<StatementEditResult> {
  let orderNumber = String(input.orderNumber || '').trim()
  let productId = String(input.productId || '').trim()
  let assemblyGroupId = String(input.assemblyGroupId || '').trim()

  if (!assemblyGroupId && input.deliveryId) {
    assemblyGroupId = await resolveAssemblyGroupIdFromDelivery(input.deliveryId)
  }

  if (assemblyGroupId) {
    const resolved = await resolveParentProductIdFromAssembly(assemblyGroupId)
    if (!orderNumber && resolved.orderId) orderNumber = resolved.orderId
    if (!productId && resolved.parentProductId) productId = resolved.parentProductId
  }

  if (!orderNumber) {
    return input.requireMatch
      ? { ok: false, reason: 'validation', detail: '단가를 저장할 발주서를 찾지 못했습니다.' }
      : { ok: true }
  }

  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('order_lines')
    .select('id, quantity, product_id, product_code, product_name, derived_from_line_id, unit_price')
    .eq('order_id', orderNumber)

  if (error) {
    return { ok: false, reason: 'query', detail: error.message }
  }

  const match = matchOrderLine((data || []) as OrderLineMatch[], {
    orderLineId: input.orderLineId,
    productCode: input.productCode,
    productId,
    productName: input.productName,
  })
  if (!match) {
    if (input.requireMatch) {
      return {
        ok: false,
        reason: 'validation',
        detail: '단가를 저장할 발주서 라인을 찾지 못했습니다.',
      }
    }
    // 출하일·수량은 이미 반영된 상태 — 단가 매칭 실패로 전체 저장을 막지 않음
    return { ok: true }
  }

  const beforePrice = Math.max(0, Math.round(Number(match.unit_price) || 0))
  const nextPrice = Math.max(0, Math.round(Number(input.unitPrice) || 0))
  const lineQty = Math.max(0, Math.floor(Number(match.quantity) || 0))
  const { error: updateError } = await supabase
    .from('order_lines')
    .update({
      unit_price: nextPrice,
      order_amount: lineQty * nextPrice,
    })
    .eq('id', match.id)

  if (updateError) {
    return { ok: false, reason: 'query', detail: updateError.message }
  }

  if (beforePrice !== nextPrice && input.reason?.trim()) {
    const label = String(input.productName || input.productCode || match.product_code || '').trim()
    await insertChangeLog({
      entityType: 'order',
      entityId: orderNumber,
      title: `발주서 ${orderNumber} 단가 수정`,
      detail: label
        ? `${label}: ${beforePrice.toLocaleString('ko-KR')} → ${nextPrice.toLocaleString('ko-KR')}`
        : `${beforePrice.toLocaleString('ko-KR')} → ${nextPrice.toLocaleString('ko-KR')}`,
      reason: input.reason.trim(),
      beforeData: { unitPrice: beforePrice },
      afterData: { unitPrice: nextPrice },
    })
  }

  return { ok: true }
}

export async function updateStatementLines(
  lines: UpdateStatementLineInput[],
  options?: UpdateStatementLinesOptions,
): Promise<StatementEditResult> {
  if (!lines.length) {
    return { ok: false, reason: 'validation', detail: '수정할 품목이 없습니다.' }
  }
  for (let index = 0; index < lines.length; index += 1) {
    const result = await updateStatementLine(lines[index]!, options)
    if (!result.ok) {
      return {
        ...result,
        detail: `${index + 1}행: ${result.detail}`,
      }
    }
  }

  const legacyLine = lines.find((line) => line.source === 'legacy')
  if (legacyLine) {
    await syncLegacyShipmentStubQuantity(
      String(legacyLine.orderNumber || '').trim(),
      legacyLine.recordDate,
    )
  }

  return { ok: true }
}

export async function deleteStatementLines(
  lines: Array<{
    source: 'delivery' | 'legacy'
    deliveryId: string
    orderNumber: string
    orderLineId?: string
    productCode?: string
  }>,
): Promise<StatementEditResult> {
  if (!lines.length) {
    return { ok: false, reason: 'validation', detail: '삭제할 품목이 없습니다.' }
  }
  for (let index = 0; index < lines.length; index += 1) {
    const result = await deleteStatementLine(lines[index]!)
    if (!result.ok) {
      return {
        ...result,
        detail: `${index + 1}행: ${result.detail}`,
      }
    }
  }
  return { ok: true }
}

export async function updateStatementLine(
  input: UpdateStatementLineInput,
  options?: UpdateStatementLinesOptions,
): Promise<StatementEditResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'update' })
  if (!gate.ok) return gate

  const recordDate = String(input.recordDate || '').trim()
  const quantity = Math.floor(Number(input.quantity) || 0)
  const unitPrice = Math.max(0, Math.round(Number(input.unitPrice) || 0))

  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    return { ok: false, reason: 'validation', detail: '출하일이 올바르지 않습니다.' }
  }
  if (quantity < 1) {
    return { ok: false, reason: 'validation', detail: '수량은 1 이상이어야 합니다.' }
  }

  try {
    if (input.source === 'delivery') {
      if (!input.billingOnly) {
        const deliveryId = String(input.deliveryId || '').trim()
        if (!deliveryId) {
          return { ok: false, reason: 'validation', detail: '출하번호를 찾을 수 없습니다.' }
        }

        const deliveryResult = await updateDeliveryRecord(deliveryId, {
          recordDate,
          quantity,
        })
        if (!deliveryResult.ok) return deliveryResult
      }

      const priceResult = await updateOrderLineUnitPrice({
        orderNumber: input.orderNumber,
        orderLineId: input.orderLineId,
        assemblyGroupId: input.assemblyGroupId,
        deliveryId: input.deliveryId,
        productCode: input.productCode,
        productId: input.productId,
        productName: input.productName,
        unitPrice,
        reason: options?.reason,
        requireMatch: Boolean(input.billingOnly),
      })
      if (!priceResult.ok) {
        return {
          ok: false,
          reason: priceResult.reason,
          detail: input.billingOnly
            ? priceResult.detail
            : `${priceResult.detail} (출하일·수량은 저장되었습니다.)`,
        }
      }

      return { ok: true }
    }

    const orderNumber = String(input.orderNumber || '').trim()
    const productName = String(input.productName || '').trim()
    const productCode = String(input.productCode || '').trim() || 'TEMP'
    const customer = String(input.customer || '').trim()

    if (!orderNumber) {
      return { ok: false, reason: 'validation', detail: '발주ID를 찾을 수 없습니다.' }
    }
    if (!customer) {
      return { ok: false, reason: 'validation', detail: '고객사를 입력해 주세요.' }
    }
    if (!productName) {
      return { ok: false, reason: 'validation', detail: '품목명을 입력해 주세요.' }
    }

    const supabase = createSupabaseClient()
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, source, customer')
      .eq('id', orderNumber)
      .maybeSingle()

    if (orderError) {
      return { ok: false, reason: 'query', detail: orderError.message }
    }
    if (!order?.id || !isLegacyStatementOrder(order)) {
      return {
        ok: false,
        reason: 'validation',
        detail: '과거 거래명세서만 이 화면에서 품목·고객사를 수정할 수 있습니다.',
      }
    }

    const { data: lines, error: linesError } = await supabase
      .from('order_lines')
      .select('id, quantity, product_id, product_code, derived_from_line_id')
      .eq('order_id', order.id)

    if (linesError) {
      return { ok: false, reason: 'query', detail: linesError.message }
    }

    const orderLineId = String(input.orderLineId || '').trim()
    const allLines = (lines || []) as OrderLineMatch[]
    const match = orderLineId
      ? matchOrderLine(allLines, {
          orderLineId: input.orderLineId,
          productCode: input.productCode,
        })
      : undefined

    const { error: headerError } = await supabase
      .from('orders')
      .update({
        order_date: recordDate,
        delivery_date: recordDate,
        customer,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    if (headerError) {
      return { ok: false, reason: 'query', detail: headerError.message }
    }

    if (!match) {
      if (!orderLineId) {
        const userLines = allLines.filter((line) => !line.derived_from_line_id)
        const { error: insertError } = await supabase.from('order_lines').insert({
          order_id: order.id,
          line_seq: userLines.length,
          product_id: null,
          product_code: productCode,
          product_name: productName,
          quantity,
          setup_cost: 0,
          smd_unit_price: unitPrice,
          dip_unit_price: 0,
          material_cost: 0,
          unit_price: unitPrice,
          order_amount: quantity * unitPrice,
          delivery_date: recordDate,
        })

        if (insertError) {
          return { ok: false, reason: 'query', detail: insertError.message }
        }

        return { ok: true }
      }

      return { ok: false, reason: 'validation', detail: '수정할 명세서 라인을 찾지 못했습니다.' }
    }

    const { error: lineError } = await supabase
      .from('order_lines')
      .update({
        product_code: productCode,
        product_name: productName,
        quantity,
        unit_price: unitPrice,
        order_amount: quantity * unitPrice,
        delivery_date: recordDate,
      })
      .eq('id', match.id)

    if (lineError) {
      return { ok: false, reason: 'query', detail: lineError.message }
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

export async function deleteStatementLine(input: {
  source: 'delivery' | 'legacy'
  deliveryId: string
  orderNumber: string
  orderLineId?: string
  productCode?: string
}): Promise<StatementEditResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'delete' })
  if (!gate.ok) return gate

  try {
    if (input.source === 'delivery') {
      const deliveryId = String(input.deliveryId || '').trim()
      if (!deliveryId) {
        return { ok: false, reason: 'validation', detail: '출하번호를 찾을 수 없습니다.' }
      }
      return deleteDeliveryRecord(deliveryId)
    }

    const orderNumber = String(input.orderNumber || '').trim()
    if (!orderNumber) {
      return { ok: false, reason: 'validation', detail: '발주ID를 찾을 수 없습니다.' }
    }

    const supabase = createSupabaseClient()
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, source')
      .eq('id', orderNumber)
      .maybeSingle()

    if (orderError) {
      return { ok: false, reason: 'query', detail: orderError.message }
    }
    if (!order?.id || !isLegacyStatementOrder(order)) {
      return {
        ok: false,
        reason: 'validation',
        detail: '과거 거래명세서만 이 화면에서 삭제할 수 있습니다.',
      }
    }

    const { data: lines, error: linesError } = await supabase
      .from('order_lines')
      .select('id, quantity, product_id, product_code, derived_from_line_id')
      .eq('order_id', order.id)

    if (linesError) {
      return { ok: false, reason: 'query', detail: linesError.message }
    }

    const allLines = (lines || []) as OrderLineMatch[]
    const userLines = allLines.filter((line) => !line.derived_from_line_id)
    const match = matchOrderLine(allLines, {
      orderLineId: input.orderLineId,
      productCode: input.productCode,
    })
    if (!match) {
      return { ok: false, reason: 'validation', detail: '삭제할 명세서 라인을 찾지 못했습니다.' }
    }

    if (userLines.length <= 1) {
      await deleteLegacyShipmentStub(order.id)
      return deleteOrder(order.id)
    }

    const { error: deleteError } = await supabase.from('order_lines').delete().eq('id', match.id)
    if (deleteError) {
      return { ok: false, reason: 'query', detail: deleteError.message }
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
