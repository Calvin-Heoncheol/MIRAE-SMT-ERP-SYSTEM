'use client'

import { useEffect, useMemo, useState } from 'react'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { createItem, deleteItem, updateItem } from '@/lib/items/repository'
import { calcParentUnitPriceFromBom } from '@/lib/bom/repository'
import {
  emptyItemForm,
  formToItemPayload,
  formToItemUpdatePayload,
  itemToForm,
  validateItemForm,
  type ItemFormState,
} from '@/lib/items/form-state'
import {
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  ITEM_MATERIAL_TYPE_LABELS,
  ITEM_MATERIAL_TYPE_OPTIONS,
  ITEM_PCB_SIDE_MODES,
  ITEM_PCB_SIDE_MODE_LABELS,
  ITEM_SUPPLY_TYPE_LABELS,
  ITEM_SUPPLY_TYPE_OPTIONS,
  isManualItemCodeCategory,
  isOptionalItemCodeCategory,
  canEditItemCodeOnCreate,
  isFinishedItemCategory,
  isMaterialItemCategory,
  isRawMaterialItemCategory,
  isSemiFinishedItemCategory,
  type Item,
  type ItemCategory,
  type ItemMaterialType,
  type ItemPcbSideMode,
  type ItemSupplyType,
} from '@/lib/items/types'
import { nextItemCodeForCategory } from '@/lib/items/utils'
import { fetchPurchaseBusinessPartners } from '@/lib/partners/repository'
import type { BusinessPartner } from '@/lib/partners/types'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

type ItemModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  item?: Item | null
  existingItems?: Item[]
  initialCategory?: ItemCategory | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

function resolvePreviewItemCode(
  category: ItemCategory | '',
  existingItems: Item[],
): string {
  if (!category || isManualItemCodeCategory(category) || isOptionalItemCodeCategory(category)) {
    return ''
  }
  return nextItemCodeForCategory(existingItems, category) ?? ''
}

function createFormWithCategory(
  category: ItemCategory | null | undefined,
  existingItems: Item[],
): ItemFormState {
  const form = emptyItemForm()
  if (!category) return form

  form.itemCategory = category
  if (!isMaterialItemCategory(category)) {
    form.specification = ''
    form.mpn = ''
    form.materialType = ''
    form.supplyType = ''
    form.supplier = ''
  } else if (!isRawMaterialItemCategory(category)) {
    form.mpn = ''
    form.materialType = ''
    form.supplyType = ''
  }
  if (category === 3) {
    form.pcbSideMode = 'single'
  } else {
    form.pcbSideMode = ''
  }
  if (isFinishedItemCategory(category)) {
    form.unitPrice = ''
    form.smdUnitPrice = ''
    form.dipUnitPrice = ''
    form.materialUnitPrice = ''
  }
  // 부자재만 자동코드 미리보기 채움. 반·완제품은 비워 두고 저장 시 자동/수동 결정
  form.id = isOptionalItemCodeCategory(category) ? '' : resolvePreviewItemCode(category, existingItems)
  return form
}

function ItemModalContent({
  mode,
  item,
  existingItems = [],
  initialCategory = null,
  onClose,
  onSaved,
  onDeleted,
}: Omit<ItemModalProps, 'open'>) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState<ItemFormState>(() =>
    item ? itemToForm(item) : createFormWithCategory(initialCategory, existingItems),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [purchasePartners, setPurchasePartners] = useState<BusinessPartner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(true)
  const [bomPriceLoading, setBomPriceLoading] = useState(false)

  const isRequiredManualCode =
    form.itemCategory !== '' && isManualItemCodeCategory(form.itemCategory)
  const isOptionalCode =
    form.itemCategory !== '' && isOptionalItemCodeCategory(form.itemCategory)
  const canEditCode =
    isCreate && form.itemCategory !== '' && canEditItemCodeOnCreate(form.itemCategory)
  const autoPreviewCode = useMemo(() => {
    if (form.itemCategory === '' || isManualItemCodeCategory(form.itemCategory)) return ''
    return nextItemCodeForCategory(existingItems, form.itemCategory) ?? ''
  }, [form.itemCategory, existingItems])
  const previewItemCode = autoPreviewCode

  useEffect(() => {
    setForm(
      item ? itemToForm(item) : createFormWithCategory(initialCategory, existingItems),
    )
    setSaveError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 오픈 시 초기값만 세팅
  }, [item, mode, initialCategory])

  useEffect(() => {
    const finishedId =
      form.itemCategory !== '' && isFinishedItemCategory(form.itemCategory)
        ? (item?.id || form.id).trim()
        : ''

    if (!finishedId) {
      if (form.itemCategory !== '' && isFinishedItemCategory(form.itemCategory)) {
        setForm((current) => (current.unitPrice === '' ? current : { ...current, unitPrice: '' }))
      }
      setBomPriceLoading(false)
      return
    }

    let cancelled = false
    setBomPriceLoading(true)
    calcParentUnitPriceFromBom(finishedId).then((result) => {
      if (cancelled) return
      setBomPriceLoading(false)
      if (!result.ok) return
      const nextValue = result.unitPrice > 0 ? String(result.unitPrice) : ''
      setForm((current) => {
        if (
          current.itemCategory === '' ||
          !isFinishedItemCategory(current.itemCategory) ||
          current.unitPrice === nextValue
        ) {
          return current
        }
        return { ...current, unitPrice: nextValue }
      })
    })

    return () => {
      cancelled = true
    }
    // item/mode 변경으로 폼이 리셋된 뒤 BOM 단가를 다시 읽음
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finishedId 기준
  }, [item?.id, mode, form.itemCategory, form.id])

  useEffect(() => {
    let cancelled = false
    setPartnersLoading(true)
    fetchPurchaseBusinessPartners().then((result) => {
      if (cancelled) return
      setPartnersLoading(false)
      if (result.ok) {
        setPurchasePartners(result.partners)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isCreate) return
    if (
      form.itemCategory === '' ||
      isManualItemCodeCategory(form.itemCategory) ||
      isOptionalItemCodeCategory(form.itemCategory)
    ) {
      return
    }
    setForm((current) => {
      const nextCode = resolvePreviewItemCode(current.itemCategory, existingItems)
      if (current.id === nextCode) return current
      return { ...current, id: nextCode }
    })
  }, [isCreate, form.itemCategory, existingItems])

  function updateForm<K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateItemCategory(value: ItemCategory | '') {
    setForm((current) => {
      const next: ItemFormState = { ...current, itemCategory: value }
      if (value && !isMaterialItemCategory(value)) {
        next.specification = ''
        next.mpn = ''
        next.materialType = ''
        next.supplyType = ''
        next.supplier = ''
      } else if (value && !isRawMaterialItemCategory(value)) {
        next.mpn = ''
        next.materialType = ''
        next.supplyType = ''
      }
      if (value === 3) {
        if (!next.pcbSideMode) next.pcbSideMode = 'single'
      } else {
        next.pcbSideMode = ''
      }
      if (value && isFinishedItemCategory(value)) {
        next.unitPrice = ''
        next.smdUnitPrice = ''
        next.dipUnitPrice = ''
        next.materialUnitPrice = ''
      }
      if (value !== 3) {
        next.smdUnitPrice = ''
        next.dipUnitPrice = ''
        next.materialUnitPrice = ''
      } else {
        next.unitPrice = ''
      }
      if (isCreate) {
        if (!value) {
          next.id = ''
        } else if (isOptionalItemCodeCategory(value) || isManualItemCodeCategory(value)) {
          next.id = ''
        } else {
          next.id = resolvePreviewItemCode(value, existingItems)
        }
      }
      return next
    })
  }

  const showMaterialFields =
    form.itemCategory !== '' && isMaterialItemCategory(form.itemCategory)
  const showRawMaterialFields =
    form.itemCategory !== '' && isRawMaterialItemCategory(form.itemCategory)
  const showPcbSideModeField =
    form.itemCategory !== '' && isSemiFinishedItemCategory(form.itemCategory)
  const showUnitPriceField =
    form.itemCategory !== '' &&
    !isFinishedItemCategory(form.itemCategory) &&
    !isSemiFinishedItemCategory(form.itemCategory)
  const showFinishedUnitPriceField =
    form.itemCategory !== '' && isFinishedItemCategory(form.itemCategory)
  const showSemiUnitPriceFields =
    form.itemCategory !== '' && isSemiFinishedItemCategory(form.itemCategory)

  async function handleSave() {
    const validationError = validateItemForm(form, { isCreate })
    if (validationError) {
      setSaveError(validationError)
      return
    }

    setSaving(true)
    setSaveError(null)

    let saveForm = form
    if (form.itemCategory !== '' && isFinishedItemCategory(form.itemCategory)) {
      const finishedId = (isCreate ? form.id : item?.id || form.id).trim()
      if (finishedId) {
        const calc = await calcParentUnitPriceFromBom(finishedId)
        if (calc.ok) {
          saveForm = {
            ...form,
            unitPrice: calc.unitPrice > 0 ? String(calc.unitPrice) : '',
          }
          setForm(saveForm)
        }
      }
    }

    const result = isCreate
      ? await createItem(formToItemPayload(saveForm))
      : await updateItem(item!.id, formToItemUpdatePayload(saveForm))

    setSaving(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onSaved?.()
  }

  async function handleDelete() {
    if (!item) return
    if (!window.confirm(`${item.name} (${item.id}) 품목을 삭제하시겠습니까?`)) return

    setDeleting(true)
    setSaveError(null)

    const result = await deleteItem(item.id)
    setDeleting(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onDeleted?.()
  }

  const busy = saving || deleting

  return (
    <ErpModal
      open
      size="form"
      title={isCreate ? '품목 등록' : '품목 수정'}
      description={!isCreate && item ? item.id : undefined}
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-col gap-3">
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          <div className="flex justify-between gap-2">
            {!isCreate ? (
              <ErpButton variant="danger" onClick={() => void handleDelete()} disabled={busy}>
                {deleting ? '삭제 중…' : '삭제'}
              </ErpButton>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <ErpButton variant="secondary" onClick={onClose} disabled={busy}>
                취소
              </ErpButton>
              <ErpButton onClick={() => void handleSave()} disabled={busy}>
                {saving ? '저장 중…' : '저장'}
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>
            품목구분 <span className="text-red-500">*</span>
          </span>
          <select
            value={form.itemCategory === '' ? '' : String(form.itemCategory)}
            onChange={(event) =>
              updateItemCategory(
                event.target.value ? (Number(event.target.value) as ItemCategory) : '',
              )
            }
            className={ERP_FIELD_INPUT_CLASS}
          >
            <option value="">선택</option>
            {ITEM_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {ITEM_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>
            품목코드 {isRequiredManualCode ? <span className="text-red-500">*</span> : null}
          </span>
          <input
            value={
              isCreate && !canEditCode && form.itemCategory !== ''
                ? previewItemCode
                : form.id
            }
            onChange={(event) => updateForm('id', event.target.value)}
            placeholder={
              form.itemCategory === ''
                ? '품목구분 선택 후 표시'
                : isRequiredManualCode
                  ? '직접 입력'
                  : isOptionalCode
                    ? autoPreviewCode
                      ? `비우면 ${autoPreviewCode} 자동`
                      : '비우면 자동 생성'
                    : '자동 생성'
            }
            readOnly={!canEditCode}
            className={`${ERP_FIELD_INPUT_CLASS} font-mono ${
              !canEditCode ? 'bg-slate-50 text-slate-600' : ''
            }`}
          />
          {isCreate && form.itemCategory !== '' && isOptionalCode ? (
            <p className="mt-1 text-xs text-slate-500">
              비워 두면 {autoPreviewCode || '자동 코드'} 로 생성되고, 입력하면 그 값이 품목코드가 됩니다.
            </p>
          ) : null}
          {isCreate && form.itemCategory !== '' && !canEditCode ? (
            <p className="mt-1 text-xs text-slate-500">저장 시 {previewItemCode} 로 자동 생성됩니다.</p>
          ) : null}
        </label>
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>
            품목명 <span className="text-red-500">*</span>
          </span>
          <input
            value={form.name}
            onChange={(event) => updateForm('name', event.target.value)}
            className={ERP_FIELD_INPUT_CLASS}
          />
        </label>
        {showMaterialFields ? (
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>규격</span>
            <input
              value={form.specification}
              onChange={(event) => updateForm('specification', event.target.value)}
              className={ERP_FIELD_INPUT_CLASS}
            />
          </label>
        ) : null}
        {showRawMaterialFields ? (
          <>
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>MPN</span>
              <input
                value={form.mpn}
                onChange={(event) => updateForm('mpn', event.target.value)}
                className={`${ERP_FIELD_INPUT_CLASS} font-mono`}
              />
            </label>
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>
                구분 <span className="text-red-500">*</span>
              </span>
              <select
                value={form.materialType}
                onChange={(event) =>
                  updateForm('materialType', event.target.value as ItemMaterialType)
                }
                className={ERP_FIELD_INPUT_CLASS}
              >
                <option value="">선택</option>
                {ITEM_MATERIAL_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {ITEM_MATERIAL_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>
                도급/사급 <span className="text-red-500">*</span>
              </span>
              <select
                value={form.supplyType}
                onChange={(event) => updateForm('supplyType', event.target.value as ItemSupplyType)}
                className={ERP_FIELD_INPUT_CLASS}
              >
                <option value="">선택</option>
                {ITEM_SUPPLY_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {ITEM_SUPPLY_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {showPcbSideModeField ? (
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>
              면 구분 <span className="text-red-500">*</span>
            </span>
            <select
              value={form.pcbSideMode}
              onChange={(event) =>
                updateForm('pcbSideMode', event.target.value as ItemPcbSideMode)
              }
              className={ERP_FIELD_INPUT_CLASS}
            >
              <option value="">선택</option>
              {ITEM_PCB_SIDE_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {ITEM_PCB_SIDE_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {showMaterialFields ? (
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>공급사</span>
            <CustomerCombobox
              value={form.supplier}
              partners={purchasePartners}
              placeholder="거래처명 검색"
              ariaLabel="공급사"
              inputClassName={ERP_FIELD_INPUT_CLASS}
              onValueChange={(value) => updateForm('supplier', value)}
              onPartnerSelect={(partner) => updateForm('supplier', partner.name)}
            />
            <p className="mt-1 text-xs text-slate-500">
              {partnersLoading
                ? '매입 거래처 목록을 불러오는 중...'
                : purchasePartners.length === 0
                  ? '등록된 매입 거래처가 없습니다. 기초등록 → 거래처등록에서 먼저 등록해 주세요.'
                  : '거래처등록의 매입·매입/매출 거래처만 선택할 수 있습니다.'}
            </p>
          </label>
        ) : null}
        {showUnitPriceField ? (
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>단가</span>
            <input
              type="number"
              min={0}
              step="any"
              value={form.unitPrice}
              onChange={(event) => updateForm('unitPrice', event.target.value)}
              placeholder="0"
              className={`${ERP_FIELD_INPUT_CLASS} tabular-nums`}
            />
          </label>
        ) : null}
        {showFinishedUnitPriceField ? (
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>단가</span>
            <input
              type="number"
              min={0}
              step="any"
              value={form.unitPrice}
              readOnly
              placeholder={bomPriceLoading ? '계산 중…' : '0'}
              className={`${ERP_FIELD_INPUT_CLASS} tabular-nums bg-slate-50 text-slate-600`}
            />
            <p className="mt-1 text-xs text-slate-500">
              BOM 구성 품목 단가 × 소요량의 합산입니다. BOM등록에서 구성이 바뀌면 자동 반영됩니다.
            </p>
          </label>
        ) : null}
        {showSemiUnitPriceFields ? (
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>SMD 단가</span>
              <input
                type="number"
                min={0}
                step="any"
                value={form.smdUnitPrice}
                onChange={(event) => updateForm('smdUnitPrice', event.target.value)}
                placeholder="0"
                className={`${ERP_FIELD_INPUT_CLASS} tabular-nums`}
              />
            </label>
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>DIP 단가</span>
              <input
                type="number"
                min={0}
                step="any"
                value={form.dipUnitPrice}
                onChange={(event) => updateForm('dipUnitPrice', event.target.value)}
                placeholder="0"
                className={`${ERP_FIELD_INPUT_CLASS} tabular-nums`}
              />
            </label>
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>자재 단가</span>
              <input
                type="number"
                min={0}
                step="any"
                value={form.materialUnitPrice}
                onChange={(event) => updateForm('materialUnitPrice', event.target.value)}
                placeholder="0"
                className={`${ERP_FIELD_INPUT_CLASS} tabular-nums`}
              />
            </label>
          </div>
        ) : null}
      </div>
    </ErpModal>
  )
}

export function ItemModal({ open, ...props }: ItemModalProps) {
  if (!open) return null
  return <ItemModalContent {...props} />
}
