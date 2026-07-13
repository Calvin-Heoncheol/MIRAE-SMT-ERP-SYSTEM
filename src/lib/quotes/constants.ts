import type { QuoteType } from './types'

export const QUOTE_KRW_PER_USD = 1350

/** 장비 임율: 국내 ₩3,500/분 */
export const SMT_SETUP_RATE_DOMESTIC = 3_500
/** 장비 임율: 해외 ₩3,500/분 (표시·계산 모두 원화) */
export const SMT_SETUP_RATE_EXPORT = 3_500
/** 단면 기본시간 */
export const SMT_SETUP_BASE_MINUTES_SINGLE = 80
/** 양면 기본시간 */
export const SMT_SETUP_BASE_MINUTES_DOUBLE = 120
/** 초품검사: 종(부품 종수)당 20초 */
export const SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART = 20
/** SETTING: 종(부품 종수)당 3분 */
export const SMT_SETUP_MINUTES_PER_PART = 3
/** 150점 이하일 때 PCB당 적용되는 최소 실장비 (IC/BGA 등 단가 무효, 이 금액만 청구) */
export const SMT_PLACEMENT_MIN_FEE_DOMESTIC = 6_000
export const SMT_PLACEMENT_MIN_FEE_EXPORT = 6_000
/** CHIP·이형·특수/모듈·IC PIN·BGA BALL 합산 점수(개수 1:1)가 이 값 이하이면 최소 실장비 적용 */
export const SMT_PLACEMENT_MIN_SCORE = 150
export const POST_RATE = 550

export const SMT_UNIT_CHIP = 5.25
export const SMT_UNIT_ODD = 20
export const SMT_UNIT_SPECIAL = 100
export const SMT_UNIT_IC_PIN = 1.58
export const SMT_UNIT_BGA_BALL = 2.0

/** AOI 검사 PCB당 (양면은 2배) */
export const AOI_UNIT = 100
/** PCB 세척 PCB당 */
export const PCB_WASH_UNIT = 100
/** @deprecated AOI·세척 개별 옵션으로 대체 */
export const INSPECTION_UNIT_SINGLE = AOI_UNIT
export const INSPECTION_UNIT_DOUBLE = AOI_UNIT * 2
/** SET-UP 기본시간 설명 (견적서 표시용) */
export const SMT_SETUP_BASE_TIME_DESCRIPTION =
  'Loader/Unloader · Screen Print & SPI · Reflow Profile 측정'
/** SET-UP 초품검사 설명 (견적서 표시용) */
export const SMT_SETUP_FIRST_ARTICLE_DESCRIPTION = 'BOM 실장 확인 및 LCR 측정'
/** SET-UP SETTING 설명 (견적서 표시용) */
export const SMT_SETUP_SETTING_DESCRIPTION = '부품 피더 장착 및 좌표확인'

export const DIP_UNIT = {
  dipGeneral: 250,
  dipConnector: 300,
  dipWire: 400,
  waveGeneral: 200,
  waveConnector: 250,
  waveWire: 350,
} as const

/** 관리비: 원자재 원가의 10% */
export const RAW_MATERIAL_MANAGEMENT_RATE = 0.1

export function getSmtPlacementMinFee(quoteType: QuoteType) {
  return quoteType === 'domestic' ? SMT_PLACEMENT_MIN_FEE_DOMESTIC : SMT_PLACEMENT_MIN_FEE_EXPORT
}

export function getSmtSetupRate(quoteType: QuoteType) {
  return quoteType === 'domestic' ? SMT_SETUP_RATE_DOMESTIC : SMT_SETUP_RATE_EXPORT
}

export function getSmtSetupBaseMinutes(smtSide: 'single' | 'double') {
  return smtSide === 'double' ? SMT_SETUP_BASE_MINUTES_DOUBLE : SMT_SETUP_BASE_MINUTES_SINGLE
}

export function getAoiUnit(smtSide: 'single' | 'double') {
  return smtSide === 'double' ? AOI_UNIT * 2 : AOI_UNIT
}

/** @deprecated getAoiUnit 사용 */
export function getBoardInspectionUnit(smtSide: 'single' | 'double') {
  return getAoiUnit(smtSide)
}
