'use client'

import { useEffect, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  createStatementPayment,
  deleteStatementPayment,
} from '@/lib/accounting/repository'
import type { ReceivableRow } from '@/lib/accounting/types'
import { RECEIVABLE_STATUS_BADGE_CLASS, RECEIVABLE_STATUS_LABELS } from '@/lib/accounting/types'
import { formatOrderDate, formatOrderMoney, todayYmdSeoul } from '@/lib/orders/utils'
import {
  ERP_DANGER_BUTTON_CLASS,
  ERP_FIELD_INPUT_CLASS,
  ERP_FIELD_LABEL_CLASS,
  ERP_TEXT_WRAP_CLASS,
} from '@/lib/ui/tokens'

type ReceivablesPaymentModalProps = {
  open: boolean
  row: ReceivableRow | null
  paymentsMissing?: boolean
  onClose: () => void
  onSaved: (message: string) => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className={`${ERP_TEXT_WRAP_CLASS} text-sm font-semibold text-slate-900`}>{value}</dd>
    </div>
  )
}

export function ReceivablesPaymentModal({
  open,
  row,
  paymentsMissing = false,
  onClose,
  onSaved,
}: ReceivablesPaymentModalProps) {
  const [paidDate, setPaidDate] = useState(todayYmdSeoul())
  const [amountText, setAmountText] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !row) return
    setPaidDate(todayYmdSeoul())
    setAmountText(row.remaining > 0 ? String(row.remaining) : '')
    setNote('')
    setError(null)
    setSaving(false)
    setDeletingId(null)
  }, [open, row?.shipmentId, row?.remaining])

  if (!row) return null

  async function handleSave(fullRemaining = false) {
    if (!row) return
    const amount = fullRemaining ? row.remaining : Math.round(Number(amountText.replace(/[^\d]/g, '')) || 0)
    if (amount <= 0) {
      setError(fullRemaining ? '입금할 잔액이 없습니다.' : '입금 금액을 입력하세요.')
      return
    }

    setSaving(true)
    setError(null)
    const result = await createStatementPayment({
      shipmentId: row.shipmentId,
      paidDate,
      amount,
      note,
    })
    setSaving(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }
    onSaved(fullRemaining || amount >= row.remaining ? '전액 입금으로 기록했습니다.' : '입금을 기록했습니다.')
  }

  async function handleDelete(paymentId: string) {
    setDeletingId(paymentId)
    setError(null)
    const result = await deleteStatementPayment(paymentId)
    setDeletingId(null)
    if (!result.ok) {
      setError(result.detail)
      return
    }
    onSaved('입금 내역을 삭제했습니다.')
  }

  const busy = saving || Boolean(deletingId)

  return (
    <ErpModal
      open={open}
      title="입금 확인"
      description={`${row.shipmentId} · ${row.customer || '고객사 미지정'}`}
      onClose={onClose}
      size="md"
      closeOnEscape={!busy}
      footer={
        <>
          {row.remaining > 0 ? (
            <ErpButton
              variant="secondary"
              disabled={busy || paymentsMissing}
              onClick={() => void handleSave(true)}
            >
              전액 입금
            </ErpButton>
          ) : null}
          <ErpButton disabled={busy || paymentsMissing} loading={saving} onClick={() => void handleSave(false)}>
            확인
          </ErpButton>
        </>
      }
    >
      <div className="space-y-4">
        <dl className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5">
          <DetailRow label="상태" value={RECEIVABLE_STATUS_LABELS[row.status]} />
          <DetailRow label="발행일" value={row.issueDate || '-'} />
          <DetailRow label="입금예정일" value={row.expectedDate || '-'} />
          <DetailRow label="결제조건" value={row.paymentTermLabel || '-'} />
          <DetailRow label="발주번호" value={row.orderNumber || '-'} />
          <DetailRow label="품목" value={row.productName || '-'} />
          <DetailRow label="공급가액" value={formatOrderMoney(row.amount)} />
          <DetailRow label="입금액" value={formatOrderMoney(row.paidAmount)} />
          <DetailRow label="잔액" value={formatOrderMoney(row.remaining)} />
        </dl>

        <div className="flex items-center gap-2">
          <StatusBadge
            label={RECEIVABLE_STATUS_LABELS[row.status]}
            className={RECEIVABLE_STATUS_BADGE_CLASS[row.status]}
          />
          {!row.paymentTermLabel ? (
            <p className="text-xs text-slate-500">결제조건이 없으면 입금예정일을 계산하지 않습니다.</p>
          ) : null}
        </div>

        {paymentsMissing ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            입금 테이블이 없습니다. migrate-statement-payments.sql 을 실행한 뒤 다시 시도하세요.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={ERP_FIELD_LABEL_CLASS}>입금일</span>
              <input
                type="date"
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
                disabled={busy}
                className={ERP_FIELD_INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className={ERP_FIELD_LABEL_CLASS}>입금 금액</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value.replace(/[^\d]/g, ''))}
                disabled={busy}
                placeholder="원"
                className={ERP_FIELD_INPUT_CLASS}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={ERP_FIELD_LABEL_CLASS}>비고</span>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={busy}
                placeholder="분할 입금, 세금계산서 번호 등"
                className={ERP_FIELD_INPUT_CLASS}
              />
            </label>
          </div>
        )}

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500">입금 내역</p>
          {row.payments.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">입금일</th>
                    <th className="px-3 py-2 text-right">금액</th>
                    <th className="px-3 py-2 text-left">비고</th>
                    <th className="px-3 py-2 text-left">등록</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {row.payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-3 py-2">{formatOrderDate(payment.paidDate)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-semibold">
                        {formatOrderMoney(payment.amount)}
                      </td>
                      <td className={`${ERP_TEXT_WRAP_CLASS} px-3 py-2 text-slate-600`}>{payment.note || '-'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                        {payment.createdByName || '-'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleDelete(payment.id)}
                          className={`${ERP_DANGER_BUTTON_CLASS} !px-2.5 !py-1 text-xs`}
                        >
                          {deletingId === payment.id ? '삭제 중…' : '삭제'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
              아직 입금 기록이 없습니다.
            </p>
          )}
        </div>
      </div>
    </ErpModal>
  )
}
