import type { QuoteType } from './types'

export const QUOTE_KRW_PER_USD = 1350

/** 장비 임율: 국내 ₩5,000/분 */
export const SMT_SETUP_RATE_DOMESTIC = 5_000
/** 장비 임율: 해외 ₩5,000/분 (표시·계산 모두 원화) */
export const SMT_SETUP_RATE_EXPORT = 5_000
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
export const SMT_UNIT_ODD = 50
export const SMT_UNIT_SPECIAL = 120
export const SMT_UNIT_IC_PIN = 7
export const SMT_UNIT_BGA_BALL = 8

export const AOI_UNIT_PRICE_SINGLE = 300
export const AOI_UNIT_PRICE_DOUBLE = 600
/** AOI 검사 (단면/양면 PCB당) */
export const AOI_INSPECTION_UNIT_SINGLE = 100
export const AOI_INSPECTION_UNIT_DOUBLE = 200
/** X-RAY 검사 (단면/양면 PCB당) */
export const XRAY_INSPECTION_UNIT_SINGLE = 100
export const XRAY_INSPECTION_UNIT_DOUBLE = 200
/** 외관검사 (단면/양면 PCB당) */
export const VISUAL_INSPECTION_UNIT_SINGLE = 100
export const VISUAL_INSPECTION_UNIT_DOUBLE = 200
/** SET-UP 기본시간 설명 (견적서 표시용) */
export const SMT_SETUP_BASE_TIME_DESCRIPTION =
  'Loader/Unloader · Screen Print & SPI · Reflow Profile 측정'
/** SET-UP 초품검사 설명 (견적서 표시용) */
export const SMT_SETUP_FIRST_ARTICLE_DESCRIPTION = 'BOM 실장 확인 및 LCR 측정'
/** SET-UP SETTING 설명 (견적서 표시용) */
export const SMT_SETUP_SETTING_DESCRIPTION = '부품 피더 장착 및 좌표확인'

export const DIP_UNIT = {
  dipGeneral: 450,
  dipConnector: 500,
  dipWire: 550,
  waveGeneral: 300,
  waveConnector: 350,
  waveWire: 400,
} as const

export const SUB_MATERIAL_RATE = 0.1
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

export function getBoardInspectionUnits(smtSide: 'single' | 'double') {
  const isDouble = smtSide === 'double'
  return {
    aoi: isDouble ? AOI_INSPECTION_UNIT_DOUBLE : AOI_INSPECTION_UNIT_SINGLE,
    xray: isDouble ? XRAY_INSPECTION_UNIT_DOUBLE : XRAY_INSPECTION_UNIT_SINGLE,
    visual: isDouble ? VISUAL_INSPECTION_UNIT_DOUBLE : VISUAL_INSPECTION_UNIT_SINGLE,
  }
}
