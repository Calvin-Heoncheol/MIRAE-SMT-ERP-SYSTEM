'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { setMaterialDirectStockBatch } from '@/lib/materials/inventory/direct-stock'
import { formatInventoryQuantity } from '@/lib/materials/inventory/utils'
import type { MaterialInventoryRow } from '@/lib/materials/inventory/types'
import { ERP_FIELD_INPUT_CLASS } from '@/lib/ui/tokens'

type DirectStockModalProps = {
  open: boolean
  row: MaterialInventoryRow
  onClose: () => void
  onSaved: () => void
}

export function DirectStockModal({ open, row, onClose, onSaved }: DirectStockModalProps) {
  const canDelete = useCanDeleteRecords()
  const [qty, setQty] = useState(String(Math.max(0, row.onHandQuantity)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setQty(String(Math.max(0, row.onHandQuantity)))
    setError('')
  }, [open, row.id, row.onHandQuantity])

  const targetQuantity = Math.floor(Number(qty))
  const delta =
    Number.isFinite(targetQuantity) && targetQuantity >= 0
      ? targetQuantity - row.onHandQuantity
      : null

  async function handleSave() {
    if (!canDelete) return
    if (!Number.isFinite(targetQuantity) || targetQuantity < 0) {
      setError('현재고는 0 이상 숫자로 입력해 주세요.')
      return
    }

    setSaving(true)
    setError('')
    const result = await setMaterialDirectStockBatch([
      { materialId: row.id, targetQuantity },
    ])
    setSaving(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }

    onSaved()
  }

  function handleClose() {
    if (saving) return
    onClose()
  }

  return (
    <ErpModal
      open={open}
      title="현재고 설정"
      description={
        canDelete
          ? '입력한 수량으로 현재고를 맞춥니다. (증가=사급입고, 감소=조정불출)'
          : '현재고 조정은 관리자 이상만 할 수 있습니다.'
      }
      size="form"
      onClose={handleClose}
      closeOnEscape={!saving}
      footer={
        <div className="flex w-full flex-col gap-2">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <ErpButton variant="secondary" disabled={saving} onClick={handleClose}>
              {canDelete ? '취소' : '닫기'}
            </ErpButton>
            {canDelete ? (
              <ErpButton disabled={saving} onClick={() => void handleSave()}>
                {saving ? '적용 중…' : '적용'}
              </ErpButton>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="font-mono text-xs font-semibold text-blue-800">{row.id}</p>
          <p className="mt-1 text-base font-bold text-slate-900">{row.materialName || '—'}</p>
          {row.specification.trim() || row.mpn.trim() ? (
            <p className="mt-1 text-xs text-slate-500">
              {[row.specification, row.mpn].filter((value) => value.trim()).join(' · ')}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-slate-500">현재고</p>
            <p
              className={[
                'mt-1 text-lg font-bold tabular-nums',
                row.onHandQuantity < 0 ? 'text-rose-700' : 'text-slate-900',
              ].join(' ')}
            >
              {formatInventoryQuantity(row.onHandQuantity)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold text-slate-500">입고예정</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
              {formatInventoryQuantity(row.expectedInboundQuantity)}
            </p>
          </div>
        </div>

        {canDelete ? (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">맞출 현재고</span>
              <input
                type="number"
                min={0}
                step={1}
                value={qty}
                onChange={(event) => setQty(event.target.value)}
                disabled={saving}
                className={ERP_FIELD_INPUT_CLASS}
                autoFocus
              />
            </label>

            {delta != null ? (
              <p className="text-xs text-slate-500">
                {delta === 0
                  ? '변경 없음'
                  : delta > 0
                    ? `+${formatInventoryQuantity(delta)} 입고(사급)로 반영`
                    : `${formatInventoryQuantity(delta)} 불출(조정)로 반영`}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </ErpModal>
  )
}
