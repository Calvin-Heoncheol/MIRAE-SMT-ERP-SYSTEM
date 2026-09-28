'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { BomChildItemCombobox } from '@/components/bom/bom-child-item-combobox'
import { BomAddRowsControl } from '@/components/bom/bom-add-rows-control'
import { BomLinesSpreadsheet } from '@/components/bom/bom-lines-spreadsheet'
import { useBusy } from '@/components/ui/busy-provider'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import {
  applyBomColumnPaste,
  enrichBomFormLinesFromItems,
  parseBomBulkPaste,
  parseBomImportRows,
  resolveBomPasteRows,
  unresolvedFromBomLines,
  type BomSpreadsheetColumnKey,
} from '@/lib/bom/bulk-paste'
import { deleteBomForParent, saveBomForParent } from '@/lib/bom/repository'
import { versionUpBomParent } from '@/lib/bom/version-up'
import {
  bomGroupToForm,
  createBomFormLine,
  createEmptyBomSheetLines,
  emptyBomForm,
  formToBomLinePayloads,
  validateBomForm,
  type BomFormLine,
  type BomFormState,
} from '@/lib/bom/form-state'
import {
  childItemsForParent,
  describeBomRule,
  parentItemsForBom,
} from '@/lib/bom/utils'
import { registerMissingBomRawMaterials } from '@/lib/bom/register-missing-raw'
import type { BomGroup } from '@/lib/bom/types'
import { readBomSpreadsheetFile } from '@/lib/excel/read-spreadsheet'
import type { Item } from '@/lib/items/types'
import {
  ITEM_CATEGORY_LABELS,
  isProductItemCategory,
  isSemiFinishedItemCategory,
} from '@/lib/items/types'
import { normalizeVersionLabel, suggestNextVersionForItem } from '@/lib/items/version-code'
import {
  ERP_ERROR_TEXT_CLASS,
  ERP_FIELD_INPUT_CLASS,
  ERP_FIELD_LABEL_CLASS,
} from '@/lib/ui/tokens'

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
  const canDelete = useCanDeleteRecords()
  const confirm = useErpConfirm()
  const [form, setForm] = useState<BomFormState>(() =>
    group ? bomGroupToForm(group) : emptyBomForm(initialParentProductId),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [versioning, setVersioning] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pasteHint, setPasteHint] = useState<string | null>(null)
  const [localItems, setLocalItems] = useState<Item[]>([])
  const [versionUpInput, setVersionUpInput] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  const showSpreadsheet = Boolean(selectedParent)

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

  const unmatchedCount = useMemo(
    () => unresolvedFromBomLines(form.lines).length,
    [form.lines],
  )

  useEffect(() => {
    const next = group ? bomGroupToForm(group) : emptyBomForm(initialParentProductId)
    const parent =
      items.find((item) => item.id === next.parentProductId) ||
      (group ? items.find((item) => item.id === group.parentProductId) : null)
    const children = parent ? childItemsForParent(items, parent.itemCategory) : items
    setForm({
      ...next,
      lines: enrichBomFormLinesFromItems(next.lines, children),
    })
    setSaveError(null)
    setPasteHint(null)

    if (group) {
      const sourceParent = items.find((item) => item.id === group.parentProductId)
      const suggested = sourceParent ? suggestNextVersionForItem(sourceParent, items) : null
      setVersionUpInput(suggested?.version || '')
    } else {
      setVersionUpInput('')
    }
    // 모달을 열거나 대상 BOM이 바뀔 때만 신버전 입력을 초기화
    // eslint-disable-next-line react-hooks/exhaustive-deps -- items는 열 당시 스냅샷만 사용
  }, [group?.parentProductId, mode, initialParentProductId])

  function updateLine(key: string, patch: Partial<BomFormLine>) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }))
    setPasteHint(null)
  }

  function addLine() {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, createBomFormLine()],
    }))
  }

  function addLines(count: number) {
    const n = Math.max(1, Math.floor(count))
    setForm((current) => ({
      ...current,
      lines: [...current.lines, ...createEmptyBomSheetLines(n)],
    }))
  }

  function removeLine(key: string) {
    setForm((current) => {
      const next = current.lines.filter((line) => line.key !== key)
      return { ...current, lines: next.length ? next : createEmptyBomSheetLines(1) }
    })
  }

  async function applyResolvedLines(lines: BomFormLine[], sourceLabel: string) {
    const hasExisting = form.lines.some(
      (line) =>
        line.childProductId.trim() ||
        line.sourcePartCode.trim() ||
        line.sourceMpn.trim() ||
        line.sourceName.trim(),
    )
    if (hasExisting) {
      if (
        !(await confirm({
          title: `${sourceLabel} 교체`,
          message: `현재 구성 표를 ${sourceLabel} ${lines.length}행으로 바꿀까요?`,
          confirmLabel: '교체',
          tone: 'default',
        }))
      ) {
        return
      }
    }

    setForm((current) => ({
      ...current,
      lines: (() => {
        const next = lines.length ? lines : createEmptyBomSheetLines()
        const pad = Math.max(0, 20 - next.length)
        return pad > 0 ? [...next, ...createEmptyBomSheetLines(pad)] : next
      })(),
    }))
  }

  async function applyPasteText(text: string) {
    if (!selectedParent) {
      setPasteHint('부모 품목을 먼저 선택해 주세요.')
      return
    }

    const parsed = parseBomBulkPaste(text)
    const resolved = resolveBomPasteRows(parsed, childOptions)
    if (!resolved.ok) {
      setPasteHint(resolved.detail)
      return
    }

    await applyResolvedLines(resolved.lines, '붙여넣기')
      setPasteHint(
      resolved.unresolved.length
        ? `${resolved.lines.length}행 반영 · 미등록 ${resolved.unresolved.length}건`
        : `${resolved.lines.length}행을 표에 반영했습니다.`,
    )
  }

  function handleColumnPaste(
    startRowIndex: number,
    columnKey: BomSpreadsheetColumnKey,
    text: string,
  ) {
    const next = applyBomColumnPaste({
      lines: form.lines,
      startRowIndex,
      columnKey,
      text,
      childItems: childOptions,
    })
    if (!next) return
    setForm((current) => ({ ...current, lines: next }))
    setPasteHint(`${columnKey === 'quantityPer' ? 'Qty' : '열'} 붙여넣기 반영`)
  }

  async function handleBomFile(file: File) {
    if (!selectedParent) {
      setPasteHint('부모 품목을 먼저 선택해 주세요.')
      return
    }

    setFileLoading(true)
    setPasteHint(null)
    try {
      const { rows } = await readBomSpreadsheetFile(file)
      const parsed = parseBomImportRows(rows)
      const resolved = resolveBomPasteRows(parsed, childOptions)
      if (!resolved.ok) {
        setPasteHint(resolved.detail)
        return
      }
      await applyResolvedLines(resolved.lines, '파일')
      setPasteHint(
        resolved.unresolved.length
          ? `${file.name}: ${resolved.lines.length}행 · 미등록 ${resolved.unresolved.length}건`
          : `${file.name}: ${resolved.lines.length}행 반영`,
      )
    } catch (error) {
      setPasteHint(error instanceof Error ? error.message : 'BOM 파일을 읽지 못했습니다.')
    } finally {
      setFileLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSave() {
    if (!selectedParent) {
      setSaveError('부모 품목을 선택해 주세요.')
      return
    }

    let workingForm = form
    let workingChildren = childOptions
    const unmatched = unresolvedFromBomLines(form.lines)

    if (unmatched.length) {
      if (!isSemiFinishedItemCategory(selectedParent.itemCategory)) {
        setSaveError(
          `미등록 ${unmatched.length}건이 있습니다. 조립제품 BOM의 구성(반제품)은 자동 등록되지 않습니다.`,
        )
        return
      }

      const listLimit = 30
      const listLines = unmatched.slice(0, listLimit).map((entry, index) => {
        const parts = [
          entry.partCode.trim() || null,
          entry.name.trim() || null,
          entry.mpn.trim() ? `MPN ${entry.mpn.trim()}` : null,
        ].filter(Boolean)
        return `· ${index + 1}. ${parts.join(' · ') || entry.token}`
      })
      if (unmatched.length > listLimit) {
        listLines.push(`· … 외 ${unmatched.length - listLimit}건`)
      }

      if (
        !(await confirm({
          title: '미등록 품목',
          message: [
            `${unmatched.length}개의 품목이 미등록되어 있습니다. 등록하시겠습니까?`,
            '',
            ...listLines,
          ].join('\n'),
          confirmLabel: '등록',
          tone: 'default',
          size: unmatched.length > 5 ? 'md' : 'form',
        }))
      ) {
        return
      }

      setSaving(true)
      setSaveError(null)
      const registered = await busyUi.run(() =>
        registerMissingBomRawMaterials({
          lines: form.lines,
          parent: selectedParent,
          existingItems: mergedItems,
        }),
      )
      if (!registered.ok) {
        setSaving(false)
        if (!notifyAuthOrFailure(registered)) setSaveError(registered.detail)
        return
      }

      workingForm = { ...form, lines: registered.lines }
      setForm(workingForm)
      setLocalItems(registered.items)
      workingChildren = childItemsForParent(
        registered.items,
        selectedParent.itemCategory,
      )
      if (registered.createdCount > 0) {
        setPasteHint(`미등록 원자재 ${registered.createdCount}건을 등록했습니다.`)
      }
    }

    const validationError = validateBomForm(workingForm, {
      parentItemCategory: selectedParent.itemCategory,
      childItems: workingChildren,
    })
    if (validationError) {
      setSaving(false)
      setSaveError(validationError)
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = await busyUi.run(() =>
      saveBomForParent(workingForm.parentProductId, formToBomLinePayloads(workingForm)),
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

  const busy = saving || deleting || versioning || fileLoading

  const filledLineCount = useMemo(
    () => form.lines.filter((line) => line.childProductId.trim()).length,
    [form.lines],
  )

  return (
    <>
      <ErpModal
        open
        size="wide"
        title={isCreate ? 'BOM 등록' : 'BOM 수정'}
        description="표 셀에 직접 입력한 뒤 저장하세요. 미등록 원자재는 저장 시 자동 등록됩니다. (품목코드 또는 MPN · 공정 SMD/DIP)"
        onClose={onClose}
        closeOnEscape={!busy}
        contentClassName="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-4"
        dialogClassName="h-[92dvh]"
        footer={
          <div className="flex w-full flex-col gap-2">
            {saveError ? <p className={ERP_ERROR_TEXT_CLASS}>{saveError}</p> : null}
            {pasteHint ? <p className="text-xs text-slate-600">{pasteHint}</p> : null}
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
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleBomFile(file)
                  }}
                />
                <ErpButton
                  type="button"
                  variant="secondary"
                  disabled={!selectedParent || busy}
                  loading={fileLoading}
                  onClick={() => fileInputRef.current?.click()}
                  className="min-w-[8.75rem] justify-center"
                >
                  Excel 불러오기
                </ErpButton>
                <BomAddRowsControl
                  disabled={!selectedParent || busy}
                  onAddOne={addLine}
                  onAddMany={addLines}
                />
                <ErpButton
                  disabled={busy}
                  loading={saving}
                  onClick={() => void handleSave()}
                  className="min-w-[8.75rem] justify-center"
                >
                  저장
                </ErpButton>
              </div>
            </div>
          </div>
        }
      >
        <div className="flex shrink-0 flex-wrap items-end gap-3">
          <label className="min-w-[240px] flex-1 text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>부모 품목</span>
            <BomChildItemCombobox
              value={form.parentProductId}
              items={availableParents}
              disabled={!isCreate}
              placeholder="부모 품목 검색"
              ariaLabel="부모 품목"
              onItemSelect={(item) =>
                setForm({
                  parentProductId: item?.id || '',
                  lines: createEmptyBomSheetLines(),
                })
              }
            />
          </label>
          {!isCreate && selectedParent ? (
            <label className="w-36 text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>신버전</span>
              <input
                type="text"
                value={versionUpInput}
                disabled={busy}
                placeholder={suggestedVersion?.version || 'A2'}
                onChange={(event) => setVersionUpInput(event.target.value)}
                className={`${ERP_FIELD_INPUT_CLASS} font-mono`}
              />
            </label>
          ) : null}
          {selectedParent ? (
            <span className="pb-2 text-xs text-slate-500">
              등록 {filledLineCount.toLocaleString('ko-KR')}
              {unmatchedCount > 0
                ? ` · 미등록 ${unmatchedCount.toLocaleString('ko-KR')}`
                : ''}
              {selectedParent.itemCategory === 4
                ? ` · ${ITEM_CATEGORY_LABELS[3]}`
                : ` · ${ITEM_CATEGORY_LABELS[1]}/${ITEM_CATEGORY_LABELS[2]}`}
            </span>
          ) : null}
        </div>

        {selectedParent ? (
          <p className="shrink-0 text-xs text-slate-500">{describeBomRule(selectedParent.itemCategory)}</p>
        ) : null}

        {showSpreadsheet ? (
          <BomLinesSpreadsheet
            lines={form.lines}
            childItems={childOptions}
            disabled={busy}
            onPatchLine={updateLine}
            onRemoveLine={removeLine}
            onAddLine={addLine}
            onPasteBlock={(text) => void applyPasteText(text)}
            onColumnPaste={handleColumnPaste}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <p className="text-sm text-slate-500">부모 품목을 선택하면 구성 표가 열립니다.</p>
          </div>
        )}
      </ErpModal>
    </>
  )
}

export function BomModal({ open, ...props }: BomModalProps) {
  if (!open) return null
  return <BomModalContent {...props} />
}
