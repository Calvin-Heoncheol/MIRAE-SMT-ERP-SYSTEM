'use client'

import { useEffect, useRef, useState } from 'react'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import { ExcelPasteSampleTable } from '@/components/ui/excel-paste-sample-table'
import { RequiredMark } from '@/components/ui/required-mark'
import { useToast } from '@/components/ui/toast-provider'
import {
  applyItemBulkColumnPaste,
  defaultItemBulkRow,
  isEmptyItemBulkRow,
  itemBulkColumns,
  itemBulkPastePlaceholder,
  itemBulkPasteSampleValues,
  parseItemBulkPaste,
} from '@/lib/items/bulk-paste'
import { formToItemPayload, validateItemForm, type ItemFormState } from '@/lib/items/form-state'
import { createItems } from '@/lib/items/repository'
import {
  ERP_FIELD_INPUT_CLASS,
  ERP_FIELD_LABEL_CLASS,
  ERP_INFO_BOX_CLASS,
  ERP_INFO_BOX_TEXT_CLASS,
  ERP_INFO_BOX_TITLE_CLASS,
  ERP_PASTE_TEXTAREA_CLASS,
  ERP_WARNING_BOX_CLASS,
} from '@/lib/ui/tokens'
import {
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  ITEM_MATERIAL_TYPE_OPTIONS,
  ITEM_PCB_SIDE_MODE_LABELS,
  ITEM_PCB_SIDE_MODES,
  ITEM_PROCESS_TYPE_LABELS,
  ITEM_PROCESS_TYPES,
  ITEM_SUPPLY_TYPE_OPTIONS,
  type ItemCategory,
  type ItemMaterialType,
  type ItemPcbSideMode,
  type ItemPayload,
  type ItemProcessType,
  type ItemSupplyType,
} from '@/lib/items/types'
import { fetchSalesBusinessPartners } from '@/lib/partners/repository'
import type { BusinessPartner } from '@/lib/partners/types'
import { resolvePartnerFromInput } from '@/lib/partners/utils'

type ItemBulkModalProps = {
  open: boolean
  initialCategory?: ItemCategory | null
  onClose: () => void
  onSaved?: (message?: string) => void
}

export function ItemBulkModal({
  open,
  initialCategory = null,
  onClose,
  onSaved,
}: ItemBulkModalProps) {
  if (!open) return null

  return (
    <ItemBulkModalContent
      initialCategory={initialCategory}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function ItemBulkModalContent({
  initialCategory,
  onClose,
  onSaved,
}: {
  initialCategory: ItemCategory | null
  onClose: () => void
  onSaved?: (message?: string) => void
}) {
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const errorRowRef = useRef<HTMLTableRowElement>(null)
  const toast = useToast()
  const [category, setCategory] = useState<ItemCategory>(initialCategory ?? 1)
  const [rows, setRows] = useState<ItemFormState[]>(() => [
    defaultItemBulkRow(initialCategory ?? 1),
  ])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  /** 검증 실패 시 테이블에서 강조할 행 (0-based, rows 기준) */
  const [errorRowIndex, setErrorRowIndex] = useState<number | null>(null)
  const [duplicateCodes, setDuplicateCodes] = useState<string[]>([])
  const [canSkipExisting, setCanSkipExisting] = useState(false)
  const pendingPayloadsRef = useRef<ItemPayload[] | null>(null)
  const [salesPartners, setSalesPartners] = useState<BusinessPartner[]>([])

  const columns = itemBulkColumns(category)
  const inputClassName = ERP_FIELD_INPUT_CLASS
  const errorInputClassName =
    'w-full rounded-lg border border-red-400 bg-red-50/80 px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100'

  useEffect(() => {
    let cancelled = false
    fetchSalesBusinessPartners().then((result) => {
      if (cancelled || !result.ok) return
      setSalesPartners(result.partners)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function resolveRowCustomer(row: ItemFormState): ItemFormState {
    if (row.customerId.trim()) return row
    const partner = resolvePartnerFromInput(salesPartners, row.customerName)
    if (!partner) return row
    return {
      ...row,
      customerName: partner.name,
      customerId: partner.id,
    }
  }

  function clearDuplicateState() {
    setDuplicateCodes([])
    setCanSkipExisting(false)
    pendingPayloadsRef.current = null
  }

  function clearValidationHighlight() {
    setErrorRowIndex(null)
  }

  function focusErrorRow(index: number) {
    setErrorRowIndex(index)
    window.requestAnimationFrame(() => {
      errorRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  useEffect(() => {
    if (errorRowIndex == null) return
    errorRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [errorRowIndex])

  function changeCategory(next: ItemCategory) {
    setCategory(next)
    setRows([defaultItemBulkRow(next)])
    setSaveError(null)
    clearValidationHighlight()
    clearDuplicateState()
    if (pasteRef.current) pasteRef.current.value = ''
  }

  function patchRow(index: number, patch: Partial<ItemFormState>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    )
    if (errorRowIndex === index) {
      setSaveError(null)
      clearValidationHighlight()
    }
    clearDuplicateState()
  }

  function addRow() {
    setRows((current) => [...current, defaultItemBulkRow(category)])
  }

  function removeRow(index: number) {
    setRows((current) => {
      if (current.length <= 1) return [defaultItemBulkRow(category)]
      return current.filter((_, rowIndex) => rowIndex !== index)
    })
    setSaveError(null)
    clearValidationHighlight()
    clearDuplicateState()
  }

  function applyPasteText(text: string) {
    const parsed = parseItemBulkPaste(text, category)
    if (!parsed.length) return
    setRows(parsed)
    setSaveError(null)
    clearValidationHighlight()
    clearDuplicateState()
  }

  function handleBulkPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData('text')
    if (!text.trim()) return
    event.preventDefault()
    applyPasteText(text)
    if (pasteRef.current) pasteRef.current.value = ''
  }

  function handleColumnPaste(
    startRowIndex: number,
    columnKey: keyof ItemFormState,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) {
    const text = event.clipboardData.getData('text')
    if (!text.trim()) return

    // 여러 열(탭) → 기존처럼 전체 일괄 파싱
    if (text.includes('\t')) {
      event.preventDefault()
      applyPasteText(text)
      return
    }

    const next = applyItemBulkColumnPaste({
      rows,
      category,
      startRowIndex,
      columnKey,
      text,
    })
    if (!next) return

    event.preventDefault()
    setRows(next)
    setSaveError(null)
    clearValidationHighlight()
    clearDuplicateState()
  }

  function buildPayloads(): ItemPayload[] | null {
    const filledIndexes = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !isEmptyItemBulkRow(row))

    if (!filledIndexes.length) {
      setSaveError('등록할 품목을 입력하거나 붙여넣어 주세요.')
      clearValidationHighlight()
      clearDuplicateState()
      return null
    }

    const payloads: ItemPayload[] = []
    for (const { row, index } of filledIndexes) {
      const form = resolveRowCustomer({ ...row, itemCategory: category })
      const validationError = validateItemForm(form, { isCreate: true })
      if (validationError) {
        setSaveError(`${index + 1}행: ${validationError}`)
        focusErrorRow(index)
        clearDuplicateState()
        return null
      }
      payloads.push(formToItemPayload(form))
    }
    clearValidationHighlight()
    return payloads
  }

  async function runCreate(payloads: ItemPayload[], skipExisting: boolean) {
    setSaving(true)
    setSaveError(null)
    clearValidationHighlight()

    const result = await createItems(payloads, { skipExisting })
    setSaving(false)

    if (!result.ok) {
      const prefix =
        result.savedCount > 0
          ? `${result.savedCount}건까지 저장되었습니다. `
          : ''
      const detail = `${prefix}${result.detail}`
      setSaveError(detail)

      const rowMatch = detail.match(/(\d+)\s*행/)
      if (rowMatch) {
        const rowNumber = Number(rowMatch[1])
        if (Number.isFinite(rowNumber) && rowNumber >= 1 && rowNumber <= rows.length) {
          focusErrorRow(rowNumber - 1)
        }
      }

      if (result.duplicateCodes?.length) {
        setDuplicateCodes(result.duplicateCodes)
        setCanSkipExisting(Boolean(result.canSkipExisting))
        pendingPayloadsRef.current = result.canSkipExisting ? payloads : null
        toast.push({
          title: result.canSkipExisting
            ? '이미 등록된 품목코드입니다'
            : '중복 품목코드가 있습니다',
          description: result.canSkipExisting
            ? `${result.duplicateCodes.length}개 코드가 이미 있습니다. 모달에서 「제외하고 등록」할 수 있습니다.`
            : `${result.duplicateCodes.length}개 코드가 붙여넣기 목록에서 중복됩니다.`,
          kind: 'error',
          durationMs: 7000,
        })
      } else {
        clearDuplicateState()
        toast.error('품목 일괄 등록 실패', result.detail)
      }
      return
    }

    clearDuplicateState()
    const skipped = result.skippedCount ?? 0
    const message =
      skipped > 0
        ? `${result.ids.length}건 등록 · 기존 ${skipped}건 제외`
        : `${result.ids.length}건 품목이 등록되었습니다.`
    onSaved?.(message)
  }

  async function handleSave() {
    const payloads = buildPayloads()
    if (!payloads) return
    await runCreate(payloads, false)
  }

  async function handleSaveSkippingExisting() {
    const payloads = pendingPayloadsRef.current ?? buildPayloads()
    if (!payloads) return
    await runCreate(payloads, true)
  }

  return (
    <ErpModal
      open
      size="lg"
      title="품목 일괄 등록"
      description="Excel에서 복사한 내용을 붙여넣어 등록합니다."
      onClose={onClose}
      closeOnEscape={!saving}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <ErpButton variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </ErpButton>
          {canSkipExisting ? (
            <ErpButton
              variant="secondary"
              onClick={() => void handleSaveSkippingExisting()}
              disabled={saving}
              className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            >
              {saving ? '등록 중…' : '제외하고 등록'}
            </ErpButton>
          ) : null}
          <ErpButton onClick={() => void handleSave()} disabled={saving} loading={saving}>
            일괄 등록
          </ErpButton>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block max-w-xs text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>
            품목구분
            <RequiredMark />
          </span>
          <select
            value={category}
            onChange={(event) => changeCategory(Number(event.target.value) as ItemCategory)}
            disabled={saving}
            className={ERP_FIELD_INPUT_CLASS}
          >
            {ITEM_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {ITEM_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <div className={ERP_INFO_BOX_CLASS}>
          <p className={ERP_INFO_BOX_TITLE_CLASS}>일괄 붙여넣기</p>
          <p className={ERP_INFO_BOX_TEXT_CLASS}>
            Excel에서 아래 열 순서대로 복사한 뒤, 이 칸에 붙여넣으세요.
          </p>
          <p className={ERP_INFO_BOX_TEXT_CLASS}>
            품목코드는 비우면 자동 생성됩니다 (원자재 MA-, 부자재 SM-, 반제품 SFG-, 조립제품
            FG-).
          </p>
          <p className={ERP_INFO_BOX_TEXT_CLASS}>
            내부 품목ID(MR-00001)는 저장 시 자동 발급됩니다.
          </p>

          <ExcelPasteSampleTable
            columns={columns}
            sampleRows={itemBulkPasteSampleValues(category)}
          />

          <textarea
            ref={pasteRef}
            rows={3}
            onPaste={handleBulkPaste}
            disabled={saving}
            placeholder={itemBulkPastePlaceholder(category)}
            className={ERP_PASTE_TEXTAREA_CLASS}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-bold text-slate-900">등록 품목</h3>
            <span className="text-xs font-medium text-slate-500">총 {rows.length}건</span>
          </div>
          <ErpRowAddButton onClick={addRow} disabled={saving} title="품목 행 추가" />
        </div>

        {saveError && !duplicateCodes.length ? (
          <button
            type="button"
            onClick={() => {
              if (errorRowIndex != null) focusErrorRow(errorRowIndex)
            }}
            className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-100"
          >
            {saveError}
            {errorRowIndex != null ? (
              <span className="mt-0.5 block text-xs font-medium text-red-600">
                빨간 행을 확인해 주세요. (클릭하면 해당 행으로 이동)
              </span>
            ) : null}
          </button>
        ) : null}

        <div ref={tableScrollRef} className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="erp-data-table erp-data-table--compact min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-50">
              <tr>
                <th className="whitespace-nowrap px-2 py-2 text-center text-sm font-semibold text-slate-500">
                  #
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={[
                      'whitespace-nowrap px-3 py-2 text-left text-sm font-semibold text-slate-600',
                      column.widthClass || '',
                      column.key === 'unitPrice' ? 'text-right' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {column.label}
                    {column.required ? <RequiredMark /> : null}
                  </th>
                ))}
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const isErrorRow = errorRowIndex === index
                const rowInputClass = isErrorRow ? errorInputClassName : inputClassName
                return (
                  <tr
                    key={index}
                    ref={isErrorRow ? errorRowRef : undefined}
                    className={[
                      'border-t',
                      isErrorRow
                        ? 'border-red-200 bg-red-50 ring-2 ring-inset ring-red-300'
                        : 'border-slate-100',
                    ].join(' ')}
                  >
                    <td
                      className={[
                        'whitespace-nowrap px-2 py-2 text-center align-top text-xs tabular-nums',
                        isErrorRow ? 'font-bold text-red-700' : 'text-slate-400',
                      ].join(' ')}
                    >
                      {index + 1}
                    </td>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={[
                          'px-3 py-2 align-top',
                          column.widthClass || '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {column.key === 'customerName' ? (
                          <CustomerCombobox
                            value={row.customerName}
                            partners={salesPartners}
                            placeholder="거래처명 검색"
                            ariaLabel={`${index + 1}행 고객사`}
                            inputClassName={rowInputClass}
                            onValueChange={(value) =>
                              patchRow(index, { customerName: value, customerId: '' })
                            }
                            onPartnerSelect={(partner) =>
                              patchRow(index, {
                                customerName: partner.name,
                                customerId: partner.id,
                              })
                            }
                          />
                        ) : column.key === 'materialType' ? (
                          <select
                            value={row.materialType}
                            onChange={(event) =>
                              patchRow(index, {
                                materialType: event.target.value as ItemMaterialType,
                              })
                            }
                            className={rowInputClass}
                          >
                            <option value="">선택</option>
                            {ITEM_MATERIAL_TYPE_OPTIONS.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        ) : column.key === 'supplyType' ? (
                          <select
                            value={row.supplyType}
                            onChange={(event) =>
                              patchRow(index, {
                                supplyType: event.target.value as ItemSupplyType,
                              })
                            }
                            className={rowInputClass}
                          >
                            <option value="">선택</option>
                            {ITEM_SUPPLY_TYPE_OPTIONS.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        ) : column.key === 'processType' ? (
                          <select
                            value={row.processType}
                            onChange={(event) =>
                              patchRow(index, {
                                processType: event.target.value as ItemProcessType,
                              })
                            }
                            className={rowInputClass}
                          >
                            <option value="">선택</option>
                            {ITEM_PROCESS_TYPES.map((value) => (
                              <option key={value} value={value}>
                                {ITEM_PROCESS_TYPE_LABELS[value]}
                              </option>
                            ))}
                          </select>
                        ) : column.key === 'pcbSideMode' ? (
                          <select
                            value={row.pcbSideMode}
                            onChange={(event) =>
                              patchRow(index, {
                                pcbSideMode: event.target.value as ItemPcbSideMode,
                              })
                            }
                            className={rowInputClass}
                          >
                            <option value="">선택</option>
                            {ITEM_PCB_SIDE_MODES.map((value) => (
                              <option key={value} value={value}>
                                {ITEM_PCB_SIDE_MODE_LABELS[value]}
                              </option>
                            ))}
                          </select>
                        ) : column.key === 'unitPrice' ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            value={row.unitPrice ? String(row.unitPrice) : ''}
                            onChange={(event) => {
                              const digits = event.target.value.replace(/[^\d]/g, '')
                              patchRow(index, {
                                unitPrice: digits ? Math.max(0, Math.round(Number(digits))) : 0,
                              })
                            }}
                            onPaste={(event) => handleColumnPaste(index, column.key, event)}
                            placeholder="0"
                            className={`${rowInputClass} text-right tabular-nums`}
                            aria-label={`${index + 1}행 단가`}
                          />
                        ) : (
                          <input
                            value={String(row[column.key] ?? '')}
                            onChange={(event) =>
                              patchRow(index, {
                                [column.key]: event.target.value,
                              } as Partial<ItemFormState>)
                            }
                            onPaste={(event) => handleColumnPaste(index, column.key, event)}
                            className={`${rowInputClass}${
                              column.key === 'id' || column.key === 'mpn' ? ' font-mono' : ''
                            }${column.key === 'version' ? ' max-w-[5.5rem]' : ''}`}
                          />
                        )}
                      </td>
                    ))}
                    <td className="w-10 px-2 py-2 text-center align-top">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        disabled={saving}
                        className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`${index + 1}행 삭제`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          고객사명·품목코드·품목명 등 입력칸에 Excel 한 열을 붙여넣으면 해당 열에 세로로 채워집니다. 행이
          부족하면 자동으로 추가됩니다.
        </p>

        {duplicateCodes.length ? (
          <div className={ERP_WARNING_BOX_CLASS}>
            <p className="font-semibold">
              {canSkipExisting
                ? `이미 등록된 품목코드 ${duplicateCodes.length}개`
                : `중복 품목코드 ${duplicateCodes.length}개`}
            </p>
            <p className="mt-1 break-all text-amber-900/90">{duplicateCodes.join(', ')}</p>
            {canSkipExisting ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ErpButton
                  variant="secondary"
                  disabled={saving}
                  loading={saving}
                  onClick={() => void handleSaveSkippingExisting()}
                  className="border-amber-300 bg-amber-700 text-xs text-white hover:bg-amber-800"
                >
                  이미 등록된 항목 제외하고 등록
                </ErpButton>
                <p className="text-xs text-amber-800/80">
                  중복을 빼고 나머지 신규 품목만 저장합니다.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-800/80">
                붙여넣기 목록 안에서 같은 코드가 여러 번 있습니다. 중복 행을 정리한 뒤 다시 등록해
                주세요.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </ErpModal>
  )
}
