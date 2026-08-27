/** ERP UI 공통 토큰 — Primary는 통일, 모듈 색은 포커스/배지에만 사용 */

export type ErpModuleAccent =
  | 'neutral'
  | 'sky'
  | 'blue'
  | 'orange'
  | 'violet'
  | 'emerald'
  | 'slate'

/** 모듈별 악센트 (검색 focus, 건수 tint, 배지) */
export const ERP_MODULE_ACCENT = {
  orders: 'slate',
  quotes: 'slate',
  master: 'slate',
  inventory: 'slate',
  inbound: 'slate',
  outbound: 'slate',
  purchaseOrders: 'slate',
  smt: 'sky',
  postProcess: 'emerald',
  delivery: 'sky',
  production: 'sky',
  approvals: 'slate',
} as const satisfies Record<string, ErpModuleAccent>

export const ERP_PRIMARY_BUTTON_CLASS =
  'rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300'

export const ERP_SECONDARY_BUTTON_CLASS =
  'rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

export const ERP_DANGER_BUTTON_CLASS =
  'rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50'

/** 내보내기 — Excel / PDF 공통. CTA가 아니므로 secondary 톤 */
export const ERP_EXPORT_BUTTON_CLASS =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

export const ERP_EXCEL_BUTTON_CLASS = ERP_EXPORT_BUTTON_CLASS
export const ERP_PDF_BUTTON_CLASS = ERP_EXPORT_BUTTON_CLASS

/** 필터 칩 활성 — Primary와 동일 톤 */
export const ERP_FILTER_CHIP_ACTIVE_CLASS = 'bg-slate-800 text-white'
export const ERP_FILTER_CHIP_IDLE_CLASS =
  'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'

const SEARCH_FOCUS: Record<ErpModuleAccent, string> = {
  neutral: 'ring-slate-100 focus:border-slate-400 focus:ring-2',
  sky: 'ring-sky-100 focus:border-sky-300 focus:ring-2',
  blue: 'ring-blue-100 focus:border-blue-300 focus:ring-2',
  orange: 'ring-orange-100 focus:border-orange-300 focus:ring-2',
  violet: 'ring-violet-100 focus:border-violet-300 focus:ring-2',
  emerald: 'ring-emerald-100 focus:border-emerald-300 focus:ring-2',
  slate: 'ring-slate-100 focus:border-slate-400 focus:ring-2',
}

const COUNT_TINT: Record<ErpModuleAccent, string> = {
  neutral: 'text-slate-900',
  sky: 'text-sky-700',
  blue: 'text-blue-700',
  orange: 'text-orange-700',
  violet: 'text-violet-700',
  emerald: 'text-emerald-700',
  slate: 'text-slate-900',
}

export function erpSearchFocusClass(accent: ErpModuleAccent = 'neutral') {
  return SEARCH_FOCUS[accent]
}

export function erpCountTintClass(accent: ErpModuleAccent = 'neutral') {
  return COUNT_TINT[accent]
}

export const ERP_SEARCH_INPUT_BASE =
  'w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400'

export const ERP_TABLE_WRAP_CLASS =
  'flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white'

/** 표 본문 스크롤 — sticky thead와 함께 사용 */
export const ERP_TABLE_SCROLL_CLASS = 'min-h-0 flex-1 overflow-auto'

/** `.erp-data-table` — globals.css에서 th/td 패딩을 통일(px-4 / py-3). w-full로 컨테이너 폭을 채움(min-w만 있으면 넓은 화면에서 우측 공백) */
export const ERP_TABLE_CLASS = 'erp-data-table w-full min-w-full border-collapse text-left text-sm'

export const ERP_TABLE_HEAD_CLASS =
  'sticky top-0 z-[1] bg-slate-50 text-xs font-semibold text-slate-500'

/** 목록 표 공통 밀도 — CSS와 동일 값(개별 유틸이 있어도 erp-data-table이 우선) */
export const ERP_TABLE_TH_CLASS = 'px-4 py-3'
export const ERP_TABLE_TD_CLASS = 'px-4 py-3'

/** 입력·편집용 조밀 표 (모달 라인 등) */
export const ERP_TABLE_COMPACT_CLASS = 'erp-data-table erp-data-table--compact'

/** 긴 텍스트(품명·고객·비고 등) — 줄바꿈 허용, 한글 한 글자씩 끊김 방지 */
export const ERP_TABLE_TD_WRAP_CLASS =
  'min-w-0 whitespace-normal break-keep [overflow-wrap:break-word]'

/** 날짜·코드·수량·금액·짧은 칩 — 한 줄 유지 */
export const ERP_TABLE_TD_FIXED_CLASS = 'whitespace-nowrap'

/** 뱃지·상태 라벨 — 절대 줄바꿈 금지 */
export const ERP_BADGE_CLASS =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold'

/** 사이드바·현황용 소형 뱃지 */
export const ERP_BADGE_COMPACT_CLASS =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold ring-1'

/** 테이블 밖 긴 한글 텍스트(모달·카드) */
export const ERP_TEXT_WRAP_CLASS =
  'min-w-0 whitespace-normal break-keep [overflow-wrap:break-word]'

export const ERP_TABLE_ROW_CLASS =
  'border-t border-slate-100 even:bg-slate-50/60 hover:bg-slate-50/80'

/** 모달·페이지 공통 오버레이 (ErpModal과 동일) */
export const ERP_MODAL_OVERLAY_CLASS = 'bg-slate-900/45'

/** 경고·주의 안내 박스 (amber) */
export const ERP_WARNING_BOX_CLASS =
  'rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'

/** 성공 안내 박스 */
export const ERP_SUCCESS_BOX_CLASS =
  'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'

/** 위험/오류 인라인 박스 (배너보다 조밀) */
export const ERP_DANGER_BOX_CLASS =
  'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'

/**
 * 입력 위젯 규칙
 * - 마스터 참조(거래처·품목·자재·발주서): Combobox
 * - 고정 enum(대략 5개 이하): native select
 */
export const ERP_INPUT_WIDGET_RULE =
  'master→combobox · fixed-enum→select' as const

/** radius 스케일: 필드/버튼 lg · 표 wrap·empty xl · 모달 2xl · 칩 full · compact badge md */

/** 폼 필드 공통 */
export const ERP_FIELD_LABEL_CLASS = 'mb-1 block font-medium text-slate-600'
export const ERP_FIELD_INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-slate-100 focus:border-slate-400 focus:ring-2 disabled:bg-slate-50'

/** 테이블·목록 행 추가 버튼 (섹션 헤더 우측) */
export const ERP_ROW_ADD_BUTTON_CLASS =
  'inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50'

/** 붙여넣기·안내 박스 */
export const ERP_INFO_BOX_CLASS = 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-3'
export const ERP_INFO_BOX_TITLE_CLASS = 'text-sm font-medium text-slate-900'
export const ERP_INFO_BOX_TEXT_CLASS = 'mt-1 text-xs text-slate-600'
export const ERP_PASTE_TEXTAREA_CLASS =
  'mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none ring-slate-100 focus:border-slate-400 focus:ring-2 disabled:opacity-50'

export type ErpStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export const ERP_STATUS_TONE_CLASS: Record<ErpStatusTone, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-rose-100 text-rose-800',
  info: 'bg-sky-100 text-sky-800',
  neutral: 'bg-slate-100 text-slate-700',
}

/** 목록 fetch 실패 배너 (수금·거래명세서와 동일 rose) */
export const ERP_ERROR_BANNER_CLASS =
  'rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700'

export const ERP_ERROR_BANNER_HINT_CLASS = 'mt-3 text-xs text-rose-800'

/** 빈 목록 메시지: 검색/필터 시 조건 안내, 아니면 없음 + 다음 액션 */
export function formatEmptyListMessage(options: {
  hasQuery: boolean
  emptyLabel: string
  actionHint?: string
}) {
  if (options.hasQuery) {
    return '검색 결과가 없습니다. 조건을 바꿔 보세요.'
  }
  if (options.actionHint) {
    const label = options.emptyLabel.replace(/[.。]+$/, '')
    return `${label}. ${options.actionHint}`
  }
  return options.emptyLabel
}
