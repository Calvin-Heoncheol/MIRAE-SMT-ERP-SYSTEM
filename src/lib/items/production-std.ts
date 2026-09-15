/** 반제품 생산 기준 — 종수·Array·장비 Tech Time(패널 1회 초). */

export type ItemProductionStd = {
  /** 패널 1장에 들어 있는 PCB 수 (array). 0·미입력 = 1 */
  arrayCount: number
  /** 단면·더블 종수 */
  partCount: number
  /** 양면 TOP 종수 */
  partCountTop: number
  /** 양면 BOT 종수 */
  partCountBot: number
  /**
   * 단면·더블 Tech Time (초).
   * SMT 장비 표시값 = 패널 1회 시간. 발주 1대당 초 = tactTimeSec / arrayCount
   */
  tactTimeSec: number
  /** 양면 TOP Tech Time (초, 패널 1회) */
  tactTimeTopSec: number
  /** 양면 BOT Tech Time (초, 패널 1회) */
  tactTimeBotSec: number
}

export const EMPTY_ITEM_PRODUCTION_STD: ItemProductionStd = {
  arrayCount: 0,
  partCount: 0,
  partCountTop: 0,
  partCountBot: 0,
  tactTimeSec: 0,
  tactTimeTopSec: 0,
  tactTimeBotSec: 0,
}

function nonNegInt(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

export function normalizeItemProductionStd(value: unknown): ItemProductionStd {
  if (!value || typeof value !== 'object') return { ...EMPTY_ITEM_PRODUCTION_STD }
  const raw = value as Record<string, unknown>
  return {
    arrayCount: nonNegInt(raw.arrayCount ?? raw.array_count ?? raw.array),
    partCount: nonNegInt(raw.partCount ?? raw.part_count),
    partCountTop: nonNegInt(raw.partCountTop ?? raw.part_count_top),
    partCountBot: nonNegInt(raw.partCountBot ?? raw.part_count_bot),
    tactTimeSec: nonNegInt(raw.tactTimeSec ?? raw.tact_time_sec),
    tactTimeTopSec: nonNegInt(raw.tactTimeTopSec ?? raw.tact_time_top_sec),
    tactTimeBotSec: nonNegInt(raw.tactTimeBotSec ?? raw.tact_time_bot_sec),
  }
}

export function itemProductionStdToJson(std: ItemProductionStd) {
  const normalized = normalizeItemProductionStd(std)
  return {
    arrayCount: normalized.arrayCount,
    partCount: normalized.partCount,
    partCountTop: normalized.partCountTop,
    partCountBot: normalized.partCountBot,
    tactTimeSec: normalized.tactTimeSec,
    tactTimeTopSec: normalized.tactTimeTopSec,
    tactTimeBotSec: normalized.tactTimeBotSec,
  }
}

/** 계산용 Array — 미입력·0 이면 1 */
export function resolveItemArrayCount(std: ItemProductionStd | null | undefined) {
  const count = normalizeItemProductionStd(std).arrayCount
  return count > 0 ? count : 1
}

/**
 * 장비 Tech Time(패널 1회 초) → 발주 1대(낱장)당 초.
 * array=2, tech=40 → 20초/대
 */
export function panelTechTimeToUnitSeconds(panelTechTimeSec: number, arrayCount: number) {
  const panelSec = Math.max(0, Number(panelTechTimeSec) || 0)
  const array = Math.max(1, Math.floor(Number(arrayCount) || 0) || 1)
  return panelSec / array
}

/** 면모드에 맞는 종수 표시 (엑셀·요약) */
export function displayItemPartCountLabel(
  pcbSideMode: string | null | undefined,
  std: ItemProductionStd,
) {
  if (pcbSideMode === 'double') {
    const top = std.partCountTop
    const bot = std.partCountBot
    if (top <= 0 && bot <= 0) return ''
    return `T${top}/B${bot}`
  }
  return std.partCount > 0 ? String(std.partCount) : ''
}

/** 면모드에 맞는 Tech Time 표시 (장비 패널 초) */
export function displayItemTactTimeLabel(
  pcbSideMode: string | null | undefined,
  std: ItemProductionStd,
) {
  if (pcbSideMode === 'double') {
    const top = std.tactTimeTopSec
    const bot = std.tactTimeBotSec
    if (top <= 0 && bot <= 0) return ''
    return `T${top}/B${bot}`
  }
  return std.tactTimeSec > 0 ? String(std.tactTimeSec) : ''
}

/**
 * 엑셀 작성용 TOP/BOT 값.
 * 단면·더블은 공통 종수/Tech Time을 TOP에 넣고 BOT은 비움.
 * 양면은 TOP/BOT 필드를 그대로 사용.
 */
export function excelProductionStdTopBot(
  pcbSideMode: string | null | undefined,
  std: ItemProductionStd,
) {
  if (pcbSideMode === 'double') {
    return {
      partCountTop: std.partCountTop > 0 ? String(std.partCountTop) : '',
      partCountBot: std.partCountBot > 0 ? String(std.partCountBot) : '',
      tactTimeTopSec: std.tactTimeTopSec > 0 ? String(std.tactTimeTopSec) : '',
      tactTimeBotSec: std.tactTimeBotSec > 0 ? String(std.tactTimeBotSec) : '',
    }
  }
  return {
    partCountTop: std.partCount > 0 ? String(std.partCount) : '',
    partCountBot: '',
    tactTimeTopSec: std.tactTimeSec > 0 ? String(std.tactTimeSec) : '',
    tactTimeBotSec: '',
  }
}
