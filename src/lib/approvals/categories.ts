import type { ApprovalDetailItem } from './types'

export const APPROVAL_CATEGORIES = [
  {
    slug: 'consumables',
    label: '부자재/소모품',
    shortLabel: '부자재/소모품',
    href: '/approvals/consumables',
    description: '제품에 직접 들어가거나 생산을 위해 계속 소비되는 자재 관련 지출입니다.',
    examples:
      '솔더페이스트(납), 세척제, SMT 노즐, 피더 부품, 와이퍼 roll, 정전기 방지 용품(지그, 장갑, 제전복) 등',
  },
  {
    slug: 'equipment-purchase',
    label: '장비 구입',
    shortLabel: '장비 구입',
    href: '/approvals/equipment-purchase',
    description: '생산·검사에 사용하는 장비 구입 관련 지출입니다.',
    examples: '마운터, 리플로우, AOI, 스크린프린터, 검사 장비 등',
  },
  {
    slug: 'facility-investment',
    label: '설비 투자',
    shortLabel: '설비 투자',
    href: '/approvals/facility-investment',
    description:
      '회사 자산으로 반영되는 설비·시설·인프라 투자 지출입니다. 생산 설비뿐 아니라 사내 시설 개선·교체도 포함합니다.',
    examples:
      '랙(Rack) 설비, 공조·전력 설비, 라인 증설, 형광등 교체, 벽지·바닥재 교체, 시설 보수 등',
  },
  {
    slug: 'maintenance',
    label: '수리/유지보수',
    shortLabel: '수리/유지보수',
    href: '/approvals/maintenance',
    description: '기존 설비를 고치거나 성능을 유지하기 위해 들어가는 비용입니다.',
    examples: '마운터 헤드 수리비, 모터 교체, 설비 정기 교정(Calibration), 노즐 클리닝 외주 등',
  },
  {
    slug: 'duty-tax',
    label: '관세/부가세',
    shortLabel: '관세/부가세',
    href: '/approvals/duty-tax',
    description: '수입 자재·장비 등과 관련된 관세 및 부가세 납부 지출입니다.',
    examples: '수입 부품/장비 관세, 통관 부가세 납부, 관세사 수수료 등',
  },
  {
    slug: 'exhibition-program',
    label: '전시회/대외활동',
    shortLabel: '전시회/대외활동',
    href: '/approvals/exhibition-program',
    description: '국내외 전시회 참가 및 정부 지원 사업, 수출 지원 프로그램 등 대외 활동 관련 지출입니다.',
    examples: 'SIMTOS 등 국내외 전시회 부스비, 해외 지사화 프로그램 참가비 등',
  },
  {
    slug: 'general',
    label: '기타',
    shortLabel: '기타',
    href: '/approvals/general',
    description: '위 분류에 속하지 않는 일상 운영 비용이나 잡지출입니다.',
    examples: '사무용품, 사내 소프트웨어(ERP/SW) 구독료, 회식비, 경조사비, 부서 운영비, 회사 홍보물 제작 등',
  },
] as const

export type ApprovalCategory = (typeof APPROVAL_CATEGORIES)[number]['slug']

export const DEFAULT_APPROVAL_CATEGORY: ApprovalCategory = 'consumables'

export function isApprovalCategory(value: string): value is ApprovalCategory {
  return APPROVAL_CATEGORIES.some((category) => category.slug === value)
}

export function getApprovalCategory(slug: string) {
  return APPROVAL_CATEGORIES.find((category) => category.slug === slug)
}

export function getApprovalCategoryLabel(slug: ApprovalCategory) {
  return getApprovalCategory(slug)?.label ?? slug
}

export function getApprovalCategoryShortLabel(slug: ApprovalCategory) {
  return getApprovalCategory(slug)?.shortLabel ?? slug
}

export function getApprovalCategoryDescription(slug: ApprovalCategory) {
  return getApprovalCategory(slug)?.description ?? ''
}

export function getApprovalCategoryExamples(slug: ApprovalCategory) {
  return getApprovalCategory(slug)?.examples ?? ''
}

export function getApprovalSubjectPlaceholder(category: ApprovalCategory) {
  if (category === 'consumables') return '예: SMT 양산용 부자재/소모품 구매의 건'
  if (category === 'equipment-purchase') return '예: 신규 고속 마운터 구매의 건'
  if (category === 'facility-investment') return '예: 생산 라인 시설 개선 공사의 건'
  if (category === 'maintenance') return '예: 마운터 헤드 수리 및 유지보수의 건'
  if (category === 'duty-tax') return '예: 수입 부품 관세 및 통관 부가세 납부의 건'
  if (category === 'exhibition-program') return '예: SIMTOS 전시회 참가비 집행의 건'
  if (category === 'general') return '예: 부서 운영 일반 경비 집행의 건'
  return ''
}

export type ApprovalDetailColumn = {
  key: keyof ApprovalDetailItem
  label: string
  computed?: boolean
  inputType?: 'text' | 'date'
}

const CONSUMABLES_DETAIL_COLUMNS: ApprovalDetailColumn[] = [
  { key: 'name', label: '품목명' },
  { key: 'model', label: '규격' },
  { key: 'supplier', label: '공급사' },
  { key: 'qty', label: '수량' },
  { key: 'unit', label: '단위' },
  { key: 'unitPrice', label: '단가' },
  { key: 'amount', label: '공급가액', computed: true },
  { key: 'note', label: '비고' },
]

const EQUIPMENT_PURCHASE_DETAIL_COLUMNS: ApprovalDetailColumn[] = [
  { key: 'name', label: '설비명' },
  { key: 'model', label: '규격(사양)' },
  { key: 'supplier', label: '공급사' },
  { key: 'qty', label: '수량' },
  { key: 'unitPrice', label: '단가' },
  { key: 'amount', label: '공급가액', computed: true },
  { key: 'note', label: '비고' },
]

const MAINTENANCE_DETAIL_COLUMNS: ApprovalDetailColumn[] = [
  { key: 'name', label: '설비 대상' },
  { key: 'partNumber', label: '상세 내역' },
  { key: 'supplier', label: '업체' },
  { key: 'qty', label: '수량' },
  { key: 'unitPrice', label: '단가' },
  { key: 'amount', label: '공급가액', computed: true },
  { key: 'note', label: '비고' },
]

const DUTY_TAX_DETAIL_COLUMNS: ApprovalDetailColumn[] = [
  { key: 'name', label: '비용 항목' },
  { key: 'model', label: '수입신고번호' },
  { key: 'supplier', label: '납부처' },
  { key: 'unitPrice', label: '관세' },
  { key: 'amount', label: '부가세' },
  { key: 'dueDate', label: '납부 마감일', inputType: 'date' },
  { key: 'note', label: '비고' },
]

const EXHIBITION_PROGRAM_DETAIL_COLUMNS: ApprovalDetailColumn[] = [
  { key: 'name', label: '비용 항목' },
  { key: 'model', label: '세부 내용' },
  { key: 'supplier', label: '지급처(주관사)' },
  { key: 'amount', label: '금액' },
  { key: 'note', label: '비고' },
]

const GENERAL_DETAIL_COLUMNS: ApprovalDetailColumn[] = [
  { key: 'dueDate', label: '사용 일자', inputType: 'date' },
  { key: 'name', label: '지출 세부내역' },
  { key: 'supplier', label: '가맹점명(사용처)' },
  { key: 'amount', label: '금액' },
  { key: 'model', label: '증빙 유형' },
  { key: 'note', label: '비고' },
]

const DEFAULT_DETAIL_COLUMNS: ApprovalDetailColumn[] = [
  { key: 'name', label: '품명' },
  { key: 'model', label: '규격/모델' },
  { key: 'qty', label: '수량' },
  { key: 'unitPrice', label: '단가' },
  { key: 'amount', label: '공급가액', computed: true },
  { key: 'note', label: '비고' },
]

const FACILITY_INVESTMENT_DETAIL_COLUMNS: ApprovalDetailColumn[] = [
  { key: 'name', label: '투자 대상' },
  { key: 'partNumber', label: '상세 내역' },
  { key: 'supplier', label: '시공 업체' },
  { key: 'qty', label: '수량' },
  { key: 'unitPrice', label: '단가' },
  { key: 'amount', label: '공급가액', computed: true },
  { key: 'dueDate', label: '공사 기간(완료일)', inputType: 'date' },
  { key: 'note', label: '비고' },
]

const EQUIPMENT_PURCHASE_INTRO_PLACEHOLDER = `■ 구매 목적: 신규 고속 마운터 도입 / 기판 검사용 AOI 장비 추가 구매
■ 기대효과: 생산 캐파(Capa) 15% 증대, 불량률 1.5% 감소

품의 하오니 검토 후 재가하여 주시기 바랍니다.`

const CONSUMABLES_INTRO_PLACEHOLDER = `■ 구매 목적: SMT 양산 투입용 부자재/소모품 선구매
■ 사용 계획: 솔더페이스트, 노즐, 세척제 등 생산 일정에 맞춰 순차 사용

품의 하오니 검토 후 재가하여 주시기 바랍니다.`

const FACILITY_INVESTMENT_INTRO_PLACEHOLDER = `■ 투자 목적: 작업 환경 및 생산 인프라 개선을 위한 설비/시설 투자
■ 기대효과: 생산 효율 향상, 작업 안전성 개선, 유지관리 비용 절감

품의 하오니 검토 후 재가하여 주시기 바랍니다.`

const MAINTENANCE_INTRO_PLACEHOLDER = `■ 수리 목적: 기존 설비의 정상 가동 회복 및 품질 안정화
■ 기대효과: 비가동 시간 최소화, 생산 차질 방지, 불량률 감소

품의 하오니 검토 후 재가하여 주시기 바랍니다.`

const DUTY_TAX_INTRO_PLACEHOLDER = `■ 납부 목적: 수입 건 통관 완료 및 세금 납부 처리
■ 비고 사항: 수입신고번호 기준으로 관세와 부가세를 구분하여 정산

품의 하오니 검토 후 재가하여 주시기 바랍니다.`

const EXHIBITION_PROGRAM_INTRO_PLACEHOLDER = `■ 참여 목적: 전시회/대외활동을 통한 판로 확대 및 사업 기회 발굴
■ 기대효과: 신규 거래처 발굴, 브랜드 인지도 향상, 정부 지원 사업 연계

품의 하오니 검토 후 재가하여 주시기 바랍니다.`

const GENERAL_INTRO_PLACEHOLDER = `■ 지출 목적: 부서 운영 및 회사 공통 업무 수행을 위한 일반 경비 집행
■ 기대효과: 업무 지원 효율 향상 및 원활한 조직 운영

품의 하오니 검토 후 재가하여 주시기 바랍니다.`

const COMPUTED_LINE_AMOUNT_CATEGORIES = new Set<ApprovalCategory>([
  'consumables',
  'equipment-purchase',
  'maintenance',
  'facility-investment',
])

export function usesComputedLineAmount(category: ApprovalCategory) {
  return COMPUTED_LINE_AMOUNT_CATEGORIES.has(category)
}

export function usesAmountBasisSelector(category: ApprovalCategory) {
  return category !== 'duty-tax'
}

export function getApprovalDetailColumns(category: ApprovalCategory): ApprovalDetailColumn[] {
  if (category === 'consumables') return CONSUMABLES_DETAIL_COLUMNS
  if (category === 'equipment-purchase') return EQUIPMENT_PURCHASE_DETAIL_COLUMNS
  if (category === 'facility-investment') return FACILITY_INVESTMENT_DETAIL_COLUMNS
  if (category === 'maintenance') return MAINTENANCE_DETAIL_COLUMNS
  if (category === 'duty-tax') return DUTY_TAX_DETAIL_COLUMNS
  if (category === 'exhibition-program') return EXHIBITION_PROGRAM_DETAIL_COLUMNS
  if (category === 'general') return GENERAL_DETAIL_COLUMNS
  return DEFAULT_DETAIL_COLUMNS
}

export function getApprovalIntroBodyPlaceholder(category: ApprovalCategory) {
  if (category === 'consumables') return CONSUMABLES_INTRO_PLACEHOLDER
  if (category === 'equipment-purchase') return EQUIPMENT_PURCHASE_INTRO_PLACEHOLDER
  if (category === 'facility-investment') return FACILITY_INVESTMENT_INTRO_PLACEHOLDER
  if (category === 'maintenance') return MAINTENANCE_INTRO_PLACEHOLDER
  if (category === 'duty-tax') return DUTY_TAX_INTRO_PLACEHOLDER
  if (category === 'exhibition-program') return EXHIBITION_PROGRAM_INTRO_PLACEHOLDER
  if (category === 'general') return GENERAL_INTRO_PLACEHOLDER
  return ''
}
