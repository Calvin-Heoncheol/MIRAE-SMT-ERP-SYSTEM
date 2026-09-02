'use client'

import { useEffect, useMemo, useState } from 'react'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { DeliveryRegisterItemsForm } from '@/components/delivery/delivery-register-items-form'
import { useBusy } from '@/components/ui/busy-provider'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { useToast } from '@/components/ui/toast-provider'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import {
  isBillingRegisterItem,
  padDeliveryRegisterItems,
  validateDeliveryRegisterItems,
  type DeliveryRegisterItemForm,
  type DeliveryShippableOption,
} from '@/lib/delivery/register-form'
import { createDeliveryShipment } from '@/lib/delivery/repository'
import type { DeliveryBillingOnlyLine } from '@/lib/delivery/utils'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { BusinessPartner } from '@/lib/partners/types'
import { CATCH_UP_LOT_WARNING } from '@/lib/production-lots/types'
import type { Product } from '@/lib/products/types'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

type DeliveryRegisterModalProps = {
  open: boolean
  options: DeliveryShippableOption[]
  billingOnlyLines?: DeliveryBillingOnlyLine[]
  partners: BusinessPartner[]
  products: Product[]
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

function filledRegisterItems(items: DeliveryRegisterItemForm[] | null | undefined) {
  return (items || []).filter(
    (item) =>
      !isBillingRegisterItem(item) && item.assemblyGroupId.trim() && item.productCode.trim(),
  )
}

function resolveRegisterSeedCustomer(
  options: DeliveryShippableOption[],
  initialItems?: DeliveryRegisterItemForm[] | null,
) {
  const seed = filledRegisterItems(initialItems)[0]
  if (seed?.customer.trim()) return seed.customer.trim()
  if (seed?.assemblyGroupId.trim()) {
    return (
      options.find((option) => option.assemblyGroupId === seed.assemblyGroupId)?.customer.trim() ||
      ''
    )
  }
  return ''
}

function DeliveryRegisterModalContent({
  options,
  billingOnlyLines = [],
  partners,
  products,
  initialItems,
  onClose,
  onShipped,
}: Omit<DeliveryRegisterModalProps, 'open'>) {
  const busyUi = useBusy()
  const toast = useToast()
  const { notifyAuthOrFailure } = useWriteFailureToast()
  const seedCustomer = useMemo(
    () => resolveRegisterSeedCustomer(options, initialItems),
    [initialItems, options],
  )
  const [customer, setCustomer] = useState(seedCustomer)
  const [recordDate, setRecordDate] = useState(todayYmdSeoul())
  const [items, setItems] = useState<DeliveryRegisterItemForm[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (seedCustomer) setCustomer(seedCustomer)
  }, [seedCustomer])

  useEffect(() => {
    const customerName = customer.trim()
    if (!customerName) {
      setItems([])
      return
    }
    setItems(padDeliveryRegisterItems([], customerName))
  }, [customer])

  async function handleShip() {
    const customerName = customer.trim()
    if (!customerName) {
      setSaveError('고객사를 선택해 주세요.')
      return
    }

    const validation = validateDeliveryRegisterItems(items, {
      customer: customerName,
      products,
      orderOptions: options,
    })
    if (!validation.ok) {
      setSaveError(validation.detail)
      return
    }
    if (validation.customer !== customerName) {
      setSaveError('선택한 고객사와 품목의 고객사가 다릅니다.')
      return
    }

    const shipDate = recordDate.trim()
    if (!shipDate) {
      setSaveError('출하일을 선택하세요.')
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = await busyUi.run(() =>
      createDeliveryShipment({
        customer: customerName,
        recordDate: shipDate,
        note: '',
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

    if (result.usedCatchUp) {
      toast.info('LOT 보충', CATCH_UP_LOT_WARNING)
    }

    onShipped?.({
      shipmentId: result.shipmentId,
      deltas: validation.lines.map((line) => ({
        assemblyGroupId: line.assemblyGroupId,
        quantity: Math.floor(Number(line.quantity) || 0),
      })),
    })
    onClose()
  }

  const busy = saving
  const inputClass = `${ERP_FIELD_INPUT_CLASS} !bg-white`

  return (
    <ErpModal
      open
      size="wide"
      title="출하 등록"
      description="고객사와 출하일을 입력한 뒤, 품목을 선택하면 생산현황 진행 중 발주와 연결됩니다."
      onClose={onClose}
      closeOnEscape={!busy}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      footer={
        <div className="flex w-full flex-col gap-3">
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <CancelButton disabled={busy} />
            <ErpButton disabled={busy} loading={saving} onClick={() => void handleShip()}>
              출하
            </ErpButton>
          </div>
        </div>
      }
    >
      <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>
              고객사 <span className="text-rose-600">*</span>
            </span>
            <CustomerCombobox
              value={customer}
              partners={partners}
              placeholder="거래처명 검색"
              inputClassName={inputClass}
              ariaLabel="고객사 (필수)"
              onValueChange={setCustomer}
              onPartnerSelect={(partner) => setCustomer(partner.name)}
            />
            <p className="mt-1 text-xs text-slate-500">
              거래처등록의 거래처를 검색해 선택하세요.
            </p>
          </label>
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>
              출하일 <span className="text-rose-600">*</span>
            </span>
            <input
              type="date"
              value={recordDate}
              disabled={busy}
              onChange={(event) => setRecordDate(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <DeliveryRegisterItemsForm
          items={items}
          options={options}
          products={products}
          customer={customer}
          billingOnlyLines={billingOnlyLines}
          disabled={busy}
          onChange={setItems}
        />
      </div>
    </ErpModal>
  )
}

export function DeliveryRegisterModal({
  open,
  options,
  billingOnlyLines,
  partners,
  products,
  initialItems,
  onClose,
  onShipped,
}: DeliveryRegisterModalProps) {
  if (!open) return null
  return (
    <DeliveryRegisterModalContent
      options={options}
      billingOnlyLines={billingOnlyLines}
      partners={partners}
      products={products}
      initialItems={initialItems}
      onClose={onClose}
      onShipped={onShipped}
    />
  )
}
