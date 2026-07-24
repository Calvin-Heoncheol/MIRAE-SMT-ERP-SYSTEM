import type { QuoteType } from './types'

export type QuoteDocumentLanguage = 'ko' | 'en'

/** PDF·미리보기 문구용 타입 (금액 계산 quoteType 과 분리 가능) */
export function resolveLabelQuoteType(
  quoteType: QuoteType,
  language?: QuoteDocumentLanguage,
): QuoteType {
  if (language === 'en') return 'export'
  if (language === 'ko') return 'domestic'
  return quoteType
}

export type PreviewLabels = {
  title: string
  colItem: string
  colUnit: string
  colQty: string
  colPerUnitTotal: string
  issueDate: string
  customer: string
  validity: string
  supplier: string
  product: string
  contact: string
  quantity: string
  perUnitPriceVat: string
  grandTotalVat: string
  loadingPreview: string
  emptyPreview: string
  qtySuffix: string
  minPlacement: string
  oddParts: string
  specialParts: string
  inspectionCombined: string
  aoi: string
  pcbWash: string
  inspection: string
  soldering: string
  postProcess: string
  assembly: string
  test: string
  packing: string
  assemblyDesc: string
  testDesc: string
  packingDesc: string
  materials: string
  other: string
  rawMaterial: string
  managementFee: string
  auxiliaryMaterial: string
  subMaterial: string
  metalMask: string
  sampleCost: string
  productionKind: string
  productionKindSample: string
  productionKindMass: string
  setupBaseTime: string
  firstArticle: string
  setupBaseDesc: string
  setupFirstArticleDesc: string
  setupSettingDesc: string
  sideSingle: string
  sideDual: string
  sideDouble: string
  dipGeneral: string
  dipConnector: string
  dipWire: string
  waveGeneral: string
  waveConnector: string
  waveWire: string
  onePcb: string
  oneUnit: string
  oneTime: string
  minPlacementDesc: (score: number, threshold: number) => string
  partsCount: (count: number) => string
  minutesCount: (minutes: number | string) => string
  formatQty: (qty: number) => string
}

const DOMESTIC_LABELS: PreviewLabels = {
  title: '견 적 서',
  colItem: '항목',
  colUnit: '단가',
  colQty: '수량',
  colPerUnitTotal: '대당 합계',
  issueDate: '발행일자',
  customer: '고객사',
  validity: '유효기간',
  supplier: '공급자',
  product: '제품명',
  contact: '담당자',
  quantity: '생산 수량',
  perUnitPriceVat: '대당 단가 (VAT 별도)',
  grandTotalVat: '최종 합계 금액 (VAT 별도)',
  loadingPreview: '미리보기를 불러오는 중...',
  emptyPreview: '왼쪽에서 값을 입력하면 미리보기가 표시됩니다',
  qtySuffix: 'EA',
  minPlacement: '최소 실장비',
  oddParts: '이형',
  specialParts: '특수/모듈',
  inspectionCombined: 'AOI, X-RAY 및 외관검사',
  aoi: 'AOI',
  pcbWash: '세척',
  inspection: '검사',
  soldering: '납땜',
  postProcess: '후공정',
  assembly: '조립',
  test: '테스트',
  packing: '포장',
  assemblyDesc: 'Base · Illumination · Top · Bottom',
  testDesc: '경사도 · 화이트밸런스 · MSR',
  packingDesc: '액세서리 · 제품',
  materials: '자재',
  other: '기타',
  rawMaterial: '원자재 비용',
  managementFee: '관리비',
  auxiliaryMaterial: '부자재 비용',
  subMaterial: '메탈마스크 비용 (일회성)',
  metalMask: '메탈마스크 비용 (일회성)',
  sampleCost: '샘플 비용',
  productionKind: '구분',
  productionKindSample: '샘플',
  productionKindMass: '양산',
  setupBaseTime: '기본시간',
  firstArticle: '초품검사',
  setupBaseDesc: 'Loader/Unloader · Screen Print & SPI · Reflow Profile 측정',
  setupFirstArticleDesc: 'BOM 실장 확인 및 LCR 측정',
  setupSettingDesc: '부품 피더 장착 및 좌표확인',
  sideSingle: '단면',
  sideDual: '듀얼',
  sideDouble: '양면',
  dipGeneral: '수납땜 소형(1~3PIN)',
  dipConnector: '수납땜 중형(4~10PIN)',
  dipWire: '수납땜 대형(10PIN+)',
  waveGeneral: 'WAVE 일반(1~3PIN)',
  waveConnector: 'WAVE 중형(4~10PIN)',
  waveWire: 'WAVE 대형(10PIN+)',
  onePcb: '1 PCB',
  oneUnit: '1대',
  oneTime: '1회',
  minPlacementDesc: (score, threshold) => `${score}점 · ${threshold}점 이하`,
  partsCount: (count) => `${count}개`,
  minutesCount: (minutes) => `${minutes}분`,
  formatQty: (qty) => `${qty.toLocaleString('ko-KR')}EA`,
}

const EXPORT_LABELS: PreviewLabels = {
  title: 'QUOTATION',
  colItem: 'Item',
  colUnit: 'Unit Price',
  colQty: 'Qty',
  colPerUnitTotal: 'Per Unit Total',
  issueDate: 'Issue Date',
  customer: 'Customer',
  validity: 'Valid Until',
  supplier: 'From',
  product: 'Product',
  contact: 'Contact',
  quantity: 'Quantity',
  perUnitPriceVat: 'Unit Price (excl. VAT)',
  grandTotalVat: 'Grand Total (excl. VAT)',
  loadingPreview: 'Loading preview...',
  emptyPreview: 'Enter values on the left to preview',
  qtySuffix: ' EA',
  minPlacement: 'Min Placement Fee',
  oddParts: 'Odd-Form',
  specialParts: 'Special/Module',
  inspectionCombined: 'AOI, X-Ray & Visual Inspection',
  aoi: 'AOI',
  pcbWash: 'PCB Wash',
  inspection: 'Inspection',
  soldering: 'Soldering',
  postProcess: 'Post-Process',
  assembly: 'Assembly',
  test: 'Test',
  packing: 'Packing',
  assemblyDesc: 'Base · Illumination · Top · Bottom',
  testDesc: 'Slope · White Balance · MSR',
  packingDesc: 'Accessories · Product',
  materials: 'Materials',
  other: 'Other',
  rawMaterial: 'Raw Material Cost',
  managementFee: 'Management Fee',
  auxiliaryMaterial: 'Auxiliary Material Cost',
  subMaterial: 'Metal Mask Cost (one-time)',
  metalMask: 'Metal Mask Cost (one-time)',
  sampleCost: 'Sample Fee',
  productionKind: 'Type',
  productionKindSample: 'Sample',
  productionKindMass: 'Production',
  setupBaseTime: 'Base Time',
  firstArticle: 'First Article Inspection',
  setupBaseDesc: 'Loader/Unloader · Screen Print & SPI · Reflow Profile',
  setupFirstArticleDesc: 'BOM verification & LCR measurement',
  setupSettingDesc: 'Feeder setup & coordinate verification',
  sideSingle: 'Single-sided',
  sideDual: 'Dual',
  sideDouble: 'Double-sided',
  dipGeneral: 'Hand Solder Small (1-3 PIN)',
  dipConnector: 'Hand Solder Medium (4-10 PIN)',
  dipWire: 'Hand Solder Large (10+ PIN)',
  waveGeneral: 'Wave Small (1-3 PIN)',
  waveConnector: 'Wave Medium (4-10 PIN)',
  waveWire: 'Wave Large (10+ PIN)',
  onePcb: '1 PCB',
  oneUnit: '1 unit',
  oneTime: '1 time',
  minPlacementDesc: (score, threshold) => `${score} pts · ≤${threshold} pts`,
  partsCount: (count) => `${count} pcs`,
  minutesCount: (minutes) => `${minutes} min`,
  formatQty: (qty) => `${qty.toLocaleString('en-US')}${' EA'}`,
}

export function getPreviewLabels(quoteType: QuoteType): PreviewLabels {
  return quoteType === 'export' ? EXPORT_LABELS : DOMESTIC_LABELS
}
