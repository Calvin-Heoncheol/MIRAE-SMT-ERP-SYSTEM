/** 반제품 생산 기준 — 종수·Tech Time(초/대). 면모드에 따라 사용 필드가 다름. */

export type ItemProductionStd = {
  /** 단면·더블 종수 */
  partCount: number
  /** 양면 TOP 종수 */
  partCountTop: number
  /** 양면 BOT 종수 */
  partCountBot: number
  /** 단면·더블 Tech Time (초/대) */
  tactTimeSec: number
  /** 양면 TOP Tech Time (초/대) */
  tactTimeTopSec: number
  /** 양면 BOT Tech Time (초/대) */
  tactTimeBotSec: number
}

export const EMPTY_ITEM_PRODUCTION_STD: ItemProductionStd = {
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
    partCount: normalized.partCount,
    partCountTop: normalized.partCountTop,
    partCountBot: normalized.partCountBot,
    tactTimeSec: normalized.tactTimeSec,
    tactTimeTopSec: normalized.tactTimeTopSec,
    tactTimeBotSec: normalized.tactTimeBotSec,
  }
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

/** 면모드에 맞는 Tech Time 표시 */
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
