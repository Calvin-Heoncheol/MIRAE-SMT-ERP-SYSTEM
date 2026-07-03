import type { QuoteType } from './types'

export const QUOTE_KRW_PER_USD = 1350

export const SMT_SETUP_RATE = 6_000
export const SMT_SETUP_RATE_EXPORT_SINGLE = 4_000
export const SMT_SETUP_RATE_EXPORT_DOUBLE = 6_000
export const SMT_SETUP_BASE_MINUTES = 80
export const SMT_SETUP_MINUTES_PER_PART = 3
/** 120점 이하일 때 PCB당 적용되는 최소 실장비 (IC/BGA 등 단가 무효, 이 금액만 청구) */
export const SMT_PLACEMENT_MIN_FEE_DOMESTIC = 3_500
export const SMT_PLACEMENT_MIN_FEE_EXPORT = 5_000
/** CHIP·이형 합산 점수(개수 1:1)가 이 값 이하이면 최소 실장비 적용 */
export const SMT_PLACEMENT_MIN_SCORE = 120
export const POST_RATE = 540

export const SMT_UNIT_CHIP = 16
export const SMT_UNIT_ODD = 50
export const SMT_UNIT_SPECIAL = 120
export const SMT_UNIT_IC_PIN = 12
export const SMT_UNIT_BGA_BALL = 14

export const AOI_UNIT_PRICE_SINGLE = 100
export const AOI_UNIT_PRICE_DOUBLE = 200
export const PCB_WASH_UNIT_PRICE = 100

export const DIP_UNIT = {
  dipGeneral: 400,
  dipConnector: 450,
  dipWire: 500,
  waveGeneral: 300,
  waveConnector: 350,
  waveWire: 400,
} as const

export const SUB_MATERIAL_RATE = 0.1

export function getSmtPlacementMinFee(quoteType: QuoteType) {
  return quoteType === 'domestic' ? SMT_PLACEMENT_MIN_FEE_DOMESTIC : SMT_PLACEMENT_MIN_FEE_EXPORT
}

export function getSmtSetupRate(quoteType: QuoteType, smtSide: 'single' | 'double' = 'single') {
  if (quoteType === 'export') {
    return smtSide === 'double' ? SMT_SETUP_RATE_EXPORT_DOUBLE : SMT_SETUP_RATE_EXPORT_SINGLE
  }
  return SMT_SETUP_RATE
}
