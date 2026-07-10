'use client'

import { useEffect, useMemo, useState } from 'react'
import { createItem, deleteItem, updateItem } from '@/lib/items/repository'
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
  ITEM_MATERIAL_TYPES,
  ITEM_MATERIAL_TYPE_LABELS,
  ITEM_SUPPLY_TYPES,
  ITEM_SUPPLY_TYPE_LABELS,
  isManualItemCodeCategory,
  isMaterialItemCategory,
  type Item,
  type ItemCategory,
  type ItemMaterialType,
  type ItemSupplyType,
} from '@/lib/items/types'
import { nextItemCodeForCategory } from '@/lib/items/utils'

type ItemModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  item?: Item | null
  existingItems?: Item[]
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

function resolvePreviewItemCode(
  category: ItemCategory | '',
  existingItems: Item[],
): string {
  if (!category || isManualItemCodeCategory(category)) return ''
  return nextItemCodeForCategory(existingItems, category) ?? ''
}

function ItemModalContent({
  mode,
  item,
  existingItems = [],
  onClose,
  onSaved,
  onDeleted,
}: Omit<ItemModalProps, 'open'>) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState<ItemFormState>(() => (item ? itemToForm(item) : emptyItemForm()))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isManualCode =
    form.itemCategory !== '' && isManualItemCodeCategory(form.itemCategory)
  const previewItemCode = useMemo(
    () => resolvePreviewItemCode(form.itemCategory, existingItems),
    [form.itemCategory, existingItems],
  )

  useEffect(() => {
    setForm(item ? itemToForm(item) : emptyItemForm())
    setSaveError(null)
  }, [item, mode])

  useEffect(() => {
    if (!isCreate) return
    if (form.itemCategory === '' || isManualItemCodeCategory(form.itemCategory)) return
    setForm((current) => {
      const nextCode = resolvePreviewItemCode(current.itemCategory, existingItems)
      if (current.id === nextCode) return current
      return { ...current, id: nextCode }
    })
  }, [isCreate, form.itemCategory, existingItems])

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
      }
      if (isCreate) {
        next.id = value ? resolvePreviewItemCode(value, existingItems) : ''
      }
      return next
    })
  }

  const showMaterialFields =
    form.itemCategory !== '' && isMaterialItemCategory(form.itemCategory)

  async function handleSave() {
    const validationError = validateItemForm(form, { isCreate })
    if (validationError) {
      setSaveError(validationError)
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = isCreate
      ? await createItem(formToItemPayload(form))
      : await updateItem(item!.id, formToItemUpdatePayload(form))

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isCreate ? '품목 등록' : '품목 수정'}</h2>
            {!isCreate && item ? (
              <p className="mt-1 font-mono text-xs text-slate-500">{item.id}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                품목명 <span className="text-red-500">*</span>
              </span>
              <input
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                품목구분 <span className="text-red-500">*</span>
              </span>
              <select
                value={form.itemCategory === '' ? '' : String(form.itemCategory)}
                onChange={(event) =>
                  updateItemCategory(
                    event.target.value ? (Number(event.target.value) as ItemCategory) : '',
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="">선택</option>
                {ITEM_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}. {ITEM_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                품목코드 {isManualCode ? <span className="text-red-500">*</span> : null}
              </span>
              <input
                value={isCreate && !isManualCode && form.itemCategory !== '' ? previewItemCode : form.id}
                onChange={(event) => updateForm('id', event.target.value)}
                placeholder={
                  form.itemCategory === ''
                    ? '품목구분 선택 후 표시'
                    : isManualCode
                      ? '직접 입력'
                      : '자동 생성'
                }
                readOnly={!isCreate || !isManualCode}
                className={`w-full rounded-lg border border-slate-200 px-3 py-2 font-mono ${
                  !isCreate || !isManualCode ? 'bg-slate-50 text-slate-600' : ''
                }`}
              />
              {isCreate && form.itemCategory !== '' && !isManualCode ? (
                <p className="mt-1 text-xs text-slate-500">저장 시 {previewItemCode} 로 자동 생성됩니다.</p>
              ) : null}
            </label>
            {showMaterialFields ? (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">규격</span>
                  <input
                    value={form.specification}
                    onChange={(event) => updateForm('specification', event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">MPN</span>
                  <input
                    value={form.mpn}
                    onChange={(event) => updateForm('mpn', event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">구분 (SMD/DIP)</span>
                  <select
                    value={form.materialType}
                    onChange={(event) =>
                      updateForm('materialType', event.target.value as ItemMaterialType)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {ITEM_MATERIAL_TYPES.map((type) => (
                      <option key={type || 'none'} value={type}>
                        {ITEM_MATERIAL_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">도급/사급</span>
                  <select
                    value={form.supplyType}
                    onChange={(event) => updateForm('supplyType', event.target.value as ItemSupplyType)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {ITEM_SUPPLY_TYPES.map((type) => (
                      <option key={type || 'none'} value={type}>
                        {ITEM_SUPPLY_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">단가</span>
              <input
                type="number"
                min={0}
                step="any"
                value={form.unitPrice}
                onChange={(event) => updateForm('unitPrice', event.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums"
              />
            </label>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            * 품목명·품목구분 필수 · 원자재만 품목코드 직접 입력 (부자재 SUB-, 반제품 SFG-, 완제품 FG- 자동)
            {showMaterialFields ? ' · 규격·MPN·구분·도급/사급은 원자재·부자재에만 해당' : null}
          </p>
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
                {deleting ? '삭제 중…' : '삭제'}
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

export function ItemModal({ open, ...props }: ItemModalProps) {
  if (!open) return null
  return <ItemModalContent {...props} />
}
