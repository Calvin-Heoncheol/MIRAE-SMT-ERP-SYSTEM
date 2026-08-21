'use client'

import { useEffect, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { upsertSolderCreamLotStatus } from '@/lib/materials/solder-cream/repository'
import type { SolderCreamStatusRow } from '@/lib/materials/solder-cream/types'
import { formatSolderCreamDate } from '@/lib/materials/solder-cream/utils'
import { ERP_FIELD_INPUT_CLASS } from '@/lib/ui/tokens'

type SolderCreamStatusEditModalProps = {
  open: boolean
  row: SolderCreamStatusRow | null
  onClose: () => void
  onSaved: (message?: string) => void
}

export function SolderCreamStatusEditModal({
  open,
  row,
  onClose,
  onSaved,
}: SolderCreamStatusEditModalProps) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !row) return
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
      status: 'scrapped',
      note,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }
    onSaved('폐기 처리했습니다.')
  }

  function handleClose() {
    if (saving) return
    onClose()
  }

  return (
    <ErpModal
      open
      title="솔더크림 폐기"
      description="출고된 LOT을 폐기로 표시합니다."
      size="form"
      onClose={handleClose}
      closeOnEscape={!saving}
      footer={
        <div className="flex w-full flex-col gap-2">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex justify-end">
            <ErpButton disabled={saving} onClick={() => void handleSave()}>
              {saving ? '저장 중…' : '폐기'}
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
        </div>

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
