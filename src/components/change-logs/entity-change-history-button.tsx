'use client'

import { useEffect, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { ChangeLogDetailText } from '@/components/change-logs/change-log-detail-text'
import { fetchChangeLogsForEntity } from '@/lib/change-logs/repository'
import type { ChangeLogEntityType, ChangeLogRecord } from '@/lib/change-logs/types'
import { ERP_SECONDARY_BUTTON_CLASS } from '@/lib/ui/tokens'

function formatChangeTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

type EntityChangeHistoryButtonProps = {
  entityType: ChangeLogEntityType
  entityId: string | null | undefined
  label?: string
  disabled?: boolean
  className?: string
}

export function EntityChangeHistoryButton({
  entityType,
  entityId,
  label = '변경이력',
  disabled = false,
  className = '',
}: EntityChangeHistoryButtonProps) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ChangeLogRecord[]>([])
  const [loading, setLoading] = useState(false)
  const id = String(entityId || '').trim()

  useEffect(() => {
    if (!open || !id) return

    let cancelled = false
    setLoading(true)
    void fetchChangeLogsForEntity(entityType, id).then((result) => {
      if (cancelled) return
      setLoading(false)
      setRows(result.ok ? result.rows : [])
    })

    return () => {
      cancelled = true
    }
  }, [open, entityType, id])

  if (!id) return null

  return (
    <>
      <ErpButton
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={className}
      >
        {label}
      </ErpButton>

      <ErpModal
        open={open}
        size="md"
        title="변경이력"
        description="이 건의 수정 기록"
        onClose={() => setOpen(false)}
        zIndexClassName="z-[60]"
        footer={
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={ERP_SECONDARY_BUTTON_CLASS}
          >
            닫기
          </button>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-500">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            아직 기록된 변경이력이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                <p className="text-sm font-semibold text-slate-800">{row.title}</p>
                {row.detail ? <ChangeLogDetailText detail={row.detail} /> : null}
                <p className="mt-1 text-xs text-slate-400">
                  {[formatChangeTime(row.changedAt), row.changedByName || null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ErpModal>
    </>
  )
}
