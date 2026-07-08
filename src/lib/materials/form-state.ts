import type { Material, MaterialPayload, MaterialSupplyType, MaterialType } from './types'

export type MaterialFormState = {
  customer: string
  materialName: string
  specification: string
  type: MaterialType
  cpn: string
  mpn: string
  supplier: string
  supplyType: MaterialSupplyType
  moq: string
  unitPrice: string
}

export function materialToForm(material: Material): MaterialFormState {
  return {
    customer: material.customer,
    materialName: material.materialName,
    specification: material.specification,
    type: material.type,
    cpn: material.cpn,
    mpn: material.mpn,
    supplier: material.supplier,
    supplyType: material.supplyType,
    moq: String(material.moq || 0),
    unitPrice: String(material.unitPrice || 0),
  }
}

export function formToMaterialPayload(form: MaterialFormState): MaterialPayload {
  return {
    customer: form.customer.trim(),
    materialName: form.materialName.trim(),
    specification: form.specification.trim(),
    type: form.type,
    cpn: form.cpn.trim(),
    mpn: form.mpn.trim(),
    supplier: form.supplier.trim(),
    supplyType: form.supplyType,
    moq: Math.max(0, Math.floor(Number(form.moq) || 0)),
    unitPrice: Math.max(0, Number(form.unitPrice) || 0),
  }
}
