import { createSupabaseClient } from '@/lib/supabase'
import { fetchMaterials } from '@/lib/materials/repository'
import { resolveMaterialByInventoryCode } from '@/lib/materials/utils'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { MaterialOutboundType } from './types'
import {
  findReelsByScan,
  isMissingReelRemainingColumn,
  pickFefoWarehouseReel,
  REEL_MIGRATION_HINT,
  type MaterialReelRow,
} from './reels'

export type ReelMutationResult =
  | { ok: true; outboundId: string; outboundNumber: string; message: string }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

type AllocatedReelLine = {
  material_id: string
  quantity: number
  lot_number: string
  inbound_line_id: string
}

function mapReelRow(row: {
  id: string
  material_id: string
  quantity: number
  remaining_qty: number
  lot_number?: string | null
  scan_fingerprint?: string | null
  location_status?: string | null
  material_inbound_records?:
    | { inbound_date?: string; created_at?: string }
    | { inbound_date?: string; created_at?: string }[]
    | null
}): MaterialReelRow {
  const header = Array.isArray(row.material_inbound_records)
    ? row.material_inbound_records[0]
    : row.material_inbound_records
  return {
    id: row.id,
    materialId: String(row.material_id || '').trim(),
    quantity: Number(row.quantity) || 0,
    remainingQty: Number(row.remaining_qty) || 0,
    lotNumber: String(row.lot_number || '').trim(),
    scanFingerprint: String(row.scan_fingerprint || '').trim(),
    locationStatus: row.location_status === 'line' ? 'line' : 'warehouse',
    inboundDate: String(header?.inbound_date || ''),
    createdAt: String(header?.created_at || ''),
  }
}

export async function fetchReelsByMaterialIds(materialIds: string[]): Promise<MaterialReelRow[]> {
  const unique = [...new Set(materialIds.map((id) => id.trim()).filter(Boolean))]
  if (!unique.length) return []

  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('material_inbound_lines')
    .select(
      `
      id,
      material_id,
      quantity,
      remaining_qty,
      lot_number,
      scan_fingerprint,
      location_status,
      material_inbound_records (
        inbound_date,
        created_at
      )
    `,
    )
    .in('material_id', unique)

  if (error) {
    if (isMissingReelRemainingColumn(error.message)) throw new Error(REEL_MIGRATION_HINT)
    throw new Error(error.message)
  }

  return (data || []).map((row) => mapReelRow(row as Parameters<typeof mapReelRow>[0]))
}

async function setReelRemaining(inboundLineId: string, remainingQty: number, originalQty: number) {
  const supabase = createSupabaseClient()
  const next = Math.max(0, Math.min(originalQty, remainingQty))
  const { error } = await supabase
    .from('material_inbound_lines')
    .update({
      remaining_qty: next,
      location_status: next > 0 ? 'warehouse' : 'line',
    })
    .eq('id', inboundLineId)

  if (error) {
    if (isMissingReelRemainingColumn(error.message)) throw new Error(REEL_MIGRATION_HINT)
    throw new Error(error.message)
  }
}

async function consumeReelQty(reel: MaterialReelRow, qty: number) {
  if (qty <= 0) return
  if (qty > reel.remainingQty) {
    throw new Error(
      `${reel.lotNumber || reel.materialId} 릴 잔량(${reel.remainingQty.toLocaleString('ko-KR')})을 초과합니다.`,
    )
  }
  await setReelRemaining(reel.id, reel.remainingQty - qty, reel.quantity)
}

export async function restoreReelsForOutboundLines(
  lines: { inbound_line_id?: string | null; quantity: number }[],
  outboundType: string,
) {
  const linked = lines.filter((line) => line.inbound_line_id)
  if (!linked.length) return

  const supabase = createSupabaseClient()
  for (const line of linked) {
    const inboundLineId = String(line.inbound_line_id)
    const { data, error } = await supabase
      .from('material_inbound_lines')
      .select('id, quantity, remaining_qty')
      .eq('id', inboundLineId)
      .maybeSingle()
    if (error) {
      if (isMissingReelRemainingColumn(error.message)) throw new Error(REEL_MIGRATION_HINT)
      throw new Error(error.message)
    }
    if (!data?.id) continue
    const original = Number(data.quantity) || 0
    const remaining = Number(data.remaining_qty) || 0
    const qty = Math.max(0, Number(line.quantity) || 0)
    const next = outboundType === 'restock' ? remaining - qty : remaining + qty
    await setReelRemaining(inboundLineId, next, original)
  }
}

export async function allocateFifoReelLines(
  items: { material_id: string; quantity: number; inbound_line_id?: string | null; lot_number?: string }[],
): Promise<AllocatedReelLine[]> {
  const materialIds = items.map((item) => item.material_id)
  const reels = await fetchReelsByMaterialIds(materialIds)
  const remainingById = new Map(reels.map((reel) => [reel.id, reel.remainingQty]))
  const allocated: AllocatedReelLine[] = []

  try {
  for (const item of items) {
    let need = Math.max(0, Number(item.quantity) || 0)
    if (need <= 0) continue

    if (item.inbound_line_id) {
      const reel = reels.find((row) => row.id === item.inbound_line_id)
      if (!reel) throw new Error('지정한 릴을 찾을 수 없습니다.')
      const available = remainingById.get(reel.id) ?? 0
      if (need > available) {
        throw new Error(
          `${reel.lotNumber || reel.materialId} 릴 잔량이 부족합니다. (잔량 ${available.toLocaleString('ko-KR')})`,
        )
      }
      await consumeReelQty({ ...reel, remainingQty: available }, need)
      remainingById.set(reel.id, available - need)
      allocated.push({
        material_id: item.material_id,
        quantity: need,
        lot_number: reel.lotNumber,
        inbound_line_id: reel.id,
      })
      continue
    }

    const fifo = reels
      .filter((reel) => reel.materialId === item.material_id)
      .sort((a, b) => {
        const dateCompare = a.inboundDate.localeCompare(b.inboundDate)
        if (dateCompare !== 0) return dateCompare
        return a.createdAt.localeCompare(b.createdAt)
      })

    for (const reel of fifo) {
      if (need <= 0) break
      const available = remainingById.get(reel.id) ?? 0
      if (available <= 0) continue
      const take = Math.min(available, need)
      await consumeReelQty({ ...reel, remainingQty: available }, take)
      remainingById.set(reel.id, available - take)
      allocated.push({
        material_id: item.material_id,
        quantity: take,
        lot_number: reel.lotNumber,
        inbound_line_id: reel.id,
      })
      need -= take
    }

    if (need > 0) {
      throw new Error(
        `${item.material_id} 릴 잔량이 부족합니다. (부족 ${need.toLocaleString('ko-KR')})`,
      )
    }
  }

    return allocated
  } catch (error) {
    await restoreReelsForOutboundLines(allocated, 'production')
    throw error
  }
}

async function insertOutboundRecord(input: {
  outboundDate: string
  outboundType: MaterialOutboundType
  orderId: string | null
  productId?: string | null
  note: string
  lines: AllocatedReelLine[]
  withCreatedBy: (row: Record<string, unknown>) => Promise<Record<string, unknown>>
  stripCreatedBy: (row: Record<string, unknown>) => Record<string, unknown>
  isMissingCreatedBy: (detail: string) => boolean
}): Promise<{ id: string }> {
  const supabase = createSupabaseClient()
  let headerRow: Record<string, unknown> = await input.withCreatedBy({
    outbound_date: input.outboundDate,
    outbound_type: input.outboundType,
    order_id: input.orderId,
    product_id: input.productId?.trim() || null,
    note: input.note,
  })

  let { data: inserted, error } = await supabase
    .from('material_outbound_records')
    .insert(headerRow)
    .select('id')
    .single()

  if (error && (input.isMissingCreatedBy(error.message) || error.message.includes('product_id'))) {
    headerRow = input.stripCreatedBy(headerRow)
    if (error.message.includes('product_id')) delete headerRow.product_id
    ;({ data: inserted, error } = await supabase
      .from('material_outbound_records')
      .insert(headerRow)
      .select('id')
      .single())
  }

  if (error || !inserted?.id) {
    throw new Error(error?.message || '불출 저장에 실패했습니다.')
  }

  const { error: linesError } = await supabase.from('material_outbound_lines').insert(
    input.lines.map((line, index) => ({
      outbound_id: inserted.id,
      line_seq: index,
      material_id: line.material_id,
      quantity: line.quantity,
      lot_number: line.lot_number,
      inbound_line_id: line.inbound_line_id,
    })),
  )

  if (linesError) {
    await restoreReelsForOutboundLines(input.lines, input.outboundType)
    await supabase.from('material_outbound_records').delete().eq('id', inserted.id)
    if (isMissingReelRemainingColumn(linesError.message) || linesError.message.includes('lot_number')) {
      throw new Error(REEL_MIGRATION_HINT)
    }
    throw new Error(linesError.message)
  }

  return { id: inserted.id }
}

export async function issueMaterialProductUnits(input: {
  orderId: string
  productId: string
  productName?: string
  bucketLabel?: string
  productQuantity: number
  units: number
  remainingProductQuantity: number
  issuableQuantity: number
  lines: { materialId: string; requiredQuantity: number; remainingQuantity: number }[]
  withCreatedBy: (row: Record<string, unknown>) => Promise<Record<string, unknown>>
  stripCreatedBy: (row: Record<string, unknown>) => Record<string, unknown>
  isMissingCreatedBy: (detail: string) => boolean
}): Promise<ReelMutationResult> {
  const orderId = input.orderId.trim()
  const productId = input.productId.trim()
  const productQty = Math.max(0, Number(input.productQuantity) || 0)
  const units = Math.floor(Number(input.units) || 0)
  const remaining = Math.max(0, Math.floor(Number(input.remainingProductQuantity) || 0))
  const issuable = Math.max(0, Math.floor(Number(input.issuableQuantity) || 0))

  if (!orderId) return { ok: false, reason: 'validation', detail: '주문이 없습니다.' }
  if (!productId) return { ok: false, reason: 'validation', detail: '제품이 없습니다.' }
  if (productQty <= 0) return { ok: false, reason: 'validation', detail: '주문 대수가 없습니다.' }
  if (units < 1) return { ok: false, reason: 'validation', detail: '이번 불출 대수를 입력하세요.' }
  if (units > remaining) {
    return {
      ok: false,
      reason: 'validation',
      detail: `소요잔량(${remaining.toLocaleString('ko-KR')}대)을 초과할 수 없습니다.`,
    }
  }
  if (issuable <= 0) {
    return { ok: false, reason: 'validation', detail: '지금 재고로는 불출할 수 없습니다.' }
  }
  if (units > issuable) {
    return {
      ok: false,
      reason: 'validation',
      detail: `불출가능(${issuable.toLocaleString('ko-KR')}대)을 초과할 수 없습니다.`,
    }
  }

  const items = input.lines
    .map((line) => {
      const required = Math.max(0, Number(line.requiredQuantity) || 0)
      const leftover = Math.max(0, Number(line.remainingQuantity) || 0)
      const quantity = (required * units) / productQty
      return {
        material_id: line.materialId.trim(),
        quantity,
        leftover,
      }
    })
    .filter((item) => item.material_id && item.quantity > 0)

  if (!items.length) {
    return { ok: false, reason: 'validation', detail: '이 대수에 해당하는 자재 소요가 없습니다.' }
  }

  for (const item of items) {
    if (item.quantity > item.leftover + 1e-6) {
      return {
        ok: false,
        reason: 'validation',
        detail: `${item.material_id} 잔량(${item.leftover.toLocaleString('ko-KR')})을 초과합니다.`,
      }
    }
  }

  try {
    const allocated = await allocateFifoReelLines(
      items.map((item) => ({ material_id: item.material_id, quantity: item.quantity })),
    )
    try {
      const inserted = await insertOutboundRecord({
        outboundDate: todayYmdSeoul(),
        outboundType: 'production',
        orderId,
        productId,
        note: [input.productName, input.bucketLabel, `${units}대`].filter(Boolean).join(' · '),
        lines: allocated,
        withCreatedBy: input.withCreatedBy,
        stripCreatedBy: input.stripCreatedBy,
        isMissingCreatedBy: input.isMissingCreatedBy,
      })
      return {
        ok: true,
        outboundId: inserted.id,
        outboundNumber: inserted.id,
        message: `${units.toLocaleString('ko-KR')}대분 불출`,
      }
    } catch (error) {
      await restoreReelsForOutboundLines(allocated, 'production').catch(() => undefined)
      throw error
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export type ReelPreviewResult =
  | {
      ok: true
      reelId: string
      materialId: string
      lotNumber: string
      remainingQty: number
    }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

async function matchWarehouseReel(input: {
  allowedMaterialIds: string[]
  scanCode: string
}): Promise<ReelPreviewResult> {
  const scan = input.scanCode.trim()
  if (!scan) return { ok: false, reason: 'validation', detail: '릴 바코드 또는 LOT를 스캔하세요.' }

  const allowed = [...new Set(input.allowedMaterialIds.filter(Boolean))]
  const reels = await fetchReelsByMaterialIds(allowed)
  const warehouse = reels.filter((reel) => reel.remainingQty > 0 && reel.locationStatus === 'warehouse')
  let matched = findReelsByScan(warehouse, scan)

  if (!matched.length) {
    const materialsResult = await fetchMaterials()
    if (materialsResult.ok) {
      const material = resolveMaterialByInventoryCode(materialsResult.materials, scan)
      if (material && allowed.includes(material.id)) {
        const fefo = pickFefoWarehouseReel(warehouse, material.id)
        if (fefo) matched = [fefo]
      }
    }
  }

  if (matched.length > 1) {
    return { ok: false, reason: 'validation', detail: '같은 LOT 릴이 여러 개입니다. 내부 LOT를 스캔하세요.' }
  }
  const reel = matched[0]
  if (!reel) {
    return { ok: false, reason: 'validation', detail: '창고에 있는 릴을 찾지 못했습니다.' }
  }
  if (!allowed.includes(reel.materialId)) {
    return { ok: false, reason: 'validation', detail: '이 주문·공정 소요에 없는 자재입니다.' }
  }

  return {
    ok: true,
    reelId: reel.id,
    materialId: reel.materialId,
    lotNumber: reel.lotNumber,
    remainingQty: reel.remainingQty,
  }
}

export async function previewMaterialReel(input: {
  allowedMaterialIds: string[]
  scanCode: string
}): Promise<ReelPreviewResult> {
  try {
    return await matchWarehouseReel(input)
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

type IssueReelAuth = {
  withCreatedBy: (row: Record<string, unknown>) => Promise<Record<string, unknown>>
  stripCreatedBy: (row: Record<string, unknown>) => Record<string, unknown>
  isMissingCreatedBy: (detail: string) => boolean
}

export async function issueMaterialReels(
  input: {
    orderId: string
    productId?: string
    allowedMaterialIds: string[]
    scanCodes: string[]
    productName?: string
    bucketLabel?: string
  } & IssueReelAuth,
): Promise<ReelMutationResult> {
  const codes = [...new Set(input.scanCodes.map((code) => code.trim()).filter(Boolean))]
  if (!codes.length) return { ok: false, reason: 'validation', detail: '릴 바코드 또는 LOT를 스캔하세요.' }
  if (!input.orderId.trim()) {
    return { ok: false, reason: 'validation', detail: '주문이 없습니다.' }
  }

  const allocated: AllocatedReelLine[] = []
  try {
    for (const scan of codes) {
      const matched = await matchWarehouseReel({
        allowedMaterialIds: input.allowedMaterialIds,
        scanCode: scan,
      })
      if (!matched.ok) return matched
      if (allocated.some((line) => line.inbound_line_id === matched.reelId)) {
        return { ok: false, reason: 'validation', detail: '같은 릴을 두 번 담았습니다.' }
      }
      const reels = await fetchReelsByMaterialIds([matched.materialId])
      const reel = reels.find((item) => item.id === matched.reelId)
      if (!reel || reel.remainingQty <= 0 || reel.locationStatus !== 'warehouse') {
        return { ok: false, reason: 'validation', detail: '창고에 있는 릴을 찾지 못했습니다.' }
      }
      const qty = reel.remainingQty
      await consumeReelQty(reel, qty)
      allocated.push({
        material_id: reel.materialId,
        quantity: qty,
        lot_number: reel.lotNumber,
        inbound_line_id: reel.id,
      })
    }

    const inserted = await insertOutboundRecord({
      outboundDate: todayYmdSeoul(),
      outboundType: 'production',
      orderId: input.orderId,
      productId: input.productId,
      note: [input.productName, input.bucketLabel, `릴 ${allocated.length}건`].filter(Boolean).join(' · '),
      lines: allocated,
      withCreatedBy: input.withCreatedBy,
      stripCreatedBy: input.stripCreatedBy,
      isMissingCreatedBy: input.isMissingCreatedBy,
    })
    return {
      ok: true,
      outboundId: inserted.id,
      outboundNumber: inserted.id,
      message: `릴 ${allocated.length.toLocaleString('ko-KR')}건 불출`,
    }
  } catch (error) {
    if (allocated.length) {
      await restoreReelsForOutboundLines(allocated, 'production').catch(() => undefined)
    }
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function issueMaterialReel(
  input: {
    orderId: string
    productId?: string
    allowedMaterialIds: string[]
    scanCode: string
    productName?: string
    bucketLabel?: string
  } & IssueReelAuth,
): Promise<ReelMutationResult> {
  return issueMaterialReels({ ...input, scanCodes: [input.scanCode] })
}

export async function restockMaterialReel(input: {
  orderId: string
  productId?: string
  allowedMaterialIds: string[]
  scanCode: string
  leftoverQty: number
  productName?: string
  withCreatedBy: (row: Record<string, unknown>) => Promise<Record<string, unknown>>
  stripCreatedBy: (row: Record<string, unknown>) => Record<string, unknown>
  isMissingCreatedBy: (detail: string) => boolean
}): Promise<ReelMutationResult> {
  const scan = input.scanCode.trim()
  const leftover = Math.floor(Number(input.leftoverQty) || 0)
  if (!scan) return { ok: false, reason: 'validation', detail: '반납할 릴을 스캔하세요.' }
  if (leftover < 1) {
    return { ok: false, reason: 'validation', detail: '반납 수량을 입력하세요.' }
  }

  try {
    const allowed = [...new Set(input.allowedMaterialIds.filter(Boolean))]
    const reels = await fetchReelsByMaterialIds(allowed)
    const onLine = reels.filter(
      (reel) => reel.locationStatus === 'line' && reel.remainingQty === 0 && reel.quantity > 0,
    )
    const matched = findReelsByScan(onLine, scan)
    if (matched.length > 1) {
      return { ok: false, reason: 'validation', detail: '같은 LOT 릴이 여러 개입니다. 내부 LOT를 스캔하세요.' }
    }
    const reel = matched[0]
    if (!reel) {
      return {
        ok: false,
        reason: 'validation',
        detail: '라인에 지급된 릴을 찾지 못했습니다. 창고에 있으면 지급 스캔을 먼저 하세요.',
      }
    }
    if (leftover > reel.quantity) {
      return {
        ok: false,
        reason: 'validation',
        detail: `반납 수량이 릴 수량(${reel.quantity.toLocaleString('ko-KR')})을 초과합니다.`,
      }
    }

    await setReelRemaining(reel.id, leftover, reel.quantity)
    try {
      const inserted = await insertOutboundRecord({
        outboundDate: todayYmdSeoul(),
        outboundType: 'restock',
        orderId: input.orderId,
        productId: input.productId,
        note: [input.productName, '잔량반납', reel.lotNumber].filter(Boolean).join(' · '),
        lines: [
          {
            material_id: reel.materialId,
            quantity: leftover,
            lot_number: reel.lotNumber,
            inbound_line_id: reel.id,
          },
        ],
        withCreatedBy: input.withCreatedBy,
        stripCreatedBy: input.stripCreatedBy,
        isMissingCreatedBy: input.isMissingCreatedBy,
      })
      return {
        ok: true,
        outboundId: inserted.id,
        outboundNumber: inserted.id,
        message: `${reel.lotNumber || reel.materialId} ${leftover.toLocaleString('ko-KR')} 반납`,
      }
    } catch (error) {
      await setReelRemaining(reel.id, 0, reel.quantity)
      throw error
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
