'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { deleteBomForParent, saveBomForParent } from '@/lib/bom/repository'
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
import { ITEM_CATEGORY_LABELS } from '@/lib/items/types'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

type BomModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  group?: BomGroup | null
  items: Item[]
  existingParentIds: string[]
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

function BomModalContent({
  mode,
  group,
  items,
  existingParentIds,
  onClose,
  onSaved,
  onDeleted,
}: Omit<BomModalProps, 'open'>) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState<BomFormState>(() =>
    group ? bomGroupToForm(group) : emptyBomForm(),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const parents = useMemo(() => parentItemsForBom(items), [items])
  const selectedParent = parents.find((item) => item.id === form.parentProductId) || null
  const childOptions = useMemo(
    () => (selectedParent ? childItemsForParent(items, selectedParent.itemCategory) : []),
    [items, selectedParent],
  )

  const availableParents = useMemo(() => {
    if (!isCreate) return parents
    const taken = new Set(existingParentIds)
    return parents.filter((item) => !taken.has(item.id))
  }, [parents, existingParentIds, isCreate])

  useEffect(() => {
    setForm(group ? bomGroupToForm(group) : emptyBomForm())
    setSaveError(null)
  }, [group, mode])

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

  const busy = saving || deleting

  return (
    <ErpModal
      open
      size="md"
      title={isCreate ? 'BOM 등록' : 'BOM 수정'}
      description="완제품 → 반제품, 반제품 → 원자재·부자재 구성을 등록합니다."
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-col gap-2">
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {!isCreate ? (
              <ErpButton variant="danger" disabled={busy} onClick={() => void handleDelete()}>
                {deleting ? '삭제 중…' : 'BOM 삭제'}
              </ErpButton>
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
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-600">구성 품목</p>
            <button
              type="button"
              onClick={addLine}
              disabled={!selectedParent}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              구성 추가
            </button>
          </div>

          <div className="space-y-2">
            {form.lines.map((line, index) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 md:grid-cols-[minmax(0,1fr)_110px_auto]"
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-500">구성 {index + 1}</span>
                  <select
                    value={line.childProductId}
                    disabled={!selectedParent}
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
                    onChange={(event) => updateLine(line.key, { quantityPer: event.target.value })}
                    className={ERP_FIELD_INPUT_CLASS}
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>

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
