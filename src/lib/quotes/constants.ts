import type { QuoteType } from './types'

export const QUOTE_KRW_PER_USD = 1350

/** 장비 임율: 국내 ₩4,500/분 */
export const SMT_SETUP_RATE_DOMESTIC = 4_500
/** 장비 임율: 해외 ₩4,500/분 (표시·계산 모두 원화) */
export const SMT_SETUP_RATE_EXPORT = 4_500
/** 단면 기본시간 */
export const SMT_SETUP_BASE_MINUTES_SINGLE = 80
/** 양면 기본시간 */
export const SMT_SETUP_BASE_MINUTES_DOUBLE = 120
/** 초품검사: 종(부품 종수)당 20초 */
export const SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART = 20
/** SETTING: 종(부품 종수)당 3분 */
export const SMT_SETUP_MINUTES_PER_PART = 3
/** 150점 이하일 때 PCB당 적용되는 최소 실장비 (IC/BGA 등 단가 무효, 이 금액만 청구) */
export const SMT_PLACEMENT_MIN_FEE_DOMESTIC = 3_500
export const SMT_PLACEMENT_MIN_FEE_EXPORT = 5_000
/** CHIP·이형·특수/모듈·IC PIN·BGA BALL 합산 점수(개수 1:1)가 이 값 이하이면 최소 실장비 적용 */
export const SMT_PLACEMENT_MIN_SCORE = 150
export const POST_RATE = 540

export const SMT_UNIT_CHIP = 15
export const SMT_UNIT_ODD = 60
export const SMT_UNIT_SPECIAL = 120
export const SMT_UNIT_IC_PIN = 7
export const SMT_UNIT_BGA_BALL = 8

export const AOI_UNIT_PRICE_SINGLE = 300
export const AOI_UNIT_PRICE_DOUBLE = 600
export const PCB_WASH_UNIT_PRICE = 100

export const DIP_UNIT = {
  dipGeneral: 450,
  dipConnector: 500,
  dipWire: 550,
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
