import type { CreateMaterialPayload, Material, MaterialPayload, MaterialSupplyType, MaterialType } from './types'

export type MaterialFormState = {
  customer: string
  materialName: string
  specification: string
  type: MaterialType
  mpn: string
  supplier: string
  supplyType: MaterialSupplyType
  moq: string
  unitPrice: string
}

export function emptyMaterialForm(): MaterialFormState {
  return {
    customer: '',
    materialName: '',
    specification: '',
    type: '',
    mpn: '',
    supplier: '',
    supplyType: '',
    moq: '0',
    unitPrice: '0',
  }
}

export function materialToForm(material: Material): MaterialFormState {
  return {
    customer: material.customer,
    materialName: material.materialName,
    specification: material.specification,
    type: material.type,
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
    mpn: form.mpn.trim(),
    supplier: form.supplier.trim(),
    supplyType: form.supplyType,
    moq: Math.max(0, Math.floor(Number(form.moq) || 0)),
    unitPrice: Math.max(0, Number(form.unitPrice) || 0),
  }
}

export function formToCreateMaterialPayload(form: MaterialFormState, id: string): CreateMaterialPayload {
  return {
    id: id.trim(),
    ...formToMaterialPayload(form),
  }
}
