export type PartnerTradeRole = 'purchase' | 'sales' | 'both'

export const PARTNER_TRADE_ROLES: PartnerTradeRole[] = ['purchase', 'sales', 'both']

export const PARTNER_TRADE_ROLE_LABELS: Record<PartnerTradeRole, string> = {
  purchase: '매입',
  sales: '매출',
  both: '매입/매출',
}

/** 지급 시점 기준 결제조건 */
export type PartnerPaymentTermType = '' | 'installment' | 'net' | 'monthly'

export const PARTNER_PAYMENT_TERM_TYPES: PartnerPaymentTermType[] = [
  '',
  'installment',
  'net',
  'monthly',
]

export const PARTNER_PAYMENT_TERM_TYPE_OPTIONS: Exclude<PartnerPaymentTermType, ''>[] = [
  'installment',
  'net',
  'monthly',
]

export const PARTNER_PAYMENT_TERM_TYPE_LABELS: Record<PartnerPaymentTermType, string> = {
  '': '선택 안 함',
  installment: '분할 지급',
  net: '일반 후불',
  monthly: '월괄 후불',
}

export const PARTNER_PAYMENT_TERM_TYPE_HINTS: Record<Exclude<PartnerPaymentTermType, ''>, string> = {
  installment: '선금 + 잔금',
  net: '건별 출고·계산서 기준 Net OO일',
  monthly: '월말 마감 후 익월 지정일',
}

/** 견적서·발주서 PDF 출력 언어 */
export type PartnerDocumentLanguage = 'ko' | 'en'

export const PARTNER_DOCUMENT_LANGUAGES: PartnerDocumentLanguage[] = ['ko', 'en']

export const PARTNER_DOCUMENT_LANGUAGE_LABELS: Record<PartnerDocumentLanguage, string> = {
  ko: '한국어',
  en: '영어',
}

/** 발주서·구매발주 기본 통화 */
export type PartnerCurrency = 'KRW' | 'USD'

export const PARTNER_CURRENCIES: PartnerCurrency[] = ['KRW', 'USD']

export const PARTNER_CURRENCY_LABELS: Record<PartnerCurrency, string> = {
  KRW: '원화 (KRW)',
  USD: '달러 (USD)',
}

export type BusinessPartner = {
  /** 내부 PK. BP-00001 자동채번, 수정 불가 */
  id: string
  businessRegNo: string
  name: string
  representativeName: string
  businessType: string
  address: string
  phone: string
  tradeRole: PartnerTradeRole
  paymentTermType: PartnerPaymentTermType
  /** 분할 지급 선금 % (1~99) */
  paymentDepositPercent: number
  /** 일반 후불 Net 일수 */
  paymentNetDays: number
  /** 월괄 후불 익월 입금일 (1~31) */
  paymentMonthlyDay: number
  documentLanguage: PartnerDocumentLanguage
  /** 견적서·거래명세서 부가세 포함 기본값 */
  includeVat: boolean
  currency: PartnerCurrency
  createdAt: string
  updatedAt: string
}

export type BusinessPartnerPayload = {
  businessRegNo: string
  name: string
  representativeName: string
  businessType: string
  address: string
  phone: string
  tradeRole: PartnerTradeRole
  paymentTermType: PartnerPaymentTermType
  paymentDepositPercent: number
  paymentNetDays: number
  paymentMonthlyDay: number
  documentLanguage: PartnerDocumentLanguage
  includeVat: boolean
  currency: PartnerCurrency
}
