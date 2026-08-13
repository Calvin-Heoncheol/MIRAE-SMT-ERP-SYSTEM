export type PartnerTradeRole = 'purchase' | 'sales' | 'both'

export const PARTNER_TRADE_ROLES: PartnerTradeRole[] = ['purchase', 'sales', 'both']

export const PARTNER_TRADE_ROLE_LABELS: Record<PartnerTradeRole, string> = {
  purchase: '매입',
  sales: '매출',
  both: '매입/매출',
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
}
