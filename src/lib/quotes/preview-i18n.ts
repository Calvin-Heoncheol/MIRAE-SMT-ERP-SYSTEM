import type { QuoteType } from './types'
import { formatPostProcessMinutesDisplay, roundPostProcessMinutes } from './post-process-lines'

function formatMinutesCountLabel(minutes: number | string, unit: '분' | 'min' | '分钟') {
  const rounded = roundPostProcessMinutes(minutes)
  if (rounded <= 0) {
    if (unit === '분') return '0분'
    if (unit === '分钟') return '0分钟'
    return '0 min'
  }
  const value = formatPostProcessMinutesDisplay(rounded)
  if (unit === '분') return `${value}분`
  if (unit === '分钟') return `${value}分钟`
  return `${value} min`
}

/** PDF 출력 언어 */
export type QuoteDocumentLanguage = 'ko' | 'en' | 'zh'

/** 문구 로케일 — 국내/해외 견적 타입과 분리, 중문 포함 */
export type QuoteLabelType = QuoteType | 'zh'

/** PDF·미리보기 문구용 타입 (금액 계산 quoteType 과 분리 가능) */
export function resolveLabelQuoteType(
  quoteType: QuoteType,
  language?: QuoteDocumentLanguage,
): QuoteLabelType {
  if (language === 'en') return 'export'
  if (language === 'ko') return 'domestic'
  if (language === 'zh') return 'zh'
  return quoteType
}

export function resolvePdfLanguage(
  quoteType: QuoteType,
  language?: QuoteDocumentLanguage,
): QuoteDocumentLanguage {
  if (language === 'ko' || language === 'en' || language === 'zh') return language
  return quoteType === 'export' ? 'en' : 'ko'
}

export type PreviewLabels = {
  title: string
  colItem: string
  colUnit: string
  /** 행 대당 금액 (단가×수량 등) */
  colUnitTotal: string
  colQty: string
  colPerUnitTotal: string
  /** SET-UP 섹션 전용 — 단가 자리 */
  colSetupBasis: string
  /** SET-UP 섹션 전용 — 수량 자리 */
  colSetupMinutes: string
  /** SMD 섹션 — 부품·핀 등 작업 단위 */
  colSmdWorkQty: string
  /** 후공정 섹션 — 핀수·작업분 등 */
  colPostWorkQty: string
  /** 후공정 섹션 — 분당 임률 */
  colPostRate: string
  /** SMD·후공정 — 생산수량 */
  colProductionQty: string
  issueDate: string
  customer: string
  validity: string
  supplier: string
  product: string
  contact: string
  quantity: string
  perUnitPriceVat: string
  supplyAmount: string
  vatAmount: string
  grandTotalVat: string
  grandTotalVatIncl: string
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
  download: string
  test: string
  packing: string
  corporateProfit: string
  corporateProfitDesc: string
  materials: string
  orderLevelCosts: string
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
  setting: string
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
  colUnit: '대당 단가',
  colUnitTotal: '대당합계',
  colQty: '수량',
  colPerUnitTotal: '합계',
  colSetupBasis: '산출 근거',
  colSetupMinutes: '시간(분)',
  colSmdWorkQty: '부품수',
  colPostWorkQty: '작업량',
  colPostRate: '분당 임률',
  colProductionQty: '생산수량',
  issueDate: '발행일자',
  customer: '고객사',
  validity: '유효기간',
  supplier: '공급자',
  product: '제품명',
  contact: '담당자',
  quantity: '생산 수량',
  perUnitPriceVat: '대당 단가 (VAT 별도)',
  supplyAmount: '공급가액',
  vatAmount: '부가세 (10%)',
  grandTotalVat: '최종 합계 금액 (VAT 별도)',
  grandTotalVatIncl: '최종 합계 금액 (VAT 포함)',
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
  download: '다운로드',
  test: '테스트',
  packing: '포장',
  corporateProfit: '기업이윤',
  corporateProfitDesc: '제조비용(SMD+후공정)의 10%',
  materials: '자재',
  orderLevelCosts: '건당 비용 (발주 1회)',
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
  setting: '세팅',
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
  minutesCount: (minutes) => formatMinutesCountLabel(minutes, '분'),
  formatQty: (qty) => `${qty.toLocaleString('ko-KR')}EA`,
}

const EXPORT_LABELS: PreviewLabels = {
  title: 'QUOTATION',
  colItem: 'Item',
  colUnit: 'Per-Unit Price',
  colUnitTotal: 'Unit Total',
  colQty: 'Qty',
  colPerUnitTotal: 'Total',
  colSetupBasis: 'Basis',
  colSetupMinutes: 'Time (min)',
  colSmdWorkQty: 'Parts',
  colPostWorkQty: 'Work Time',
  colPostRate: 'Rate /min',
  colProductionQty: 'Prod. Qty',
  issueDate: 'Issue Date',
  customer: 'Customer',
  validity: 'Valid Until',
  supplier: 'From',
  product: 'Product',
  contact: 'Contact',
  quantity: 'Quantity',
  perUnitPriceVat: 'Unit Price (excl. VAT)',
  supplyAmount: 'Supply Amount',
  vatAmount: 'VAT (10%)',
  grandTotalVat: 'Grand Total (excl. VAT)',
  grandTotalVatIncl: 'Grand Total (incl. VAT)',
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
  download: 'Download',
  test: 'Test',
  packing: 'Packing',
  corporateProfit: 'Corporate Profit',
  corporateProfitDesc: '10% of manufacturing cost (SMD + post-process)',
  materials: 'Materials',
  orderLevelCosts: 'Order-Level Costs (per PO)',
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
  setting: 'SETTING',
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
  minutesCount: (minutes) => formatMinutesCountLabel(minutes, 'min'),
  formatQty: (qty) => `${qty.toLocaleString('en-US')}${' EA'}`,
}

const CHINESE_LABELS: PreviewLabels = {
  title: '报 价 单',
  colItem: '项目',
  colUnit: '单价',
  colUnitTotal: '单价合计',
  colQty: '数量',
  colPerUnitTotal: '合计',
  colSetupBasis: '计算依据',
  colSetupMinutes: '时间(分)',
  colSmdWorkQty: '部品数',
  colPostWorkQty: '作业量',
  colPostRate: '每分钟费率',
  colProductionQty: '生产数量',
  issueDate: '发行日期',
  customer: '客户',
  validity: '有效期',
  supplier: '供应方',
  product: '产品名',
  contact: '负责人',
  quantity: '生产数量',
  perUnitPriceVat: '单价 (不含增值税)',
  supplyAmount: '供应金额',
  vatAmount: '增值税 (10%)',
  grandTotalVat: '最终合计 (不含增值税)',
  grandTotalVatIncl: '最终合计 (含增值税)',
  loadingPreview: '正在加载预览...',
  emptyPreview: '在左侧输入数值后显示预览',
  qtySuffix: 'EA',
  minPlacement: '最低贴装费',
  oddParts: '异形',
  specialParts: '特殊/模块',
  inspectionCombined: 'AOI、X-RAY及外观检查',
  aoi: 'AOI',
  pcbWash: '清洗',
  inspection: '检查',
  soldering: '焊接',
  postProcess: '后工序',
  assembly: '组装',
  download: '下载',
  test: '测试',
  packing: '包装',
  corporateProfit: '企业利润',
  corporateProfitDesc: '制造成本(SMD+后工序)的10%',
  materials: '材料',
  orderLevelCosts: '按订单费用 (每单1次)',
  other: '其他',
  rawMaterial: '原材料费用',
  managementFee: '管理费',
  auxiliaryMaterial: '辅材费用',
  subMaterial: '钢网费用 (一次性)',
  metalMask: '钢网费用 (一次性)',
  sampleCost: '样品费用',
  productionKind: '类别',
  productionKindSample: '样品',
  productionKindMass: '量产',
  setupBaseTime: '基本时间',
  firstArticle: '首件检查',
  setting: 'SETTING',
  setupBaseDesc: 'Loader/Unloader · Screen Print & SPI · Reflow Profile 测定',
  setupFirstArticleDesc: 'BOM贴装确认及LCR测定',
  setupSettingDesc: '供料器安装及坐标确认',
  sideSingle: '单面',
  sideDual: '双面(Dual)',
  sideDouble: '双面',
  dipGeneral: '手工焊小型(1~3PIN)',
  dipConnector: '手工焊中型(4~10PIN)',
  dipWire: '手工焊大型(10PIN+)',
  waveGeneral: 'WAVE普通(1~3PIN)',
  waveConnector: 'WAVE中型(4~10PIN)',
  waveWire: 'WAVE大型(10PIN+)',
  onePcb: '1 PCB',
  oneUnit: '1台',
  oneTime: '1次',
  minPlacementDesc: (score, threshold) => `${score}分 · ${threshold}分以下`,
  partsCount: (count) => `${count}个`,
  minutesCount: (minutes) => formatMinutesCountLabel(minutes, '分钟'),
  formatQty: (qty) => `${qty.toLocaleString('zh-CN')}EA`,
}

export function getPreviewLabels(labelType: QuoteLabelType): PreviewLabels {
  if (labelType === 'zh') return CHINESE_LABELS
  if (labelType === 'export') return EXPORT_LABELS
  return DOMESTIC_LABELS
}

const POST_PROCESS_ITEM_NAME_EN: Record<string, string> = {
  조립: 'Assembly',
  다운로드: 'Download',
  테스트: 'Test',
  포장: 'Packing',
  납땜: 'Soldering',
  세척: 'PCB Wash',
  검사: 'Inspection',
}

const POST_PROCESS_ITEM_NAME_ZH: Record<string, string> = {
  조립: '组装',
  다운로드: '下载',
  테스트: '测试',
  포장: '包装',
  납땜: '焊接',
  세척: '清洗',
  검사: '检查',
  Assembly: '组装',
  Download: '下载',
  Test: '测试',
  Packing: '包装',
  Soldering: '焊接',
  'PCB Wash': '清洗',
  Inspection: '检查',
}

/** 견적서 Item 칸 — 저장된 공정명을 문서 언어로 표시 */
export function localizePostProcessItemName(name: string, labelType: QuoteLabelType) {
  const trimmed = name.trim()
  if (!trimmed || labelType === 'domestic') return trimmed
  if (labelType === 'zh') return POST_PROCESS_ITEM_NAME_ZH[trimmed] ?? trimmed
  return POST_PROCESS_ITEM_NAME_EN[trimmed] ?? trimmed
}

export function breakdownSmtSectionTitle(labelType: QuoteLabelType) {
  if (labelType === 'zh') return 'SMD · 贴装·检查'
  if (labelType === 'domestic') return 'SMD · 실장·검사'
  return 'SMD · Placement & Inspection'
}

export function breakdownBoardColLabelLocalized(labelType: QuoteLabelType) {
  if (labelType === 'zh') return '板卡'
  if (labelType === 'domestic') return '보드'
  return 'BOARD'
}

export function pdfSummarySectionLabelLocalized(label: string, labelType: QuoteLabelType) {
  if (labelType === 'domestic') return label
  if (labelType === 'zh') return label
  return label.toUpperCase()
}
