import type { ItemProductionStd } from '@/lib/items/production-std'
import type { SmtPcbBoard } from '@/lib/quotes/types'
import type { SmtPcbSide } from '@/lib/smt/types'

/** 1대당 실장 점수 출처 — BOM 우선, 없으면 견적 */
export type SmtPointsSource = 'bom' | 'quote'

export type SmtOrderLinePoints = {
  /** 1대(양면이면 TOP+BOT) 실장 점수 */
  pointsPerUnit: number
  pointsTop: number
  pointsBot: number
  source: SmtPointsSource
}

export type SmtLineCapacity = {
  lineNo: number
  name: string
  /** 사용중 마운터 사양 CPH 합계 */
  ratedCph: number
  mounterCount: number
}

export type BomPointsLine = {
  childProductId: string
  quantityPer: number
  /** bom_items.process 정규화 값 */
  process: '' | 'smd' | 'dip'
}

/**
 * BOM 1대당 SMD 실장 점수.
 * 공정이 SMD인 줄 + 공정 미지정이면서 자재 구분이 SMD인 줄의 수량 합 (DIP 제외).
 */
export function computeBomSmdPoints(
  lines: BomPointsLine[],
  materialTypeById: Map<string, string>,
): number {
  let total = 0
  for (const line of lines) {
    const qty = Math.max(0, Number(line.quantityPer) || 0)
    if (qty <= 0) continue
    if (line.process === 'smd') {
      total += qty
      continue
    }
    if (line.process === '' && materialTypeById.get(line.childProductId) === 'SMD') {
      total += qty
    }
  }
  return Math.round(total)
}

/** 견적 보드 실장 점수 — IC 핀·BGA 볼은 실장 횟수가 아니라 제외 */
export function quoteBoardPlacementPoints(
  board: Pick<SmtPcbBoard, 'chip' | 'smtOdd' | 'smtSpecial'>,
): number {
  return Math.max(
    0,
    Math.round(
      (Number(board.chip) || 0) + (Number(board.smtOdd) || 0) + (Number(board.smtSpecial) || 0),
    ),
  )
}

/** 양면 품목 — 종수 비율로 TOP/BOT 점수 분배 (종수 없으면 반반) */
export function splitPointsBySide(
  pointsPerUnit: number,
  splitPcbSides: boolean,
  std: ItemProductionStd | null | undefined,
): Pick<SmtOrderLinePoints, 'pointsTop' | 'pointsBot'> {
  if (!splitPcbSides) return { pointsTop: pointsPerUnit, pointsBot: 0 }
  const top = Math.max(0, Number(std?.partCountTop) || 0)
  const bot = Math.max(0, Number(std?.partCountBot) || 0)
  const ratio = top + bot > 0 ? top / (top + bot) : 0.5
  const pointsTop = Math.round(pointsPerUnit * ratio)
  return { pointsTop, pointsBot: Math.max(0, pointsPerUnit - pointsTop) }
}

export function pointsForSide(points: SmtOrderLinePoints, side: SmtPcbSide) {
  if (side === 'TOP') return points.pointsTop
  if (side === 'BOT') return points.pointsBot
  return points.pointsPerUnit
}

export type SmtLineDayEfficiency = {
  lineNo: number
  ymd: string
  producedQty: number
  points: number
  /** 사양 CPH × 가동시간 */
  capacityPoints: number
  /** 실적 점수 ÷ 능력 점수 (%) — 사양 CPH 미등록이면 null */
  percent: number | null
  /** 1대당 점수를 몰라 점수에서 빠진 수량 */
  missingPointsQty: number
  sources: SmtPointsSource[]
}

export function smtLineDayKey(lineNo: number, ymd: string) {
  return `${ymd}:${lineNo}`
}

/** progress 키(일자:주문라인:면:라인) → 라인·일자별 실적 점수와 사양 CPH 대비 효율 */
export function summarizeSmtLineDayEfficiency(input: {
  progress: Record<string, number>
  pointsByOrderLine: Record<string, SmtOrderLinePoints>
  capacities: SmtLineCapacity[]
  dayHours: number
}): Map<string, SmtLineDayEfficiency> {
  const capacityByLine = new Map(input.capacities.map((entry) => [entry.lineNo, entry]))
  const result = new Map<string, SmtLineDayEfficiency>()

  for (const [key, rawQty] of Object.entries(input.progress)) {
    const [ymd, orderLineId, sideRaw, lineNoRaw] = key.split(':')
    const lineNo = Math.floor(Number(lineNoRaw) || 0)
    const qty = Math.max(0, Math.floor(Number(rawQty) || 0))
    if (!ymd || !orderLineId || lineNo < 1 || qty <= 0) continue
    const side: SmtPcbSide = sideRaw === 'TOP' || sideRaw === 'BOT' ? sideRaw : 'SINGLE'

    const dayKey = smtLineDayKey(lineNo, ymd)
    let entry = result.get(dayKey)
    if (!entry) {
      const ratedCph = capacityByLine.get(lineNo)?.ratedCph ?? 0
      entry = {
        lineNo,
        ymd,
        producedQty: 0,
        points: 0,
        capacityPoints: Math.round(ratedCph * input.dayHours),
        percent: null,
        missingPointsQty: 0,
        sources: [],
      }
      result.set(dayKey, entry)
    }

    entry.producedQty += qty
    const points = input.pointsByOrderLine[orderLineId]
    const perUnit = points ? pointsForSide(points, side) : 0
    if (!points || perUnit <= 0) {
      entry.missingPointsQty += qty
      continue
    }
    entry.points += qty * perUnit
    if (!entry.sources.includes(points.source)) entry.sources.push(points.source)
  }

  for (const entry of result.values()) {
    entry.percent =
      entry.capacityPoints > 0 && entry.points > 0
        ? Math.round((entry.points / entry.capacityPoints) * 100)
        : null
  }
  return result
}

export function formatSmtPoints(points: number) {
  return Math.round(points).toLocaleString('ko-KR')
}
