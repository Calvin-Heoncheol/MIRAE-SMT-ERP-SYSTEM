'use client'

import { useMemo, useState } from 'react'
import { DeliveryRegisterItemsForm } from '@/components/delivery/delivery-register-items-form'
import { useBusy } from '@/components/ui/busy-provider'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import {
  emptyDeliveryRegisterItemForm,
  validateDeliveryRegisterItems,
  type DeliveryRegisterItemForm,
  type DeliveryShippableOption,
} from '@/lib/delivery/register-form'
import {
  buildDeliveryStatementDataFromShipment,
  printDeliveryStatement,
} from '@/lib/delivery/print-delivery-statement'
import { createDeliveryShipment } from '@/lib/delivery/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

type DeliveryRegisterModalProps = {
  open: boolean
  options: DeliveryShippableOption[]
  initialItems?: DeliveryRegisterItemForm[] | null
  onClose: () => void
  onShipped?: (payload: {
    shipmentId: string
    deltas: Array<{ assemblyGroupId: string; quantity: number }>
  }) => void
}

function CancelButton({ disabled }: { disabled?: boolean }) {
  const requestClose = useErpModalRequestClose()
  return (
    <ErpButton variant="secondary" disabled={disabled} onClick={() => requestClose?.()}>
      닫기
    </ErpButton>
  )
}

function DeliveryRegisterModalContent({
  options,
  initialItems,
  onClose,
  onShipped,
}: Omit<DeliveryRegisterModalProps, 'open'>) {
  const busyUi = useBusy()
  const { notifyAuthOrFailure } = useWriteFailureToast()
  const [recordDate, setRecordDate] = useState(todayYmdSeoul)
  const [note, setNote] = useState('')
  const [items, setItems] = useState<DeliveryRegisterItemForm[]>(() => {
    if (initialItems?.length) {
      return initialItems
    }
    return [
      emptyDeliveryRegisterItemForm(),
      emptyDeliveryRegisterItemForm(),
      emptyDeliveryRegisterItemForm(),
    ]
  })
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastShipmentId, setLastShipmentId] = useState<string | null>(null)
  const [lastShipMeta, setLastShipMeta] = useState<{
    date: string
    customer: string
    note: string
    lines: DeliveryRegisterItemForm[]
  } | null>(null)

  const lockedCustomer = useMemo(() => {
    const first = items.find((item) => item.customer.trim())
    return first?.customer.trim() || ''
  }, [items])

  const shipped = Boolean(lastShipmentId && lastShipMeta)

  async function printLastStatement() {
    if (!lastShipmentId || !lastShipMeta) return false
    setPrinting(true)
    setSaveError(null)
    const built = await buildDeliveryStatementDataFromShipment({
      shipmentId: lastShipmentId,
      shipDate: lastShipMeta.date,
      customer: lastShipMeta.customer,
      note: lastShipMeta.note,
      shippedLines: lastShipMeta.lines.map((line) => ({
        orderNumber: line.orderNumber,
        productCode: line.productCode,
        productName: line.productName,
        qty: Math.floor(Number(line.quantity) || 0),
        unitPrice: Math.round(Number(line.unitPrice) || 0),
      })),
    })
    setPrinting(false)

    if (!built.ok) {
      setSaveError(built.detail)
      return false
    }

    const printed = printDeliveryStatement(built.data)
    if (!printed) {
      setSaveError('거래명세서를 열 수 없습니다. 팝업 차단을 해제해 주세요.')
      return false
    }
    return true
  }

  async function handleShip() {
    const validation = validateDeliveryRegisterItems(items)
    if (!validation.ok) {
      setSaveError(validation.detail)
      return
    }

    const shipDate = recordDate.trim()
    if (!shipDate) {
      setSaveError('출하일을 선택하세요.')
      return
    }

    setSaving(true)
    setSaveError(null)

    const shipNote = note.trim()
    const result = await busyUi.run(() =>
      createDeliveryShipment({
        customer: validation.customer,
        recordDate: shipDate,
        note: shipNote,
        lines: validation.lines.map((line) => ({
          assemblyGroupId: line.assemblyGroupId,
          quantity: Math.floor(Number(line.quantity) || 0),
          allocations: line.lotManual ? line.allocations : undefined,
        })),
      }),
    )

    setSaving(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setSaveError(result.detail)
      return
    }

    setLastShipmentId(result.shipmentId)
    setLastShipMeta({
      date: shipDate,
      customer: validation.customer,
      note: shipNote,
      lines: validation.lines,
    })
    onShipped?.({
      shipmentId: result.shipmentId,
      deltas: validation.lines.map((line) => ({
        assemblyGroupId: line.assemblyGroupId,
        quantity: Math.floor(Number(line.quantity) || 0),
      })),
    })
  }

  const busy = saving || printing

  return (
    <ErpModal
      open
      size="lg"
      title="출하 등록"
      description="완제품·반제품 코드로 출하할 수 있습니다. LOT은 FIFO로 채워지며 수정 가능합니다."
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-col gap-3">
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          {shipped ? (
            <p className="text-sm text-emerald-700">
              출하 완료 · 명세서 번호 <span className="font-mono font-semibold">{lastShipmentId}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <CancelButton disabled={busy} />
            {shipped ? (
              <ErpButton
                variant="secondary"
                disabled={busy}
                loading={printing}
                onClick={() => void printLastStatement()}
              >
                거래명세서
              </ErpButton>
            ) : null}
            {!shipped ? (
              <ErpButton disabled={busy} loading={saving} onClick={() => void handleShip()}>
                출하
              </ErpButton>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>출하일</span>
            <input
              type="date"
              value={recordDate}
              disabled={shipped || busy}
              onChange={(event) => setRecordDate(event.target.value)}
              className={ERP_FIELD_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>비고</span>
            <input
              value={note}
              disabled={shipped || busy}
              onChange={(event) => setNote(event.target.value)}
              className={ERP_FIELD_INPUT_CLASS}
              placeholder="선택"
            />
          </label>
        </div>

        <DeliveryRegisterItemsForm
          items={items}
          options={options}
          lockedCustomer={lockedCustomer}
          disabled={shipped || busy}
          onChange={setItems}
        />
      </div>
    </ErpModal>
  )
}

export function DeliveryRegisterModal({
  open,
  options,
  initialItems,
  onClose,
  onShipped,
}: DeliveryRegisterModalProps) {
  if (!open) return null
  return (
    <DeliveryRegisterModalContent
      options={options}
      initialItems={initialItems}
      onClose={onClose}
      onShipped={onShipped}
    />
  )
}
