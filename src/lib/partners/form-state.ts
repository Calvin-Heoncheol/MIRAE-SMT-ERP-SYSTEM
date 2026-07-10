import type { BusinessPartner, BusinessPartnerPayload, PartnerTradeRole } from './types'
import { formatBusinessRegNo } from './utils'

export type PartnerFormState = {
  businessRegNo: string
  name: string
  representativeName: string
  businessType: string
  phone: string
  tradeRole: PartnerTradeRole
}

export function emptyPartnerForm(): PartnerFormState {
  return {
    businessRegNo: '',
    name: '',
    representativeName: '',
    businessType: '',
    phone: '',
    tradeRole: 'both',
  }
}

export function partnerToForm(partner: BusinessPartner): PartnerFormState {
  return {
    businessRegNo: formatBusinessRegNo(partner.businessRegNo),
    name: partner.name,
    representativeName: partner.representativeName,
    businessType: partner.businessType,
    phone: partner.phone,
    tradeRole: partner.tradeRole,
  }
}

export function formToPartnerPayload(form: PartnerFormState): BusinessPartnerPayload {
  return {
    businessRegNo: form.businessRegNo,
    name: form.name,
    representativeName: form.representativeName,
    businessType: form.businessType,
    phone: form.phone,
    tradeRole: form.tradeRole,
  }
}
