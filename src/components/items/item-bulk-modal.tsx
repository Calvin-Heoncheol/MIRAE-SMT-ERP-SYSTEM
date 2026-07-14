'use client'

import { useEffect, useRef, useState } from 'react'
import {
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
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  ITEM_MATERIAL_TYPE_OPTIONS,
  ITEM_PCB_SIDE_MODES,
  ITEM_PCB_SIDE_MODE_LABELS,
  ITEM_SUPPLY_TYPE_OPTIONS,
  isManualItemCodeCategory,
  type ItemCategory,
  type ItemMaterialType,
  type ItemPcbSideMode,
  type ItemSupplyType,
} from '@/lib/items/types'

type ItemBulkModalProps = {
  open: boolean
  initialCategory?: ItemCategory | null
  onClose: () => void
  onSaved?: () => void
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
  onSaved?: () => void
}) {
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const [category, setCategory] = useState<ItemCategory>(initialCategory ?? 1)
  const [rows, setRows] = useState<ItemFormState[]>(() => [
    defaultItemBulkRow(initialCategory ?? 1),
  ])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const columns = itemBulkColumns(category)
  const inputClassName =
    'w-full min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  function changeCategory(next: ItemCategory) {
    setCategory(next)
    setRows([defaultItemBulkRow(next)])
    setSaveError(null)
    if (pasteRef.current) pasteRef.current.value = ''
  }

  function patchRow(index: number, patch: Partial<ItemFormState>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    )
  }

  function addRow() {
    setRows((current) => [...current, defaultItemBulkRow(category)])
  }

  function removeRow(index: number) {
    setRows((current) => {
      if (current.length <= 1) return [defaultItemBulkRow(category)]
      return current.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  function applyPasteText(text: string) {
    const parsed = parseItemBulkPaste(text, category)
    if (!parsed.length) return
    setRows(parsed)
    setSaveError(null)
  }

  function handleBulkPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData('text')
    if (!text.trim()) return
    event.preventDefault()
    applyPasteText(text)
    if (pasteRef.current) pasteRef.current.value = ''
  }

  function handleTablePaste(event: React.ClipboardEvent<HTMLTableElement>) {
    const text = event.clipboardData.getData('text')
    if (!text.includes('\n') && !text.includes('\t')) return
    event.preventDefault()
    applyPasteText(text)
  }

  async function handleSave() {
    const filled = rows.filter((row) => !isEmptyItemBulkRow(row))
    if (!filled.length) {
      setSaveError('등록할 품목을 입력하거나 붙여넣어 주세요.')
      return
    }

    const payloads = []
    for (let index = 0; index < filled.length; index += 1) {
      const form = { ...filled[index], itemCategory: category }
      const validationError = validateItemForm(form, { isCreate: true })
      if (validationError) {
        setSaveError(`${index + 1}행: ${validationError}`)
        return
      }
      payloads.push(formToItemPayload(form))
    }

    const duplicateIds = payloads
      .map((payload) => payload.id.trim())
      .filter(Boolean)
      .filter((id, index, list) => list.indexOf(id) !== index)
    if (duplicateIds.length) {
      setSaveError(`붙여넣기 목록에 중복 품목코드가 있습니다: ${duplicateIds[0]}`)
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = await createItems(payloads)
    setSaving(false)

    if (!result.ok) {
      const prefix =
        result.savedCount > 0
          ? `${result.savedCount}건까지 저장되었습니다. `
          : ''
      setSaveError(`${prefix}${result.detail}`)
      return
    }

    onSaved?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">품목 일괄 등록</h2>
            <p className="mt-1 text-xs text-slate-500">Excel에서 복사한 내용을 붙여넣어 등록합니다.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block max-w-xs text-sm">
            <span className="mb-1 block font-medium text-slate-600">
              품목구분 <span className="text-red-500">*</span>
            </span>
            <select
              value={category}
              onChange={(event) => changeCategory(Number(event.target.value) as ItemCategory)}
              disabled={saving}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {ITEM_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {ITEM_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-3">
            <p className="text-sm font-medium text-blue-900">일괄 붙여넣기</p>
            <p className="mt-1 text-xs text-blue-800">
              Excel에서 아래 열 순서대로 복사한 뒤, 이 칸에 붙여넣으세요.
            </p>
            {!isManualItemCodeCategory(category) ? (
              <p className="mt-1 text-xs text-blue-700">품목코드는 저장 시 자동 생성됩니다.</p>
            ) : null}

            <div className="mt-2 overflow-x-auto rounded border border-emerald-700/30 bg-white shadow-sm">
              <table className="w-max min-w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="w-8 border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-semibold text-slate-500" />
                    {columns.map((column, index) => (
                      <th
                        key={`col-${column.key}`}
                        className="border border-slate-300 bg-slate-100 px-2 py-1 text-center font-semibold text-slate-500"
                      >
                        {String.fromCharCode(65 + index)}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-semibold text-slate-500">
                      1
                    </th>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className="whitespace-nowrap border border-slate-300 bg-[#e2efda] px-2.5 py-1.5 text-left font-semibold text-slate-800"
                      >
                        {column.label}
                        {column.required ? <span className="ml-0.5 text-red-500">*</span> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-semibold text-slate-500">
                      2
                    </th>
                    {itemBulkPasteSampleValues(category).map((value, index) => (
                      <td
                        key={`${columns[index]?.key ?? index}-sample`}
                        className="whitespace-nowrap border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700"
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <textarea
              ref={pasteRef}
              rows={3}
              onPaste={handleBulkPaste}
              disabled={saving}
              placeholder={itemBulkPastePlaceholder(category)}
              className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full border-collapse text-sm" onPaste={handleTablePaste}>
              <thead className="bg-slate-50">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="whitespace-nowrap px-3 py-2 text-left text-sm font-semibold text-slate-600"
                    >
                      {column.label}
                      {column.required ? <span className="ml-0.5 text-red-500">*</span> : null}
                    </th>
                  ))}
                  <th className="w-16 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    {columns.map((column) => (
                      <td key={column.key} className="px-3 py-2 align-top">
                        {column.key === 'materialType' ? (
                          <select
                            value={row.materialType}
                            onChange={(event) =>
                              patchRow(index, {
                                materialType: event.target.value as ItemMaterialType,
                              })
                            }
                            className={inputClassName}
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
                            className={inputClassName}
                          >
                            <option value="">선택</option>
                            {ITEM_SUPPLY_TYPE_OPTIONS.map((value) => (
                              <option key={value} value={value}>
                                {value}
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
                            className={inputClassName}
                          >
                            <option value="">선택</option>
                            {ITEM_PCB_SIDE_MODES.map((value) => (
                              <option key={value} value={value}>
                                {ITEM_PCB_SIDE_MODE_LABELS[value]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={String(row[column.key] ?? '')}
                            onChange={(event) =>
                              patchRow(index, { [column.key]: event.target.value } as Partial<ItemFormState>)
                            }
                            className={`${inputClassName}${column.key === 'id' ? ' font-mono' : ''}${
                              column.key === 'unitPrice' ? ' text-right' : ''
                            }`}
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center align-top">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        disabled={saving}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addRow}
            disabled={saving}
            className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:bg-slate-50 disabled:opacity-50"
          >
            + 행 추가
          </button>

          {saveError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {saving ? '등록 중…' : '일괄 등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
