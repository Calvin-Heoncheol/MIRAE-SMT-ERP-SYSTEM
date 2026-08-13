'use client'

import { useEffect, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import {
  upsertDefectHandling,
} from '@/lib/quality/defects/repository'
import type {
  DefectActionType,
  DefectHandlingListItem,
} from '@/lib/quality/defects/types'
import { DEFECT_ACTION_LABELS, DEFECT_ACTION_TYPES } from '@/lib/quality/defects/types'
import {
  formatDefectAction,
  formatDefectSourceModule,
  formatDefectStatus,
} from '@/lib/quality/defects/utils'
import { formatSmtPcbSideLabel } from '@/lib/smt/history-utils'
import type { SmtPcbSide } from '@/lib/smt/types'
import { ERP_TEXT_WRAP_CLASS } from '@/lib/ui/tokens'

type DefectHandlingModalProps = {
  open: boolean
  row: DefectHandlingListItem | null
  onClose: () => void
  onSaved: () => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className={`${ERP_TEXT_WRAP_CLASS} text-sm font-semibold text-slate-900`}>{value}</dd>
    </div>
  )
}

export function DefectHandlingModal({ open, row, onClose, onSaved }: DefectHandlingModalProps) {
  const [actionType, setActionType] = useState<DefectActionType | ''>('')
  const [actionNote, setActionNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !row) return
    setActionType(row.actionType ?? '')
    setActionNote(row.actionNote)
    setError(null)
    setSaving(false)
  }, [open, row?.key])

  if (!row) return null

  async function handleSave() {
    if (!row) return
    if (!actionType) {
      setError('대처 구분을 선택하세요.')
      return
    }

    setSaving(true)
    setError(null)
    const result = await upsertDefectHandling({
      sourceModule: row.sourceModule,
      productionRecordId: row.productionRecordId,
      actionType,
      actionNote,
    })
    setSaving(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }
    onSaved()
  }

  const processDetail = [
    formatDefectSourceModule(row.sourceModule),
    row.team,
    row.sourceModule === 'smt' && row.pcbSide
      ? formatSmtPcbSideLabel(row.pcbSide as SmtPcbSide)
      : null,
    row.lineNo != null ? `라인 ${row.lineNo}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <ErpModal open={open} title="불량 대처" onClose={onClose} size="md">
      <div className="space-y-4">
        <dl className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5">
          <DetailRow label="상태" value={formatDefectStatus(row.status)} />
          <DetailRow label="발주서" value={formatInternalCodeLabel(row.orderNumber)} />
          <DetailRow label="고객사" value={row.customer || '-'} />
          <DetailRow label="제품" value={row.productName || row.productCode || '-'} />
          <DetailRow label="공정" value={processDetail || '-'} />
          <DetailRow label="기록일" value={row.recordDate} />
          <DetailRow label="불량수량" value={`${row.defectQuantity.toLocaleString('ko-KR')}대`} />
          <DetailRow label="불량사유" value={row.note.trim() || '-'} />
          <DetailRow label="등록자" value={row.createdByName || '-'} />
          {row.handledByName ? (
            <DetailRow
              label="대처자"
              value={`${row.handledByName}${row.handledAt ? ` · ${row.handledAt.slice(0, 16).replace('T', ' ')}` : ''}`}
            />
          ) : null}
          {row.actionType ? (
            <DetailRow label="기존대처" value={formatDefectAction(row.actionType)} />
          ) : null}
        </dl>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-800">대처 구분</legend>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {DEFECT_ACTION_TYPES.map((type) => {
              const active = actionType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActionType(type)}
                  className={[
                    'rounded-lg border px-3 py-2 text-left text-sm font-semibold transition',
                    active
                      ? 'border-slate-800 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {DEFECT_ACTION_LABELS[type]}
                </button>
              )
            })}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">조치 내용</span>
          <textarea
            value={actionNote}
            onChange={(event) => setActionNote(event.target.value)}
            rows={3}
            placeholder="조치 내용·특이사항을 적어 주세요"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <ErpButton variant="secondary" onClick={onClose} disabled={saving}>
            닫기
          </ErpButton>
          <ErpButton onClick={() => void handleSave()} disabled={saving} loading={saving}>
            대처 저장
          </ErpButton>
        </div>
      </div>
    </ErpModal>
  )
}
