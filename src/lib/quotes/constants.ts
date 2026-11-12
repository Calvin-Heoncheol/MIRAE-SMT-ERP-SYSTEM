import type { LegacyWaveCounts, QuoteType, SmtSide } from './types'
export function normalizeSmtSide(value: unknown): SmtSide {
  if (value === 'dual' || value === 'double' || value === 'single') return value
  return 'single'
}

/** 듀얼·양면은 2차면(BOT) 종수·양면 단가 적용 */
export function isMultiSideSmt(side: SmtSide | string | undefined) {
  const normalized = normalizeSmtSide(side)
  return normalized === 'dual' || normalized === 'double'
}

/** 단가·기본시간 계산용 — 듀얼은 양면과 동일 */
export function toBillingSmtSide(side: SmtSide | string | undefined): 'single' | 'double' {
  return isMultiSideSmt(side) ? 'double' : 'single'
}

export const QUOTE_KRW_PER_USD = 1300

/** 장비 임율: 국내 ₩3,500/분 */
export const SMT_SETUP_RATE_DOMESTIC = 3_500
/** 장비 임율: 해외 ₩3,500/분 (표시·계산 모두 원화) */
export const SMT_SETUP_RATE_EXPORT = 3_500
/** 단면 기본시간: 국내 60분 */
export const SMT_SETUP_BASE_MINUTES_SINGLE_DOMESTIC = 60
/** 단면 기본시간: 해외 = 국내 */
export const SMT_SETUP_BASE_MINUTES_SINGLE_EXPORT = SMT_SETUP_BASE_MINUTES_SINGLE_DOMESTIC
/** 양면 기본시간: 국내 90분 */
export const SMT_SETUP_BASE_MINUTES_DOUBLE_DOMESTIC = 90
/** 양면 기본시간: 해외 = 국내 */
export const SMT_SETUP_BASE_MINUTES_DOUBLE_EXPORT = SMT_SETUP_BASE_MINUTES_DOUBLE_DOMESTIC
/** 초품검사: 종(부품 종수)당 20초 */
export const SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART = 20
/** SETTING: 국내 종(부품 종수)당 2분 */
export const SMT_SETUP_MINUTES_PER_PART_DOMESTIC = 2
/** SETTING: 해외 = 국내 */
export const SMT_SETUP_MINUTES_PER_PART_EXPORT = SMT_SETUP_MINUTES_PER_PART_DOMESTIC
/** 후공정 임율: 국내 ₩460/분 */
export const POST_RATE_DOMESTIC = 460
/** 후공정 임율: 해외 ₩800/분 */
export const POST_RATE_EXPORT = 800
/** 분당임률 구성 — 직접노무비 */
export const POST_RATE_DIRECT_LABOR = 330
/** 분당임률 구성 — 간접노무비 (반장·자재·관리 인력) */
export const POST_RATE_OVERHEAD = 70
/** 분당임률 구성 — 기업이윤 */
export const POST_RATE_CORPORATE_PROFIT = 35
/** 분당임률 구성 — 제조경비 (품질관리·전력·부자재·설비·공장 운영비 등) */
export const POST_RATE_ADMIN = 25
/** 분당임률 구성 — 해외 대응비 (수출 서류·포장·커뮤니케이션 등, 해외용만) */
export const POST_RATE_EXPORT_SURCHARGE = POST_RATE_EXPORT - POST_RATE_DOMESTIC
/** 후공정 작업시간 여유 — 생산수량 1,000대 미만 30% */
export const POST_PROCESS_BUFFER_UNDER_1000 = 0.3
/** 후공정 작업시간 여유 — 1,000대 이상 25% */
export const POST_PROCESS_BUFFER_FROM_1000 = 0.25
/** 후공정 작업시간 여유 — 2,000대 이상 20% */
export const POST_PROCESS_BUFFER_FROM_2000 = 0.2
/** 후공정 작업시간 여유 — 5,000대 이상 15% */
export const POST_PROCESS_BUFFER_FROM_5000 = 0.15

/** CHIP 단가: 국내 ₩6/개 */
export const SMT_UNIT_CHIP_DOMESTIC = 6
/** CHIP 단가: 해외 ₩10/개 */
export const SMT_UNIT_CHIP_EXPORT = 10
/** 이형 단가: 국내 ₩20/개 */
export const SMT_UNIT_ODD_DOMESTIC = 20
/** 이형 단가: 해외 ₩35/개 */
export const SMT_UNIT_ODD_EXPORT = 35
/** 특수모듈 단가: 국내 ₩100/개 */
export const SMT_UNIT_SPECIAL_DOMESTIC = 100
/** 특수모듈 단가: 해외 ₩175/개 */
export const SMT_UNIT_SPECIAL_EXPORT = 175
/** IC PIN 단가: 국내 ₩2/PIN */
export const SMT_UNIT_IC_PIN_DOMESTIC = 2
/** IC PIN 단가: 해외 ₩3.5/PIN */
export const SMT_UNIT_IC_PIN_EXPORT = 3.5
/** BGA BALL 단가: 국내 ₩2.5/BALL */
export const SMT_UNIT_BGA_BALL_DOMESTIC = 2.5
/** BGA BALL 단가: 해외 ₩4/BALL */
export const SMT_UNIT_BGA_BALL_EXPORT = 4

/** AOI 검사 PCB당: 국내 ₩100 (양면은 2배) */
export const AOI_UNIT = 100
/** AOI 검사 PCB당: 해외 ₩150 (양면은 2배) */
export const AOI_UNIT_EXPORT = 150

export const DIP_UNIT = {
  dipGeneral: 250,
  dipConnector: 300,
  dipWire: 400,
  /** 초대형 20PIN 이상 */
  dipXLarge: 600,
} as const

export type DipUnitRates = { [K in keyof typeof DIP_UNIT]: number }

/** 해외 수납땜 단가 */
export const DIP_UNIT_EXPORT: DipUnitRates = {
  dipGeneral: 350,
  dipConnector: 400,
  dipWire: 500,
  dipXLarge: 600,
}

export function getDipUnitRates(quoteType: QuoteType): DipUnitRates {
  return activeRateSet(quoteType).dip
}

/** 예전 견적의 WAVE 수량을 같은 크기의 수납땜 수량에 합산 */
export function foldLegacyWaveCounts(
  board: {
    dipGeneral?: number | string
    dipConnector?: number | string
    dipWire?: number | string
    dipXLarge?: number | string
  } & LegacyWaveCounts,
) {
  const num = (value: number | string | undefined) => Number(value) || 0
  return {
    dipGeneral: num(board.dipGeneral) + num(board.waveGeneral),
    dipConnector: num(board.dipConnector) + num(board.waveConnector),
    dipWire: num(board.dipWire) + num(board.waveWire),
    dipXLarge: num(board.dipXLarge),
  }
}

/** 관리비: 원자재 비용의 10% */
export const RAW_MATERIAL_MANAGEMENT_RATE = 0.1

/** 메탈마스크: 단면 */
export const METAL_MASK_COST_SINGLE = 110_000
/** 메탈마스크: 양면 */
export const METAL_MASK_COST_DOUBLE = 220_000
/** 샘플 비용 (일회성) — 단면 */
export const SAMPLE_COST_SINGLE = 200_000
/** 샘플 비용 (일회성) — 양면·듀얼 */
export const SAMPLE_COST_DOUBLE = 300_000
/** 샘플 비용 적용 기준 수량 (미만) */
export const SAMPLE_QTY_THRESHOLD = 200

export type SmtUnitRates = {
  chip: number
  odd: number
  special: number
  icPin: number
  bgaBall: number
}

/** 국내/해외별 단가 */
export type QuoteRateSet = {
  setupRate: number
  setupBaseMinutesSingle: number
  setupBaseMinutesDouble: number
  setupMinutesPerPart: number
  postRate: number
  smt: SmtUnitRates
  /** AOI 단면 PCB당 (양면은 2배) */
  aoi: number
  dip: DipUnitRates
}

/** 견적 단가표 — 견적 저장 시 detail_info.settings.rates 로 함께 저장 */
export type QuoteRates = {
  domestic: QuoteRateSet
  export: QuoteRateSet
  firstArticleSecondsPerPart: number
  metalMaskSingle: number
  metalMaskDouble: number
  sampleCostSingle: number
  sampleCostDouble: number
  sampleQtyThreshold: number
  /** 원자재 관리비율 (0.1 = 10%) */
  materialManagementRate: number
  /** 후공정 시간 여유율 (0.3 = 30%) */
  postBuffer: {
    under1000: number
    from1000: number
    from2000: number
    from5000: number
  }
}

/**
 * 단가표가 저장되지 않은 기존 견적의 계산 기준.
 * 기존 견적 금액이 바뀌므로 이 값은 수정하지 말고, 단가 변경은 견적 단가 관리에서 할 것.
 */
export const DEFAULT_QUOTE_RATES: QuoteRates = Object.freeze({
  domestic: {
    setupRate: SMT_SETUP_RATE_DOMESTIC,
    setupBaseMinutesSingle: SMT_SETUP_BASE_MINUTES_SINGLE_DOMESTIC,
    setupBaseMinutesDouble: SMT_SETUP_BASE_MINUTES_DOUBLE_DOMESTIC,
    setupMinutesPerPart: SMT_SETUP_MINUTES_PER_PART_DOMESTIC,
    postRate: POST_RATE_DOMESTIC,
    smt: {
      chip: SMT_UNIT_CHIP_DOMESTIC,
      odd: SMT_UNIT_ODD_DOMESTIC,
      special: SMT_UNIT_SPECIAL_DOMESTIC,
      icPin: SMT_UNIT_IC_PIN_DOMESTIC,
      bgaBall: SMT_UNIT_BGA_BALL_DOMESTIC,
    },
    aoi: AOI_UNIT,
    dip: { ...DIP_UNIT },
  },
  export: {
    setupRate: SMT_SETUP_RATE_EXPORT,
    setupBaseMinutesSingle: SMT_SETUP_BASE_MINUTES_SINGLE_EXPORT,
    setupBaseMinutesDouble: SMT_SETUP_BASE_MINUTES_DOUBLE_EXPORT,
    setupMinutesPerPart: SMT_SETUP_MINUTES_PER_PART_EXPORT,
    postRate: POST_RATE_EXPORT,
    smt: {
      chip: SMT_UNIT_CHIP_EXPORT,
      odd: SMT_UNIT_ODD_EXPORT,
      special: SMT_UNIT_SPECIAL_EXPORT,
      icPin: SMT_UNIT_IC_PIN_EXPORT,
      bgaBall: SMT_UNIT_BGA_BALL_EXPORT,
    },
    aoi: AOI_UNIT_EXPORT,
    dip: { ...DIP_UNIT_EXPORT },
  },
  firstArticleSecondsPerPart: SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART,
  metalMaskSingle: METAL_MASK_COST_SINGLE,
  metalMaskDouble: METAL_MASK_COST_DOUBLE,
  sampleCostSingle: SAMPLE_COST_SINGLE,
  sampleCostDouble: SAMPLE_COST_DOUBLE,
  sampleQtyThreshold: SAMPLE_QTY_THRESHOLD,
  materialManagementRate: RAW_MATERIAL_MANAGEMENT_RATE,
  postBuffer: {
    under1000: POST_PROCESS_BUFFER_UNDER_1000,
    from1000: POST_PROCESS_BUFFER_FROM_1000,
    from2000: POST_PROCESS_BUFFER_FROM_2000,
    from5000: POST_PROCESS_BUFFER_FROM_5000,
  },
})

function rateNumber(value: unknown, fallback: number) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : fallback
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeNumberRecord<T extends Record<string, number>>(raw: unknown, fallback: T): T {
  const source = asRecord(raw)
  const next = { ...fallback }
  for (const key of Object.keys(fallback) as Array<keyof T & string>) {
    next[key] = rateNumber(source[key], fallback[key]) as T[typeof key]
  }
  return next
}

function normalizeQuoteRateSet(raw: unknown, fallback: QuoteRateSet): QuoteRateSet {
  const source = asRecord(raw)
  return {
    setupRate: rateNumber(source.setupRate, fallback.setupRate),
    setupBaseMinutesSingle: rateNumber(source.setupBaseMinutesSingle, fallback.setupBaseMinutesSingle),
    setupBaseMinutesDouble: rateNumber(source.setupBaseMinutesDouble, fallback.setupBaseMinutesDouble),
    setupMinutesPerPart: rateNumber(source.setupMinutesPerPart, fallback.setupMinutesPerPart),
    postRate: rateNumber(source.postRate, fallback.postRate),
    smt: normalizeNumberRecord(source.smt, fallback.smt),
    aoi: rateNumber(source.aoi, fallback.aoi),
    dip: normalizeNumberRecord(source.dip, fallback.dip),
  }
}

const normalizedRates = new WeakSet<object>()

/** 저장된 JSON 단가표를 검증. 빠지거나 잘못된 값은 fallback 으로 채움 */
export function normalizeQuoteRates(raw: unknown, fallback: QuoteRates = DEFAULT_QUOTE_RATES): QuoteRates {
  if (raw && typeof raw === 'object' && normalizedRates.has(raw)) return raw as QuoteRates
  const source = asRecord(raw)
  const rates: QuoteRates = {
    domestic: normalizeQuoteRateSet(source.domestic, fallback.domestic),
    export: normalizeQuoteRateSet(source.export, fallback.export),
    firstArticleSecondsPerPart: rateNumber(source.firstArticleSecondsPerPart, fallback.firstArticleSecondsPerPart),
    metalMaskSingle: rateNumber(source.metalMaskSingle, fallback.metalMaskSingle),
    metalMaskDouble: rateNumber(source.metalMaskDouble, fallback.metalMaskDouble),
    sampleCostSingle: rateNumber(source.sampleCostSingle, fallback.sampleCostSingle),
    sampleCostDouble: rateNumber(source.sampleCostDouble, fallback.sampleCostDouble),
    sampleQtyThreshold: rateNumber(source.sampleQtyThreshold, fallback.sampleQtyThreshold),
    materialManagementRate: rateNumber(source.materialManagementRate, fallback.materialManagementRate),
    postBuffer: normalizeNumberRecord(source.postBuffer, fallback.postBuffer),
  }
  normalizedRates.add(rates)
  return rates
}

/** 저장된 견적의 단가표. 단가표가 없는 구 견적은 DEFAULT_QUOTE_RATES 로 고정 */
export function resolveQuoteDetailRates(
  detailInfo?: { settings?: { rates?: unknown } | null } | null,
): QuoteRates {
  const saved = detailInfo?.settings?.rates
  return saved ? normalizeQuoteRates(saved) : DEFAULT_QUOTE_RATES
}

let activeQuoteRates: QuoteRates = DEFAULT_QUOTE_RATES

/** 단가 조회 함수(getPostRate 등)가 현재 사용하는 단가표 */
export function getActiveQuoteRates(): QuoteRates {
  return activeQuoteRates
}

/** 견적 모달처럼 렌더 전체에 단가표를 적용할 때 사용. null 이면 기본값 */
export function setActiveQuoteRates(rates: QuoteRates | null | undefined) {
  activeQuoteRates = rates ? normalizeQuoteRates(rates) : DEFAULT_QUOTE_RATES
}

/** fn 실행 동안만 단가표를 바꿔 적용 (동기 함수 전용) */
export function withQuoteRates<T>(rates: QuoteRates | null | undefined, fn: () => T): T {
  if (!rates) return fn()
  const previous = activeQuoteRates
  activeQuoteRates = normalizeQuoteRates(rates)
  try {
    return fn()
  } finally {
    activeQuoteRates = previous
  }
}

function activeRateSet(quoteType: QuoteType): QuoteRateSet {
  return quoteType === 'domestic' ? activeQuoteRates.domestic : activeQuoteRates.export
}

export function getFirstArticleSecondsPerPart() {
  return activeQuoteRates.firstArticleSecondsPerPart
}

export function getMaterialManagementRate() {
  return activeQuoteRates.materialManagementRate
}

export function getPostProcessBufferRates() {
  return activeQuoteRates.postBuffer
}

export function getMetalMaskCost(side: MetalMaskSide) {
  return side === 'double' ? activeQuoteRates.metalMaskDouble : activeQuoteRates.metalMaskSingle
}

export function getSampleCostSettings() {
  return {
    single: activeQuoteRates.sampleCostSingle,
    double: activeQuoteRates.sampleCostDouble,
    qtyThreshold: activeQuoteRates.sampleQtyThreshold,
  }
}

/** PCB 중 하나라도 듀얼·양면이면 true */
export function hasAnyDoubleSidedSmt(
  boards?: Array<{ smtSide?: SmtSide | string }> | null,
) {
  if (!boards?.length) return false
  return boards.some((board) => isMultiSideSmt(board.smtSide))
}

export function sampleCostForBoards(boards?: Array<{ smtSide?: SmtSide | string }> | null) {
  return hasAnyDoubleSidedSmt(boards) ? activeQuoteRates.sampleCostDouble : activeQuoteRates.sampleCostSingle
}

/** 생산수량 200대 미만 또는 구분=샘플이면 샘플 비용 (금액은 고정, 수량과 무관) */
export function computeSampleCostTotal(
  qty?: number | string | null,
  boards?: Array<{ smtSide?: SmtSide | string }> | null,
  productionKind?: '샘플' | '양산',
) {
  const safeQty = Math.floor(Number(qty) || 0)
  const byKind = productionKind === '샘플'
  const byQty = safeQty > 0 && safeQty < activeQuoteRates.sampleQtyThreshold
  if (!byKind && !byQty) return 0
  return sampleCostForBoards(boards)
}

export function metalMaskCostForSide(side: SmtSide | string | undefined) {
  return getMetalMaskCost(toBillingSmtSide(side))
}

export type MetalMaskSide = 'single' | 'double'

export function normalizeMetalMaskSide(value: unknown): MetalMaskSide | undefined {
  return value === 'single' || value === 'double' ? value : undefined
}

/** 선택값이 없을 때 보드 면 기준 기본 선택 (하나라도 듀얼·양면이면 양면) */
export function defaultMetalMaskSide(boards?: Array<{ smtSide?: SmtSide | string }> | null): MetalMaskSide {
  return boards?.some((board) => toBillingSmtSide(board.smtSide) === 'double') ? 'double' : 'single'
}

/**
 * PCB별 메탈마스크 비용 합계 (단면 11만 / 듀얼·양면 22만).
 * side를 지정하면 모든 PCB에 그 면 단가를 적용.
 */
export function computeMetalMaskCostTotal(
  boards: Array<{ smtSide?: SmtSide | string }>,
  includeSmd = true,
  side?: MetalMaskSide,
) {
  if (!includeSmd || boards.length === 0) return 0
  if (side) {
    return boards.length * getMetalMaskCost(side)
  }
  return boards.reduce((sum, board) => sum + metalMaskCostForSide(board.smtSide), 0)
}

export function getSmtSetupRate(quoteType: QuoteType) {
  return activeRateSet(quoteType).setupRate
}

export function getSmtSetupMinutesPerPart(quoteType: QuoteType) {
  return activeRateSet(quoteType).setupMinutesPerPart
}

export function getPostRate(quoteType: QuoteType) {
  return activeRateSet(quoteType).postRate
}

export function getSmtUnitRates(quoteType: QuoteType): SmtUnitRates {
  return activeRateSet(quoteType).smt
}

export function getSmtSetupBaseMinutes(
  smtSide: SmtSide | 'single' | 'double',
  quoteType: QuoteType = 'export',
) {
  const set = activeRateSet(quoteType)
  return toBillingSmtSide(smtSide) === 'double' ? set.setupBaseMinutesDouble : set.setupBaseMinutesSingle
}

export function getAoiUnit(smtSide: SmtSide | 'single' | 'double', quoteType: QuoteType) {
  const unit = activeRateSet(quoteType).aoi
  return toBillingSmtSide(smtSide) === 'double' ? unit * 2 : unit
}