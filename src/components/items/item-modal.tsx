'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { EntityChangeHistoryButton } from '@/components/change-logs/entity-change-history-button'
import { useBusy } from '@/components/ui/busy-provider'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { RequiredMark } from '@/components/ui/required-mark'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import { createItem, deleteItem, setItemActive, updateItem } from '@/lib/items/repository'
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
  ITEM_CATEGORY_CODE_PREFIX,
  ITEM_MATERIAL_TYPE_OPTIONS,
  ITEM_SUPPLY_TYPE_OPTIONS,
  ITEM_PCB_SIDE_MODE_LABELS,
  ITEM_PCB_SIDE_MODES,
  ITEM_PROCESS_TYPE_LABELS,
  ITEM_PROCESS_TYPES,
  type ItemPcbSideMode,
  canEditItemCodeOnCreate,
  isProductItemCategory,
  isRawMaterialItemCategory,
  isSemiFinishedItemCategory,
  isFinishedItemCategory,
  type Item,
  type ItemCategory,
  type ItemMaterialType,
  type ItemProcessType,
  type ItemSupplyType,
} from '@/lib/items/types'
import { nextItemCodeForCategory, itemFromPayload, displayItemUnitPrice, formatItemUnitPrice } from '@/lib/items/utils'
import { fetchSalesBusinessPartners } from '@/lib/partners/repository'
import { resolvePartnerFromInput } from '@/lib/partners/utils'
import type { BusinessPartner } from '@/lib/partners/types'
import { displayItemFormUnitPrice } from '@/lib/quotes/quote-to-item'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS, ERP_ROW_ADD_BUTTON_CLASS } from '@/lib/ui/tokens'

type ItemModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  item?: Item | null
  existingItems?: Item[]
  initialCategory?: ItemCategory | null
  /** create 시 품목코드·품명 등 미리 채움 (BOM 미등록 품목 등) */
  initialValues?: Partial<
    Pick<ItemFormState, 'id' | 'name' | 'mpn' | 'package' | 'specification' | 'supplier'>
  >
  /** 중첩 모달용 (기본 z-50) */
  zIndexClassName?: string
  onClose: () => void
  onSaved?: (message?: string) => void
  /** create 성공 직후 — 호출측에서 목록에 바로 반영 */
  onCreated?: (item: Item) => void
  onDeleted?: (message?: string) => void
}

function CancelButton({ disabled }: { disabled?: boolean }) {
  const requestClose = useErpModalRequestClose()
  return (
    <ErpButton variant="secondary" disabled={disabled} onClick={() => requestClose?.()}>
      취소
    </ErpButton>
  )
}

function resolvePreviewItemCode(
  category: ItemCategory | '',
  existingItems: Item[],
): string {
  if (!category) return ''
  return nextItemCodeForCategory(existingItems, category) ?? ''
}

function createFormWithCategory(
  category: ItemCategory | null | undefined,
  existingItems: Item[],
  initialValues?: ItemModalProps['initialValues'],
): ItemFormState {
  const form = emptyItemForm()
  if (!category) return form

  form.itemCategory = category
  form.pcbSideMode = isSemiFinishedItemCategory(category) ? 'single' : ''
  form.id = resolvePreviewItemCode(category, existingItems)

  if (initialValues) {
    if (initialValues.id !== undefined) form.id = initialValues.id
    if (initialValues.name !== undefined) form.name = initialValues.name
    if (initialValues.mpn !== undefined) form.mpn = initialValues.mpn
    if (initialValues.package !== undefined) form.package = initialValues.package
    if (initialValues.specification !== undefined) form.specification = initialValues.specification
    if (initialValues.supplier !== undefined) form.supplier = initialValues.supplier
  }
  return form
}

function ItemModalContent({
  mode,
  item,
  existingItems = [],
  initialCategory = null,
  initialValues,
  zIndexClassName = 'z-50',
  onClose,
  onSaved,
  onCreated,
  onDeleted,
}: Omit<ItemModalProps, 'open'>) {
  const isCreate = mode === 'create'
  const canDelete = useCanDeleteRecords()
  const confirm = useErpConfirm()
  const [form, setForm] = useState<ItemFormState>(() =>
    item ? itemToForm(item) : createFormWithCategory(initialCategory, existingItems, initialValues),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [salesPartners, setSalesPartners] = useState<BusinessPartner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(true)

  const busyUi = useBusy()
  const { notifyAuthOrFailure, toast } = useWriteFailureToast()

  const canEditCode =
    form.itemCategory !== '' &&
    (isCreate
      ? canEditItemCodeOnCreate(form.itemCategory)
      : !isRawMaterialItemCategory(form.itemCategory))
  const autoPreviewCode = useMemo(() => {
    if (form.itemCategory === '') return ''
    return nextItemCodeForCategory(existingItems, form.itemCategory) ?? ''
  }, [form.itemCategory, existingItems])
  const previewItemCode = autoPreviewCode

  useEffect(() => {
    const nextForm = item
      ? itemToForm(item)
      : createFormWithCategory(initialCategory, existingItems, initialValues)
    setForm(nextForm)
    setSaveError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 오픈 시 초기값만 세팅
  }, [item, mode, initialCategory])

  useEffect(() => {
    let cancelled = false
    setPartnersLoading(true)
    fetchSalesBusinessPartners().then((result) => {
      if (cancelled) return
      setPartnersLoading(false)
      if (result.ok) {
        setSalesPartners(result.partners)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isCreate) return
    if (form.itemCategory === '') return
    setForm((current) => {
      if (current.id.trim()) return current
      const nextCode = resolvePreviewItemCode(current.itemCategory, existingItems)
      if (!nextCode || current.id === nextCode) return current
      return { ...current, id: nextCode }
    })
  }, [isCreate, form.itemCategory, existingItems])

  function updateForm<K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateItemCategory(value: ItemCategory | '') {
    setForm((current) => {
      const next: ItemFormState = {
        ...current,
        itemCategory: value,
        pcbSideMode: value && isSemiFinishedItemCategory(value) ? 'single' : '',
      }
      if (isCreate) {
        next.id = value ? resolvePreviewItemCode(value, existingItems) : ''
      }
      if (!value || !isProductItemCategory(value)) {
        next.version = ''
        next.unitPrice = 0
        next.setupUnitPrice = 0
        next.smdUnitPrice = 0
        next.dipUnitPrice = 0
        next.materialUnitPrice = 0
        next.processType = ''
        next.baselineQuoteId = ''
        next.baselineQuoteLabel = ''
      }
      if (value && isProductItemCategory(value)) {
        next.materialType = ''
        next.supplyType = ''
        next.package = ''
        next.specification = ''
        next.mpn = ''
        next.alternateMpns = []
      }
      return next
    })
  }

  const showMaterialDetailFields =
    form.itemCategory !== '' && !isProductItemCategory(form.itemCategory)
  const showRawMaterialTypeField =
    form.itemCategory !== '' && isRawMaterialItemCategory(form.itemCategory)
  const showProductProcessTypeField =
    form.itemCategory !== '' && isSemiFinishedItemCategory(form.itemCategory)
  const showPcbSideModeField = showProductProcessTypeField
  const showProductUnitPriceField =
    form.itemCategory !== '' && isSemiFinishedItemCategory(form.itemCategory)
  const showFinishedProductUnitPriceInfo =
    form.itemCategory !== '' && isFinishedItemCategory(form.itemCategory)
  const showAdditionalUnitPriceField =
    form.itemCategory !== '' &&
    (isSemiFinishedItemCategory(form.itemCategory) || isFinishedItemCategory(form.itemCategory))

  function updateBaselineUnitPrice(raw: string) {
    const next = Math.max(0, Math.round(Number(raw) || 0))
    setForm((current) => ({
      ...current,
      unitPrice: next,
      setupUnitPrice: 0,
      smdUnitPrice: 0,
      dipUnitPrice: 0,
      materialUnitPrice: 0,
    }))
  }

  const showVersionField =
    form.itemCategory !== '' && isProductItemCategory(form.itemCategory)

  const displayUnitPrice = displayItemFormUnitPrice(form)

  const displayItemCode = (() => {
    if (form.itemCategory === '') return ''
    if (isCreate && !canEditCode) {
      return previewItemCode
    }
    return form.id.trim() || (isCreate ? previewItemCode : '')
  })()

  async function commitItemSave(saveForm: ItemFormState) {
    setSaving(true)
    setSaveError(null)

    let result
    try {
      result = await busyUi.run(async () => {
        if (isCreate) {
          return createItem(formToItemPayload(saveForm))
        }
        return updateItem(item!.id, formToItemUpdatePayload(saveForm))
      })
    } finally {
      setSaving(false)
    }

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setSaveError(result.detail)
      return
    }

    if (result.changeLogWarning) {
      toast.info('변경이력 미기록', result.changeLogWarning)
    }

    if (isCreate) {
      const payload = formToItemPayload(saveForm)
      onCreated?.(
        itemFromPayload(
          {
            ...payload,
            id: result.id,
            baseCode: payload.baseCode.trim() || result.id,
          },
          { isActive: true, customerName: saveForm.customerName.trim() },
        ),
      )
    }
    onSaved?.(isCreate ? '품목이 등록되었습니다.' : '품목이 수정되었습니다.')
  }

  async function handleSave() {
    const validationError = validateItemForm(form, { isCreate })
    if (validationError) {
      setSaveError(validationError)
      return
    }

    await commitItemSave(form)
  }

  async function handleDelete() {
    if (!item) return
    const codeLabel =
      item.baseCode && item.baseCode !== item.id ? `${item.baseCode} / ${item.id}` : item.id
    if (
      !(await confirm({
        title: '품목 삭제',
        message: `${item.name} (${codeLabel}) 품목을 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }

    setDeleting(true)
    setSaveError(null)

    const result = await busyUi.run(() => deleteItem(item.id))
    setDeleting(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setSaveError(result.detail)
      return
    }

    onDeleted?.('품목이 삭제되었습니다.')
  }

  async function handleDeactivate() {
    if (!item) return
    if (
      !(await confirm({
        title: '품목 사용중지',
        message: [
          `${item.name} (${item.id}) 을(를) 사용중지할까요?`,
          '',
          '· 발주·생산 이력은 그대로 유지됩니다.',
          '· 품목 수정 화면에서「사용중지」로 표시됩니다.',
          '· BOM 등록 목록에서는 숨겨집니다.',
          '· 실수로 만든 버전을 없애고 싶을 때 삭제 대신 이 방법을 권장합니다.',
        ].join('\n'),
        confirmLabel: '사용중지',
        tone: 'default',
      }))
    ) {
      return
    }

    setDeactivating(true)
    setSaveError(null)
    const result = await busyUi.run(() => setItemActive(item.id, false))
    setDeactivating(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setSaveError(result.detail)
      return
    }

    onSaved?.('품목이 사용중지되었습니다.')
  }

  async function handleActivate() {
    if (!item) return
    if (
      !(await confirm({
        title: '품목 재사용',
        message: [
          `${item.name} (${item.id}) 을(를) 다시 사용중으로 바꿀까요?`,
          '',
          '· BOM 등록 목록에도 다시 표시됩니다.',
        ].join('\n'),
        confirmLabel: '확인',
        tone: 'default',
      }))
    ) {
      return
    }

    setDeactivating(true)
    setSaveError(null)
    const result = await busyUi.run(() => setItemActive(item.id, true))
    setDeactivating(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setSaveError(result.detail)
      return
    }

    onSaved?.('품목이 사용중으로 변경되었습니다.')
  }

  const busy = saving || deleting || deactivating

  return (
    <ErpModal
      open
      size="xl"
      title={isCreate ? '품목 등록' : '품목 수정'}
      description={
        !isCreate && item
          ? item.version
            ? `${item.baseCode || item.id} · ${item.version}`
            : item.baseCode || item.id
          : '내부 품목ID는 저장 시 MR-00001 형식으로 자동 발급됩니다.'
      }
      onClose={onClose}
      closeOnEscape={!busy}
      zIndexClassName={zIndexClassName}
      footer={
        <div className="flex w-full flex-col gap-3">
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          <div className="flex justify-between gap-2">
            {!isCreate ? (
              <div className="flex flex-wrap gap-2">
                {canDelete ? (
                  <ErpButton
                    variant="danger"
                    onClick={() => void handleDelete()}
                    disabled={busy}
                    loading={deleting}
                  >
                    삭제
                  </ErpButton>
                ) : (
                  <span />
                )}
                {item?.isActive !== false ? (
                  <ErpButton
                    variant="secondary"
                    onClick={() => void handleDeactivate()}
                    disabled={busy}
                    loading={deactivating}
                  >
                    사용중지
                  </ErpButton>
                ) : (
                  <ErpButton
                    variant="secondary"
                    onClick={() => void handleActivate()}
                    disabled={busy}
                    loading={deactivating}
                  >
                    사용중으로 변경
                  </ErpButton>
                )}
                {item ? (
                  <EntityChangeHistoryButton entityType="item" entityId={item.id} disabled={busy} />
                ) : null}
              </div>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <CancelButton disabled={busy} />
              <ErpButton onClick={() => void handleSave()} disabled={busy} loading={saving}>
                저장
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>
            품목구분 <RequiredMark />
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
        <label className="block text-sm sm:col-span-2">
          <span className={ERP_FIELD_LABEL_CLASS}>
            고객사명 <RequiredMark />
          </span>
          <CustomerCombobox
            value={form.customerName}
            partners={salesPartners}
            placeholder="거래처명 검색"
            ariaLabel="고객사"
            inputClassName={ERP_FIELD_INPUT_CLASS}
            onValueChange={(value) => {
              setForm((current) => ({
                ...current,
                customerName: value,
                customerId: '',
              }))
            }}
            onPartnerSelect={(partner) => {
              setForm((current) => ({
                ...current,
                customerName: partner.name,
                customerId: partner.id,
              }))
            }}
          />
          <p className="mt-1 text-xs text-slate-500">
            {partnersLoading
              ? '고객사 목록을 불러오는 중...'
              : salesPartners.length === 0
                ? '등록된 거래처가 없습니다. 기초등록 → 거래처등록에서 먼저 등록해 주세요.'
                : '거래처등록의 거래처를 검색해 선택하세요.'}
          </p>
        </label>
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>
            품목코드
          </span>
          <input
            value={canEditCode ? form.id : displayItemCode}
            onChange={(event) => updateForm('id', event.target.value)}
            placeholder={
              form.itemCategory === ''
                ? '품목구분 선택 후 표시'
                : isCreate
                  ? `${ITEM_CATEGORY_CODE_PREFIX[form.itemCategory]}0001 형식 자동`
                  : '품목코드'
            }
            readOnly={!canEditCode}
            className={`${ERP_FIELD_INPUT_CLASS} font-mono ${
              !canEditCode ? 'bg-slate-50 text-slate-600' : ''
            }`}
          />
          {isCreate ? (
            <p className="mt-1 text-xs text-slate-500">
              품목코드는 구분별 자동채번입니다 (원자재 MA-, 부자재 SM-, 반제품 SFG-, 조립제품 FG-).
              직접 수정할 수 있습니다. 내부 품목ID는 저장 시 MR-00001 형식으로 발급됩니다.
            </p>
          ) : null}
        </label>
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>
            품목명 <RequiredMark />
          </span>
          <input
            value={form.name}
            onChange={(event) => updateForm('name', event.target.value)}
            className={ERP_FIELD_INPUT_CLASS}
          />
        </label>
        {showVersionField ? (
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>버전</span>
            <input
              value={form.version}
              onChange={(event) => updateForm('version', event.target.value)}
              placeholder="예: A1, V2 (없으면 비움)"
              className={`${ERP_FIELD_INPUT_CLASS} font-mono`}
            />
            <p className="mt-1 text-xs text-slate-500">
              같은 품목코드·버전이라도 품목명이 다르면 별도 품목으로 등록됩니다. 품목코드·품명·버전이
              모두 같을 때만 중복입니다.
            </p>
          </label>
        ) : null}
        {showProductProcessTypeField ? (
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>
              생산 공정 <RequiredMark />
            </span>
            <select
              value={form.processType}
              onChange={(event) =>
                updateForm('processType', event.target.value as ItemProcessType)
              }
              className={ERP_FIELD_INPUT_CLASS}
            >
              <option value="">선택</option>
              {ITEM_PROCESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ITEM_PROCESS_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              생산등록(SMD·후공정) 카드 표시 기준입니다.
            </p>
          </label>
        ) : null}
        {showPcbSideModeField ? (
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>
              면
              {form.processType === 'smt' || form.processType === 'smt_post' ? (
                <RequiredMark />
              ) : null}
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
            <p className="mt-1 text-xs text-slate-500">
              양면만 TOP/BOT를 나눠 생산합니다. 단면·더블은 한 면으로 등록합니다.
            </p>
          </label>
        ) : null}
        {showFinishedProductUnitPriceInfo ? (
          <div className="block text-sm sm:col-span-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className={ERP_FIELD_LABEL_CLASS}>기본 단가</span>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  {!isCreate && item && displayItemUnitPrice(item) > 0 ? (
                    <p className="font-medium text-slate-800">
                      {formatItemUnitPrice(displayItemUnitPrice(item))}원
                    </p>
                  ) : (
                    <p className="text-slate-500">BOM 등록 후 자동 계산</p>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  조립제품 단가는 BOM 등록에서 구성 반제품 단가 합으로 자동 반영됩니다.
                </p>
              </div>
              {showAdditionalUnitPriceField ? (
                <label className="block text-sm">
                  <span className={ERP_FIELD_LABEL_CLASS}>추가비용</span>
                  <QuoteNumericInput
                    min={0}
                    value={String(form.additionalUnitPrice > 0 ? form.additionalUnitPrice : '')}
                    onChange={(raw) =>
                      updateForm('additionalUnitPrice', Math.max(0, Math.round(Number(raw) || 0)))
                    }
                    className={ERP_FIELD_INPUT_CLASS}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    발주서 등록 시 같은 품목 아래 추가작업 행으로 자동 반영됩니다.
                  </p>
                </label>
              ) : null}
            </div>
          </div>
        ) : null}
        {showProductUnitPriceField ? (
          <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>기본단가</span>
              <QuoteNumericInput
                min={0}
                value={String(displayUnitPrice > 0 ? displayUnitPrice : form.unitPrice || '')}
                onChange={updateBaselineUnitPrice}
                className={ERP_FIELD_INPUT_CLASS}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-slate-500">
                직접 입력해 주세요. 직접 수정 시 세부 단가는 초기화됩니다.
              </p>
            </label>
            {showAdditionalUnitPriceField ? (
              <label className="block text-sm">
                <span className={ERP_FIELD_LABEL_CLASS}>추가비용</span>
                <QuoteNumericInput
                  min={0}
                  value={String(form.additionalUnitPrice > 0 ? form.additionalUnitPrice : '')}
                  onChange={(raw) =>
                    updateForm('additionalUnitPrice', Math.max(0, Math.round(Number(raw) || 0)))
                  }
                  className={ERP_FIELD_INPUT_CLASS}
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-slate-500">
                  발주서 등록 시 같은 품목 아래 추가작업 행으로 자동 반영됩니다.
                </p>
              </label>
            ) : null}
          </div>
        ) : null}
        {showRawMaterialTypeField ? (
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>
              공정구분 <RequiredMark />
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
                  {type}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {showMaterialDetailFields ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className={ERP_FIELD_LABEL_CLASS}>패키지</span>
                <input
                  value={form.package}
                  onChange={(event) => updateForm('package', event.target.value)}
                  placeholder="예: QFN, SOP, 0603"
                  className={ERP_FIELD_INPUT_CLASS}
                />
              </label>
              <label className="block text-sm">
                <span className={ERP_FIELD_LABEL_CLASS}>사양</span>
                <input
                  value={form.specification}
                  onChange={(event) => updateForm('specification', event.target.value)}
                  className={ERP_FIELD_INPUT_CLASS}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>MPN</span>
              <input
                value={form.mpn}
                onChange={(event) => updateForm('mpn', event.target.value)}
                className={`${ERP_FIELD_INPUT_CLASS} font-mono`}
              />
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={ERP_FIELD_LABEL_CLASS}>대체 MPN</span>
                <button
                  type="button"
                  className={ERP_ROW_ADD_BUTTON_CLASS}
                  onClick={() => updateForm('alternateMpns', [...form.alternateMpns, ''])}
                >
                  + 추가
                </button>
              </div>
              {form.alternateMpns.length ? (
                <div className="space-y-2">
                  {form.alternateMpns.map((mpn, index) => (
                    <div key={`alt-mpn-${index}`} className="flex items-center gap-2">
                      <input
                        value={mpn}
                        onChange={(event) => {
                          const next = [...form.alternateMpns]
                          next[index] = event.target.value
                          updateForm('alternateMpns', next)
                        }}
                        placeholder="같은 부품의 다른 메이커 품번"
                        className={`${ERP_FIELD_INPUT_CLASS} font-mono`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateForm(
                            'alternateMpns',
                            form.alternateMpns.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        aria-label={`대체 MPN ${index + 1} 삭제`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">릴 바코드만 다른 같은 부품이면 여기에 추가하세요.</p>
              )}
            </div>
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>도급/사급</span>
              <select
                value={form.supplyType}
                onChange={(event) =>
                  updateForm('supplyType', event.target.value as ItemSupplyType)
                }
                className={ERP_FIELD_INPUT_CLASS}
              >
                <option value="">선택</option>
                {ITEM_SUPPLY_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                사급은 고객이 자재를 넘기고, 도급은 우리가 구매발주·수급합니다.
              </p>
            </label>
          </>
        ) : null}
      </div>
    </ErpModal>
  )
}

export function ItemModal({ open, ...props }: ItemModalProps) {
  if (!open) return null
  return <ItemModalContent {...props} />
}
