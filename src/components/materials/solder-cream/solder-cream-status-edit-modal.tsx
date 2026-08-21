'use client'

import { useEffect, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import {
  clearSolderCreamLotStatus,
  upsertSolderCreamLotStatus,
} from '@/lib/materials/solder-cream/repository'
import type {
  SolderCreamEditableLotStatus,
  SolderCreamStatusRow,
} from '@/lib/materials/solder-cream/types'
import {
  formatSolderCreamDate,
  SOLDER_CREAM_LOT_STATUS_LABELS,
} from '@/lib/materials/solder-cream/utils'
import { ERP_FIELD_INPUT_CLASS } from '@/lib/ui/tokens'

type SolderCreamStatusEditModalProps = {
  open: boolean
  row: SolderCreamStatusRow | null
  onClose: () => void
  onSaved: (message?: string) => void
}

const EDITABLE_STATUSES: SolderCreamEditableLotStatus[] = ['cold', 'discarded', 'scrapped']

export function SolderCreamStatusEditModal({
  open,
  row,
  onClose,
  onSaved,
}: SolderCreamStatusEditModalProps) {
  const [status, setStatus] = useState<SolderCreamEditableLotStatus>('cold')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !row) return
    const nextStatus: SolderCreamEditableLotStatus =
      row.status === 'cold' || row.status === 'discarded' || row.status === 'scrapped'
        ? row.status
        : 'cold'
    setStatus(nextStatus)
    setNote(row.note || '')
    setError('')
  }, [open, row])

  if (!open || !row) return null

  const current = row

  async function handleSave() {
    setSaving(true)
    setError('')
    const result = await upsertSolderCreamLotStatus({
      lotNumber: current.barcode,
      status,
      note,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }
    onSaved('상태를 저장했습니다.')
  }

  async function handleReset() {
    setSaving(true)
    setError('')
    const result = await clearSolderCreamLotStatus(current.barcode)
    setSaving(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }
    onSaved('로그 기준 상태로 되돌렸습니다.')
  }

  function handleClose() {
    if (saving) return
    onClose()
  }

  return (
    <ErpModal
      open
      title="솔더크림 상태 수정"
      description="유통기한·폐기 등 현장 판단으로 상태를 바꿀 수 있습니다."
      size="form"
      onClose={handleClose}
      closeOnEscape={!saving}
      footer={
        <div className="flex w-full flex-col gap-2">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {current.manualStatus ? (
              <ErpButton variant="secondary" disabled={saving} onClick={() => void handleReset()}>
                로그 기준으로
              </ErpButton>
            ) : null}
            <ErpButton variant="secondary" disabled={saving} onClick={handleClose}>
              취소
            </ErpButton>
            <ErpButton disabled={saving} onClick={() => void handleSave()}>
              {saving ? '저장 중…' : '저장'}
            </ErpButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="font-mono text-xs font-semibold text-blue-800">{current.barcode}</p>
          <p className="mt-1 text-xs text-slate-500">
            제조 {formatSolderCreamDate(current.manufacturedAt)} · 유통기한{' '}
            {formatSolderCreamDate(current.expiresAt)} · 입고 {current.inboundCount}회
          </p>
          <p className="mt-1 text-xs text-slate-500">
            로그 기준: {SOLDER_CREAM_LOT_STATUS_LABELS[current.derivedStatus]}
            {current.manualStatus ? ' · 수동 수정됨' : ''}
          </p>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">상태</span>
          <select
            value={status}
            disabled={saving}
            onChange={(event) => setStatus(event.target.value as SolderCreamEditableLotStatus)}
            className={ERP_FIELD_INPUT_CLASS}
          >
            {EDITABLE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {SOLDER_CREAM_LOT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">비고</span>
          <textarea
            value={note}
            disabled={saving}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
            placeholder="폐기 사유 등"
            className={`${ERP_FIELD_INPUT_CLASS} min-h-[84px] resize-y`}
          />
        </label>
      </div>
    </ErpModal>
  )
}
