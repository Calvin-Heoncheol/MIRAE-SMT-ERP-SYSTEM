'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { ChangeReasonModal } from '@/components/change-logs/change-reason-modal'
import { ProductCombobox } from '@/components/orders/product-combobox'
import { ErpButton } from '@/components/ui/erp-button'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import { buildDeliveryStatementDataFromShipment } from '@/lib/delivery/build-delivery-statement-data'
import { printDeliveryStatement } from '@/lib/delivery/print-delivery-statement'
import {
  createDeliveryRecord,
  deleteDeliveryRecord,
  fetchOrderLineUnitPrices,
} from '@/lib/delivery/repository'
import {
  findShippableOptionsForProduct,
  type DeliveryShippableOption,
} from '@/lib/delivery/register-form'
import type { DeliveryHistoryShipmentGroup } from '@/lib/delivery/history-utils'
import type { DeliveryHistoryRow } from '@/lib/delivery/types'
import type { DeliveryBillingOnlyLine } from '@/lib/delivery/utils'
import { buildShipmentStatementLinesFromHistory, resolveHistoryLineUnitPrices } from '@/lib/delivery/utils'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import type { Product } from '@/lib/products/types'
import { filterProductsForCustomerStrict } from '@/lib/products/utils'
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
  products?: Product[]
  options?: DeliveryShippableOption[]
  onClose: () => void
  onSaved?: (message?: string) => void
  onDeleted?: (message?: string) => void
}

type LineDraft = {
  key: string
  isNew?: boolean
  deliveryId: string
  assemblyGroupId: string
  orderNumber: string
  orderLineId?: string
  customerPoNumber: string
  productCode: string
  productName: string
  quantity: string
  unitPrice: string
  note: string
  billingOnly?: boolean
  maxQuantity?: number
}

function createDraftKey() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isPersistedDeliveryId(id: string) {
  const value = String(id || '').trim()
  if (!value) return false
  if (value.startsWith('billing:') || value.startsWith('product:')) return false
  return true
}

function emptyProductDraft(): LineDraft {
  return {
    key: createDraftKey(),
    isNew: true,
    deliveryId: '',
    assemblyGroupId: '',
    orderNumber: '',
    customerPoNumber: '',
    productCode: '',
    productName: '',
    quantity: '',
    unitPrice: '0',
    note: '',
    billingOnly: false,
    maxQuantity: 0,
  }
}

function isBlankNewDraft(line: LineDraft) {
  if (!line.isNew || line.billingOnly) return false
  return (
    !line.productCode.trim() &&
    !line.productName.trim() &&
    !line.assemblyGroupId.trim() &&
    Math.floor(Number(line.quantity) || 0) < 1
  )
}

function formatMoneyInput(value: number) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('ko-KR')
}

function parseMoneyInput(value: string) {
  return Math.max(0, Math.round(Number(String(value).replace(/[^\d]/g, '')) || 0))
}

function draftPriceKey(line: LineDraft) {
  if (line.billingOnly) {
    return `billing:${line.orderLineId || line.productCode || line.productName}`
  }
  return line.deliveryId
}

function hasDraftUnitPriceChange(
  drafts: LineDraft[],
  initialPrices: Record<string, number>,
) {
  return drafts.some((line) => {
    const key = draftPriceKey(line)
    const before = initialPrices[key]
    if (before == null) return false
    return parseMoneyInput(line.unitPrice) !== before
  })
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
  line: Pick<
    DeliveryHistoryRow,
    'id' | 'orderNumber' | 'customerPoNumber' | 'productCode' | 'productName' | 'note'
  > & {
    quantity: number
    unitPrice?: number
    billingOnly?: boolean
    orderLineId?: string
    assemblyGroupId?: string
  },
): LineDraft {
  return {
    key: line.id,
    isNew: false,
    deliveryId: line.id,
    assemblyGroupId: String(line.assemblyGroupId || '').trim(),
    orderNumber: line.orderNumber,
    orderLineId: line.orderLineId,
    customerPoNumber: line.customerPoNumber || '',
    productCode: line.productCode,
    productName: line.productName,
    quantity: String(line.quantity),
    unitPrice: formatMoneyInput(line.unitPrice ?? 0),
    note: line.note || '',
    billingOnly: line.billingOnly,
    maxQuantity: 0,
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
      assemblyGroupId:
        historyLine?.assemblyGroupId || production?.assemblyGroupId || '',
      orderLineId: production?.orderLineId,
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
  products = [],
  options = [],
  onClose,
  onSaved,
  onDeleted,
}: DeliveryHistoryModalProps) {
  const canDelete = useCanDeleteRecords()
  const confirm = useErpConfirm()
  const [recordDate, setRecordDate] = useState('')
  const [drafts, setDrafts] = useState<LineDraft[]>([])
  const [removedDeliveryIds, setRemovedDeliveryIds] = useState<string[]>([])
  const [customer, setCustomer] = useState('')
  const [shipmentId, setShipmentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reasonOpen, setReasonOpen] = useState(false)
  const initialUnitPricesRef = useRef<Record<string, number>>({})
  const draftsReadyRef = useRef(false)

  const searchableProducts = useMemo(
    () => (customer ? filterProductsForCustomerStrict(products, customer) : products.filter((product) => product.isActive)),
    [products, customer],
  )

  useEffect(() => {
    if (!open || !group) return
    draftsReadyRef.current = false
    initialUnitPricesRef.current = {}
    setReasonOpen(false)
    setRecordDate(group.recordDate.slice(0, 10))
    setCustomer(group.customer)
    setShipmentId(group.shipmentId)
    setRemovedDeliveryIds([])
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

  useEffect(() => {
    if (!open || !drafts.length || draftsReadyRef.current) return
    initialUnitPricesRef.current = Object.fromEntries(
      drafts.map((line) => [draftPriceKey(line), parseMoneyInput(line.unitPrice)]),
    )
    draftsReadyRef.current = true
  }, [open, drafts])

  useEffect(() => {
    let changed = false
    const next = drafts.map((item, index) => {
      if (!item.isNew || item.billingOnly || item.assemblyGroupId.trim()) return item
      if (!item.productCode.trim() && !item.productName.trim()) return item
      const matches = findShippableOptionsForProduct(optionsForRow(index, item), customer, {
        id: '',
        productCode: item.productCode,
        productName: item.productName,
      })
      if (matches.length !== 1) return item
      changed = true
      return bindOptionToDraft(item, matches[0]!)
    })
    if (changed) setDrafts(next)
  }, [customer, drafts, options, productionOrders])

  const productRowCount = drafts.filter((line) => !line.billingOnly).length
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

  function optionsForRow(index: number, item: LineDraft) {
    const used = new Set(
      drafts
        .filter((line, lineIndex) => lineIndex !== index && !line.billingOnly)
        .map((line) => line.assemblyGroupId.trim())
        .filter(Boolean),
    )
    return options.filter((option) => {
      if (customer && option.customer !== customer) return false
      if (used.has(option.assemblyGroupId) && option.assemblyGroupId !== item.assemblyGroupId) {
        return false
      }
      return true
    })
  }

  function bindOptionToDraft(item: LineDraft, option: DeliveryShippableOption): LineDraft {
    const production = productionOrders.find(
      (order) => order.assemblyGroupId === option.assemblyGroupId,
    )
    return {
      ...item,
      isNew: true,
      deliveryId: '',
      assemblyGroupId: option.assemblyGroupId,
      orderNumber: option.orderNumber,
      orderLineId: production?.orderLineId,
      customerPoNumber: option.customerPoNumber || '',
      productCode: option.productCode,
      productName: option.productName,
      unitPrice: formatMoneyInput(option.unitPrice),
      maxQuantity: Math.max(0, Math.floor(Number(option.maxQuantity) || 0)),
    }
  }

  function addRow() {
    setDrafts((current) => {
      const insertAt = current.findIndex((line) => line.billingOnly)
      const next = emptyProductDraft()
      if (insertAt < 0) return [...current, next]
      return [...current.slice(0, insertAt), next, ...current.slice(insertAt)]
    })
    setError(null)
  }

  function removeRow(index: number) {
    const target = drafts[index]
    if (!target || target.billingOnly) return
    const productRows = drafts.filter((line) => !line.billingOnly)
    if (productRows.length <= 1) {
      setError('마지막 품목은 아래 삭제로 출하 전체를 지워 주세요.')
      return
    }

    if (!target.isNew && isPersistedDeliveryId(target.deliveryId)) {
      setRemovedDeliveryIds((current) =>
        current.includes(target.deliveryId) ? current : [...current, target.deliveryId],
      )
    }

    const remainingProducts = productRows.filter((line) => line.key !== target.key)
    const remainingOrders = new Set(remainingProducts.map((line) => line.orderNumber.trim()).filter(Boolean))
    setDrafts((current) =>
      current.filter((line) => {
        if (line.key === target.key) return false
        if (line.billingOnly && line.orderNumber.trim() && !remainingOrders.has(line.orderNumber.trim())) {
          return false
        }
        return true
      }),
    )
    setError(null)
  }

  function selectOrderOption(index: number, assemblyGroupId: string) {
    const item = drafts[index]
    if (!item) return
    const option = optionsForRow(index, item).find((row) => row.assemblyGroupId === assemblyGroupId)
    if (!option) {
      patchDraft(index, { assemblyGroupId: '', orderNumber: '', customerPoNumber: '', maxQuantity: 0 })
      return
    }
    patchDraft(index, bindOptionToDraft(item, option))
  }

  function selectProduct(index: number, product: Product) {
    const item = drafts[index] ?? emptyProductDraft()
    const matches = findShippableOptionsForProduct(optionsForRow(index, item), customer, product)
    const option = matches.length === 1 ? matches[0]! : null
    if (option) {
      patchDraft(index, {
        ...bindOptionToDraft(item, option),
        productCode: product.productCode,
        productName: product.productName,
        unitPrice: formatMoneyInput(option.unitPrice || product.defaultUnitPrice),
      })
      return
    }
    patchDraft(index, {
      ...item,
      isNew: true,
      deliveryId: '',
      assemblyGroupId: '',
      orderNumber: '',
      orderLineId: undefined,
      customerPoNumber: '',
      productCode: product.productCode,
      productName: product.productName,
      unitPrice: formatMoneyInput(product.defaultUnitPrice),
      maxQuantity: 0,
    })
  }

  async function commitSave(reason?: string) {
    if (!group) return
    const working = drafts.filter((line) => !isBlankNewDraft(line))
    const productDrafts = working.filter((line) => !line.billingOnly)
    if (!productDrafts.length) {
      setError('출하할 품목을 하나 이상 남겨 주세요.')
      return
    }
    for (let index = 0; index < productDrafts.length; index += 1) {
      const line = productDrafts[index]!
      if (!line.productCode.trim() || !line.productName.trim()) {
        setError(`${index + 1}행 품목을 선택해 주세요.`)
        return
      }
      if (!line.assemblyGroupId.trim()) {
        setError(`${index + 1}행 발주번호를 선택해 주세요.`)
        return
      }
      const quantity = Math.floor(Number(line.quantity) || 0)
      if (quantity < 1) {
        setError(`${index + 1}행 수량은 1 이상이어야 합니다.`)
        return
      }
      if (line.isNew && (line.maxQuantity || 0) > 0 && quantity > (line.maxQuantity || 0)) {
        setError(
          `${index + 1}행 수량이 출하 가능 수량(${line.maxQuantity!.toLocaleString('ko-KR')})을 초과합니다.`,
        )
        return
      }
    }
    if (!recordDate.trim()) {
      setError('출하일을 선택하세요.')
      return
    }

    setSaving(true)
    setError(null)

    const existingLines = working.filter(
      (line) => !line.isNew && (line.billingOnly || isPersistedDeliveryId(line.deliveryId)),
    )
    if (existingLines.length) {
      const result = await updateStatementLines(
        existingLines.map((line) => ({
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
        reason ? { reason } : undefined,
      )
      if (!result.ok) {
        setSaving(false)
        setError(result.detail)
        return
      }
    }

    for (const deliveryId of removedDeliveryIds) {
      const result = await deleteDeliveryRecord(deliveryId)
      if (!result.ok) {
        setSaving(false)
        setError(result.detail)
        return
      }
    }

    const newLines = productDrafts.filter((line) => line.isNew)
    for (const line of newLines) {
      const created = await createDeliveryRecord({
        assemblyGroupId: line.assemblyGroupId,
        quantity: Math.max(0, Math.floor(Number(line.quantity) || 0)),
        recordDate: recordDate.trim(),
        shipmentGroupId: shipmentId,
        note: line.note,
      })
      if (!created.ok) {
        setSaving(false)
        setError(created.detail)
        return
      }

      const priceResult = await updateStatementLines(
        [
          {
            source: 'delivery' as const,
            deliveryId: created.record.id,
            orderNumber: line.orderNumber,
            orderLineId: line.orderLineId,
            recordDate: recordDate.trim(),
            productCode: line.productCode,
            productName: line.productName,
            quantity: Math.max(0, Math.floor(Number(line.quantity) || 0)),
            unitPrice: parseMoneyInput(line.unitPrice),
          },
        ],
        reason ? { reason } : undefined,
      )
      if (!priceResult.ok) {
        setSaving(false)
        setError(priceResult.detail)
        return
      }
    }

    setSaving(false)
    setReasonOpen(false)
    onSaved?.('출하 내역을 수정했습니다.')
    onClose()
  }

  async function handleSave() {
    if (hasDraftUnitPriceChange(drafts, initialUnitPricesRef.current)) {
      setReasonOpen(true)
      return
    }
    await commitSave()
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
    const persisted = group.lines.filter((line) => isPersistedDeliveryId(line.id))
    if (!persisted.length) return
    if (
      !(await confirm({
        title: '출하 내역 삭제',
        message: `출하번호 ${shipmentId} 내역 ${persisted.length}건을 삭제할까요?\n삭제 후 누적 출하 수량이 함께 반영됩니다.`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }

    setDeleting(true)
    setError(null)

    for (const line of persisted) {
      const result = await deleteDeliveryRecord(line.id)
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
    <>
    <ErpModal
      open={open && Boolean(group)}
      title="출하"
      description="출하일·수량·단가를 품목별로 수정하고, 행을 추가하거나 삭제할 수 있습니다. 단가는 발주서에 반영됩니다."
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

          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">품목</h3>
            <ErpRowAddButton onClick={addRow} disabled={busy} title="행 추가" />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="erp-data-table erp-data-table--compact min-w-[720px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-2 py-2 text-center">No</th>
                  <th className="px-2 py-2 text-left">발주번호</th>
                  <th className="px-2 py-2 text-left">품목코드</th>
                  <th className="px-2 py-2 text-left">품명</th>
                  <th className="w-[88px] px-2 py-2 text-right">수량</th>
                  <th className="w-[112px] px-2 py-2 text-right">단가</th>
                  <th className="w-[120px] px-2 py-2 text-right">공급가액</th>
                  <th className="w-10 px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {drafts.map((line, index) => {
                  const qty = Math.max(0, Math.floor(Number(line.quantity) || 0))
                  const price = parseMoneyInput(line.unitPrice)
                  const amount = qty * price
                  const isNew = Boolean(line.isNew)
                  const hasProduct = Boolean(line.productCode.trim() || line.productName.trim())
                  const rowOptions = isNew
                    ? findShippableOptionsForProduct(optionsForRow(index, line), customer, {
                        id: '',
                        productCode: line.productCode,
                        productName: line.productName,
                      })
                    : []
                  const canRemove =
                    !line.billingOnly &&
                    productRowCount > 1 &&
                    (isNew || canDelete)
                  return (
                    <tr
                      key={line.key}
                      className={[
                        'border-t border-slate-100',
                        line.billingOnly ? 'bg-amber-50/40' : '',
                      ].join(' ')}
                    >
                      <td className="px-2 py-2 text-center tabular-nums text-slate-500">
                        {index + 1}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs text-slate-600">
                        {line.billingOnly || !isNew ? (
                          displayOrderPoNumber(line.customerPoNumber, line.orderNumber) || '—'
                        ) : !hasProduct ? (
                          <span className="text-slate-400">—</span>
                        ) : rowOptions.length === 0 ? (
                          <span className="block rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-700">
                            발주서 없음
                          </span>
                        ) : rowOptions.length === 1 ? (
                          displayOrderPoNumber(
                            rowOptions[0]!.customerPoNumber,
                            rowOptions[0]!.orderNumber,
                          ) || '—'
                        ) : (
                          <select
                            value={line.assemblyGroupId}
                            disabled={busy}
                            onChange={(event) => selectOrderOption(index, event.target.value)}
                            className={`${cellInputClass} min-w-[120px] text-xs`}
                            aria-label={`${index + 1}행 발주번호 선택`}
                          >
                            <option value="">발주 선택</option>
                            {rowOptions.map((option) => (
                              <option key={option.assemblyGroupId} value={option.assemblyGroupId}>
                                {displayOrderPoNumber(option.customerPoNumber, option.orderNumber)}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className={`px-2 py-2 font-mono text-xs text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                        {line.billingOnly ? (
                          line.productCode || '—'
                        ) : isNew ? (
                          <ProductCombobox
                            value={line.productCode}
                            products={searchableProducts}
                            customer={customer}
                            field="code"
                            placeholder="코드 검색"
                            ariaLabel={`${index + 1}행 품목코드`}
                            inputClassName={`${cellInputClass} min-w-[120px] font-mono`}
                            onValueChange={(productCode) =>
                              patchDraft(index, {
                                productCode,
                                productName: '',
                                assemblyGroupId: '',
                                orderNumber: '',
                                customerPoNumber: '',
                                unitPrice: '0',
                                quantity: '',
                                maxQuantity: 0,
                              })
                            }
                            onProductSelect={(product) => selectProduct(index, product)}
                          />
                        ) : (
                          line.productCode || '—'
                        )}
                      </td>
                      <td className={`px-2 py-2 font-medium text-slate-900 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                        {line.billingOnly ? (
                          <>
                            {line.productName || '—'}
                            <span className="ml-2 text-xs font-semibold text-amber-700">추가작업</span>
                          </>
                        ) : isNew ? (
                          <ProductCombobox
                            value={line.productName}
                            products={searchableProducts}
                            customer={customer}
                            field="name"
                            placeholder="품목명 검색"
                            ariaLabel={`${index + 1}행 품명`}
                            inputClassName={`${cellInputClass} min-w-[140px]`}
                            onValueChange={(productName) =>
                              patchDraft(index, {
                                productName,
                                productCode: '',
                                assemblyGroupId: '',
                                orderNumber: '',
                                customerPoNumber: '',
                                unitPrice: '0',
                                quantity: '',
                                maxQuantity: 0,
                              })
                            }
                            onProductSelect={(product) => selectProduct(index, product)}
                          />
                        ) : (
                          line.productName || '—'
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={line.quantity}
                          placeholder={
                            isNew && (line.maxQuantity || 0) > 0
                              ? `잔량 ${(line.maxQuantity || 0).toLocaleString('ko-KR')}`
                              : undefined
                          }
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
                      <td className="px-1 py-2 text-center">
                        {canRemove ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => removeRow(index)}
                            className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                            aria-label={`${index + 1}행 삭제`}
                          >
                            ×
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <td className="px-2 py-2.5 text-right" colSpan={4}>
                    합계
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {formatCount(totals.quantity)}
                  </td>
                  <td className="px-2 py-2.5" />
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {formatCount(totals.amount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </ErpModal>

    <ChangeReasonModal
      open={reasonOpen}
      saving={saving}
      onCancel={() => {
        if (saving) return
        setReasonOpen(false)
      }}
      onConfirm={(reason) => void commitSave(reason)}
    />
    </>
  )
}
