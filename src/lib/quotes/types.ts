import type { PaymentTermSnapshot } from '@/lib/partners/payment-term-snapshot'

export type QuoteType = 'export' | 'domestic'

export type QuoteStatus = 'draft' | 'confirmed'

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: '미확정',
  confirmed: '확정',
}

export const QUOTE_TYPE_LABELS: Record<QuoteType, string> = {
  domestic: '국내',
  export: '해외',
}

export const QUOTE_TYPE_BADGE_CLASS: Record<QuoteType, string> = {
  domestic: 'bg-blue-100 text-blue-800',
  export: 'bg-teal-100 text-teal-800',
}

/** 해외용 견적서 미리보기·입력 화면 표시 통화 */
export type QuoteDisplayCurrency = 'usd' | 'krw'

/** SMT 면: 단면 / 듀얼 / 양면 */
export type SmtSide = 'single' | 'dual' | 'double'

export type SmtPcbBoard = {
  pcbName: string
  chip: number
  icPin: number
  bga: number
  smtOdd: number
  smtSpecial: number
  smtSide: SmtSide
  aoiEnabled: boolean
  pcbWashEnabled: boolean
  smtTopCount: number
  smtBotCount: number
}

export type DipPcbBoard = {
  pcbName: string
  dipGeneral: number
  dipConnector: number
  dipWire: number
  waveGeneral: number
  waveConnector: number
  waveWire: number
}

export type QuoteDetailAmounts = {
  smt: number
  dip: number
  assembly: number
  test: number
  packing: number
  materialCost: number
  materialManagementCost: number
  setupCost: number
  subMaterialCost: number
  /** 샘플 비용 (일회성, 생산수량 200대 미만 · 단면 20만 / 양면 30만) */
  sampleCost?: number
  /** @deprecated 미사용 — 항상 0 */
  auxiliaryMaterialCost?: number
}

/** 후공정 세부 공정 행 (공정명 + 분) */
export type PostProcessLine = {
  name: string
  minutes: number
}

export type QuoteDetailInfo = {
  amounts?: QuoteDetailAmounts
  inputs?: {
    smt?: {
      pcbBoards?: SmtPcbBoard[]
      smtSide?: SmtSide
    }
    dip?: { dipBoards?: DipPcbBoard[] }
    postProcess?: {
      /** 합계 분 (하위호환·계산용) — 통합 후 postAssembly 에 전체 분 합계 */
      postAssembly?: number
      postTest?: number
      postPacking?: number
      /** 통합 후공정 행 (공정명 + 분) */
      lines?: PostProcessLine[]
      /** @deprecated lines 로 통합. 로드 시 merge */
      assemblyLines?: PostProcessLine[]
      testLines?: PostProcessLine[]
      packingLines?: PostProcessLine[]
    }
  }
  settings?: {
    materialCostPerUnit?: number
    /** 메탈마스크 총액 */
    metalMaskCost?: number
    /** @deprecated 미사용 — 항상 0 */
    auxiliaryMaterialCostPerUnit?: number
    pcbBoardCount?: number
    specialDiscount?: number
    /** 샘플 / 양산 */
    productionKind?: '샘플' | '양산'
    quoteType?: QuoteType | 'legacy'
    smtIncludesSetup?: boolean
    /** 국내용/해외용 — SMD(SMT) 입력 섹션 사용 */
    includeSmd?: boolean
    /** 국내용/해외용 — DIP(납땜·후공정) 입력 섹션 사용 */
    includeDip?: boolean
    /**
     * 원자재·관리비 포함 여부.
     * 미설정(구 견적) = 포함. 신규 견적은 false 로 저장.
     */
    includeMaterialCosts?: boolean
    /** 메탈마스크 포함 여부 */
    includeMetalMask?: boolean
    productId?: string
    /** 미확정 / 확정 */
    quoteStatus?: QuoteStatus
    /** 과거 견적 — 대당 비용 (원) */
    legacyCosts?: {
      smd: number
      post: number
      material: number
      /** @deprecated 견적 기타 제거 */
      other?: number
    }
  }
}

export type QuoteRecord = {
  id: string
  quote_date: string
  customer: string
  product_name: string
  board_qty: number
  total_amount: number
  detail_info: QuoteDetailInfo
  status?: QuoteStatus | string | null
  payment_term_type?: string | null
  payment_deposit_percent?: number | null
  payment_net_days?: number | null
  payment_monthly_day?: number | null
  created_by?: string | null
  created_by_name?: string | null
  updated_by?: string | null
  updated_by_name?: string | null
  created_at: string
  updated_at: string
}

export type QuoteListItem = {
  quoteId: string
  quoteNumber: string
  quoteDate: string
  quoteType: QuoteType
  quoteStatus: QuoteStatus
  customer: string
  productName: string
  boardQty: number
  totalAmount: number
  detailInfo: QuoteDetailInfo
  paymentTerms: PaymentTermSnapshot
  createdBy?: string | null
  createdByName: string
  /** 최종 수정자 (없으면 등록자) */
  updatedBy?: string | null
  updatedByName: string
  createdAt: string
}

export type EstimateInput = {
  boardQty?: number | string
  materialCost?: number | string
  /** 메탈마스크 총액 (단면 11만 / 양면 22만 × PCB 수) */
  metalMaskCost?: number | string
  /** 샘플 / 양산 — 표시용 구분 (금액 산정과 무관) */
  productionKind?: '샘플' | '양산'
  /** @deprecated 미사용 — 항상 0 */
  auxiliaryMaterialCost?: number | string
  postAssembly?: number | string
  postTest?: number | string
  postPacking?: number | string
  specialDiscount?: number | string
  pcbBoardCount?: number | string
  pcbBoards?: SmtPcbBoard[]
  dipBoards?: DipPcbBoard[]
  quoteType?: QuoteType
  existingQuoteNumber?: string
  includeSmd?: boolean
  /**
   * 원자재·관리비 포함 여부.
   * 미설정 = 포함(구 견적 호환). false 이면 제외.
   */
  includeMaterialCosts?: boolean
  /** false 이면 메탈마스크 비용 제외 */
  includeMetalMask?: boolean
  smtSide?: SmtSide
  aoiEnabled?: boolean
  pcbWashEnabled?: boolean
  smtTopCount?: number
  smtBotCount?: number
  chip?: number
  icPin?: number
  bga?: number
  dipGeneral?: number
  dipConnector?: number
  dipWire?: number
  waveGeneral?: number
  waveConnector?: number
  waveWire?: number
}

export type EstimateResult = {
  estNo: string
  date: string
  qty: number
  values: {
    smt: number
    dip: number
    postProcess: number
    assy: number
    laborMarkup: number
    specialDiscount: number
    subtotalBeforeDiscount: number
    grandTotal: number
  }
  common: {
    smtSetup: number
    smtSetupPartCount: number
    smtInspectionPerUnit: number
    smtLaborPerUnit: number
    smtLaborRawPerUnit: number
    smtLaborMinApplied: boolean
    smtLaborMinAdjustment: number
    pcbBoardCount: number
    pcbBoardDetails: SmtBoardDetail[]
    dipBoardDetails: DipBoardDetail[]
    subMaterial: number
    /** 샘플 비용 총액 (일회성, 생산수량 200대 미만 · 단면 20만 / 양면 30만) */
    sampleCost: number
    /** SET-UP + 메탈마스크 + 샘플 (발주 1회) */
    orderLevelTotal: number
    /** SMD 실장·검사 (대당 × 수량, SET-UP 제외) */
    smtPlacementTotal: number
    auxiliaryMaterial: number
    materialManagement: number
    specialDiscount: number
    subtotalBeforeDiscount: number
    grandTotal: string
    unitTotal: string
  }
}

export type SmtBoardDetail = SmtPcbBoard & {
  setupPartCount: number
  setupMinutes: number
  setupMinApplied: boolean
  setupAmount: number
  setupRate: number
  laborUnit: number
  laborRaw: number
  laborMinApplied: boolean
  laborMinAdjustment: number
  chipTotal: number
  aoiInspectionUnit: number
  xrayInspectionUnit: number
  visualInspectionUnit: number
  inspectionUnit: number
  pcbWashUnit: number
}

export type DipBoardDetail = DipPcbBoard & {
  boardUnit: number
}

export type QuoteListFilter = 'all' | QuoteType
