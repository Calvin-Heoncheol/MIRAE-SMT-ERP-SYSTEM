'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import {
  BOM_PASTE_COLUMNS,
  bomPastePlaceholder,
  bomPasteSampleValues,
  parseBomBulkPaste,
  resolveBomPasteRows,
} from '@/lib/bom/bulk-paste'
import { deleteBomForParent, saveBomForParent } from '@/lib/bom/repository'
import { versionUpBomParent } from '@/lib/bom/version-up'
import {
  bomGroupToForm,
  createBomFormLine,
  emptyBomForm,
  formToBomLinePayloads,
  validateBomForm,
  type BomFormState,
} from '@/lib/bom/form-state'
import {
  childItemsForParent,
  describeBomRule,
  formatItemOptionLabel,
  parentItemsForBom,
} from '@/lib/bom/utils'
import type { BomGroup } from '@/lib/bom/types'
import type { Item } from '@/lib/items/types'
import { ITEM_CATEGORY_LABELS, isSemiFinishedItemCategory } from '@/lib/items/types'
import { suggestNextVersionItemCode } from '@/lib/items/version-code'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

type BomModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  group?: BomGroup | null
  /** create 모드에서 부모 품목 미리 선택 */
  initialParentProductId?: string
  items: Item[]
  existingParentIds: string[]
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
  /** 버전업 성공 시 새 BOM 편집으로 전환 */
  onVersioned?: (group: BomGroup) => void
}

function BomModalContent({
  mode,
  group,
  initialParentProductId = '',
  items,
  existingParentIds,
  onClose,
  onSaved,
  onDeleted,
  onVersioned,
}: Omit<BomModalProps, 'open'>) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState<BomFormState>(() =>
    group ? bomGroupToForm(group) : emptyBomForm(initialParentProductId),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [versioning, setVersioning] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [pasteHint, setPasteHint] = useState<string | null>(null)

  const parents = useMemo(() => parentItemsForBom(items), [items])
  const selectedParent = parents.find((item) => item.id === form.parentProductId) || null
  const childOptions = useMemo(
    () => (selectedParent ? childItemsForParent(items, selectedParent.itemCategory) : []),
    [items, selectedParent],
  )
  const showExcelPaste = Boolean(
    selectedParent && isSemiFinishedItemCategory(selectedParent.itemCategory),
  )
  const useCompactLines = showExcelPaste || form.lines.length > 12

  const availableParents = useMemo(() => {
    if (!isCreate) return parents
    const taken = new Set(existingParentIds)
    return parents.filter((item) => !taken.has(item.id))
  }, [parents, existingParentIds, isCreate])

  const suggestedVersionCode = useMemo(() => {
    if (!group) return null
    return suggestNextVersionItemCode(
      group.parentProductId,
      items.map((item) => item.id),
    )
  }, [group, items])

  const childNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of childOptions) {
      map.set(item.id, item.name)
    }
    return map
  }, [childOptions])

  useEffect(() => {
    setForm(group ? bomGroupToForm(group) : emptyBomForm(initialParentProductId))
    setSaveError(null)
    setPasteText('')
    setPasteHint(null)
  }, [group, mode, initialParentProductId])

  function updateLine(key: string, patch: Partial<BomFormState['lines'][number]>) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }))
  }

  function addLine() {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, createBomFormLine()],
    }))
  }

  function removeLine(key: string) {
    setForm((current) => {
      const next = current.lines.filter((line) => line.key !== key)
      return { ...current, lines: next.length ? next : [createBomFormLine()] }
    })
  }

  function applyPaste() {
    if (!selectedParent) {
      setPasteHint('부모 품목을 먼저 선택해 주세요.')
      return
    }

    const parsed = parseBomBulkPaste(pasteText)
    const resolved = resolveBomPasteRows(parsed, childOptions)
    if (!resolved.ok) {
      setPasteHint(resolved.detail)
      return
    }

    const hasExisting = form.lines.some((line) => line.childProductId.trim())
    if (hasExisting) {
      const confirmed = window.confirm(
        `현재 구성 ${form.lines.filter((line) => line.childProductId.trim()).length}건을 붙여넣기 ${resolved.lines.length}건으로 바꿀까요?`,
      )
      if (!confirmed) return
    }

    setForm((current) => ({ ...current, lines: resolved.lines }))
    const skipped = resolved.unresolved.length
    setPasteHint(
      skipped
        ? `${resolved.lines.length}건 적용 · 미매칭 ${skipped}건 제외 (${resolved.unresolved.slice(0, 5).join(', ')}${skipped > 5 ? '…' : ''})`
        : `${resolved.lines.length}건 적용되었습니다.`,
    )
  }

  async function handleSave() {
    const validationError = validateBomForm(form)
    if (validationError) {
      setSaveError(validationError)
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = await saveBomForParent(form.parentProductId, formToBomLinePayloads(form))
    setSaving(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onSaved?.()
  }

  async function handleDelete() {
    if (!group) return
    if (!window.confirm(`${group.parentProductId} BOM 구성을 삭제할까요?`)) return

    setDeleting(true)
    setSaveError(null)
    const result = await deleteBomForParent(group.parentProductId)
    setDeleting(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onDeleted?.()
  }

  async function handleVersionUp() {
    if (!group || !selectedParent) return
    if (!suggestedVersionCode) {
      setSaveError('다음 버전 코드를 만들 수 없습니다.')
      return
    }

    const confirmed = window.confirm(
      [
        'BOM 버전업을 진행할까요?',
        '',
        `구버전: ${group.parentProductId}`,
        `신버전: ${suggestedVersionCode}`,
        '',
        '· 품목 속성과 BOM 구성을 복사합니다.',
        '· 구버전 품목은 사용중지됩니다.',
        '· 완료 후 신버전 BOM을 바로 수정할 수 있습니다.',
      ].join('\n'),
    )
    if (!confirmed) return

    setVersioning(true)
    setSaveError(null)

    const result = await versionUpBomParent({
      sourceItem: selectedParent,
      group,
      existingItemIds: items.map((item) => item.id),
      deactivateSource: true,
    })

    setVersioning(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onVersioned?.(result.newGroup)
  }

  const busy = saving || deleting || versioning

  return (
    <ErpModal
      open
      size={showExcelPaste ? 'lg' : 'md'}
      title={isCreate ? 'BOM 등록' : 'BOM 수정'}
      description="완제품 → 반제품, 반제품 → 원자재·부자재 구성을 등록합니다."
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-col gap-2">
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {!isCreate ? (
              <div className="flex flex-wrap gap-2">
                <ErpButton variant="danger" disabled={busy} onClick={() => void handleDelete()}>
                  {deleting ? '삭제 중…' : 'BOM 삭제'}
                </ErpButton>
                <ErpButton
                  variant="secondary"
                  disabled={busy || !suggestedVersionCode}
                  onClick={() => void handleVersionUp()}
                >
                  {versioning
                    ? '버전업 중…'
                    : suggestedVersionCode
                      ? `버전업 (${suggestedVersionCode})`
                      : '버전업'}
                </ErpButton>
              </div>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <ErpButton variant="secondary" onClick={onClose} disabled={busy}>
                취소
              </ErpButton>
              <ErpButton disabled={busy} onClick={() => void handleSave()}>
                {saving ? '저장 중…' : '저장'}
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>부모 품목</span>
          <select
            value={form.parentProductId}
            disabled={!isCreate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                parentProductId: event.target.value,
                lines: [createBomFormLine()],
              }))
            }
            className={ERP_FIELD_INPUT_CLASS}
          >
            <option value="">부모 품목 선택</option>
            {availableParents.map((item) => (
              <option key={item.id} value={item.id}>
                {formatItemOptionLabel(item)}
              </option>
            ))}
          </select>
          {selectedParent ? (
            <p className="mt-1.5 text-xs text-slate-500">{describeBomRule(selectedParent.itemCategory)}</p>
          ) : null}
          {!isCreate && suggestedVersionCode ? (
            <p className="mt-1.5 text-xs text-slate-500">
              버전업 시 새 품목코드{' '}
              <span className="font-mono font-semibold">{suggestedVersionCode}</span> 로 복사됩니다.
            </p>
          ) : null}
        </label>

        {showExcelPaste ? (
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-3">
            <p className="text-sm font-medium text-blue-900">일괄 붙여넣기</p>
            <p className="mt-1 text-xs text-blue-800">
              Excel에서 아래 열 순서대로 복사한 뒤, 이 칸에 붙여넣으세요. 품목코드 또는 MPN으로
              매칭됩니다.
            </p>

            <div className="mt-2 overflow-x-auto rounded border border-emerald-700/30 bg-white shadow-sm">
              <table className="w-max min-w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="w-8 border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-semibold text-slate-500" />
                    {BOM_PASTE_COLUMNS.map((column, index) => (
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
                    {BOM_PASTE_COLUMNS.map((column) => (
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
                    {bomPasteSampleValues().map((value, index) => (
                      <td
                        key={`${BOM_PASTE_COLUMNS[index]?.key ?? index}-sample`}
                        className="whitespace-nowrap border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700"
                      >
                        {value || '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <textarea
              value={pasteText}
              onChange={(event) => {
                setPasteText(event.target.value)
                setPasteHint(null)
              }}
              disabled={busy}
              rows={4}
              placeholder={bomPastePlaceholder()}
              className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ErpButton
                variant="secondary"
                disabled={busy || !pasteText.trim()}
                onClick={applyPaste}
              >
                붙여넣기 적용
              </ErpButton>
              {pasteHint ? <p className="text-xs text-slate-600">{pasteHint}</p> : null}
            </div>
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-600">
              구성 품목
              {form.lines.some((line) => line.childProductId.trim()) ? (
                <span className="ml-1.5 text-xs font-normal text-slate-500">
                  ({form.lines.filter((line) => line.childProductId.trim()).length}건)
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={addLine}
              disabled={!selectedParent || busy}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              구성 추가
            </button>
          </div>

          {useCompactLines ? (
            <div className="max-h-[360px] overflow-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">품목코드</th>
                    <th className="px-3 py-2 text-left font-semibold">품목명</th>
                    <th className="w-28 px-3 py-2 text-right font-semibold">수량</th>
                    <th className="w-16 px-3 py-2 text-center font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line) => (
                    <tr key={line.key} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        <input
                          value={line.childProductId}
                          disabled={!selectedParent || busy}
                          onChange={(event) =>
                            updateLine(line.key, { childProductId: event.target.value.trim() })
                          }
                          list={`bom-child-options-${form.parentProductId}`}
                          placeholder="품목코드"
                          className={`${ERP_FIELD_INPUT_CLASS} font-mono text-xs`}
                        />
                      </td>
                      <td className="truncate px-3 py-1.5 text-slate-600">
                        {childNameById.get(line.childProductId) || '—'}
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={line.quantityPer}
                          disabled={busy}
                          onChange={(event) => updateLine(line.key, { quantityPer: event.target.value })}
                          className={`${ERP_FIELD_INPUT_CLASS} text-right tabular-nums`}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          disabled={busy}
                          className="text-xs font-semibold text-slate-500 hover:text-red-600"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedParent ? (
                <datalist id={`bom-child-options-${form.parentProductId}`}>
                  {childOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </datalist>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {form.lines.map((line, index) => (
                <div
                  key={line.key}
                  className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 md:grid-cols-[minmax(0,1fr)_110px_auto]"
                >
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      구성 {index + 1}
                    </span>
                    <select
                      value={line.childProductId}
                      disabled={!selectedParent || busy}
                      onChange={(event) => updateLine(line.key, { childProductId: event.target.value })}
                      className={ERP_FIELD_INPUT_CLASS}
                    >
                      <option value="">품목 선택</option>
                      {childOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {formatItemOptionLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">수량</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={line.quantityPer}
                      disabled={busy}
                      onChange={(event) => updateLine(line.key, { quantityPer: event.target.value })}
                      className={ERP_FIELD_INPUT_CLASS}
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      disabled={busy}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedParent ? (
            <p className="mt-2 text-xs text-slate-500">
              선택 가능 구성:{' '}
              {selectedParent.itemCategory === 4
                ? ITEM_CATEGORY_LABELS[3]
                : `${ITEM_CATEGORY_LABELS[1]}, ${ITEM_CATEGORY_LABELS[2]}`}
            </p>
          ) : null}
        </div>
      </div>
    </ErpModal>
  )
}

export function BomModal({ open, ...props }: BomModalProps) {
  if (!open) return null
  return <BomModalContent {...props} />
}
