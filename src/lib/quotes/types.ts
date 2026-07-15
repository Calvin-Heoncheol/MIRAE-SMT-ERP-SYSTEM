export type QuoteType = 'export' | 'domestic' | 'legacy'

/** 해외용 견적서 미리보기·입력 화면 표시 통화 */
export type QuoteDisplayCurrency = 'usd' | 'krw'

export type SmtPcbBoard = {
  pcbName: string
  chip: number
  icPin: number
  bga: number
  smtOdd: number
  smtSpecial: number
  smtSide: 'single' | 'double'
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
}

export type LegacyBoardSide = 'single' | 'double'

export type LegacyBoardInput = {
  name: string
  smtSide: LegacyBoardSide
}

/** DIP 조립·테스트·포장 세부 공정 행 */
export type PostProcessLine = {
  name: string
  minutes: number
}

export type QuoteDetailInfo = {
  amounts?: QuoteDetailAmounts
  inputs?: {
    smt?: {
      pcbBoards?: SmtPcbBoard[]
      smtSide?: 'single' | 'double'
      /** (구) 견적 보드별 단면/양면 */
      legacyBoards?: LegacyBoardInput[]
    }
    dip?: { dipBoards?: DipPcbBoard[] }
    postProcess?: {
      /** 합계 분 (하위호환·계산용) */
      postAssembly?: number
      postTest?: number
      postPacking?: number
      /** 세부 행 */
      assemblyLines?: PostProcessLine[]
      testLines?: PostProcessLine[]
      packingLines?: PostProcessLine[]
    }
  }
  settings?: {
    materialCostPerUnit?: number
    pcbBoardCount?: number
    specialDiscount?: number
    quoteType?: QuoteType
    smtIncludesSetup?: boolean
    /** (구) 견적 품목 반영으로 연결된 반제품 */
    linkedSemiItemId?: string
    /** (구) 견적 품목 반영 — 보드별 반제품 (우선) */
    linkedSemiItemIds?: string[]
    /** (구) 견적 품목 반영으로 연결된 완제품 */
    linkedFinishedItemId?: string
    /** (구) 견적 공정 카테고리 — smt | post | smt_post */
    processType?: 'smt' | 'post' | 'smt_post'
    /** 국내용/해외용 — SMD(SMT) 입력 섹션 사용 */
    includeSmd?: boolean
    /** 국내용/해외용 — DIP(납땜·조립·테스트·포장) 입력 섹션 사용 */
    includeDip?: boolean
    /** (구) 견적 통합 단가 */
    unitPrice?: number
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
  created_at: string
  updated_at: string
}

export type QuoteListItem = {
  quoteId: string
  quoteNumber: string
  quoteDate: string
  quoteType: QuoteType
  customer: string
  productName: string
  boardQty: number
  totalAmount: number
  detailInfo: QuoteDetailInfo
  createdAt: string
}

export type EstimateInput = {
  boardQty?: number | string
  materialCost?: number | string
  postAssembly?: number | string
  postTest?: number | string
  postPacking?: number | string
  specialDiscount?: number | string
  pcbBoardCount?: number | string
  pcbBoards?: SmtPcbBoard[]
  dipBoards?: DipPcbBoard[]
  quoteType?: QuoteType
  existingQuoteNumber?: string
  /** @deprecated legacy single-board fields */
  smtSide?: 'single' | 'double'
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
