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
  isMaterialItemCategory,
  isRawMaterialItemCategory,
  isSemiFinishedItemCategory,
} from './types'
import { normalizeItemCategory } from './utils'
import { composeItemIdWithVersion, parseItemVersionCode, versionToFormValue } from './version-code'

export type ItemFormState = {
  id: string
  name: string
  /** 반제품·완제품 버전 라벨 (코드 접미사: V1, REV2 등). 원자재·부자재는 미사용 */
  version: string
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
  safetyStock: string
}

export function emptyItemForm(): ItemFormState {
  return {
    id: '',
    name: '',
    version: '',
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
    safetyStock: '',
  }
}

function priceToFormValue(value: number) {
  return value > 0 ? String(value) : ''
}

export function itemToForm(item: Item): ItemFormState {
  const { base, version } = parseItemVersionCode(item.id)
  return {
    id: base || item.id,
    name: item.name,
    version: versionToFormValue(version),
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
    safetyStock: item.safetyStock > 0 ? String(item.safetyStock) : '',
  }
}

function parseUnitPrice(value: string) {
  const parsed = Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.round(parsed)
}

function parseSafetyStock(value: string) {
  const parsed = Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.floor(parsed)
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
  if (
    category === 3 &&
    form.pcbSideMode !== 'single' &&
    form.pcbSideMode !== 'duo' &&
    form.pcbSideMode !== 'double'
  ) {
    return '반제품은 면 구분(단면/듀얼/양면)을 선택해 주세요.'
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

  const smdUnitPrice = isSemiFinished ? parseUnitPrice(form.smdUnitPrice) : 0
  const dipUnitPrice = isSemiFinished ? parseUnitPrice(form.dipUnitPrice) : 0
  const materialUnitPrice = isSemiFinished ? parseUnitPrice(form.materialUnitPrice) : 0
  const unitPrice = isSemiFinished
    ? smdUnitPrice + dipUnitPrice + materialUnitPrice
    : parseUnitPrice(form.unitPrice)

  const rawId = form.id.trim() || (isRawMaterialItemCategory(itemCategory) ? '' : form.name.trim())
  const id = isRawMaterialItemCategory(itemCategory)
    ? rawId
    : composeItemIdWithVersion(rawId, form.version)

  return {
    id,
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
    safetyStock: parseSafetyStock(form.safetyStock),
  }
}

export function formToItemUpdatePayload(form: ItemFormState): UpdateItemPayload {
  const payload = formToItemPayload(form)
  const { id: _id, ...rest } = payload
  return rest
}
