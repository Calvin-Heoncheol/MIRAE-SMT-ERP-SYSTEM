'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { ErpButton } from '@/components/ui/erp-button'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { fetchSalesBusinessPartners } from '@/lib/partners/repository'
import type { BusinessPartner } from '@/lib/partners/types'
import type { SalesReportShipmentRow, SalesReportStatementGroup } from '@/lib/reports/sales-report'
import { deleteStatementLines, updateStatementLines } from '@/lib/reports/statement-edit'
import {
  ERP_DANGER_BUTTON_CLASS,
  ERP_FIELD_INPUT_CLASS,
  ERP_FIELD_LABEL_CLASS,
  ERP_ROW_ADD_BUTTON_CLASS,
  ERP_SECONDARY_BUTTON_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
} from '@/lib/ui/tokens'

type SalesStatementEditModalProps = {
  open: boolean
  group: SalesReportStatementGroup | null
  onClose: () => void
  onSaved?: (message?: string) => void
  onDeleted?: (message?: string) => void
}

type LineDraft = {
  key: string
  isNew?: boolean
  source: 'delivery' | 'legacy'
  deliveryId: string
  orderId: string
  orderNumber: string
  orderLineId: string
  productCode: string
  productName: string
  quantity: string
  unitPrice: string
}

function createDraftKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyLegacyDraft(template: LineDraft): LineDraft {
  return {
    key: createDraftKey(),
    isNew: true,
    source: 'legacy',
    deliveryId: template.deliveryId,
    orderId: template.orderId,
    orderNumber: template.orderNumber,
    orderLineId: '',
    productCode: '',
    productName: '',
    quantity: '1',
    unitPrice: '0',
  }
}

function formatMoneyInput(value: number) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('ko-KR')
}

function parseMoneyInput(value: string) {
  return Math.max(0, Math.round(Number(String(value).replace(/[^\d]/g, '')) || 0))
}

function handleMoneyInputChange(value: string) {
  const digits = String(value).replace(/[^\d]/g, '')
  if (!digits) return ''
  return formatMoneyInput(Number(digits))
}

function handleMoneyInputBlur(value: string) {
  if (!String(value).replace(/[^\d]/g, '')) return '0'
  return formatMoneyInput(parseMoneyInput(value))
}

function formatCount(value: number) {
  return value.toLocaleString('ko-KR')
}

function lineKey(line: Pick<LineDraft, 'key' | 'deliveryId' | 'orderLineId'>, index: number) {
  return line.key || `${line.deliveryId}-${line.orderLineId || index}`
}

function toDraft(line: SalesReportShipmentRow, index: number): LineDraft {
  return {
    key: line.orderLineId || `${line.deliveryId}-${index}`,
    source: line.source,
    deliveryId: line.deliveryId,
    orderId: line.orderId || line.orderNumber,
    orderNumber: line.orderNumber,
    orderLineId: line.orderLineId,
    productCode: line.productCode,
    productName: line.productName,
    quantity: String(line.quantity),
    unitPrice: formatMoneyInput(line.unitPrice),
  }
}

function CancelButton({ disabled }: { disabled?: boolean }) {
  const requestClose = useErpModalRequestClose()
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => requestClose?.()}
      className={ERP_SECONDARY_BUTTON_CLASS}
    >
      취소
    </button>
  )
}

export function SalesStatementEditModal({
  open,
  group,
  onClose,
  onSaved,
  onDeleted,
}: SalesStatementEditModalProps) {
  const canDelete = useCanDeleteRecords()
  const confirm = useErpConfirm()
  const isLegacy = group?.source === 'legacy' || group?.lines.some((line) => line.source === 'legacy')
  const [partners, setPartners] = useState<BusinessPartner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(false)
  const [recordDate, setRecordDate] = useState('')
  const [customer, setCustomer] = useState('')
  const [drafts, setDrafts] = useState<LineDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !group) return
    setRecordDate(group.recordDate.slice(0, 10))
    setCustomer(group.customer)
    setDrafts(group.lines.map((line, index) => toDraft(line, index)))
    setError(null)
    setSaving(false)
    setDeleting(false)
  }, [open, group])

  useEffect(() => {
    if (!open || !isLegacy) return
    let cancelled = false
    setPartnersLoading(true)
    void fetchSalesBusinessPartners().then((result) => {
      if (cancelled) return
      setPartnersLoading(false)
      if (result.ok) setPartners(result.partners)
    })
    return () => {
      cancelled = true
    }
  }, [open, isLegacy])

  const showOrderNumber = drafts.some((line) => line.orderNumber.trim())
  const totals = useMemo(() => {
    let quantity = 0
    let amount = 0
    for (const line of drafts) {
      const qty = Math.max(0, Math.floor(Number(line.quantity) || 0))
      const price = parseMoneyInput(line.unitPrice)
      quantity += qty
      amount += qty * price
    }
    return { quantity, amount }
  }, [drafts])

  function addLegacyRow() {
    const template = drafts[0]
    if (!template) return
    setDrafts((current) => [...current, emptyLegacyDraft(template)])
  }

  function patchDraft(index: number, patch: Partial<LineDraft>) {
    setDrafts((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    )
  }

  async function handleSave() {
    if (!group) return
    for (let index = 0; index < drafts.length; index += 1) {
      const line = drafts[index]!
      if (Math.floor(Number(line.quantity) || 0) < 1) {
        setError(`${index + 1}행 수량은 1 이상이어야 합니다.`)
        return
      }
      if (isLegacy && !line.productName.trim()) {
        setError(`${index + 1}행 품목명을 입력해 주세요.`)
        return
      }
    }
    if (isLegacy && !customer.trim()) {
      setError('고객사를 입력해 주세요.')
      return
    }

    setSaving(true)
    setError(null)

    const result = await updateStatementLines(
      drafts.map((line) => ({
        source: line.source,
        deliveryId: line.deliveryId,
        orderNumber: line.orderId || line.orderNumber,
        orderLineId: line.orderLineId,
        recordDate,
        customer,
        productCode: line.productCode,
        productName: line.productName,
        quantity: Math.max(0, Math.floor(Number(line.quantity) || 0)),
        unitPrice: parseMoneyInput(line.unitPrice),
      })),
    )

    setSaving(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }

    onSaved?.('거래명세서 내역을 수정했습니다.')
    onClose()
  }

  async function handleDelete() {
    if (!group || !drafts.length) return
    if (
      !(await confirm({
        title: '거래명세서 삭제',
        message: `출하번호 ${group.shipmentId} 명세 ${drafts.length}건을 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }

    setDeleting(true)
    setError(null)

    const result = await deleteStatementLines(
      drafts
        .filter((line) => !line.isNew && Boolean(line.orderLineId.trim() || line.source === 'delivery'))
        .map((line) => ({
        source: line.source,
        deliveryId: line.deliveryId,
        orderNumber: line.orderId || line.orderNumber,
        orderLineId: line.orderLineId,
        productCode: line.productCode,
      })),
    )

    setDeleting(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }

    onDeleted?.('거래명세서 내역을 삭제했습니다.')
    onClose()
  }

  const busy = saving || deleting
  const cellInputClass =
    'h-8 w-full min-w-0 rounded-md border border-slate-200 px-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
  const cellReadOnlyClass = `${cellInputClass} bg-slate-50 text-slate-600`

  return (
    <ErpModal
      open={open && Boolean(group)}
      title="거래명세서"
      description={
        isLegacy
          ? '과거 명세서입니다. 출하일·고객사·품목·단가를 수정하고 행을 추가할 수 있습니다.'
          : '출하일·수량·단가를 품목별로 수정합니다. 단가는 발주서에 반영됩니다.'
      }
      size="xl"
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div>
            {canDelete ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={busy || !drafts.length}
                className={ERP_DANGER_BUTTON_CLASS}
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <CancelButton disabled={busy} />
            <ErpButton
              disabled={busy || !drafts.length}
              loading={saving}
              onClick={() => void handleSave()}
            >
              저장
            </ErpButton>
          </div>
        </div>
      }
    >
      {group ? (
        <div className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>거래일자</span>
              <input
                type="date"
                value={recordDate}
                onChange={(event) => setRecordDate(event.target.value)}
                className={ERP_FIELD_INPUT_CLASS}
              />
            </label>
            <div className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>출하번호</span>
              <div className={`${ERP_FIELD_INPUT_CLASS} bg-slate-50 font-mono text-xs`}>
                {group.shipmentId || '—'}
              </div>
            </div>
            {isLegacy ? (
              <label className="block text-sm">
                <span className={ERP_FIELD_LABEL_CLASS}>
                  공급받는자 <span className="text-rose-600">*</span>
                </span>
                <CustomerCombobox
                  value={customer}
                  partners={partners}
                  placeholder="거래처명 검색"
                  inputClassName={ERP_FIELD_INPUT_CLASS}
                  onValueChange={setCustomer}
                  onPartnerSelect={(partner) => setCustomer(partner.name)}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {partnersLoading ? '거래처 목록을 불러오는 중…' : '거래처를 선택하세요.'}
                </p>
              </label>
            ) : (
              <div className="block text-sm">
                <span className={ERP_FIELD_LABEL_CLASS}>공급받는자</span>
                <div className={`${ERP_FIELD_INPUT_CLASS} bg-slate-50 font-semibold text-slate-900`}>
                  {group.customer || '—'}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">품목</h3>
            {isLegacy ? (
              <button
                type="button"
                className={ERP_ROW_ADD_BUTTON_CLASS}
                onClick={addLegacyRow}
                disabled={busy || !drafts.length}
              >
                + 행 추가
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="erp-data-table erp-data-table--compact w-full table-fixed min-w-[720px] border-collapse text-sm">
              <colgroup>
                <col className="w-10" />
                {showOrderNumber ? <col className="w-[120px]" /> : null}
                <col className="w-[120px]" />
                <col />
                <col className="w-[88px]" />
                <col className="w-[112px]" />
                <col className="w-[120px]" />
              </colgroup>
              <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-2 py-2 text-center">No</th>
                  {showOrderNumber ? (
                    <th className="px-2 py-2 text-left">발주번호</th>
                  ) : null}
                  <th className="px-2 py-2 text-left">품목코드</th>
                  <th className="px-2 py-2 text-left">품명</th>
                  <th className="w-[88px] px-2 py-2 text-right">수량</th>
                  <th className="w-[112px] px-2 py-2 text-right">단가</th>
                  <th className="w-[120px] px-2 py-2 text-right">공급가액</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((line, index) => {
                  const qty = Math.max(0, Math.floor(Number(line.quantity) || 0))
                  const price = parseMoneyInput(line.unitPrice)
                  const amount = qty * price
                  const legacyLine = line.source === 'legacy'
                  return (
                    <tr key={lineKey(line, index)} className="border-t border-slate-100">
                      <td className="px-2 py-2 text-center tabular-nums text-slate-500">{index + 1}</td>
                      {showOrderNumber ? (
                        <td className="px-2 py-2 font-mono text-xs text-slate-600">
                          {line.orderNumber || '—'}
                        </td>
                      ) : null}
                      <td className={`px-2 py-2 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                        {legacyLine ? (
                          <input
                            value={line.productCode}
                            onChange={(event) => patchDraft(index, { productCode: event.target.value })}
                            className={`${cellInputClass} font-mono`}
                          />
                        ) : (
                          <span className="font-mono text-xs text-slate-700">{line.productCode || '—'}</span>
                        )}
                      </td>
                      <td className={`px-2 py-2 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                        {legacyLine ? (
                          <input
                            value={line.productName}
                            onChange={(event) => patchDraft(index, { productName: event.target.value })}
                            className={cellInputClass}
                          />
                        ) : (
                          <span className="font-medium text-slate-900">{line.productName || '—'}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={line.quantity}
                          onChange={(event) => patchDraft(index, { quantity: event.target.value })}
                          className={`${cellInputClass} text-right tabular-nums`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={line.unitPrice}
                          onChange={(event) =>
                            patchDraft(index, { unitPrice: handleMoneyInputChange(event.target.value) })
                          }
                          onBlur={() =>
                            patchDraft(index, { unitPrice: handleMoneyInputBlur(line.unitPrice) })
                          }
                          className={`${cellInputClass} text-right tabular-nums`}
                          aria-label={`${index + 1}행 단가`}
                        />
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {formatCount(amount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <td
                    className="px-2 py-2.5 text-right"
                    colSpan={showOrderNumber ? 4 : 3}
                  >
                    합계
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatCount(totals.quantity)}</td>
                  <td className="px-2 py-2.5" />
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatCount(totals.amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </ErpModal>
  )
}
