import type { Material } from '@/lib/materials/types'

/** 할당 행 (DB / 계산 공통) */
export type MaterialOrderAllocation = {
  orderId: string
  materialId: string
  requiredQty: number
  reservedQty: number
  issuedQty: number
}

export type MaterialAtpLine = {
  orderId: string
  materialId: string
  requiredQty: number
  issuedQty: number
  /** 이 주문에 남은 소요 = max(0, required - issued) */
  remainingNeed: number
  /** 이 주문 전용 입고예정 (주문 연동 PO) */
  pendingInboundQty: number
  /** 공용고에서 이 주문이 선점한 예약 */
  reservedQty: number
  /** 이 주문에 지금 불출/소진 가능한 수량 */
  availableQty: number
  /** 구매 필요 = remainingNeed - reserved - pendingInbound */
  shortageQty: number
}

export type MaterialInventoryAtpSummary = {
  materialId: string
  onHandQty: number
  safetyStockQty: number
  reservedQty: number
  /** 미예약 가용 = max(0, onHand - safety - reserved) */
  freeQty: number
  availableQty: number
}

function qty(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

/**
 * 안전재고를 ATP 풀에서 뺄지 — MTO에서는 공통/미분류(소모품)만 버퍼로 유지.
 * SMD/DIP 원자재는 주문 소요에 전부 개방.
 */
export function safetyStockForAtp(material: Pick<Material, 'type' | 'safetyStock'> | null | undefined) {
  if (!material) return 0
  const type = String(material.type || '').trim().toUpperCase()
  if (type === 'SMD' || type === 'DIP') return 0
  return qty(material.safetyStock)
}

/**
 * 주문 우선순위 — 납기 빠른 순, 동률이면 주문번호.
 */
export function compareOrdersForAtpPriority(
  a: { orderId: string; deliveryDate?: string; orderNumber?: string },
  b: { orderId: string; deliveryDate?: string; orderNumber?: string },
) {
  const deliveryCompare = String(a.deliveryDate || '').localeCompare(String(b.deliveryDate || ''))
  if (deliveryCompare !== 0) return deliveryCompare
  return String(a.orderNumber || a.orderId).localeCompare(String(b.orderNumber || b.orderId), 'ko')
}

/**
 * 동일 주문 안에서만 대체 자재로 부족분을 메울 때 사용.
 * alternateMaterialIds: 주자재와 같은 주문 소요에 묶인 대체 품목 ID.
 * freeByMaterial: 자재별 미예약 가용(또는 같은 주문 여유).
 */
export function coverShortageWithOrderAlternates(input: {
  shortageQty: number
  alternateMaterialIds: string[]
  freeByMaterialId: Map<string, number>
}): { coveredQty: number; consumedByMaterialId: Map<string, number> } {
  let left = qty(input.shortageQty)
  const consumedByMaterialId = new Map<string, number>()
  if (left <= 0) return { coveredQty: 0, consumedByMaterialId }

  for (const materialId of input.alternateMaterialIds) {
    if (left <= 0) break
    const id = materialId.trim()
    if (!id) continue
    const free = qty(input.freeByMaterialId.get(id))
    if (free <= 0) continue
    const take = Math.min(left, free)
    consumedByMaterialId.set(id, take)
    input.freeByMaterialId.set(id, free - take)
    left -= take
  }

  return { coveredQty: qty(input.shortageQty) - left, consumedByMaterialId }
}

/**
 * 공용 현재고를 주문 우선순위로 소프트 예약 배분.
 * pendingInboundByOrderMaterial key: `${orderId}::${materialId}`
 */
export function allocateSoftReservations(input: {
  /** orderId → materialId → required (BOM 총소요) */
  requiredByOrderMaterial: Map<string, Map<string, number>>
  /** orderId → materialId → 이미 불출 */
  issuedByOrderMaterial?: Map<string, Map<string, number>>
  onHandByMaterialId: Map<string, number>
  safetyStockByMaterialId?: Map<string, number>
  pendingInboundByOrderMaterial?: Map<string, number>
  orderPriority: Array<{ orderId: string; deliveryDate?: string; orderNumber?: string }>
  /** orderId → 주자재 ID → BOM 대체 품목 ID 목록 */
  alternatesByOrderMaterial?: Map<string, Map<string, string[]>>
}): MaterialOrderAllocation[] {
  const issuedMap = input.issuedByOrderMaterial || new Map()
  const pendingMap = input.pendingInboundByOrderMaterial || new Map()
  const safetyMap = input.safetyStockByMaterialId || new Map()
  const alternatesMap = input.alternatesByOrderMaterial || new Map()

  const materialIds = new Set<string>()
  for (const byMaterial of input.requiredByOrderMaterial.values()) {
    for (const materialId of byMaterial.keys()) materialIds.add(materialId)
  }
  for (const byPrimary of alternatesMap.values()) {
    for (const alts of byPrimary.values()) for (const altId of alts) materialIds.add(altId)
  }

  const poolByMaterial = new Map<string, number>()
  for (const materialId of materialIds) {
    const onHand = qty(input.onHandByMaterialId.get(materialId))
    const safety = qty(safetyMap.get(materialId))
    poolByMaterial.set(materialId, Math.max(0, onHand - safety))
  }

  const sortedOrders = [...input.orderPriority].sort(compareOrdersForAtpPriority)
  const rows: MaterialOrderAllocation[] = []

  for (const order of sortedOrders) {
    const requiredByMaterial = input.requiredByOrderMaterial.get(order.orderId)
    if (!requiredByMaterial) continue

    for (const [materialId, requiredRaw] of requiredByMaterial) {
      const requiredQty = qty(requiredRaw)
      const issuedQty = qty(issuedMap.get(order.orderId)?.get(materialId))
      const remainingNeed = Math.max(0, requiredQty - issuedQty)
      const pending = qty(pendingMap.get(`${order.orderId}::${materialId}`))
      const needFromStock = Math.max(0, remainingNeed - pending)
      const pool = qty(poolByMaterial.get(materialId))
      const reservedQty = Math.min(needFromStock, pool)
      poolByMaterial.set(materialId, pool - reservedQty)

      rows.push({
        orderId: order.orderId,
        materialId,
        requiredQty,
        reservedQty,
        issuedQty,
      })
    }
  }

  if (alternatesMap.size) {
    coverShortagesWithBomAlternates({
      rows,
      sortedOrders,
      alternatesMap,
      issuedMap,
      pendingMap,
      poolByMaterial,
    })
  }

  return rows
}

/**
 * BOM 대체 — 모든 주문의 주자재 예약이 끝난 뒤 남은 부족분을 대체 품목으로 메움.
 * 1) 이 주문에서 대체 품목을 자체 소요보다 더 불출했으면 주자재 불출로 인정
 * 2) 그래도 부족하면 대체 품목의 미예약 재고를 납기 우선으로 예약
 * 대체로 넘긴 수량만큼 주자재 required 를 줄이고 대체 행 required 에 더함 (구매 이중계산 방지).
 */
function coverShortagesWithBomAlternates(input: {
  rows: MaterialOrderAllocation[]
  sortedOrders: Array<{ orderId: string }>
  alternatesMap: Map<string, Map<string, string[]>>
  issuedMap: Map<string, Map<string, number>>
  pendingMap: Map<string, number>
  poolByMaterial: Map<string, number>
}) {
  const rowByKey = new Map(input.rows.map((row) => [`${row.orderId}::${row.materialId}`, row]))

  function ensureRow(orderId: string, materialId: string) {
    const key = `${orderId}::${materialId}`
    let row = rowByKey.get(key)
    if (!row) {
      row = {
        orderId,
        materialId,
        requiredQty: 0,
        reservedQty: 0,
        issuedQty: qty(input.issuedMap.get(orderId)?.get(materialId)),
      }
      rowByKey.set(key, row)
      input.rows.push(row)
    }
    return row
  }

  for (const order of input.sortedOrders) {
    const byPrimary = input.alternatesMap.get(order.orderId)
    if (!byPrimary) continue

    for (const [primaryId, alts] of byPrimary) {
      const primary = rowByKey.get(`${order.orderId}::${primaryId}`)
      if (!primary) continue

      const pending = qty(input.pendingMap.get(`${order.orderId}::${primaryId}`))
      let short = Math.max(
        0,
        primary.requiredQty - primary.issuedQty - primary.reservedQty - pending,
      )

      for (const altId of alts) {
        if (short <= 0) break
        if (!altId || altId === primaryId) continue
        const alt = ensureRow(order.orderId, altId)

        const excessIssued = Math.max(0, alt.issuedQty - alt.requiredQty)
        const credit = Math.min(short, excessIssued)
        if (credit > 0) {
          primary.requiredQty -= credit
          alt.requiredQty += credit
          short -= credit
        }
        if (short <= 0) break

        const pool = qty(input.poolByMaterial.get(altId))
        const take = Math.min(short, pool)
        if (take > 0) {
          input.poolByMaterial.set(altId, pool - take)
          primary.requiredQty -= take
          alt.requiredQty += take
          alt.reservedQty += take
          short -= take
        }
      }
    }
  }

  // 대체로 연결만 되고 소요·불출·예약이 없는 행은 저장하지 않음
  for (let index = input.rows.length - 1; index >= 0; index -= 1) {
    const row = input.rows[index]!
    if (row.requiredQty <= 0 && row.issuedQty <= 0 && row.reservedQty <= 0) {
      input.rows.splice(index, 1)
    }
  }
}

/** 할당 행 → 주문별 ATP 라인 */
export function buildAtpLinesFromAllocations(input: {
  allocations: MaterialOrderAllocation[]
  pendingInboundByOrderMaterial?: Map<string, number>
}): MaterialAtpLine[] {
  const pendingMap = input.pendingInboundByOrderMaterial || new Map()
  return input.allocations.map((row) => {
    const remainingNeed = Math.max(0, qty(row.requiredQty) - qty(row.issuedQty))
    const pendingInboundQty = qty(pendingMap.get(`${row.orderId}::${row.materialId}`))
    const reservedQty = qty(row.reservedQty)
    const availableQty = Math.min(remainingNeed, reservedQty + pendingInboundQty)
    const shortageQty = Math.max(0, remainingNeed - reservedQty - pendingInboundQty)
    return {
      orderId: row.orderId,
      materialId: row.materialId,
      requiredQty: qty(row.requiredQty),
      issuedQty: qty(row.issuedQty),
      remainingNeed,
      pendingInboundQty,
      reservedQty,
      availableQty,
      shortageQty,
    }
  })
}

/** 재고현황용 자재별 예약/가용 요약 */
export function summarizeInventoryAtp(input: {
  materialIds: string[]
  onHandByMaterialId: Map<string, number>
  safetyStockByMaterialId?: Map<string, number>
  allocations: MaterialOrderAllocation[]
}): MaterialInventoryAtpSummary[] {
  const reservedByMaterial = new Map<string, number>()
  for (const row of input.allocations) {
    const id = row.materialId.trim()
    if (!id) continue
    reservedByMaterial.set(id, (reservedByMaterial.get(id) ?? 0) + qty(row.reservedQty))
  }

  const safetyMap = input.safetyStockByMaterialId || new Map()
  return input.materialIds.map((materialId) => {
    const onHandQty = qty(input.onHandByMaterialId.get(materialId))
    const safetyStockQty = qty(safetyMap.get(materialId))
    const reservedQty = qty(reservedByMaterial.get(materialId))
    const freeQty = Math.max(0, onHandQty - safetyStockQty - reservedQty)
    return {
      materialId,
      onHandQty,
      safetyStockQty,
      reservedQty,
      freeQty,
      availableQty: freeQty,
    }
  })
}

export function atpAvailableForOrderMaterial(
  lines: MaterialAtpLine[],
  orderId: string,
  materialId: string,
) {
  const line = lines.find(
    (row) => row.orderId === orderId.trim() && row.materialId === materialId.trim(),
  )
  return line ? line.availableQty : 0
}

export function atpShortageByMaterial(lines: MaterialAtpLine[]) {
  const map = new Map<string, number>()
  for (const line of lines) {
    if (line.shortageQty <= 0) continue
    map.set(line.materialId, (map.get(line.materialId) ?? 0) + line.shortageQty)
  }
  return map
}

/**
 * 구매발주 제안 — 동일 주문 내 대체 자재 가용으로 부족을 줄일 때 사용.
 * alternateByPrimary: 주자재 ID → 대체 자재 ID 목록
 */
export function applyOrderAlternateCoverToAtpLines(
  lines: MaterialAtpLine[],
  alternateByPrimary: Map<string, string[]>,
): MaterialAtpLine[] {
  const freeByOrderMaterial = new Map<string, number>()
  for (const line of lines) {
    if (line.shortageQty <= 0 && line.availableQty > 0) {
      freeByOrderMaterial.set(
        `${line.orderId}::${line.materialId}`,
        (freeByOrderMaterial.get(`${line.orderId}::${line.materialId}`) ?? 0) + line.availableQty,
      )
    }
  }

  return lines.map((line) => {
    if (line.shortageQty <= 0) return line
    const alts = alternateByPrimary.get(line.materialId) || []
    if (!alts.length) return line

    const freeByMaterialId = new Map<string, number>()
    for (const altId of alts) {
      const key = `${line.orderId}::${altId}`
      freeByMaterialId.set(altId, freeByOrderMaterial.get(key) ?? 0)
    }

    const { coveredQty, consumedByMaterialId } = coverShortageWithOrderAlternates({
      shortageQty: line.shortageQty,
      alternateMaterialIds: alts,
      freeByMaterialId,
    })

    for (const [altId, taken] of consumedByMaterialId) {
      const key = `${line.orderId}::${altId}`
      freeByOrderMaterial.set(key, Math.max(0, (freeByOrderMaterial.get(key) ?? 0) - taken))
    }

    if (coveredQty <= 0) return line
    return {
      ...line,
      shortageQty: Math.max(0, line.shortageQty - coveredQty),
      availableQty: line.availableQty + coveredQty,
    }
  })
}
