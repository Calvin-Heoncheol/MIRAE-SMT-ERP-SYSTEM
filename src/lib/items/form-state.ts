import type { Item, ItemPayload, ItemCategory, ItemMaterialType, ItemSupplyType, UpdateItemPayload } from './types'
import { isMaterialItemCategory } from './types'
import { normalizeItemCategory } from './utils'

export type ItemFormState = {
  id: string
  name: string
  itemCategory: ItemCategory | ''
  specification: string
  mpn: string
  materialType: ItemMaterialType
  supplyType: ItemSupplyType
  unitPrice: string
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
    unitPrice: '',
  }
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
    unitPrice: item.unitPrice > 0 ? String(item.unitPrice) : '',
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
  if (!options?.isCreate && !form.id.trim()) return '품목코드를 찾을 수 없습니다.'
  return null
}

export function formToItemPayload(form: ItemFormState): ItemPayload {
  const itemCategory = normalizeItemCategory(form.itemCategory)
  if (!itemCategory) {
    throw new Error('품목구분이 올바르지 않습니다.')
  }

  const isMaterial = isMaterialItemCategory(itemCategory)

  return {
    id: form.id.trim(),
    name: form.name.trim(),
    specification: isMaterial ? form.specification.trim() : '',
    mpn: isMaterial ? form.mpn.trim() : '',
    materialType: isMaterial ? form.materialType : '',
    supplyType: isMaterial ? form.supplyType : '',
    unitPrice: parseUnitPrice(form.unitPrice),
    itemCategory,
  }
}

export function formToItemUpdatePayload(form: ItemFormState): UpdateItemPayload {
  const payload = formToItemPayload(form)
  const { id: _id, ...rest } = payload
  return rest
}
