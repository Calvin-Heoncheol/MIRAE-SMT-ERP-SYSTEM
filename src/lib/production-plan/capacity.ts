import {
  normalizeItemProductionStd,
  panelTechTimeToUnitSeconds,
  resolveItemArrayCount,
  type ItemProductionStd,
} from '@/lib/items/production-std'
import type { ProductPcbSideMode } from '@/lib/products/types'
import type { ProductionPlanBoardRow, ProductionPlanPcbSide } from '@/lib/production-plan/types'

/** 라인·팀 1일 기준 가동시간 (1단계 고정) */
export const PRODUCTION_PLAN_DAY_CAPACITY_HOURS = 8

const DAY_CAPACITY_SECONDS = PRODUCTION_PLAN_DAY_CAPACITY_HOURS * 3600

/** 종수 기반 셋업 — 기본 10분 + 종당 2분 (현장 대략치, 견적 SET-UP과 별도) */
const SETUP_BASE_SECONDS = 10 * 60
const SETUP_SECONDS_PER_PART = 2 * 60

export type PlanLoadEstimate = {
  quantity: number
  /** 장비 Tech Time (패널 1회 초) */
  panelTactTimeSec: number
  /** 패널당 PCB 수 */
  arrayCount: number
  /** 발주 1대당 초 = panelTactTimeSec / arrayCount */
  unitTactTimeSec: number
  partCount: number
  runSeconds: number
  setupSeconds: number
  totalSeconds: number
  /** Tech Time이 없어 시간 추정 불가 */
  missingStd: boolean
}

export type CellLoadSummary = {
  quantity: number
  totalSeconds: number
  hours: number
  percent: number
  overCapacity: boolean
  withStdCount: number
  missingStdCount: number
  quantityOnly: boolean
}

/** 장비 표시 Tech Time(패널 1회 초) — 면별 */
export function resolvePlanPanelTactTimeSec(
  std: ItemProductionStd | null | undefined,
  pcbSideMode: ProductPcbSideMode | string | null | undefined,
  pcbSide: ProductionPlanPcbSide | string | null | undefined,
): number {
  const normalized = normalizeItemProductionStd(std)
  const mode = String(pcbSideMode || 'single').toLowerCase()
  const side = String(pcbSide || 'SINGLE').toUpperCase()

  if (mode === 'double') {
    if (side === 'TOP') return normalized.tactTimeTopSec || normalized.tactTimeSec
    if (side === 'BOT') return normalized.tactTimeBotSec || normalized.tactTimeSec
    if (side === 'BOTH') {
      return (
        (normalized.tactTimeTopSec || normalized.tactTimeSec) +
        (normalized.tactTimeBotSec || normalized.tactTimeSec)
      )
    }
  }

  return normalized.tactTimeSec
}

/** @deprecated resolvePlanPanelTactTimeSec 사용 */
export function resolvePlanTactTimeSec(
  std: ItemProductionStd | null | undefined,
  pcbSideMode: ProductPcbSideMode | string | null | undefined,
  pcbSide: ProductionPlanPcbSide | string | null | undefined,
): number {
  return resolvePlanPanelTactTimeSec(std, pcbSideMode, pcbSide)
}

export function resolvePlanPartCount(
  std: ItemProductionStd | null | undefined,
  pcbSideMode: ProductPcbSideMode | string | null | undefined,
  pcbSide: ProductionPlanPcbSide | string | null | undefined,
): number {
  const normalized = normalizeItemProductionStd(std)
  const mode = String(pcbSideMode || 'single').toLowerCase()
  const side = String(pcbSide || 'SINGLE').toUpperCase()

  if (mode === 'double') {
    if (side === 'TOP') return normalized.partCountTop || normalized.partCount
    if (side === 'BOT') return normalized.partCountBot || normalized.partCount
    if (side === 'BOTH') {
      return (
        (normalized.partCountTop || normalized.partCount) +
        (normalized.partCountBot || normalized.partCount)
      )
    }
  }

  return normalized.partCount
}

export function estimatePlanLoad(input: {
  quantity: number
  /** 장비 Tech Time (패널 1회 초) */
  panelTactTimeSec: number
  arrayCount?: number
  partCount?: number
  includeSetup?: boolean
}): PlanLoadEstimate {
  const quantity = Math.max(0, Math.floor(Number(input.quantity) || 0))
  const panelTactTimeSec = Math.max(0, Math.floor(Number(input.panelTactTimeSec) || 0))
  const arrayCount = Math.max(1, Math.floor(Number(input.arrayCount) || 0) || 1)
  const partCount = Math.max(0, Math.floor(Number(input.partCount) || 0))
  const missingStd = panelTactTimeSec <= 0
  const unitTactTimeSec = missingStd
    ? 0
    : panelTechTimeToUnitSeconds(panelTactTimeSec, arrayCount)
  const runSeconds = missingStd ? 0 : quantity * unitTactTimeSec
  const includeSetup = input.includeSetup !== false && !missingStd && partCount > 0
  const setupSeconds = includeSetup
    ? SETUP_BASE_SECONDS + partCount * SETUP_SECONDS_PER_PART
    : 0

  return {
    quantity,
    panelTactTimeSec,
    arrayCount,
    unitTactTimeSec,
    partCount,
    runSeconds,
    setupSeconds,
    totalSeconds: runSeconds + setupSeconds,
    missingStd,
  }
}

export function estimateBoardRowLoad(
  row: Pick<
    ProductionPlanBoardRow,
    'plannedQuantity' | 'pcbSide' | 'pcbSideMode' | 'productionStd'
  >,
  quantityOverride?: number,
  pcbSideOverride?: ProductionPlanPcbSide,
): PlanLoadEstimate {
  const pcbSide = pcbSideOverride ?? row.pcbSide
  const quantity =
    quantityOverride != null
      ? quantityOverride
      : Math.max(0, Math.round(Number(row.plannedQuantity) || 0))
  const panelTactTimeSec = resolvePlanPanelTactTimeSec(
    row.productionStd,
    row.pcbSideMode,
    pcbSide,
  )
  const partCount = resolvePlanPartCount(row.productionStd, row.pcbSideMode, pcbSide)
  const arrayCount = resolveItemArrayCount(row.productionStd)
  return estimatePlanLoad({ quantity, panelTactTimeSec, arrayCount, partCount })
}

export function summarizeCellLoad(rows: ProductionPlanBoardRow[]): CellLoadSummary {
  return summarizeLoadEstimates(rows.map((row) => estimateBoardRowLoad(row)))
}

export function summarizeLoadEstimates(estimates: PlanLoadEstimate[]): CellLoadSummary {
  let quantity = 0
  let totalSeconds = 0
  let withStdCount = 0
  let missingStdCount = 0

  for (const estimate of estimates) {
    quantity += estimate.quantity
    if (estimate.missingStd) {
      missingStdCount += 1
    } else {
      withStdCount += 1
      totalSeconds += estimate.totalSeconds
    }
  }

  const hours = totalSeconds / 3600
  const percent =
    DAY_CAPACITY_SECONDS > 0 ? Math.round((totalSeconds / DAY_CAPACITY_SECONDS) * 100) : 0

  return {
    quantity,
    totalSeconds,
    hours,
    percent,
    overCapacity: withStdCount > 0 && totalSeconds > DAY_CAPACITY_SECONDS,
    withStdCount,
    missingStdCount,
    quantityOnly: withStdCount === 0,
  }
}

export function formatLoadHours(seconds: number) {
  const hours = Math.max(0, Number(seconds) || 0) / 3600
  if (hours <= 0) return '0h'
  if (hours < 10) return `${hours.toFixed(1)}h`
  return `${Math.round(hours)}h`
}

export function formatCellLoadLabel(summary: CellLoadSummary) {
  const qty = summary.quantity.toLocaleString('ko-KR')
  if (summary.quantityOnly) {
    return `부하 ${qty}`
  }
  const hours = formatLoadHours(summary.totalSeconds)
  const pct = `${summary.percent}%`
  if (summary.missingStdCount > 0) {
    return `${qty}EA · ${hours} (${pct}) · 기준미입력 ${summary.missingStdCount}`
  }
  return `${qty}EA · ${hours} (${pct})`
}

export function formatPlanLoadDetail(estimate: PlanLoadEstimate) {
  if (estimate.missingStd) {
    return '품목에 Tech Time(장비 패널 초)이 없어 시간 부하를 계산할 수 없습니다.'
  }
  const run = formatLoadHours(estimate.runSeconds)
  const setup = estimate.setupSeconds > 0 ? ` · 셋업 ${formatLoadHours(estimate.setupSeconds)}` : ''
  const total = formatLoadHours(estimate.totalSeconds)
  const pct = Math.round((estimate.totalSeconds / DAY_CAPACITY_SECONDS) * 100)
  const unitLabel =
    estimate.unitTactTimeSec < 10
      ? estimate.unitTactTimeSec.toFixed(1)
      : String(Math.round(estimate.unitTactTimeSec))
  return `예상 ${total} (가동 ${run}${setup}) · ${unitLabel}초/대(장비 ${estimate.panelTactTimeSec}초÷array ${estimate.arrayCount}) · 일용량 ${pct}%`
}
