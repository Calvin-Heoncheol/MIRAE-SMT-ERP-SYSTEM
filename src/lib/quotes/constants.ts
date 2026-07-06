import type { QuoteType } from './types'

export const QUOTE_KRW_PER_USD = 1350

/** 장비 임율: 국내 ₩3,500/분 */
export const SMT_SETUP_RATE_DOMESTIC = 3_500
/** 장비 임율: 해외 $2.9630/분 (KRW 환산 저장) */
export const SMT_SETUP_RATE_EXPORT = 2.963 * QUOTE_KRW_PER_USD
/** 단면 기본시간: LOADER(15) + SCREEN PRINT·SPI(30) + REFLOW·UNLOADER(15) */
export const SMT_SETUP_BASE_MINUTES_SINGLE = 60
/** 양면 기본시간: 단면(60) + SCREEN PRINT·SPI(30) + REFLOW·UNLOADER(15) */
export const SMT_SETUP_BASE_MINUTES_DOUBLE = 105
export const SMT_SETUP_FIRST_ARTICLE_MINUTES = 20
export const SMT_SETUP_MINUTES_PER_PART = 2
/** 150점 이하일 때 PCB당 적용되는 최소 실장비 (IC/BGA 등 단가 무효, 이 금액만 청구) */
export const SMT_PLACEMENT_MIN_FEE_DOMESTIC = 3_500
export const SMT_PLACEMENT_MIN_FEE_EXPORT = 5_000
/** CHIP·이형·특수/모듈·IC PIN·BGA BALL 합산 점수(개수 1:1)가 이 값 이하이면 최소 실장비 적용 */
export const SMT_PLACEMENT_MIN_SCORE = 150
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

export function getSmtSetupRate(quoteType: QuoteType) {
  return quoteType === 'domestic' ? SMT_SETUP_RATE_DOMESTIC : SMT_SETUP_RATE_EXPORT
}

export function getSmtSetupBaseMinutes(smtSide: 'single' | 'double') {
  return smtSide === 'double' ? SMT_SETUP_BASE_MINUTES_DOUBLE : SMT_SETUP_BASE_MINUTES_SINGLE
}
