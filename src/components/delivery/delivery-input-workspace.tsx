'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DeliveryHistoryFetchError } from '@/components/delivery/delivery-history-fetch-error'
import { DeliveryHistoryModal } from '@/components/delivery/delivery-history-modal'
import { DeliveryHistoryTable } from '@/components/delivery/delivery-history-table'
import { DeliveryRegisterModal } from '@/components/delivery/delivery-register-modal'
import { ProductionFetchError } from '@/components/production-input/production-fetch-error'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { ErpButton } from '@/components/ui/erp-button'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { useToast } from '@/components/ui/toast-provider'
import { DELIVERY_INPUT_CONFIG } from '@/lib/delivery/config'
import {
  applyShippableOptionToItem,
  buildDeliveryShippableOptions,
  emptyDeliveryRegisterItemForm,
  type DeliveryRegisterItemForm,
  type DeliveryShippableOption,
} from '@/lib/delivery/register-form'
import type {
  FetchDeliveryHistoryResult,
  FetchDeliveryInputPageResult,
} from '@/lib/delivery/repository'
import type { DeliveryHistoryRow } from '@/lib/delivery/types'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import { filterDeliveryHistory } from '@/lib/delivery/history-utils'
import { DATE_RANGE_FILTER_LABEL, hasDateRangeFilter } from '@/lib/ui/date-range'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type DeliveryInputWorkspaceProps = {
  historyResult: FetchDeliveryHistoryResult
  inputResult: FetchDeliveryInputPageResult
  initialUiKey?: string
}

type HistoryModalState =
  | { open: false }
  | { open: true; row: DeliveryHistoryRow }

function seedItemsFromOption(option: DeliveryShippableOption | null): DeliveryRegisterItemForm[] | null {
  if (!option) return null
  return [
    applyShippableOptionToItem(emptyDeliveryRegisterItemForm(), option),
    emptyDeliveryRegisterItemForm(),
    emptyDeliveryRegisterItemForm(),
  ]
}

export function DeliveryInputWorkspace({
  historyResult,
  inputResult,
  initialUiKey = '',
}: DeliveryInputWorkspaceProps) {
  const router = useRouter()
  const toast = useToast()
  const { afterSave, afterDelete } = useSaveFeedback()

  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [historyModal, setHistoryModal] = useState<HistoryModalState>({ open: false })
  const [historyModalSession, setHistoryModalSession] = useState(0)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registerSession, setRegisterSession] = useState(0)
  const [registerInitialItems, setRegisterInitialItems] = useState<DeliveryRegisterItemForm[] | null>(
    null,
  )

  const [availabilityByGroupId, setAvailabilityByGroupId] = useState<
    Record<string, DeliveryAvailability>
  >(() => (inputResult.ok ? inputResult.data.availabilityByGroupId : {}))

  const rows = historyResult.ok ? historyResult.rows : []
  const orders = inputResult.ok ? inputResult.data.orders : []

  const shippableOptions = useMemo(
    () => buildDeliveryShippableOptions(orders, availabilityByGroupId),
    [orders, availabilityByGroupId],
  )

  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])
  const filtered = useMemo(
    () => filterDeliveryHistory(rows, search, dateRange),
    [rows, search, dateRange],
  )
  const hasActiveFilter = Boolean(search.trim()) || hasDateRangeFilter(dateRange)

  function openRegister(seed?: DeliveryShippableOption | null) {
    const matched =
      seed ||
      (initialUiKey
        ? shippableOptions.find((option) => option.uiKey === initialUiKey) || null
        : null)
    setRegisterSession((value) => value + 1)
    setRegisterInitialItems(seedItemsFromOption(matched))
    setRegisterOpen(true)
  }

  function closeRegister() {
    setRegisterOpen(false)
    setRegisterInitialItems(null)
  }

  function openHistory(row: DeliveryHistoryRow) {
    setHistoryModalSession((value) => value + 1)
    setHistoryModal({ open: true, row })
  }

  function closeHistory() {
    setHistoryModal({ open: false })
  }

  function handleHistorySaved(message?: string) {
    afterSave(message ?? '출하 이력이 저장되었습니다.', { close: closeHistory })
  }

  function handleHistoryDeleted(message?: string) {
    afterDelete(message ?? '출하 이력이 삭제되었습니다.', { close: closeHistory })
  }

  function handleShipped(payload: {
    shipmentId: string
    deltas: Array<{ assemblyGroupId: string; quantity: number }>
  }) {
    setAvailabilityByGroupId((current) => {
      const next = { ...current }
      for (const delta of payload.deltas) {
        const prev = next[delta.assemblyGroupId]
        if (!prev) continue
        const shipped = prev.shipped + delta.quantity
        next[delta.assemblyGroupId] = {
          ...prev,
          shipped,
          shippable: Math.max(0, prev.productionCap - shipped),
        }
      }
      return next
    })
    toast.success('출하 완료', `명세서 ${payload.shipmentId}`)
    router.refresh()
  }

  if (!historyResult.ok) {
    return <DeliveryHistoryFetchError result={historyResult} />
  }

  if (!inputResult.ok) {
    return <ProductionFetchError result={inputResult} config={DELIVERY_INPUT_CONFIG} />
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="출하번호, LOT, 발주번호, 고객사, 품목명, 출하일 검색…"
          accent="sky"
          inlineFilters={
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              label={DATE_RANGE_FILTER_LABEL.ship}
            />
          }
          actions={<ErpButton onClick={() => openRegister()}>출하 등록</ErpButton>}
        />

        <DeliveryHistoryTable
          rows={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '등록된 출하 이력이 없습니다',
            actionHint: '오른쪽 상단에서 출하 등록하세요',
          })}
          onRowClick={openHistory}
        />
      </PageShell>

      {registerOpen ? (
        <DeliveryRegisterModal
          key={`register-${registerSession}`}
          open
          options={shippableOptions}
          initialItems={registerInitialItems}
          onClose={closeRegister}
          onShipped={handleShipped}
        />
      ) : null}

      {historyModal.open ? (
        <DeliveryHistoryModal
          key={`${historyModal.row.id}-${historyModalSession}`}
          open
          row={historyModal.row}
          onClose={closeHistory}
          onSaved={handleHistorySaved}
          onDeleted={handleHistoryDeleted}
        />
      ) : null}
    </>
  )
}
