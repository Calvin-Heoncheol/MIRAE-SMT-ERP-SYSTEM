'use client'

import { useEffect, useMemo, useState } from 'react'
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deleting) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, deleting])

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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-10">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isCreate ? 'BOM 등록' : 'BOM 수정'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              완제품 → 반제품, 반제품 → 원자재·부자재 구성을 등록합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100"
          >
            닫기
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-slate-700">부모 품목</span>
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50"
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
              <p className="text-sm font-semibold text-slate-700">구성 품목</p>
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
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      구성 {index + 1}
                    </span>
                    <select
                      value={line.childProductId}
                      disabled={!selectedParent}
                      onChange={(event) => updateLine(line.key, { childProductId: event.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:bg-slate-100"
                    >
                      <option value="">구성 품목 선택</option>
                      {childOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {formatItemOptionLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-500">소요량</span>
                    <input
                      type="number"
                      min="0.0001"
                      step="any"
                      value={line.quantityPer}
                      onChange={(event) => updateLine(line.key, { quantityPer: event.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 tabular-nums"
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

        <div className="border-t border-slate-200 px-5 py-4">
          {saveError ? <p className="mb-3 text-sm text-red-600">{saveError}</p> : null}
          <div className="flex justify-between gap-2">
            {!isCreate ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting || saving}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : 'BOM 삭제'}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || deleting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || deleting}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BomModal({ open, ...props }: BomModalProps) {
  if (!open) return null
  return <BomModalContent {...props} />
}
