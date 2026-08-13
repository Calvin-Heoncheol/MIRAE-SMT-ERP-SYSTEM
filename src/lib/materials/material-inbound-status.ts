import type { BomEdge } from '@/lib/materials/outbound/types'
import { computeIssuableProductQuantity, explodeBomToMaterials } from '@/lib/materials/outbound/utils'

/** 주문/계획 카드용 자재 입고 상태 */
export type MaterialInboundStatus = 'ready' | 'scheduled' | 'missing' | 'no_bom'

export type MaterialInboundStatusInfo = {
  status: MaterialInboundStatus
  /** YYYY-MM-DD — 입고예정일 때 병목(최만기) 납기. 없으면 null */
  expectedReadyDate: string | null
  /** 현재고만으로 만들 수 있는 대수 (요청 잔량 상한) */
  readyUnits: number
  /** 현재고+입고예정으로 만들 수 있는 대수 (요청 잔량 상한) */
  scheduledUnits: number
}

export const MATERIAL_INBOUND_STATUS_LABELS: Record<MaterialInboundStatus, string> = {
  ready: '입고완료',
  scheduled: '입고예정',
  missing: '발주필요',
  no_bom: 'BOM없음',
}

/** 뱃지용: 입고예정이면 날짜 포함 (예: 입고예정(3/18)) */
export function formatMaterialInboundStatusLabel(info: MaterialInboundStatusInfo): string {
  if (info.status === 'scheduled') {
    const short = formatInboundReadyDateShort(info.expectedReadyDate)
    return short ? `입고예정(${short})` : MATERIAL_INBOUND_STATUS_LABELS.scheduled
  }
  return MATERIAL_INBOUND_STATUS_LABELS[info.status]
}

/**
 * SMT 생산계획 카드용 3종 문구:
 * 미발주 / 입고예정 N대분 / 입고완료 N대분
 */
export function formatSmtPlanMaterialStatusLabel(info: MaterialInboundStatusInfo): string {
  if (info.status === 'ready') {
    const n = Math.max(0, Math.floor(info.readyUnits || 0))
    return `입고완료 ${n.toLocaleString('ko-KR')}대분`
  }
  if (info.status === 'scheduled') {
    const n = Math.max(0, Math.floor(info.scheduledUnits || 0))
    return `입고예정 ${n.toLocaleString('ko-KR')}대분`
  }
  if (info.status === 'missing') return '미발주'
  return MATERIAL_INBOUND_STATUS_LABELS.no_bom
}

/** YYYY-MM-DD → M/D */
export function formatInboundReadyDateShort(value: string | null | undefined) {
  if (!value) return ''
  const match = String(value).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!match) return ''
  return `${Number(match[2])}/${Number(match[3])}`
}

export function buildBomEdgesByParent(bomEdges: BomEdge[]) {
  const edgesByParent = new Map<string, BomEdge[]>()
  for (const edge of bomEdges) {
    if (!edge.parentProductId) continue
    const list = edgesByParent.get(edge.parentProductId) || []
    list.push(edge)
    edgesByParent.set(edge.parentProductId, list)
  }
  return edgesByParent
}

function mergeStockWithPending(
  onHandByMaterialId: Map<string, number>,
  pendingInboundByMaterialId: Map<string, number>,
) {
  const combined = new Map(onHandByMaterialId)
  for (const [materialId, pending] of pendingInboundByMaterialId) {
    if (pending <= 0) continue
    combined.set(materialId, (combined.get(materialId) ?? 0) + pending)
  }
  return combined
}

function normalizeDeliveryYmd(value: string | null | undefined) {
  if (!value) return null
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

/**
 * 현재고가 부족한 자재들만 보고, 해당 자재 미입고 라인의 최만기 납기를 병목일로 잡는다.
 */
export function resolveBottleneckDeliveryDate(
  productId: string,
  remainingQty: number,
  edgesByParent: Map<string, BomEdge[]>,
  onHandByMaterialId: Map<string, number>,
  latestDeliveryDateByMaterialId: Map<string, string>,
): string | null {
  const required = explodeBomToMaterials(productId, remainingQty, edgesByParent)
  let maxDate: string | null = null

  for (const [materialId, need] of required) {
    const onHand = onHandByMaterialId.get(materialId) ?? 0
    if (onHand >= need) continue

    const date = normalizeDeliveryYmd(latestDeliveryDateByMaterialId.get(materialId))
    if (!date) continue
    if (!maxDate || date > maxDate) maxDate = date
  }

  return maxDate
}

/**
 * BOM 소요(잔여 생산수량) vs 현재고 / 발주 미입고 잔량.
 * - 입고완료: 현재고만으로 충족
 * - 입고예정: 현재고+입고예정으로 충족 (병목 납기 포함)
 * - 발주필요: 그래도 부족
 * - BOM없음: 전개 자재 없음
 */
export function resolveMaterialInboundStatus(
  productId: string,
  remainingQty: number,
  edgesByParent: Map<string, BomEdge[]>,
  onHandByMaterialId: Map<string, number>,
  pendingInboundByMaterialId: Map<string, number>,
  latestDeliveryDateByMaterialId: Map<string, string> = new Map(),
): MaterialInboundStatusInfo {
  const id = productId.trim()
  const qty = Math.max(0, Math.floor(remainingQty))
  if (!id) {
    return { status: 'no_bom', expectedReadyDate: null, readyUnits: 0, scheduledUnits: 0 }
  }

  const materialsPerOne = explodeBomToMaterials(id, 1, edgesByParent)
  if (!materialsPerOne.size) {
    return { status: 'no_bom', expectedReadyDate: null, readyUnits: 0, scheduledUnits: 0 }
  }

  if (qty <= 0) {
    return { status: 'ready', expectedReadyDate: null, readyUnits: 0, scheduledUnits: 0 }
  }

  const readyUnits = computeIssuableProductQuantity(id, qty, edgesByParent, onHandByMaterialId)
  const combined = mergeStockWithPending(onHandByMaterialId, pendingInboundByMaterialId)
  const scheduledUnits = computeIssuableProductQuantity(id, qty, edgesByParent, combined)

  if (readyUnits >= qty) {
    return { status: 'ready', expectedReadyDate: null, readyUnits, scheduledUnits }
  }

  if (scheduledUnits >= qty) {
    return {
      status: 'scheduled',
      expectedReadyDate: resolveBottleneckDeliveryDate(
        id,
        qty,
        edgesByParent,
        onHandByMaterialId,
        latestDeliveryDateByMaterialId,
      ),
      readyUnits,
      scheduledUnits,
    }
  }

  return {
    status: 'missing',
    expectedReadyDate: null,
    readyUnits,
    scheduledUnits,
  }
}

/**
 * 계획 수량 기본값: 현재고로 가능한 대수분이 있으면 그 값(부분 배치),
 * 없으면 미배정 전량(직접 줄여 분할).
 */
export function suggestPlanQuantityFromMaterial(maxQuantity: number, readyUnits: number) {
  const max = Math.max(0, Math.floor(maxQuantity))
  if (max < 1) return 1
  const ready = Math.max(0, Math.floor(readyUnits))
  if (ready > 0) return Math.min(ready, max)
  return max
}
