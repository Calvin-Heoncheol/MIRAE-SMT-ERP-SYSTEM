'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { BomChildItemCombobox } from '@/components/bom/bom-child-item-combobox'
import { ItemModal } from '@/components/items/item-modal'
import { useBusy } from '@/components/ui/busy-provider'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import { ExcelPasteSampleTable } from '@/components/ui/excel-paste-sample-table'
import {
  BOM_PASTE_COLUMNS,
  bomPastePlaceholder,
  bomPasteSampleValues,
  parseBomBulkPaste,
  resolveBomPasteRows,
  type BomPasteUnresolved,
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
  parentItemsForBom,
} from '@/lib/bom/utils'
import type { BomGroup } from '@/lib/bom/types'
import type { Item } from '@/lib/items/types'
import { ITEM_CATEGORY_LABELS, isProductItemCategory, isSemiFinishedItemCategory } from '@/lib/items/types'
import { normalizeVersionLabel, suggestNextVersionForItem } from '@/lib/items/version-code'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS, ERP_INFO_BOX_CLASS, ERP_INFO_BOX_TEXT_CLASS, ERP_INFO_BOX_TITLE_CLASS, ERP_PASTE_TEXTAREA_CLASS } from '@/lib/ui/tokens'

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

function CancelButton({ disabled }: { disabled?: boolean }) {
  const requestClose = useErpModalRequestClose()
  return (
    <ErpButton variant="secondary" disabled={disabled} onClick={() => requestClose?.()}>
      취소
    </ErpButton>
  )
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
  const canDelete = useCanDeleteRecords()
  const confirm = useErpConfirm()
  const [form, setForm] = useState<BomFormState>(() =>
    group ? bomGroupToForm(group) : emptyBomForm(initialParentProductId),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [versioning, setVersioning] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [pasteHint, setPasteHint] = useState<string | null>(null)
  const [pasteUnresolved, setPasteUnresolved] = useState<BomPasteUnresolved[]>([])
  const [localItems, setLocalItems] = useState<Item[]>([])
  const [registerTarget, setRegisterTarget] = useState<BomPasteUnresolved | null>(null)
  const [registerSession, setRegisterSession] = useState(0)
  const [versionUpInput, setVersionUpInput] = useState('')

  const busyUi = useBusy()
  const { notifyAuthOrFailure } = useWriteFailureToast()

  const mergedItems = useMemo(() => {
    if (!localItems.length) return items
    const byId = new Map(items.map((item) => [item.id, item]))
    for (const item of localItems) byId.set(item.id, item)
    return Array.from(byId.values())
  }, [items, localItems])

  const parents = useMemo(() => parentItemsForBom(mergedItems), [mergedItems])
  const selectedParent =
    parents.find((item) => item.id === form.parentProductId) ||
    mergedItems.find(
      (item) =>
        item.id === form.parentProductId && isProductItemCategory(item.itemCategory),
    ) ||
    null
  const childOptions = useMemo(
    () => (selectedParent ? childItemsForParent(mergedItems, selectedParent.itemCategory) : []),
    [mergedItems, selectedParent],
  )
  const showExcelPaste = Boolean(
    selectedParent && isSemiFinishedItemCategory(selectedParent.itemCategory),
  )
  const useCompactLines = showExcelPaste || form.lines.length > 12

  const availableParents = useMemo(() => {
    if (!isCreate) return parents
    const taken = new Set(existingParentIds)
    const list = parents.filter((item) => !taken.has(item.id))
    const lockedId = initialParentProductId.trim()
    if (!lockedId) return list
    if (list.some((item) => item.id === lockedId)) return list
    const locked = mergedItems.find(
      (item) => item.id === lockedId && isProductItemCategory(item.itemCategory),
    )
    return locked ? [locked, ...list] : list
  }, [parents, existingParentIds, isCreate, initialParentProductId, mergedItems])

  const suggestedVersion = useMemo(() => {
    if (!group || !selectedParent) return null
    return suggestNextVersionForItem(selectedParent, mergedItems)
  }, [group, selectedParent, mergedItems])

  const normalizedVersionInput = normalizeVersionLabel(versionUpInput)

  useEffect(() => {
    setForm(group ? bomGroupToForm(group) : emptyBomForm(initialParentProductId))
    setSaveError(null)
    setPasteText('')
    setPasteHint(null)
    setPasteUnresolved([])

    if (group) {
      const parent = items.find((item) => item.id === group.parentProductId)
      const suggested = parent ? suggestNextVersionForItem(parent, items) : null
      setVersionUpInput(suggested?.version || '')
    } else {
      setVersionUpInput('')
    }
    // 모달을 열거나 대상 BOM이 바뀔 때만 신버전 입력을 초기화
    // eslint-disable-next-line react-hooks/exhaustive-deps -- items는 열 당시 스냅샷만 사용
  }, [group?.parentProductId, mode, initialParentProductId])

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

  function openRegisterUnresolved(entry: BomPasteUnresolved) {
    setRegisterSession((value) => value + 1)
    setRegisterTarget(entry)
  }

  function closeRegisterModal() {
    setRegisterTarget(null)
  }

  function handleRawMaterialCreated(item: Item) {
    const target = registerTarget
    setLocalItems((current) => {
      const next = current.filter((row) => row.id !== item.id)
      next.push(item)
      return next
    })
    setPasteUnresolved((current) =>
      current.filter((row) => {
        if (!target) return true
        const token = target.token.trim().toLowerCase()
        if (row.token.trim().toLowerCase() === token) return false
        if (item.baseCode.trim().toLowerCase() === token) return false
        if (item.id.toLowerCase() === token) return false
        if (item.mpn.trim() && item.mpn.toLowerCase() === token) return false
        return true
      }),
    )
    setForm((current) => {
      if (current.lines.some((line) => line.childProductId === item.id)) return current
      const qty = target?.quantityPer || '1'
      const filled = current.lines.filter((line) => line.childProductId.trim())
      return {
        ...current,
        lines: [...filled, createBomFormLine({ childProductId: item.id, quantityPer: qty })],
      }
    })
    setPasteHint((current) => current || '등록한 자재를 BOM 구성에 추가했습니다.')
    closeRegisterModal()
  }

  async function applyPaste() {
    if (!selectedParent) {
      setPasteHint('부모 품목을 먼저 선택해 주세요.')
      setPasteUnresolved([])
      return
    }

    const parsed = parseBomBulkPaste(pasteText)
    const resolved = resolveBomPasteRows(parsed, childOptions)
    if (!resolved.ok) {
      setPasteHint(resolved.detail)
      setPasteUnresolved(resolved.unresolved)
      return
    }

    const hasExisting = form.lines.some((line) => line.childProductId.trim())
    if (hasExisting) {
      if (
        !(await confirm({
          title: '붙여넣기 교체',
          message: `현재 구성 ${form.lines.filter((line) => line.childProductId.trim()).length}건을 붙여넣기 ${resolved.lines.length}건으로 바꿀까요?`,
          confirmLabel: '교체',
          tone: 'default',
        }))
      ) {
        return
      }
    }

    setForm((current) => ({ ...current, lines: resolved.lines }))
    setPasteUnresolved(resolved.unresolved)
    setPasteHint(
      resolved.unresolved.length
        ? `붙여넣은 ${parsed.length}건 중 ${resolved.lines.length}건 적용됨`
        : `${resolved.lines.length}건 적용되었습니다.`,
    )
  }

  async function handleSave() {
    const validationError = validateBomForm(form, {
      parentItemCategory: selectedParent?.itemCategory ?? null,
      childItems: childOptions,
    })
    if (validationError) {
      setSaveError(validationError)
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = await busyUi.run(() =>
      saveBomForParent(form.parentProductId, formToBomLinePayloads(form)),
    )
    setSaving(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setSaveError(result.detail)
      return
    }

    onSaved?.()
  }

  async function handleDelete() {
    if (!group) return
    if (
      !(await confirm({
        title: 'BOM 삭제',
        message: `${group.parentProductId} BOM 구성을 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }

    setDeleting(true)
    setSaveError(null)
    const result = await busyUi.run(() => deleteBomForParent(group.parentProductId))
    setDeleting(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setSaveError(result.detail)
      return
    }

    onDeleted?.()
  }

  async function handleVersionUp() {
    if (!group || !selectedParent) return

    const versionLabel = normalizeVersionLabel(versionUpInput)
    if (!versionLabel) {
      setSaveError('신버전을 입력해 주세요. (예: A2, V2, REV3)')
      return
    }

    if (
      !(await confirm({
        title: 'BOM 버전업',
        message: [
          'BOM 버전업을 진행할까요?',
          '',
          `품목코드: ${selectedParent.baseCode || selectedParent.id}`,
          `구버전: ${selectedParent.version || '—'}`,
          `신버전: ${versionLabel}`,
          '',
          '· 같은 품목코드로 새 버전 행을 만들고 BOM을 복사합니다.',
          '· 구버전은 그대로 유지됩니다.',
          '· 완료 후 신버전 BOM을 바로 수정할 수 있습니다.',
        ].join('\n'),
        confirmLabel: '버전업',
        tone: 'default',
      }))
    ) {
      return
    }

    setVersioning(true)
    setSaveError(null)

    const result = await busyUi.run(() =>
      versionUpBomParent({
        sourceItem: selectedParent,
        group,
        existingItems: mergedItems,
        newVersion: versionLabel,
        deactivateSource: false,
      }),
    )

    setVersioning(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setSaveError(result.detail)
      return
    }

    onVersioned?.(result.newGroup)
  }

  const busy = saving || deleting || versioning

  const filledLineCount = useMemo(
    () => form.lines.filter((line) => line.childProductId.trim()).length,
    [form.lines],
  )
  const totalQuantityPer = useMemo(() => {
    let sum = 0
    for (const line of form.lines) {
      if (!line.childProductId.trim()) continue
      const qty = Number(line.quantityPer)
      if (Number.isFinite(qty) && qty > 0) sum += qty
    }
    return sum
  }, [form.lines])

  return (
    <>
    <ErpModal
      open
      size={showExcelPaste ? 'lg' : 'md'}
      title={isCreate ? 'BOM 등록' : 'BOM 수정'}
      description="조립제품 → 반제품, 반제품 → 원자재·부자재 구성을 등록합니다."
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-col gap-2">
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {!isCreate ? (
              <div className="flex flex-wrap gap-2">
                {canDelete ? (
                  <ErpButton
                    variant="danger"
                    disabled={busy}
                    loading={deleting}
                    onClick={() => void handleDelete()}
                  >
                    BOM 삭제
                  </ErpButton>
                ) : (
                  <span />
                )}
                <ErpButton
                  variant="secondary"
                  disabled={busy || !normalizedVersionInput}
                  loading={versioning}
                  onClick={() => void handleVersionUp()}
                >
                  {normalizedVersionInput ? `버전업 → ${normalizedVersionInput}` : '버전업'}
                </ErpButton>
              </div>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <CancelButton disabled={busy} />
              <ErpButton disabled={busy} loading={saving} onClick={() => void handleSave()}>
                저장
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>부모 품목</span>
            <BomChildItemCombobox
              value={form.parentProductId}
              items={availableParents}
              disabled={!isCreate}
              placeholder="부모 품목 검색"
              ariaLabel="부모 품목"
              onItemSelect={(item) =>
                setForm((current) => ({
                  ...current,
                  parentProductId: item?.id || '',
                  lines: [createBomFormLine()],
                }))
              }
            />
            {selectedParent ? (
              <p className="mt-1.5 text-xs text-slate-500">{describeBomRule(selectedParent.itemCategory)}</p>
            ) : null}
          </label>
          {!isCreate && selectedParent ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <label className="block text-sm">
                <span className={ERP_FIELD_LABEL_CLASS}>신버전</span>
                <input
                  type="text"
                  value={versionUpInput}
                  disabled={busy}
                  placeholder={suggestedVersion?.version || '예: A2, V2, REV3'}
                  onChange={(event) => setVersionUpInput(event.target.value)}
                  className={`${ERP_FIELD_INPUT_CLASS} font-mono`}
                />
              </label>
              <p className="mt-1.5 text-xs text-slate-500">
                같은 품목코드(
                <span className="font-mono">{selectedParent.baseCode || selectedParent.id}</span>
                )에 입력한 버전 행을 만들고 BOM을 복사합니다. 구버전(
                <span className="font-mono">{selectedParent.version || '—'}</span>
                )은 유지됩니다.
                {suggestedVersion ? (
                  <>
                    {' '}
                    제안: <span className="font-mono font-semibold">{suggestedVersion.version}</span>
                  </>
                ) : null}
              </p>
              {normalizedVersionInput ? (
                <p className="mt-1 text-xs text-slate-500">
                  새 행의 내부 품목ID는 저장 시 MR-00001 형식으로 자동 발급됩니다.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {showExcelPaste ? (
          <div className={ERP_INFO_BOX_CLASS}>
            <p className={ERP_INFO_BOX_TITLE_CLASS}>일괄 붙여넣기</p>
            <p className={ERP_INFO_BOX_TEXT_CLASS}>
              Excel에서 아래 열 순서대로 복사한 뒤, 이 칸에 붙여넣으세요. 고객사 품목코드 또는
              MPN으로 매칭됩니다.
            </p>

            <ExcelPasteSampleTable
              columns={BOM_PASTE_COLUMNS}
              sampleRows={bomPasteSampleValues()}
            />

            <textarea
              value={pasteText}
              onChange={(event) => {
                setPasteText(event.target.value)
                setPasteHint(null)
                setPasteUnresolved([])
              }}
              disabled={busy}
              rows={4}
              placeholder={bomPastePlaceholder()}
              className={ERP_PASTE_TEXTAREA_CLASS}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ErpButton
                variant="secondary"
                disabled={busy || !pasteText.trim()}
                onClick={() => void applyPaste()}
              >
                붙여넣기 적용
              </ErpButton>
              {pasteHint ? <p className="text-xs text-slate-600">{pasteHint}</p> : null}
            </div>
            {pasteUnresolved.length ? (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                <p className="text-xs font-bold text-amber-900">
                  자재 등록이 안 되어 제외된 품목 {pasteUnresolved.length}건
                </p>
                <ul className="mt-2 space-y-1.5">
                  {pasteUnresolved.map((entry) => (
                    <li
                      key={`${entry.token}-${entry.quantityPer}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5 ring-1 ring-amber-200"
                    >
                      <p className="min-w-0 truncate font-mono text-xs font-semibold text-amber-900">
                        {entry.token}
                      </p>
                      <ErpButton
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => openRegisterUnresolved(entry)}
                      >
                        원자재 등록
                      </ErpButton>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] text-amber-800">
                  등록하면 이 BOM 구성에 바로 추가됩니다. 고객사·품목코드·품목명만 입력하면 됩니다.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-600">
              구성 품목
              {filledLineCount > 0 ? (
                <span className="ml-1.5 text-xs font-normal text-slate-500">
                  (
                  {filledLineCount.toLocaleString('ko-KR')}건
                  {totalQuantityPer > 0
                    ? ` · 소요량 합 ${totalQuantityPer.toLocaleString('ko-KR')}`
                    : ''}
                  )
                </span>
              ) : null}
            </p>
            <ErpRowAddButton
              onClick={addLine}
              disabled={!selectedParent || busy}
              title="구성 품목 추가"
            />
          </div>

          {useCompactLines ? (
            <div className="max-h-[360px] overflow-auto rounded-xl border border-slate-200">
              <table className="erp-data-table erp-data-table--compact w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold" colSpan={2}>
                      구성 품목
                    </th>
                    <th className="w-28 px-3 py-2 text-right font-semibold">수량</th>
                    <th className="w-10 px-2 py-2 text-center font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line, index) => (
                    <tr key={line.key} className="border-t border-slate-100">
                      <td className="px-3 py-1.5" colSpan={2}>
                        <BomChildItemCombobox
                          value={line.childProductId}
                          items={childOptions}
                          disabled={!selectedParent || busy}
                          ariaLabel="구성 품목"
                          inputClassName={`${ERP_FIELD_INPUT_CLASS} text-xs`}
                          onItemSelect={(item) =>
                            updateLine(line.key, { childProductId: item?.id || '' })
                          }
                        />
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
                          className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
                          aria-label={`구성 ${index + 1} 삭제`}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    <BomChildItemCombobox
                      value={line.childProductId}
                      items={childOptions}
                      disabled={!selectedParent || busy}
                      ariaLabel={`구성 ${index + 1}`}
                      inputClassName={ERP_FIELD_INPUT_CLASS}
                      onItemSelect={(item) =>
                        updateLine(line.key, { childProductId: item?.id || '' })
                      }
                    />
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
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
                      aria-label={`구성 ${index + 1} 삭제`}
                    >
                      ×
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
                ? `${ITEM_CATEGORY_LABELS[3]} (여러 조립제품에서 공용 가능)`
                : `${ITEM_CATEGORY_LABELS[1]}, ${ITEM_CATEGORY_LABELS[2]}`}
            </p>
          ) : null}
        </div>
      </div>
    </ErpModal>

    {registerTarget ? (
      <ItemModal
        key={`bom-register-${registerSession}-${registerTarget.token}`}
        open
        mode="create"
        initialCategory={1}
        initialValues={{
          id: registerTarget.token.trim(),
          name: '',
        }}
        existingItems={mergedItems}
        zIndexClassName="z-[60]"
        onClose={closeRegisterModal}
        onCreated={handleRawMaterialCreated}
      />
    ) : null}
    </>
  )
}

export function BomModal({ open, ...props }: BomModalProps) {
  if (!open) return null
  return <BomModalContent {...props} />
}
