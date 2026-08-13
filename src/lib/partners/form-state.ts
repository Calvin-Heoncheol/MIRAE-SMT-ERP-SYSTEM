import type {
  BusinessPartner,
  BusinessPartnerPayload,
  PartnerPaymentTermType,
  PartnerTradeRole,
} from './types'
import { formatBusinessRegNo } from './utils'

export type PartnerFormState = {
  businessRegNo: string
  name: string
  representativeName: string
  businessType: string
  address: string
  phone: string
  tradeRole: PartnerTradeRole
  paymentTermType: PartnerPaymentTermType
  paymentDepositPercent: string
  paymentNetDays: string
  paymentMonthlyDay: string
}

export function emptyPartnerForm(): PartnerFormState {
  return {
    businessRegNo: '',
    name: '',
    representativeName: '',
    businessType: '',
    address: '',
    phone: '',
    tradeRole: 'both',
    paymentTermType: '',
    paymentDepositPercent: '30',
    paymentNetDays: '30',
    paymentMonthlyDay: '15',
  }
}

export function partnerToForm(partner: BusinessPartner): PartnerFormState {
  return {
    businessRegNo: formatBusinessRegNo(partner.businessRegNo),
    name: partner.name,
    representativeName: partner.representativeName,
    businessType: partner.businessType,
    address: partner.address,
    phone: partner.phone,
    tradeRole: partner.tradeRole,
    paymentTermType: partner.paymentTermType,
    paymentDepositPercent: String(partner.paymentDepositPercent || 30),
    paymentNetDays: String(partner.paymentNetDays || 30),
    paymentMonthlyDay: String(partner.paymentMonthlyDay || 15),
  }
}

export function validatePartnerForm(form: PartnerFormState) {
  if (!form.name.trim()) return '거래처명을 입력해 주세요.'

  if (form.paymentTermType === 'installment') {
    const percent = Math.floor(Number(form.paymentDepositPercent) || 0)
    if (percent < 1 || percent > 99) return '분할 지급 선금 비율은 1~99%로 입력해 주세요.'
  }
  if (form.paymentTermType === 'net') {
    const days = Math.floor(Number(form.paymentNetDays) || 0)
    if (days < 1) return '일반 후불 일수를 입력해 주세요.'
  }
  if (form.paymentTermType === 'monthly') {
    const day = Math.floor(Number(form.paymentMonthlyDay) || 0)
    if (day < 1 || day > 31) return '월괄 후불 입금일은 1~31일로 입력해 주세요.'
  }

  return null
}

export function formToPartnerPayload(form: PartnerFormState): BusinessPartnerPayload {
  const paymentTermType = form.paymentTermType
  const deposit = Math.floor(Number(form.paymentDepositPercent) || 0)
  const netDays = Math.floor(Number(form.paymentNetDays) || 0)
  const monthlyDay = Math.floor(Number(form.paymentMonthlyDay) || 0)

  return {
    businessRegNo: form.businessRegNo,
    name: form.name,
    representativeName: form.representativeName,
    businessType: form.businessType,
    address: form.address,
    phone: form.phone,
    tradeRole: form.tradeRole,
    paymentTermType,
    paymentDepositPercent: paymentTermType === 'installment' ? deposit : 0,
    paymentNetDays: paymentTermType === 'net' ? netDays : 0,
    paymentMonthlyDay: paymentTermType === 'monthly' ? monthlyDay : 0,
  }
}
