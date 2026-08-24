import type {
  Item,
  ItemPayload,
  ItemCategory,
  ItemProcessType,
  UpdateItemPayload,
} from './types'
import {
  isManualItemCodeCategory,
  isOptionalItemCodeCategory,
  isProductItemCategory,
  isRawMaterialItemCategory,
  isSemiFinishedItemCategory,
} from './types'
import { normalizeItemCategory } from './utils'
import {
  normalizeVersionLabel,
  parseItemVersionCode,
  resolveItemBaseAndVersion,
  versionToFormValue,
} from './version-code'

export type ItemFormState = {
  /** 표시용 품목코드 (버전 제외). 내부 PK(MR-00001)와는 별개 */
  id: string
  name: string
  version: string
  itemCategory: ItemCategory | ''
  specification: string
  package: string
  mpn: string
  customerId: string
  customerName: string
  processType: ItemProcessType
  materialType: Item['materialType']
  supplyType: Item['supplyType']
  supplier: string
  pcbSideMode: Item['pcbSideMode']
  unitPrice: number
}

function money(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0))
}

export function resolveItemCodeParts(input: {
  codeOrId: string
  version: string
  name: string
  isRawMaterial: boolean
}): { baseCode: string; version: string } {
  const rawCode = String(input.codeOrId || '').trim()

  if (input.isRawMaterial) {
    return { baseCode: rawCode, version: '' }
  }

  const versionField = normalizeVersionLabel(input.version)
  const parsed = parseItemVersionCode(rawCode)

  let baseCode: string
  let version: string

  if (versionField) {
    version = versionField
    if (
      parsed.version &&
      normalizeVersionLabel(parsed.version) === versionField
    ) {
      baseCode = parsed.base
    } else {
      baseCode = parsed.version ? parsed.base : rawCode
    }
  } else if (parsed.version) {
    baseCode = parsed.base
    version = normalizeVersionLabel(parsed.version)
  } else {
    baseCode = rawCode
    version = ''
  }

  return { baseCode: baseCode.trim(), version }
}

export function emptyItemForm(): ItemFormState {
  return {
    id: '',
    name: '',
    version: '',
    itemCategory: '',
    specification: '',
    package: '',
    mpn: '',
    customerId: '',
    customerName: '',
    processType: '',
    materialType: '',
    supplyType: '',
    supplier: '',
    pcbSideMode: '',
    unitPrice: 0,
  }
}

export function itemToForm(item: Item): ItemFormState {
  const { base, version } = resolveItemBaseAndVersion(item)
  return {
    id: base || item.id,
    name: item.name,
    version: versionToFormValue(version),
    itemCategory: item.itemCategory,
    specification: item.specification,
    package: item.package,
    mpn: item.mpn,
    customerId: item.customerId,
    customerName: item.customerName,
    processType: item.processType,
    materialType: item.materialType,
    supplyType: item.supplyType,
    supplier: item.supplier,
    pcbSideMode: item.pcbSideMode,
    unitPrice: item.unitPrice,
  }
}

export function validateItemForm(form: ItemFormState, options?: { isCreate?: boolean }): string | null {
  const category = normalizeItemCategory(form.itemCategory)
  if (!form.name.trim()) return '품목명을 입력해 주세요.'
  if (!category) return '품목구분을 선택해 주세요.'
  if (!form.customerId.trim()) {
    return '고객사를 거래처 목록에서 선택해 주세요.'
  }
  if (isManualItemCodeCategory(category) && !form.id.trim()) {
    return '품목코드를 입력해 주세요.'
  }
  if (!options?.isCreate && !form.id.trim() && !isOptionalItemCodeCategory(category)) {
    return '품목코드를 찾을 수 없습니다.'
  }
  if (isRawMaterialItemCategory(category) && !form.materialType) {
    return '공정구분을 선택해 주세요.'
  }
  if (isSemiFinishedItemCategory(category) && !form.processType) {
    return '생산 공정(SMD/후공정)을 선택해 주세요.'
  }
  if (
    isSemiFinishedItemCategory(category) &&
    (form.processType === 'smt' || form.processType === 'smt_post') &&
    !form.pcbSideMode
  ) {
    return '면(단면/더블/양면)을 선택해 주세요.'
  }
  return null
}

export function formToItemPayload(form: ItemFormState): ItemPayload {
  const itemCategory = normalizeItemCategory(form.itemCategory)
  if (!itemCategory) {
    throw new Error('품목구분이 올바르지 않습니다.')
  }

  const isRawMaterial = isRawMaterialItemCategory(itemCategory)
  const isProduct = isProductItemCategory(itemCategory)
  const baseCodeInput = (
    form.id.trim() ||
    (isManualItemCodeCategory(itemCategory) ? '' : form.name.trim())
  ).trim()
  const { baseCode, version } = resolveItemCodeParts({
    codeOrId: baseCodeInput,
    version: form.version,
    name: form.name.trim(),
    isRawMaterial,
  })

  return {
    id: '',
    baseCode,
    version,
    name: form.name.trim(),
    specification: form.specification.trim(),
    package: form.package.trim(),
    mpn: form.mpn.trim(),
    customerId: form.customerId.trim(),
    materialType: isRawMaterial ? form.materialType : '',
    supplyType: isProduct ? '' : form.supplyType,
    supplier: form.supplier.trim(),
    pcbSideMode: isSemiFinishedItemCategory(itemCategory) ? form.pcbSideMode || 'single' : '',
    processType: isProduct ? form.processType : '',
    unitPrice: isSemiFinishedItemCategory(itemCategory) ? money(form.unitPrice) : 0,
    smdUnitPrice: 0,
    dipUnitPrice: 0,
    materialUnitPrice: 0,
    otherUnitPrice: 0,
    itemCategory,
    safetyStock: 0,
  }
}

export function formToItemUpdatePayload(form: ItemFormState): UpdateItemPayload {
  const payload = formToItemPayload(form)
  const { id: _id, ...rest } = payload
  return rest
}
