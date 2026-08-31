import type { ItemPcbSideMode } from '@/lib/items/types'
import type { SmtSide } from '@/lib/quotes/types'

/** 품목·견적 공용 SET-UP/실장 종수 (금액 아님) */
export type ItemSmtQuoteParts = {
  chip: number
  icPin: number
  bga: number
  smtOdd: number
  smtSpecial: number
  smtTopCount: number
  smtBotCount: number
}

export const EMPTY_SMT_QUOTE_PARTS: ItemSmtQuoteParts = {
  chip: 0,
  icPin: 0,
  bga: 0,
  smtOdd: 0,
  smtSpecial: 0,
  smtTopCount: 0,
  smtBotCount: 0,
}

function nonNegInt(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

export function normalizeItemSmtQuoteParts(value: unknown): ItemSmtQuoteParts {
  if (!value || typeof value !== 'object') return { ...EMPTY_SMT_QUOTE_PARTS }
  const raw = value as Record<string, unknown>
  return {
    chip: nonNegInt(raw.chip),
    icPin: nonNegInt(raw.icPin ?? raw.ic_pin),
    bga: nonNegInt(raw.bga),
    smtOdd: nonNegInt(raw.smtOdd ?? raw.smt_odd),
    smtSpecial: nonNegInt(raw.smtSpecial ?? raw.smt_special),
    smtTopCount: nonNegInt(raw.smtTopCount ?? raw.smt_top_count),
    smtBotCount: nonNegInt(raw.smtBotCount ?? raw.smt_bot_count),
  }
}

export function itemSmtQuotePartsToJson(parts: ItemSmtQuoteParts) {
  const normalized = normalizeItemSmtQuoteParts(parts)
  return {
    chip: normalized.chip,
    icPin: normalized.icPin,
    bga: normalized.bga,
    smtOdd: normalized.smtOdd,
    smtSpecial: normalized.smtSpecial,
    smtTopCount: normalized.smtTopCount,
    smtBotCount: normalized.smtBotCount,
  }
}

/** 품목 면 → 견적 SMT 면 (duo → dual) */
export function itemPcbSideToSmtSide(mode: ItemPcbSideMode | string | null | undefined): SmtSide {
  const value = String(mode || '').trim().toLowerCase()
  if (value === 'double') return 'double'
  if (value === 'duo' || value === 'dual') return 'dual'
  return 'single'
}

/** 견적 SMT 면 → 품목 면 */
export function smtSideToItemPcbSide(side: SmtSide | string | null | undefined): ItemPcbSideMode {
  const value = String(side || '').trim().toLowerCase()
  if (value === 'double') return 'double'
  if (value === 'dual' || value === 'duo') return 'duo'
  if (value === 'single') return 'single'
  return ''
}

export function hasAnySmtQuoteParts(parts: ItemSmtQuoteParts) {
  return (
    parts.chip > 0 ||
    parts.icPin > 0 ||
    parts.bga > 0 ||
    parts.smtOdd > 0 ||
    parts.smtSpecial > 0 ||
    parts.smtTopCount > 0 ||
    parts.smtBotCount > 0
  )
}
