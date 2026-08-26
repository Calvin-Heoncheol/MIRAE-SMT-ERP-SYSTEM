'use client'

import { useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { ErpModal } from '@/components/ui/erp-modal'
import { StatusBadge } from '@/components/ui/status-badge'
import { deleteSolderCreamEquipmentLogs } from '@/lib/materials/solder-cream/repository'
import type {
  SolderCreamHistoryLotRow,
  SolderCreamLotStatus,
  SolderCreamStatusRow,
} from '@/lib/materials/solder-cream/types'
import {
  formatSolderCreamDate,
  formatSolderCreamDateTime,
  SOLDER_CREAM_LOT_STATUS_LABELS,
} from '@/lib/materials/solder-cream/utils'
import type { ErpStatusTone } from '@/lib/ui/tokens'

type SolderCreamLotHistoryModalProps = {
  open: boolean
  statusRow: SolderCreamStatusRow | null
  historyRow: SolderCreamHistoryLotRow | null
  onClose: () => void
  onDeleted: (message?: string) => void
  onRequestScrap: () => void
}

function lotStatusTone(status: SolderCreamLotStatus): ErpStatusTone {
  switch (status) {
    case 'cold':
      return 'info'
    case 'discarded':
      return 'neutral'
    case 'scrapped':
      return 'danger'
    default:
      return 'neutral'
  }
}

function RoundList({
  label,
  times,
  tone,
}: {
  label: string
  times: [string | null, string | null, string | null]
  tone: 'store' | 'discard'
}) {
  const box =
    tone === 'store'
      ? 'border-sky-200 bg-sky-50/80'
      : 'border-amber-200 bg-amber-50/80'
  const title =
    tone === 'store' ? 'text-sky-800' : 'text-amber-900'
  const value =
    tone === 'store' ? 'text-sky-950' : 'text-amber-950'

  return (
    <div className={`rounded-xl border px-3 py-3 ${box}`}>
      <p className={`mb-2 text-xs font-semibold ${title}`}>{label}</p>
      <ul className="space-y-1.5">
        {times.map((time, index) => (
          <li
            key={`${label}-${index}`}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className={`font-medium ${title}`}>{index + 1}차</span>
            <span className={`font-mono text-xs tabular-nums ${value}`}>
              {time ? formatSolderCreamDateTime(time) : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SolderCreamLotHistoryModal({
  open,
  statusRow,
  historyRow,
  onClose,
  onDeleted,
  onRequestScrap,
}: SolderCreamLotHistoryModalProps) {
  const confirm = useErpConfirm()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  if (!open || !statusRow) return null

  const lotNumber = statusRow.barcode
  const storeAt = historyRow?.storeAt ?? [null, null, null]
  const discardAt = historyRow?.discardAt ?? [null, null, null]
  const canScrap = statusRow.status === 'discarded'
  const canDelete = Boolean(historyRow?.logIds.length)

  async function handleDelete() {
    if (!historyRow?.logIds.length || deleting) return
    if (
      !(await confirm({
        title: 'LOT 이력 삭제',
        message: `${lotNumber} LOT 이력을 삭제할까요?\n현황도 함께 다시 계산됩니다.`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }

    setDeleting(true)
    setError('')
    const result = await deleteSolderCreamEquipmentLogs(historyRow.logIds)
    setDeleting(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }
    onDeleted('LOT 이력을 삭제했습니다.')
  }

  return (
    <ErpModal
      open
      title="솔더크림 LOT 이력"
      description={lotNumber}
      size="md"
      onClose={onClose}
      closeOnEscape={!deleting}
      footer={
        <div className="flex w-full flex-col gap-2">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ErpButton
              variant="danger"
              disabled={!canDelete || deleting}
              loading={deleting}
              onClick={() => void handleDelete()}
            >
              이력 삭제
            </ErpButton>
            <div className="flex gap-2">
              {canScrap ? (
                <ErpButton variant="secondary" disabled={deleting} onClick={onRequestScrap}>
                  폐기
                </ErpButton>
              ) : null}
              <ErpButton variant="secondary" disabled={deleting} onClick={onClose}>
                닫기
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={SOLDER_CREAM_LOT_STATUS_LABELS[statusRow.status]}
            tone={lotStatusTone(statusRow.status)}
          />
          <p className="text-sm text-slate-600">
            입고 {statusRow.inboundCount}회
            {statusRow.lastEventAt
              ? ` · 최근 ${formatSolderCreamDateTime(statusRow.lastEventAt)}`
              : ''}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">제조일자</dt>
            <dd className="mt-0.5 font-semibold text-slate-800">
              {formatSolderCreamDate(statusRow.manufacturedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">유통기한</dt>
            <dd className="mt-0.5 font-semibold text-slate-800">
              {formatSolderCreamDate(statusRow.expiresAt)}
            </dd>
          </div>
        </dl>

        <div className="grid gap-3 sm:grid-cols-2">
          <RoundList label="입고" times={storeAt} tone="store" />
          <RoundList label="출고" times={discardAt} tone="discard" />
        </div>

        {!historyRow ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">
            이 LOT에 대한 입고·출고 시각 기록이 없습니다.
          </p>
        ) : null}
      </div>
    </ErpModal>
  )
}
