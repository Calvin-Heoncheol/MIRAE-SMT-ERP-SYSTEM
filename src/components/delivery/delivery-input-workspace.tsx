'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DeliveryHistoryFetchError } from '@/components/delivery/delivery-history-fetch-error'
import { DeliveryHistoryModal } from '@/components/delivery/delivery-history-modal'
import { DeliveryHistoryTable } from '@/components/delivery/delivery-history-table'
import { DeliveryRegisterMenu } from '@/components/delivery/delivery-register-menu'
import { DeliveryRegisterModal } from '@/components/delivery/delivery-register-modal'
import { SalesStatementEditModal } from '@/components/reports/sales-statement-edit-modal'
import { ProductionFetchError } from '@/components/production-input/production-fetch-error'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { PageShell } from '@/components/ui/page-shell'
import { PdfDownloadButton } from '@/components/ui/pdf-download-button'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { DELIVERY_INPUT_CONFIG } from '@/lib/delivery/config'
import {
  applyShippableOptionToItem,
  buildDeliveryRegisterOrderOptions,
  emptyDeliveryRegisterItemForm,
  type DeliveryRegisterItemForm,
  type DeliveryShippableOption,
} from '@/lib/delivery/register-form'
import {
  fetchOrderLineUnitPrices,
  type FetchDeliveryHistoryResult,
  type FetchDeliveryInputPageResult,
} from '@/lib/delivery/repository'
import { resolveHistoryLineUnitPrices, type DeliveryAvailability } from '@/lib/delivery/utils'
import {
  computeShipmentGroupSupplyAmount,
  filterDeliveryHistory,
  filterStatementTableGroups,
  groupDeliveryHistoryByShipment,
  legacyStatementGroupToTableGroup,
  type DeliveryHistoryShipmentGroup,
  type DeliveryStatementTableGroup,
} from '@/lib/delivery/history-utils'
import { buildDeliveryStatementDataFromTableGroup } from '@/lib/delivery/statement-from-group'
import { printDeliveryStatements } from '@/lib/delivery/print-delivery-statement'
import { exportMonthlyClosingPdf } from '@/lib/reports/export-monthly-closing-pdf'
import {
  buildMonthlyClosingRows,
  resolveMonthlyClosingCustomerLabel,
} from '@/lib/reports/monthly-closing'
import { DATE_RANGE_FILTER_LABEL, hasDateRangeFilter } from '@/lib/ui/date-range'
import { formatEmptyListMessage } from '@/lib/ui/tokens'
import type {
  FetchLegacyStatementGroupsResult,
  SalesReportStatementGroup,
} from '@/lib/reports/sales-report'

type DeliveryInputWorkspaceProps = {
  historyResult: FetchDeliveryHistoryResult
  inputResult: FetchDeliveryInputPageResult
  legacyGroupsResult: FetchLegacyStatementGroupsResult
  initialUiKey?: string
}

type HistoryModalState =
  | { open: false }
  | { open: true; group: DeliveryHistoryShipmentGroup }

function seedItemsFromOption(option: DeliveryShippableOption | null): DeliveryRegisterItemForm[] | null {
  if (!option) return null
  return [applyShippableOptionToItem(emptyDeliveryRegisterItemForm(), option)]
}

export function DeliveryInputWorkspace({
  historyResult,
  inputResult,
  legacyGroupsResult,
  initialUiKey = '',
}: DeliveryInputWorkspaceProps) {
  const { afterSave, afterDelete, afterCreate } = useSaveFeedback()

  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const openedInitialUiKey = useRef(false)
  const [historyModal, setHistoryModal] = useState<HistoryModalState>({ open: false })
  const [historyModalSession, setHistoryModalSession] = useState(0)
  const [legacyEditGroup, setLegacyEditGroup] = useState<SalesReportStatementGroup | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registerSession, setRegisterSession] = useState(0)
  const [registerInitialItems, setRegisterInitialItems] = useState<DeliveryRegisterItemForm[] | null>(
    null,
  )
  const [unitPriceByDeliveryId, setUnitPriceByDeliveryId] = useState<Record<string, number>>({})
  const [supplyAmountsLoading, setSupplyAmountsLoading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [closingExporting, setClosingExporting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)

  const [availabilityByGroupId, setAvailabilityByGroupId] = useState<
    Record<string, DeliveryAvailability>
  >(() => (inputResult.ok ? inputResult.data.availabilityByGroupId : {}))

  const rows = historyResult.ok ? historyResult.rows : []
  const orders = inputResult.ok ? inputResult.data.orders : []
  const billingOnlyLines = inputResult.ok ? inputResult.data.billingOnlyLines : []
  const registerProducts = inputResult.ok ? inputResult.data.products : []
  const productionStatusLines = inputResult.ok ? inputResult.data.productionStatusLines : []
  const legacyGroups = legacyGroupsResult.ok ? legacyGroupsResult.groups : []

  const productionOrders = useMemo(
    () =>
      orders.map((order) => ({
        assemblyGroupId: order.assemblyGroupId,
        orderNumber: order.orderNumber,
        productId: order.productId,
        productCode: order.productCode,
        productName: order.productName,
        unitPrice: order.unitPrice,
      })),
    [orders],
  )

  const shippableOptions = useMemo(
    () =>
      buildDeliveryRegisterOrderOptions(productionStatusLines, orders, availabilityByGroupId),
    [productionStatusLines, orders, availabilityByGroupId],
  )

  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])
  const filteredHistory = useMemo(
    () => filterDeliveryHistory(rows, search, dateRange),
    [rows, search, dateRange],
  )
  const historyGroups = useMemo(
    () => groupDeliveryHistoryByShipment(filteredHistory),
    [filteredHistory],
  )
  const historyGroupsWithAmount = useMemo((): DeliveryStatementTableGroup[] => {
    return historyGroups.map((group) => ({
      ...group,
      source: 'delivery' as const,
      supplyAmount: supplyAmountsLoading
        ? null
        : computeShipmentGroupSupplyAmount(group, {
            unitPriceByDeliveryId,
            billingOnlyLines,
            productionOrders,
          }),
    }))
  }, [
    historyGroups,
    unitPriceByDeliveryId,
    supplyAmountsLoading,
    billingOnlyLines,
    productionOrders,
  ])

  const legacyTableGroups = useMemo(
    () => legacyGroups.map(legacyStatementGroupToTableGroup),
    [legacyGroups],
  )

  const statementGroups = useMemo(() => {
    const merged = [...historyGroupsWithAmount, ...legacyTableGroups]
    return filterStatementTableGroups(merged, search, dateRange).sort((a, b) => {
      const byDate = b.recordDate.localeCompare(a.recordDate)
      if (byDate !== 0) return byDate
      return b.shipmentId.localeCompare(a.shipmentId)
    })
  }, [historyGroupsWithAmount, legacyTableGroups, search, dateRange])

  const hasHistoryFilter = Boolean(search.trim()) || hasDateRangeFilter(dateRange)

  async function handleStatementPrint() {
    if (!statementGroups.length) {
      setPrintError('출력할 거래명세서가 없습니다.')
      return
    }

    setPrinting(true)
    setPrintError(null)

    try {
      const builtResults = await Promise.all(
        statementGroups.map((group) =>
          buildDeliveryStatementDataFromTableGroup(group, {
            unitPriceByDeliveryId,
            billingOnlyLines,
            productionOrders: orders,
          }),
        ),
      )

      const statements = []
      const failures: string[] = []

      for (const built of builtResults) {
        if (!built.ok) {
          failures.push(built.detail)
          continue
        }
        statements.push(built.data)
      }

      if (!statements.length) {
        setPrintError(
          failures.length
            ? `거래명세서를 만들 수 없습니다.\n${failures.slice(0, 5).join('\n')}`
            : '출력할 거래명세서가 없습니다.',
        )
        return
      }

      const ok = printDeliveryStatements(statements)
      if (!ok) {
        setPrintError('인쇄 창을 열 수 없습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요.')
        return
      }

      if (failures.length) {
        setPrintError(
          `${statements.length}건 인쇄 · ${failures.length}건 실패\n${failures.slice(0, 3).join('\n')}`,
        )
      }
    } finally {
      setPrinting(false)
    }
  }

  async function handleMonthlyClosingExport() {
    setClosingExporting(true)
    setPrintError(null)

    try {
      const rows = buildMonthlyClosingRows(statementGroups, {
        unitPriceByDeliveryId,
        billingOnlyLines,
        productionOrders: orders,
      })

      if (!rows.length) {
        setPrintError('월 마감 PDF로 보낼 출하·명세 내역이 없습니다.')
        return
      }

      const customer = resolveMonthlyClosingCustomerLabel(statementGroups, search)

      const ok = exportMonthlyClosingPdf({
        rows,
        customer,
        startDate,
        endDate,
      })
      if (!ok) {
        setPrintError('월 마감 PDF를 열 수 없습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요.')
      }
    } finally {
      setClosingExporting(false)
    }
  }

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

  function openHistory(group: DeliveryStatementTableGroup) {
    if (group.source === 'legacy') {
      if (group.legacyGroup) setLegacyEditGroup(group.legacyGroup)
      return
    }
    setHistoryModalSession((value) => value + 1)
    setHistoryModal({ open: true, group })
  }

  function closeHistory() {
    setHistoryModal({ open: false })
  }

  function handleHistorySaved(message?: string) {
    afterSave(message ?? '출하 내역을 수정했습니다.', { close: closeHistory })
  }

  function handleHistoryDeleted(message?: string) {
    afterDelete(message ?? '출하 내역을 삭제했습니다.', { close: closeHistory })
  }

  function handleLegacyEdited(message?: string) {
    afterSave(message ?? '거래명세서 내역을 수정했습니다.', {
      close: () => setLegacyEditGroup(null),
    })
  }

  function handleLegacyDeleted(message?: string) {
    afterDelete(message ?? '거래명세서 내역을 삭제했습니다.', {
      close: () => setLegacyEditGroup(null),
    })
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
    afterCreate(`출하 완료 · 명세서 ${payload.shipmentId}`, { refresh: true })
  }

  useEffect(() => {
    if (!filteredHistory.length) {
      setUnitPriceByDeliveryId({})
      setSupplyAmountsLoading(false)
      return
    }

    const { unitPriceByDeliveryId: resolved, fetchTargets } = resolveHistoryLineUnitPrices(
      filteredHistory.map((line) => ({
        id: line.id,
        orderNumber: line.orderNumber,
        assemblyGroupId: line.assemblyGroupId,
        productId: line.productId,
        productCode: line.productCode,
        productName: line.productName,
        quantity: line.quantity,
      })),
      productionOrders,
    )

    if (!fetchTargets.length) {
      setUnitPriceByDeliveryId(resolved)
      setSupplyAmountsLoading(false)
      return
    }

    let cancelled = false
    setSupplyAmountsLoading(true)

    void (async () => {
      const result = await fetchOrderLineUnitPrices(
        fetchTargets.map((target) => ({
          orderId: target.orderId,
          productId: target.productId,
        })),
      )
      if (cancelled) return

      const next = { ...resolved }
      if (result.ok) {
        fetchTargets.forEach((target, index) => {
          next[target.lineId] = result.prices[index] || 0
        })
      }
      setUnitPriceByDeliveryId(next)
      setSupplyAmountsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [filteredHistory, productionOrders])

  useEffect(() => {
    if (!initialUiKey || openedInitialUiKey.current) return
    const matched = shippableOptions.find((option) => option.uiKey === initialUiKey)
    if (!matched) return
    openedInitialUiKey.current = true
    setRegisterSession((value) => value + 1)
    setRegisterInitialItems(seedItemsFromOption(matched))
    setRegisterOpen(true)
  }, [initialUiKey, shippableOptions])

  if (!historyResult.ok) {
    return <DeliveryHistoryFetchError result={historyResult} />
  }

  if (!inputResult.ok) {
    return <ProductionFetchError result={inputResult} config={DELIVERY_INPUT_CONFIG} />
  }

  return (
    <>
      <PageShell>
        {!legacyGroupsResult.ok ? (
          <FetchErrorBanner
            title="과거 거래명세서를 불러오지 못했습니다"
            detail={legacyGroupsResult.detail}
          />
        ) : null}

        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="명세서, 발주번호, 고객사, 품목, 출하일 검색…"
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
          actions={
            <>
              <PdfDownloadButton
                onDownload={() => void handleStatementPrint()}
                disabled={printing || closingExporting || statementGroups.length === 0}
                label={printing ? '준비 중…' : '거래명세서'}
              />
              <PdfDownloadButton
                onDownload={() => void handleMonthlyClosingExport()}
                disabled={printing || closingExporting || statementGroups.length === 0}
                label={closingExporting ? '준비 중…' : '월 마감'}
              />
              <DeliveryRegisterMenu onOpenRegister={() => openRegister()} />
            </>
          }
        />

        {printError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm whitespace-pre-wrap text-amber-900">
            {printError}
          </div>
        ) : null}

        <DeliveryHistoryTable
          groups={statementGroups}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasHistoryFilter,
            emptyLabel: '등록된 출하·명세 이력이 없습니다',
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
          billingOnlyLines={billingOnlyLines}
          products={registerProducts}
          initialItems={registerInitialItems}
          onClose={closeRegister}
          onShipped={handleShipped}
        />
      ) : null}

      {historyModal.open ? (
        <DeliveryHistoryModal
          key={`${historyModal.group.shipmentId}-${historyModalSession}`}
          open
          group={historyModal.group}
          billingOnlyLines={billingOnlyLines}
          productionOrders={orders}
          unitPriceByDeliveryId={unitPriceByDeliveryId}
          products={registerProducts}
          options={shippableOptions}
          onClose={closeHistory}
          onSaved={handleHistorySaved}
          onDeleted={handleHistoryDeleted}
        />
      ) : null}

      <SalesStatementEditModal
        open={Boolean(legacyEditGroup)}
        group={legacyEditGroup}
        onClose={() => setLegacyEditGroup(null)}
        onSaved={handleLegacyEdited}
        onDeleted={handleLegacyDeleted}
      />
    </>
  )
}
