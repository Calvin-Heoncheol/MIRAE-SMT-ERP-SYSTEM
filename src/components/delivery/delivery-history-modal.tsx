'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { ErpButton } from '@/components/ui/erp-button'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { buildDeliveryStatementDataFromShipment } from '@/lib/delivery/build-delivery-statement-data'
import { printDeliveryStatement } from '@/lib/delivery/print-delivery-statement'
import {
  deleteDeliveryRecord,
  fetchOrderLineUnitPrices,
} from '@/lib/delivery/repository'
import type { DeliveryHistoryShipmentGroup } from '@/lib/delivery/history-utils'
import type { DeliveryHistoryRow } from '@/lib/delivery/types'
import type { DeliveryBillingOnlyLine } from '@/lib/delivery/utils'
import { buildShipmentStatementLinesFromHistory, resolveHistoryLineUnitPrices } from '@/lib/delivery/utils'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { updateStatementLines } from '@/lib/reports/statement-edit'
import {
  ERP_DANGER_BUTTON_CLASS,
  ERP_FIELD_INPUT_CLASS,
  ERP_FIELD_LABEL_CLASS,
  ERP_SECONDARY_BUTTON_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
} from '@/lib/ui/tokens'

type DeliveryHistoryModalProps = {
  open: boolean
  group: DeliveryHistoryShipmentGroup | null
  billingOnlyLines?: DeliveryBillingOnlyLine[]
  productionOrders?: ProductionOrderLine[]
  unitPriceByDeliveryId?: Record<string, number>
  onClose: () => void
  onSaved?: (message?: string) => void
  onDeleted?: (message?: string) => void
}

type LineDraft = {
  deliveryId: string
  orderNumber: string
  orderLineId?: string
  customerPoNumber: string
  productCode: string
  productName: string
  quantity: string
  unitPrice: string
  note: string
  billingOnly?: boolean
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

function toDraft(
  line: Pick<DeliveryHistoryRow, 'id' | 'orderNumber' | 'customerPoNumber' | 'productCode' | 'productName' | 'note'> & {
    quantity: number
    unitPrice?: number
    billingOnly?: boolean
    orderLineId?: string
  },
): LineDraft {
  return {
    deliveryId: line.id,
    orderNumber: line.orderNumber,
    orderLineId: line.orderLineId,
    customerPoNumber: line.customerPoNumber || '',
    productCode: line.productCode,
    productName: line.productName,
    quantity: String(line.quantity),
    unitPrice: formatMoneyInput(line.unitPrice ?? 0),
    note: line.note || '',
    billingOnly: line.billingOnly,
  }
}

function buildDisplayDrafts(
  group: DeliveryHistoryShipmentGroup,
  billingOnlyLines: DeliveryBillingOnlyLine[],
  productionOrders: ProductionOrderLine[],
  unitPriceByDeliveryId: Record<string, number>,
): LineDraft[] {
  const statementLines = buildShipmentStatementLinesFromHistory({
    lines: group.lines.map((line) => ({
      id: line.id,
      orderNumber: line.orderNumber,
      assemblyGroupId: line.assemblyGroupId,
      productId: line.productId,
      productCode: line.productCode,
      productName: line.productName,
      quantity: line.quantity,
    })),
    unitPriceByDeliveryId,
    billingOnlyLines,
    productionOrders: productionOrders.map((order) => ({
      assemblyGroupId: order.assemblyGroupId,
      orderNumber: order.orderNumber,
      productId: order.productId,
      productCode: order.productCode,
      productName: order.productName,
      unitPrice: order.unitPrice,
    })),
  })

  return statementLines.map((line, index) => {
    if (line.billingOnly) {
      return toDraft({
        id: `billing:${line.orderLineId || `${line.orderNumber}-${index}`}`,
        orderNumber: line.orderNumber,
        orderLineId: line.orderLineId,
        customerPoNumber:
          group.lines.find((entry) => entry.orderNumber === line.orderNumber)?.customerPoNumber || '',
        productCode: line.productCode,
        productName: line.productName,
        quantity: line.qty,
        unitPrice: line.unitPrice ?? 0,
        note: group.lines[0]?.note || '',
        billingOnly: true,
      })
    }

    const historyLine =
      group.lines.find(
        (entry) =>
          entry.orderNumber === line.orderNumber &&
          entry.productName === line.productName &&
          (entry.productId === line.productId ||
            entry.productCode === line.productCode ||
            entry.assemblyGroupId ===
              productionOrders.find((order) => order.productCode === line.productCode)
                ?.assemblyGroupId),
      ) || null

    const production = historyLine
      ? productionOrders.find((order) => order.assemblyGroupId === historyLine.assemblyGroupId)
      : productionOrders.find(
          (order) =>
            order.orderNumber === line.orderNumber &&
            (order.productId === line.productId || order.productCode === line.productCode),
        )

    return toDraft({
      id: historyLine?.id || `product:${index}`,
      orderNumber: line.orderNumber,
      customerPoNumber: historyLine?.customerPoNumber || '',
      productCode: production?.productCode || historyLine?.productCode || line.productCode,
      productName: line.productName,
      quantity: line.qty,
      unitPrice: line.unitPrice ?? 0,
      note: historyLine?.note || '',
      billingOnly: false,
    })
  })
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

export function DeliveryHistoryModal({
  open,
  group,
  billingOnlyLines = [],
  productionOrders = [],
  unitPriceByDeliveryId: parentUnitPriceByDeliveryId = {},
  onClose,
  onSaved,
  onDeleted,
}: DeliveryHistoryModalProps) {
  const canDelete = useCanDeleteRecords()
  const confirm = useErpConfirm()
  const [recordDate, setRecordDate] = useState('')
  const [drafts, setDrafts] = useState<LineDraft[]>([])
  const [customer, setCustomer] = useState('')
  const [shipmentId, setShipmentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !group) return
    setRecordDate(group.recordDate.slice(0, 10))
    setCustomer(group.customer)
    setShipmentId(group.shipmentId)
    setDrafts(group.lines.map((line) => toDraft({ ...line, quantity: line.quantity })))
    setError(null)
    setSaving(false)
    setPrinting(false)
    setDeleting(false)

    let cancelled = false
    const historyLines = group.lines.map((line) => ({
      id: line.id,
      orderNumber: line.orderNumber,
      assemblyGroupId: line.assemblyGroupId,
      productId: line.productId,
      productCode: line.productCode,
      productName: line.productName,
      quantity: line.quantity,
    }))
    const mappedProductionOrders = productionOrders.map((order) => ({
      assemblyGroupId: order.assemblyGroupId,
      orderNumber: order.orderNumber,
      productId: order.productId,
      productCode: order.productCode,
      productName: order.productName,
      unitPrice: order.unitPrice,
    }))
    const { unitPriceByDeliveryId: resolved, fetchTargets } = resolveHistoryLineUnitPrices(
      historyLines,
      mappedProductionOrders,
    )
    const mergedUnitPrices = { ...resolved, ...parentUnitPriceByDeliveryId }
    const missingTargets = fetchTargets.filter(
      (target) => mergedUnitPrices[target.lineId] == null || mergedUnitPrices[target.lineId] === 0,
    )

    if (!missingTargets.length) {
      setDrafts(
        buildDisplayDrafts(group, billingOnlyLines, productionOrders, mergedUnitPrices),
      )
      return () => {
        cancelled = true
      }
    }

    setDrafts(buildDisplayDrafts(group, billingOnlyLines, productionOrders, mergedUnitPrices))

    void (async () => {
      const result = await fetchOrderLineUnitPrices(
        missingTargets.map((target) => ({
          orderId: target.orderId,
          productId: target.productId,
        })),
      )
      if (cancelled) return
      const nextPrices = { ...mergedUnitPrices }
      if (result.ok) {
        missingTargets.forEach((target, index) => {
          nextPrices[target.lineId] = result.prices[index] || 0
        })
      }
      setDrafts(buildDisplayDrafts(group, billingOnlyLines, productionOrders, nextPrices))
    })()

    return () => {
      cancelled = true
    }
  }, [open, group, billingOnlyLines, productionOrders, parentUnitPriceByDeliveryId])

  const showOrderNumber = drafts.some((line) => line.orderNumber.trim() || line.customerPoNumber.trim())
  const totals = useMemo(() => {
    let quantity = 0
    let amount = 0
    for (const line of drafts) {
      const qty = Math.max(0, Math.floor(Number(line.quantity) || 0))
      const price = parseMoneyInput(line.unitPrice)
      if (!line.billingOnly) quantity += qty
      amount += qty * price
    }
    return { quantity, amount }
  }, [drafts])

  function patchDraft(index: number, patch: Partial<LineDraft>) {
    setDrafts((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    )
  }

  async function handleSave() {
    if (!group) return
    const productDrafts = drafts.filter((line) => !line.billingOnly)
    for (let index = 0; index < productDrafts.length; index += 1) {
      const line = productDrafts[index]!
      if (Math.floor(Number(line.quantity) || 0) < 1) {
        setError(`${index + 1}행 수량은 1 이상이어야 합니다.`)
        return
      }
    }
    if (!recordDate.trim()) {
      setError('출하일을 선택하세요.')
      return
    }

    setSaving(true)
    setError(null)

    const result = await updateStatementLines(
      drafts.map((line) => ({
        source: 'delivery' as const,
        deliveryId: line.deliveryId,
        orderNumber: line.orderNumber,
        orderLineId: line.orderLineId,
        recordDate: recordDate.trim(),
        productCode: line.productCode,
        productName: line.productName,
        quantity: Math.max(0, Math.floor(Number(line.quantity) || 0)),
        unitPrice: parseMoneyInput(line.unitPrice),
        billingOnly: line.billingOnly,
      })),
    )

    setSaving(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }

    onSaved?.('출하 내역을 수정했습니다.')
    onClose()
  }

  async function handlePrintStatement() {
    if (!shipmentId || !drafts.length || !group) return
    setPrinting(true)
    setError(null)

    const unitPriceByDeliveryId: Record<string, number> = {}
    for (const line of group.lines) {
      const draft = drafts.find(
        (entry) => !entry.billingOnly && entry.deliveryId === line.id,
      )
      unitPriceByDeliveryId[line.id] = draft ? parseMoneyInput(draft.unitPrice) : 0
    }

    const shippedLines = buildShipmentStatementLinesFromHistory({
      lines: group.lines.map((line) => ({
        id: line.id,
        orderNumber: line.orderNumber,
        assemblyGroupId: line.assemblyGroupId,
        productId: line.productId,
        productCode: line.productCode,
        productName: line.productName,
        quantity: Math.max(0, Math.floor(Number(
          drafts.find((entry) => !entry.billingOnly && entry.deliveryId === line.id)?.quantity ||
            line.quantity,
        ) || 0)),
      })),
      unitPriceByDeliveryId,
      billingOnlyLines,
      productionOrders: productionOrders.map((order) => ({
        assemblyGroupId: order.assemblyGroupId,
        orderNumber: order.orderNumber,
        productId: order.productId,
        productCode: order.productCode,
        productName: order.productName,
        unitPrice: order.unitPrice,
      })),
    })

    const built = await buildDeliveryStatementDataFromShipment({
      shipmentId,
      shipDate: recordDate || group.recordDate,
      customer: customer || group.customer,
      note: drafts[0]?.note || '',
      shippedLines: shippedLines.map((line) => ({
        orderNumber: line.orderNumber,
        productCode: line.productCode,
        productName: line.productName,
        qty: line.qty,
        unitPrice: line.unitPrice ?? 0,
        billingOnly: line.billingOnly,
        orderLineId: line.orderLineId,
      })),
    })

    setPrinting(false)
    if (!built.ok) {
      setError(built.detail)
      return
    }

    const ok = printDeliveryStatement(built.data)
    if (!ok) {
      setError('거래명세서를 열 수 없습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요.')
    }
  }

  async function handleDelete() {
    if (!group) return
    const productDrafts = drafts.filter((line) => !line.billingOnly)
    if (!productDrafts.length) return
    if (
      !(await confirm({
        title: '출하 내역 삭제',
        message: `출하번호 ${shipmentId} 내역 ${productDrafts.length}건을 삭제할까요?\n삭제 후 누적 출하 수량이 함께 반영됩니다.`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }

    setDeleting(true)
    setError(null)

    for (const line of productDrafts) {
      const result = await deleteDeliveryRecord(line.deliveryId)
      if (!result.ok) {
        setDeleting(false)
        setError(result.detail)
        return
      }
    }

    setDeleting(false)
    onDeleted?.('출하 내역을 삭제했습니다.')
    onClose()
  }

  const busy = saving || printing || deleting
  const cellInputClass =
    'h-8 w-full min-w-0 rounded-md border border-slate-200 px-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
  const cellReadOnlyClass = `${cellInputClass} bg-slate-50 text-slate-600`

  return (
    <ErpModal
      open={open && Boolean(group)}
      title="출하"
      description="출하일·수량·단가를 품목별로 수정합니다. 단가는 발주서에 반영됩니다."
      size="xl"
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
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
            <ErpButton
              variant="secondary"
              disabled={busy || !drafts.length}
              loading={printing}
              onClick={() => void handlePrintStatement()}
            >
              거래명세서
            </ErpButton>
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
              <span className={ERP_FIELD_LABEL_CLASS}>출하일</span>
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
                {shipmentId || '—'}
              </div>
            </div>
            <div className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>고객사</span>
              <div className={`${ERP_FIELD_INPUT_CLASS} bg-slate-50 font-semibold text-slate-900`}>
                {customer || '—'}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="erp-data-table erp-data-table--compact min-w-[720px] w-full border-collapse text-sm">
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
                  return (
                    <tr
                      key={line.deliveryId}
                      className={[
                        'border-t border-slate-100',
                        line.billingOnly ? 'bg-amber-50/40' : '',
                      ].join(' ')}
                    >
                      <td className="px-2 py-2 text-center tabular-nums text-slate-500">
                        {index + 1}
                      </td>
                      {showOrderNumber ? (
                        <td className="px-2 py-2 font-mono text-xs text-slate-600">
                          {displayOrderPoNumber(line.customerPoNumber, line.orderNumber) || '—'}
                        </td>
                      ) : null}
                      <td className={`px-2 py-2 font-mono text-xs text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                        {line.productCode || '—'}
                      </td>
                      <td className={`px-2 py-2 font-medium text-slate-900 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                        {line.productName || '—'}
                        {line.billingOnly ? (
                          <span className="ml-2 text-xs font-semibold text-amber-700">추가작업</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={line.quantity}
                          readOnly={line.billingOnly}
                          onChange={(event) => patchDraft(index, { quantity: event.target.value })}
                          className={`${line.billingOnly ? cellReadOnlyClass : cellInputClass} text-right tabular-nums`}
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
                  <td className="px-2 py-2.5 text-right" colSpan={showOrderNumber ? 4 : 3}>
                    합계
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {formatCount(totals.quantity)}
                  </td>
                  <td className="px-2 py-2.5" />
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {formatCount(totals.amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </ErpModal>
  )
}
