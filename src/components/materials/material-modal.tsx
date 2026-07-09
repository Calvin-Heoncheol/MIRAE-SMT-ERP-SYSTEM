'use client'

import { useEffect, useState } from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { formToCreateMaterialPayload, formToMaterialPayload, emptyMaterialForm, materialToForm, type MaterialFormState } from '@/lib/materials/form-state'
import {
  addAlternateMpn,
  createMaterial,
  deleteMaterial,
  removeAlternateMpn,
  updateMaterial,
} from '@/lib/materials/repository'
import {
  MATERIAL_COLUMN_LABELS,
  MATERIAL_SUPPLY_TYPES,
  MATERIAL_TYPES,
  type Material,
  type MaterialAlternateMpn,
} from '@/lib/materials/types'

type MaterialModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  material?: Material
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
  onDataChanged?: () => void
}

function MaterialModalContent({
  mode,
  material,
  onClose,
  onSaved,
  onDeleted,
  onDataChanged,
}: Omit<MaterialModalProps, 'open'>) {
  const isCreate = mode === 'create'
  const [materialId, setMaterialId] = useState('')
  const [form, setForm] = useState<MaterialFormState>(() =>
    material ? materialToForm(material) : emptyMaterialForm(),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [alternateRows, setAlternateRows] = useState<MaterialAlternateMpn[]>(material?.alternateMpnRows ?? [])
  const [scanValue, setScanValue] = useState('')
  const [scanBusy, setScanBusy] = useState(false)
  const [scanMessage, setScanMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (isCreate) {
      setMaterialId('')
      setForm(emptyMaterialForm())
    } else if (material) {
      setForm(materialToForm(material))
      setAlternateRows(material.alternateMpnRows)
    }
    setSaveError(null)
    setScanValue('')
    setScanMessage(null)
  }, [isCreate, material])

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

  function updateForm<K extends keyof MaterialFormState>(key: K, value: MaterialFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSave() {
    if (isCreate && !materialId.trim()) {
      setSaveError('자재코드를 입력해 주세요.')
      return
    }
    if (!form.customer.trim()) {
      setSaveError('고객사를 입력해 주세요.')
      return
    }
    if (!form.materialName.trim()) {
      setSaveError('자재명을 입력해 주세요.')
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = isCreate
      ? await createMaterial(formToCreateMaterialPayload(form, materialId))
      : await updateMaterial(material!.id, formToMaterialPayload(form))
    setSaving(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onSaved?.()
  }

  async function handleAddAlternate() {
    if (!material) return
    const value = scanValue.trim()
    if (!value) {
      setScanMessage({ tone: 'error', text: '바코드를 스캔하거나 MPN을 입력해 주세요.' })
      return
    }

    const normalized = value.toLowerCase()
    const isDuplicate =
      material.mpn.trim().toLowerCase() === normalized ||
      alternateRows.some((row) => row.mpn.trim().toLowerCase() === normalized)
    if (isDuplicate) {
      setScanMessage({ tone: 'error', text: '이미 등록된 MPN입니다.' })
      setScanValue('')
      return
    }

    setScanBusy(true)
    setScanMessage(null)

    const result = await addAlternateMpn(material.id, value, alternateRows.length + 1)
    setScanBusy(false)

    if (!result.ok) {
      setScanMessage({ tone: 'error', text: result.detail })
      return
    }

    setAlternateRows((current) => [...current, result.row])
    setScanValue('')
    setScanMessage({ tone: 'success', text: `대체 MPN "${result.row.mpn}" 을(를) 등록했습니다.` })
    onDataChanged?.()
  }

  async function handleRemoveAlternate(row: MaterialAlternateMpn) {
    setScanBusy(true)
    setScanMessage(null)

    const result = await removeAlternateMpn(row.id)
    setScanBusy(false)

    if (!result.ok) {
      setScanMessage({ tone: 'error', text: result.detail })
      return
    }

    setAlternateRows((current) => current.filter((item) => item.id !== row.id))
    onDataChanged?.()
  }

  async function handleDelete() {
    if (!material) return
    if (!window.confirm(`${material.id} 자재를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`)) {
      return
    }

    setDeleting(true)
    setSaveError(null)

    const result = await deleteMaterial(material.id)
    setDeleting(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onDeleted?.()
  }

  const inputClassName =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="material-modal-title"
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="material-modal-title" className="text-lg font-bold text-slate-900">
              {isCreate ? '자재 등록' : '자재 수정'}
            </h2>
            {!isCreate && material ? (
              <p className="mt-1 font-mono text-xs text-violet-700">
                자재코드 {material.id} <span className="text-slate-400">(수정 불가)</span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">자재코드는 등록 후 수정할 수 없습니다.</p>
            )}
          </div>
          {!isCreate ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="inline-flex items-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? '삭제 중…' : '삭제'}
            </button>
          ) : null}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isCreate ? (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-600">{MATERIAL_COLUMN_LABELS.id}</span>
                <input
                  value={materialId}
                  onChange={(event) => setMaterialId(event.target.value)}
                  placeholder="MRM-0001"
                  className={`${inputClassName} font-mono`}
                  autoFocus
                />
              </label>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{MATERIAL_COLUMN_LABELS.customer}</span>
              <input
                value={form.customer}
                onChange={(event) => updateForm('customer', event.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{MATERIAL_COLUMN_LABELS.materialName}</span>
              <input
                value={form.materialName}
                onChange={(event) => updateForm('materialName', event.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">{MATERIAL_COLUMN_LABELS.specification}</span>
              <input
                value={form.specification}
                onChange={(event) => updateForm('specification', event.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{MATERIAL_COLUMN_LABELS.type}</span>
              <select
                value={form.type}
                onChange={(event) => updateForm('type', event.target.value as MaterialFormState['type'])}
                className={inputClassName}
              >
                {MATERIAL_TYPES.map((type) => (
                  <option key={type || 'empty'} value={type}>
                    {type || '선택'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{MATERIAL_COLUMN_LABELS.supplyType}</span>
              <select
                value={form.supplyType}
                onChange={(event) =>
                  updateForm('supplyType', event.target.value as MaterialFormState['supplyType'])
                }
                className={inputClassName}
              >
                {MATERIAL_SUPPLY_TYPES.map((type) => (
                  <option key={type || 'empty'} value={type}>
                    {type || '선택'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{MATERIAL_COLUMN_LABELS.mpn}</span>
              <input
                value={form.mpn}
                onChange={(event) => updateForm('mpn', event.target.value)}
                className={`${inputClassName} font-mono`}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">{MATERIAL_COLUMN_LABELS.supplier}</span>
              <input
                value={form.supplier}
                onChange={(event) => updateForm('supplier', event.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{MATERIAL_COLUMN_LABELS.moq}</span>
              <QuoteNumericInput
                min={0}
                value={form.moq}
                onChange={(moq) => updateForm('moq', moq)}
                className={inputClassName}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{MATERIAL_COLUMN_LABELS.unitPrice}</span>
              <QuoteNumericInput
                min={0}
                step="0.01"
                value={form.unitPrice}
                onChange={(unitPrice) => updateForm('unitPrice', unitPrice)}
                className={inputClassName}
              />
            </label>
          </div>

          {!isCreate ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-700">
                {MATERIAL_COLUMN_LABELS.alternateMpns}
              </span>
              <span className="text-xs text-slate-400">
                릴 바코드를 스캔해 등록하면 이후 입고 스캔 시 자동 매칭됩니다
              </span>
            </div>

            <div className="mt-2 flex gap-2">
              <input
                value={scanValue}
                onChange={(event) => setScanValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleAddAlternate()
                  }
                }}
                disabled={scanBusy}
                placeholder="바코드 스캔 또는 MPN 입력 후 Enter"
                className={`${inputClassName} font-mono`}
              />
              <button
                type="button"
                onClick={() => void handleAddAlternate()}
                disabled={scanBusy}
                className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                추가
              </button>
            </div>

            {scanMessage ? (
              <p
                className={`mt-2 text-xs font-medium ${
                  scanMessage.tone === 'success' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {scanMessage.text}
              </p>
            ) : null}

            {alternateRows.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {alternateRows.map((row) => (
                  <li
                    key={row.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1.5 text-sm text-slate-700 shadow-sm"
                  >
                    <span className="font-mono">{row.mpn}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveAlternate(row)}
                      disabled={scanBusy}
                      aria-label={`${row.mpn} 삭제`}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-400">등록된 대체 MPN이 없습니다.</p>
            )}
          </div>
          ) : null}

          {saveError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {saveError}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? '저장 중…' : isCreate ? '등록' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function MaterialModal({
  open,
  mode,
  material,
  onClose,
  onSaved,
  onDeleted,
  onDataChanged,
}: MaterialModalProps) {
  if (!open) return null
  if (mode === 'edit' && !material) return null
  return (
    <MaterialModalContent
      mode={mode}
      material={material}
      onClose={onClose}
      onSaved={onSaved}
      onDeleted={onDeleted}
      onDataChanged={onDataChanged}
    />
  )
}
