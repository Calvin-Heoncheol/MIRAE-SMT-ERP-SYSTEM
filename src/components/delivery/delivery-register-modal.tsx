'use client'

import { useEffect, useMemo, useState } from 'react'
import { DeliveryRegisterItemsForm } from '@/components/delivery/delivery-register-items-form'
import { DeliveryShippablePicker } from '@/components/delivery/delivery-shippable-picker'
import { useBusy } from '@/components/ui/busy-provider'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { useToast } from '@/components/ui/toast-provider'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import {
  allocationsForRegisterQuantity,
  applyShippableOptionToItem,
  emptyDeliveryRegisterItemForm,
  isBillingRegisterItem,
  pruneOrphanBillingRegisterItems,
  validateDeliveryRegisterItems,
  type DeliveryRegisterItemForm,
  type DeliveryShippableOption,
} from '@/lib/delivery/register-form'
import { createDeliveryShipment } from '@/lib/delivery/repository'
import type { DeliveryBillingOnlyLine } from '@/lib/delivery/utils'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { fetchAvailableLots, syncFinishedGoodsLots } from '@/lib/production-lots/repository'
import { CATCH_UP_LOT_WARNING } from '@/lib/production-lots/types'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

type DeliveryRegisterModalProps = {
  open: boolean
  options: DeliveryShippableOption[]
  billingOnlyLines?: DeliveryBillingOnlyLine[]
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

async function attachLotsToItem(item: DeliveryRegisterItemForm): Promise<DeliveryRegisterItemForm> {
  if (isBillingRegisterItem(item)) return item
  await syncFinishedGoodsLots({ assemblyGroupId: item.assemblyGroupId })
  const result = await fetchAvailableLots(item.assemblyGroupId)
  const lots = result.ok ? result.lots : []
  return {
    ...item,
    availableLots: lots,
    allocations: item.lotManual
      ? item.allocations
      : allocationsForRegisterQuantity(lots, Number(item.quantity)),
  }
}

function DeliveryRegisterModalContent({
  options,
  billingOnlyLines = [],
  initialItems,
  onClose,
  onShipped,
}: Omit<DeliveryRegisterModalProps, 'open'>) {
  const busyUi = useBusy()
  const toast = useToast()
  const { notifyAuthOrFailure } = useWriteFailureToast()
  const [recordDate, setRecordDate] = useState(todayYmdSeoul)
  const [note, setNote] = useState('')
  const [items, setItems] = useState<DeliveryRegisterItemForm[]>(() =>
    filledRegisterItems(initialItems),
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const lockedCustomer = useMemo(() => {
    const first = items.find((item) => !isBillingRegisterItem(item) && item.customer.trim())
    return first?.customer.trim() || ''
  }, [items])

  const selectedIds = useMemo(
    () =>
      new Set(
        items
          .filter((item) => !isBillingRegisterItem(item))
          .map((item) => item.assemblyGroupId)
          .filter(Boolean),
      ),
    [items],
  )

  useEffect(() => {
    const seed = filledRegisterItems(initialItems)
    if (!seed.length) return
    let cancelled = false
    void (async () => {
      const withLots = await Promise.all(seed.map((item) => attachLotsToItem(item)))
      if (!cancelled) setItems(withLots)
    })()
    return () => {
      cancelled = true
    }
  }, [initialItems])

  async function handleToggle(option: DeliveryShippableOption, checked: boolean) {
    if (saving) return
    setSaveError(null)

    if (!checked) {
      setItems((current) =>
        pruneOrphanBillingRegisterItems(
          current.filter(
            (item) =>
              isBillingRegisterItem(item) || item.assemblyGroupId !== option.assemblyGroupId,
          ),
        ),
      )
      return
    }

    if (lockedCustomer && option.customer !== lockedCustomer) {
      setSaveError('같은 고객사 품목만 함께 출하할 수 있습니다.')
      return
    }

    if (selectedIds.has(option.assemblyGroupId)) return

    const pending = applyShippableOptionToItem(emptyDeliveryRegisterItemForm(), option)
    setItems((current) => [...current, pending])

    const withLots = await attachLotsToItem(pending)
    setItems((current) =>
      current.map((item) => (item.key === pending.key ? withLots : item)),
    )
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

  return (
    <ErpModal
      open
      size="wide"
      title="출하 등록"
      description="왼쪽에서 출하할 품목을 체크하고, 필요하면 추가작업을 넣은 뒤 출하하세요. 생산 완료분만 출하할 수 있습니다."
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
      <div className="grid h-[min(72dvh,760px)] min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(300px,38%)_minmax(0,1fr)]">
        <aside className="flex min-h-0 max-h-[42dvh] flex-col overflow-hidden border-b border-slate-200 lg:max-h-none lg:border-b-0 lg:border-r lg:border-slate-200">
          <DeliveryShippablePicker
            options={options}
            selectedIds={selectedIds}
            lockedCustomer={lockedCustomer}
            disabled={busy}
            onToggle={(option, checked) => void handleToggle(option, checked)}
          />
        </aside>

        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>출하일</span>
              <input
                type="date"
                value={recordDate}
                disabled={busy}
                onChange={(event) => setRecordDate(event.target.value)}
                className={ERP_FIELD_INPUT_CLASS}
              />
            </label>
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>비고</span>
              <input
                value={note}
                disabled={busy}
                onChange={(event) => setNote(event.target.value)}
                className={ERP_FIELD_INPUT_CLASS}
                placeholder="선택"
              />
            </label>
          </div>

          <DeliveryRegisterItemsForm
            items={items}
            options={options}
            billingOnlyLines={billingOnlyLines}
            lockedCustomer={lockedCustomer}
            disabled={busy}
            productSelectMode="fixed"
            onChange={setItems}
          />
        </div>
      </div>
    </ErpModal>
  )
}

export function DeliveryRegisterModal({
  open,
  options,
  billingOnlyLines,
  initialItems,
  onClose,
  onShipped,
}: DeliveryRegisterModalProps) {
  if (!open) return null
  return (
    <DeliveryRegisterModalContent
      options={options}
      billingOnlyLines={billingOnlyLines}
      initialItems={initialItems}
      onClose={onClose}
      onShipped={onShipped}
    />
  )
}
