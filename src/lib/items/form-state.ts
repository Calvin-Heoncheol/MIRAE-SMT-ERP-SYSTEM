import type { MaterialCostLine } from './material-cost-lines'
import { normalizeMaterialCostLines, sumMaterialCostLines } from './material-cost-lines'
import type {
  Item,
  ItemPayload,
  ItemCategory,
  ItemProcessType,
  UpdateItemPayload,
} from './types'
import {
  isMaterialItemCategory,
  isProductItemCategory,
  isRawMaterialItemCategory,
  isSemiFinishedItemCategory,
  deriveItemProcessType,
  ITEM_SUPPLY_TYPE_OPTIONS,
} from './types'
import { EMPTY_SMT_QUOTE_PARTS } from './smt-quote-parts'
import { normalizeItemCategory, normalizeAlternateMpns } from './utils'
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
  alternateMpns: string[]
  customerId: string
  customerName: string
  processType: ItemProcessType
  materialType: Item['materialType']
  supplyType: Item['supplyType']
  supplier: string
  pcbSideMode: Item['pcbSideMode']
  unitPrice: number
  setupUnitPrice: number
  smdUnitPrice: number
  dipUnitPrice: number
  materialUnitPrice: number
  /** 자재비 세부 (2개 이상이면 분할 모드) */
  materialCostLines: MaterialCostLine[]
  /** 연결된 기준 견적 ID */
  baselineQuoteId: string
  /** 표시용 (저장하지 않음) */
  baselineQuoteLabel: string
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
    alternateMpns: [],
    customerId: '',
    customerName: '',
    processType: '',
    materialType: '',
    supplyType: '',
    supplier: '',
    pcbSideMode: '',
    unitPrice: 0,
    setupUnitPrice: 0,
    smdUnitPrice: 0,
    dipUnitPrice: 0,
    materialUnitPrice: 0,
    materialCostLines: [],
    baselineQuoteId: '',
    baselineQuoteLabel: '',
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
    alternateMpns: item.alternateMpns || [],
    customerId: item.customerId,
    customerName: item.customerName,
    processType: item.processType,
    materialType: item.materialType,
    supplyType: item.supplyType,
    supplier: item.supplier,
    pcbSideMode: item.pcbSideMode,
    unitPrice: item.unitPrice,
    setupUnitPrice: item.setupUnitPrice,
    smdUnitPrice:
      item.smdUnitPrice > 0
        ? item.smdUnitPrice
        : item.dipUnitPrice > 0
          ? 0
          : item.unitPrice,
    dipUnitPrice: item.dipUnitPrice,
    materialUnitPrice: item.materialUnitPrice,
    materialCostLines: normalizeMaterialCostLines(item.materialCostLines),
    baselineQuoteId: item.baselineQuoteId || '',
    baselineQuoteLabel: '',
  }
}

export function validateItemForm(form: ItemFormState, options?: { isCreate?: boolean }): string | null {
  const category = normalizeItemCategory(form.itemCategory)
  if (!form.name.trim()) return '품목명을 입력해 주세요.'
  if (!category) return '품목구분을 선택해 주세요.'
  if (!form.customerId.trim()) {
    return '고객사를 거래처 목록에서 선택해 주세요.'
  }
  if (!options?.isCreate && !form.id.trim()) {
    return '품목코드를 찾을 수 없습니다.'
  }
  if (isRawMaterialItemCategory(category) && !form.materialType) {
    return '공정구분을 선택해 주세요.'
  }
  if (isMaterialItemCategory(category)) {
    const supplyType = String(form.supplyType || '').trim()
    if (!ITEM_SUPPLY_TYPE_OPTIONS.includes(supplyType as (typeof ITEM_SUPPLY_TYPE_OPTIONS)[number])) {
      return '도급/사급을 선택해 주세요.'
    }
  }
  if (isSemiFinishedItemCategory(category)) {
    const processType = deriveItemProcessType(form.smdUnitPrice, form.dipUnitPrice)
    if (!processType) {
      return 'SMD 또는 후공정 단가를 입력해 주세요.'
    }
    if ((processType === 'smt' || processType === 'smt_post') && !form.pcbSideMode) {
      return '면(단면/더블/양면)을 선택해 주세요.'
    }
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
  const setup = money(form.setupUnitPrice)
  const smd = money(form.smdUnitPrice)
  const dip = money(form.dipUnitPrice)
  const materialLines = isSemiFinishedItemCategory(itemCategory)
    ? normalizeMaterialCostLines(form.materialCostLines)
    : []
  const material =
    materialLines.length > 0 ? sumMaterialCostLines(materialLines) : money(form.materialUnitPrice)
  const baseCodeInput = form.id.trim()
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
    mpn: isProduct ? '' : form.mpn.trim(),
    alternateMpns: isProduct ? [] : normalizeAlternateMpns(form.alternateMpns, form.mpn),
    customerId: form.customerId.trim(),
    materialType: isRawMaterial ? form.materialType : '',
    supplyType: isProduct ? '' : form.supplyType,
    supplier: form.supplier.trim(),
    pcbSideMode: isSemiFinishedItemCategory(itemCategory) ? form.pcbSideMode || 'single' : '',
    processType: isSemiFinishedItemCategory(itemCategory)
      ? deriveItemProcessType(smd, dip)
      : isProduct
        ? form.processType
        : '',
    unitPrice: isSemiFinishedItemCategory(itemCategory)
      ? smd + dip > 0
        ? smd + dip
        : money(form.unitPrice)
      : 0,
    setupUnitPrice: isSemiFinishedItemCategory(itemCategory) ? setup : 0,
    smdUnitPrice: isSemiFinishedItemCategory(itemCategory) ? smd : 0,
    dipUnitPrice: isSemiFinishedItemCategory(itemCategory) ? dip : 0,
    materialUnitPrice: isSemiFinishedItemCategory(itemCategory) ? material : 0,
    otherUnitPrice: 0,
    materialCostLines: materialLines,
    smtQuoteParts: { ...EMPTY_SMT_QUOTE_PARTS },
    baselineQuoteId: form.baselineQuoteId.trim(),
    itemCategory,
    safetyStock: 0,
  }
}

export function formToItemUpdatePayload(form: ItemFormState): UpdateItemPayload {
  const payload = formToItemPayload(form)
  const { id: _id, ...rest } = payload
  return rest
}

export type ItemPriceField =
  | 'setupUnitPrice'
  | 'smdUnitPrice'
  | 'dipUnitPrice'
  | 'materialUnitPrice'

export function itemToUpdatePayload(item: Item): UpdateItemPayload {
  return formToItemUpdatePayload(itemToForm(item))
}

export function itemPriceUpdatePayload(
  item: Item,
  field: ItemPriceField,
  value: number,
): UpdateItemPayload {
  const form = itemToForm(item)
  form[field] = Math.max(0, Math.round(Number(value) || 0))
  return formToItemUpdatePayload(form)
}
