export type PartnerTradeRole = 'purchase' | 'sales' | 'both'

export const PARTNER_TRADE_ROLES: PartnerTradeRole[] = ['purchase', 'sales', 'both']

export const PARTNER_TRADE_ROLE_LABELS: Record<PartnerTradeRole, string> = {
  purchase: '매입',
  sales: '매출',
  both: '매입/매출',
}

export type BusinessPartner = {
  businessRegNo: string
  name: string
  representativeName: string
  businessType: string
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
  phone: string
  tradeRole: PartnerTradeRole
}
