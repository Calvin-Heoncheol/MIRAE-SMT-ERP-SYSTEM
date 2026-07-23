import type { QuoteType } from './types'

export const QUOTE_KRW_PER_USD = 1350

/** 장비 임율: 국내 ₩3,500/분 */
export const SMT_SETUP_RATE_DOMESTIC = 3_500
/** 장비 임율: 해외 ₩3,500/분 (표시·계산 모두 원화) */
export const SMT_SETUP_RATE_EXPORT = 3_500
/** 단면 기본시간: 국내 60분 */
export const SMT_SETUP_BASE_MINUTES_SINGLE_DOMESTIC = 60
/** 단면 기본시간: 해외 80분 */
export const SMT_SETUP_BASE_MINUTES_SINGLE_EXPORT = 80
/** 양면 기본시간: 국내 90분 */
export const SMT_SETUP_BASE_MINUTES_DOUBLE_DOMESTIC = 90
/** 양면 기본시간: 해외 120분 */
export const SMT_SETUP_BASE_MINUTES_DOUBLE_EXPORT = 120
/** @deprecated getSmtSetupBaseMinutes 사용 */
export const SMT_SETUP_BASE_MINUTES_SINGLE = SMT_SETUP_BASE_MINUTES_SINGLE_EXPORT
/** @deprecated getSmtSetupBaseMinutes 사용 */
export const SMT_SETUP_BASE_MINUTES_DOUBLE = SMT_SETUP_BASE_MINUTES_DOUBLE_EXPORT
/** 초품검사: 종(부품 종수)당 20초 */
export const SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART = 20
/** SETTING: 국내 종(부품 종수)당 2분 */
export const SMT_SETUP_MINUTES_PER_PART_DOMESTIC = 2
/** SETTING: 해외 종(부품 종수)당 3분 */
export const SMT_SETUP_MINUTES_PER_PART_EXPORT = 3
/** @deprecated getSmtSetupMinutesPerPart 사용 */
export const SMT_SETUP_MINUTES_PER_PART = SMT_SETUP_MINUTES_PER_PART_EXPORT
/** 150점 이하일 때 PCB당 적용되는 최소 실장비 (IC/BGA 등 단가 무효, 이 금액만 청구) */
export const SMT_PLACEMENT_MIN_FEE_DOMESTIC = 5_000
export const SMT_PLACEMENT_MIN_FEE_EXPORT = 6_000
/** CHIP·이형·특수/모듈·IC PIN·BGA BALL 합산 점수(개수 1:1)가 이 값 이하이면 최소 실장비 적용 */
export const SMT_PLACEMENT_MIN_SCORE = 150
/** 후공정(조립·테스트·포장) 임율: 국내 ₩420/분 */
export const POST_RATE_DOMESTIC = 420
/** 후공정(조립·테스트·포장) 임율: 해외 ₩550/분 */
export const POST_RATE_EXPORT = 550
/** @deprecated getPostRate 사용 */
export const POST_RATE = POST_RATE_EXPORT

/** CHIP 단가: 국내 ₩6/개 */
export const SMT_UNIT_CHIP_DOMESTIC = 6
/** CHIP 단가: 해외 ₩5.25/개 */
export const SMT_UNIT_CHIP_EXPORT = 5.25
/** 이형 단가: 국내 ₩24/개 */
export const SMT_UNIT_ODD_DOMESTIC = 24
/** 이형 단가: 해외 ₩20/개 */
export const SMT_UNIT_ODD_EXPORT = 20
/** @deprecated getSmtUnitRates 사용 */
export const SMT_UNIT_ODD = SMT_UNIT_ODD_EXPORT
export const SMT_UNIT_SPECIAL = 100
/** IC PIN 단가: 국내 ₩2/PIN */
export const SMT_UNIT_IC_PIN_DOMESTIC = 2
/** IC PIN 단가: 해외 ₩1.58/PIN */
export const SMT_UNIT_IC_PIN_EXPORT = 1.58
/** BGA BALL 단가: 국내 ₩2.5/BALL */
export const SMT_UNIT_BGA_BALL_DOMESTIC = 2.5
/** BGA BALL 단가: 해외 ₩2/BALL */
export const SMT_UNIT_BGA_BALL_EXPORT = 2.0
/** @deprecated getSmtUnitRates 사용 */
export const SMT_UNIT_CHIP = SMT_UNIT_CHIP_EXPORT
/** @deprecated getSmtUnitRates 사용 */
export const SMT_UNIT_IC_PIN = SMT_UNIT_IC_PIN_EXPORT
/** @deprecated getSmtUnitRates 사용 */
export const SMT_UNIT_BGA_BALL = SMT_UNIT_BGA_BALL_EXPORT

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

export function getSmtSetupMinutesPerPart(quoteType: QuoteType) {
  return quoteType === 'domestic'
    ? SMT_SETUP_MINUTES_PER_PART_DOMESTIC
    : SMT_SETUP_MINUTES_PER_PART_EXPORT
}

export function getPostRate(quoteType: QuoteType) {
  return quoteType === 'domestic' ? POST_RATE_DOMESTIC : POST_RATE_EXPORT
}

export function getSmtUnitRates(quoteType: QuoteType) {
  if (quoteType === 'domestic') {
    return {
      chip: SMT_UNIT_CHIP_DOMESTIC,
      odd: SMT_UNIT_ODD_DOMESTIC,
      special: SMT_UNIT_SPECIAL,
      icPin: SMT_UNIT_IC_PIN_DOMESTIC,
      bgaBall: SMT_UNIT_BGA_BALL_DOMESTIC,
    }
  }
  return {
    chip: SMT_UNIT_CHIP_EXPORT,
    odd: SMT_UNIT_ODD_EXPORT,
    special: SMT_UNIT_SPECIAL,
    icPin: SMT_UNIT_IC_PIN_EXPORT,
    bgaBall: SMT_UNIT_BGA_BALL_EXPORT,
  }
}

export function getSmtSetupBaseMinutes(
  smtSide: 'single' | 'double',
  quoteType: QuoteType = 'export',
) {
  if (quoteType === 'domestic') {
    return smtSide === 'double'
      ? SMT_SETUP_BASE_MINUTES_DOUBLE_DOMESTIC
      : SMT_SETUP_BASE_MINUTES_SINGLE_DOMESTIC
  }
  return smtSide === 'double'
    ? SMT_SETUP_BASE_MINUTES_DOUBLE_EXPORT
    : SMT_SETUP_BASE_MINUTES_SINGLE_EXPORT
}

export function getAoiUnit(smtSide: 'single' | 'double') {
  return smtSide === 'double' ? AOI_UNIT * 2 : AOI_UNIT
}

/** @deprecated getAoiUnit 사용 */
export function getBoardInspectionUnit(smtSide: 'single' | 'double') {
  return getAoiUnit(smtSide)
}
