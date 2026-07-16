import type {
  Item,
  ItemPayload,
  ItemCategory,
  ItemMaterialType,
  ItemPcbSideMode,
  ItemSupplyType,
  UpdateItemPayload,
} from './types'
import {
  deriveItemProcessType,
  isFinishedItemCategory,
  isMaterialItemCategory,
  isRawMaterialItemCategory,
  isSemiFinishedItemCategory,
} from './types'
import { normalizeItemCategory } from './utils'

export type ItemFormState = {
  id: string
  name: string
  itemCategory: ItemCategory | ''
  specification: string
  mpn: string
  materialType: ItemMaterialType
  supplyType: ItemSupplyType
  supplier: string
  pcbSideMode: ItemPcbSideMode
  unitPrice: string
  smdUnitPrice: string
  dipUnitPrice: string
  materialUnitPrice: string
}

export function emptyItemForm(): ItemFormState {
  return {
    id: '',
    name: '',
    itemCategory: '',
    specification: '',
    mpn: '',
    materialType: '',
    supplyType: '',
    supplier: '',
    pcbSideMode: '',
    unitPrice: '',
    smdUnitPrice: '',
    dipUnitPrice: '',
    materialUnitPrice: '',
  }
}

function priceToFormValue(value: number) {
  return value > 0 ? String(value) : ''
}

export function itemToForm(item: Item): ItemFormState {
  return {
    id: item.id,
    name: item.name,
    itemCategory: item.itemCategory,
    specification: item.specification,
    mpn: item.mpn,
    materialType: item.materialType,
    supplyType: item.supplyType,
    supplier: item.supplier,
    pcbSideMode: item.pcbSideMode,
    unitPrice: priceToFormValue(item.unitPrice),
    smdUnitPrice: priceToFormValue(item.smdUnitPrice),
    dipUnitPrice: priceToFormValue(item.dipUnitPrice),
    materialUnitPrice: priceToFormValue(item.materialUnitPrice),
  }
}

function parseUnitPrice(value: string) {
  const parsed = Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

export function validateItemForm(form: ItemFormState, options?: { isCreate?: boolean }): string | null {
  const category = normalizeItemCategory(form.itemCategory)
  if (!form.name.trim()) return '품목명을 입력해 주세요.'
  if (!category) return '품목구분을 선택해 주세요.'
  if (category === 1 && !form.id.trim()) return '품목코드를 입력해 주세요.'
  if (category === 1) {
    if (form.materialType !== 'SMD' && form.materialType !== 'DIP') {
      return '구분을 선택해 주세요.'
    }
    if (form.supplyType !== '도급' && form.supplyType !== '사급') {
      return '도급/사급을 선택해 주세요.'
    }
  }
  if (category === 3 && form.pcbSideMode !== 'single' && form.pcbSideMode !== 'dual') {
    return '반제품은 단면/양면을 선택해 주세요.'
  }
  if (!options?.isCreate && !form.id.trim()) return '품목코드를 찾을 수 없습니다.'
  return null
}

export function formToItemPayload(form: ItemFormState): ItemPayload {
  const itemCategory = normalizeItemCategory(form.itemCategory)
  if (!itemCategory) {
    throw new Error('품목구분이 올바르지 않습니다.')
  }

  const isMaterial = isMaterialItemCategory(itemCategory)
  const isRawMaterial = isRawMaterialItemCategory(itemCategory)
  const isSemiFinished = isSemiFinishedItemCategory(itemCategory)
  const isFinished = isFinishedItemCategory(itemCategory)

  const smdUnitPrice = isSemiFinished ? parseUnitPrice(form.smdUnitPrice) : 0
  const dipUnitPrice = isSemiFinished ? parseUnitPrice(form.dipUnitPrice) : 0
  const materialUnitPrice = isSemiFinished ? parseUnitPrice(form.materialUnitPrice) : 0
  const unitPrice = isFinished
    ? 0
    : isSemiFinished
      ? smdUnitPrice + dipUnitPrice + materialUnitPrice
      : parseUnitPrice(form.unitPrice)

  return {
    id: form.id.trim(),
    name: form.name.trim(),
    specification: isMaterial ? form.specification.trim() : '',
    mpn: isRawMaterial ? form.mpn.trim() : '',
    materialType: isRawMaterial ? form.materialType : '',
    supplyType: isRawMaterial ? form.supplyType : '',
    supplier: isMaterial ? form.supplier.trim() : '',
    pcbSideMode: isSemiFinished ? form.pcbSideMode : '',
    processType: isSemiFinished ? deriveItemProcessType(smdUnitPrice, dipUnitPrice) : '',
    unitPrice,
    smdUnitPrice,
    dipUnitPrice,
    materialUnitPrice,
    itemCategory,
  }
}

export function formToItemUpdatePayload(form: ItemFormState): UpdateItemPayload {
  const payload = formToItemPayload(form)
  const { id: _id, ...rest } = payload
  return rest
}
