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
  'rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'

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
  'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'

export const ERP_TABLE_CLASS = 'min-w-full border-collapse text-left text-sm'

export const ERP_TABLE_HEAD_CLASS =
  'sticky top-0 z-[1] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500'

/** 목록 표 공통 밀도 */
export const ERP_TABLE_TH_CLASS = 'px-3 py-2.5'
export const ERP_TABLE_TD_CLASS = 'px-3 py-2.5'

export const ERP_TABLE_ROW_CLASS = 'border-t border-slate-100 hover:bg-slate-50/80'

/** 폼 필드 공통 */
export const ERP_FIELD_LABEL_CLASS = 'mb-1 block font-medium text-slate-600'
export const ERP_FIELD_INPUT_CLASS =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-slate-100 focus:border-slate-400 focus:ring-2 disabled:bg-slate-50'

/** 테이블·목록 행 추가 버튼 (섹션 헤더 우측) */
export const ERP_ROW_ADD_BUTTON_CLASS =
  'inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50'

/** 빈 목록 메시지: 없음 + 다음 액션 */
export function formatEmptyListMessage(options: {
  hasQuery: boolean
  emptyLabel: string
  actionHint?: string
}) {
  if (options.hasQuery) {
    return '검색 결과가 없습니다. 검색어를 바꿔 보세요.'
  }
  if (options.actionHint) {
    return `${options.emptyLabel}. ${options.actionHint}`
  }
  return options.emptyLabel
}
