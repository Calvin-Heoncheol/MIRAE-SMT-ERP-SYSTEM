'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords, useAuthProfile } from '@/components/auth/auth-profile-provider'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { OrderItemsForm } from '@/components/orders/order-items-form'
import { EntityChangeHistoryButton } from '@/components/change-logs/entity-change-history-button'
import { ChangeReasonModal } from '@/components/change-logs/change-reason-modal'
import { useBusy } from '@/components/ui/busy-provider'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import { validateOrderItems } from '@/lib/orders/build-order-payload'
import {
  defaultOrderItemForm,
  orderItemsFromDetail,
  type OrderFormState,
  type OrderItemForm,
} from '@/lib/orders/form-state'
import { buildOrderPrintData, printOrder } from '@/lib/orders/print-order'
import { createOrder, deleteOrder, updateOrder } from '@/lib/orders/repository'
import { ORDER_CATEGORIES, ORDER_CURRENCIES, ORDER_CURRENCY_LABELS } from '@/lib/orders/types'
import type { OrderCurrency, OrderListGroup, OrderRowPayload } from '@/lib/orders/types'
import { normalizeOrderCurrency, todayYmdSeoul } from '@/lib/orders/utils'
import { hasOrderUnitPriceChange } from '@/lib/change-logs/utils'
import { fetchProducts } from '@/lib/products/repository'
import type { Product } from '@/lib/products/types'
import { fetchSalesBusinessPartners } from '@/lib/partners/repository'
import type { BusinessPartner } from '@/lib/partners/types'
import { resolvePartnerFromInput } from '@/lib/partners/utils'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

type OrderModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  order?: OrderListGroup | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

function CancelButton({ disabled }: { disabled?: boolean }) {
  const requestClose = useErpModalRequestClose()
  return (
    <ErpButton variant="secondary" disabled={disabled} onClick={() => requestClose?.()}>
      취소
    </ErpButton>
  )
}

function createInitialForm(order?: OrderListGroup | null): OrderFormState {
  const today = todayYmdSeoul()
  if (order) {
    return {
      orderCode: order.orderNumber,
      orderDate: order.orderDate || today,
      deliveryDate: order.deliveryDate || '',
      customer: order.customer || '',
      category: order.category,
      currency: normalizeOrderCurrency(order.currency),
      note: order.note || '',
      customerPoNumber: order.customerPoNumber || '',
    }
  }
  return {
    orderCode: '',
    orderDate: today,
    deliveryDate: '',
    customer: '',
    category: '양산',
    currency: 'KRW',
    note: '',
    customerPoNumber: '',
  }
}

function OrderModalContent({
  mode,
  order,
  onClose,
  onSaved,
  onDeleted,
}: Omit<OrderModalProps, 'open'>) {
  const canDelete = useCanDeleteRecords()
  const { profile } = useAuthProfile()
  const contactEmail = String(profile?.email || '').trim()
  const [form, setForm] = useState<OrderFormState>(() => createInitialForm(order))
  const [items, setItems] = useState<OrderItemForm[]>(() =>
    order
      ? orderItemsFromDetail(order.items, order.deliveryDate)
      : [defaultOrderItemForm()],
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [salesPartners, setSalesPartners] = useState<BusinessPartner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(true)
  const [pendingPayload, setPendingPayload] = useState<OrderRowPayload | null>(null)
  const [reasonOpen, setReasonOpen] = useState(false)

  const busyUi = useBusy()
  const { notifyAuthOrFailure, toast } = useWriteFailureToast()

  useEffect(() => {
    setForm(createInitialForm(order))
    setItems(
      order ? orderItemsFromDetail(order.items, order.deliveryDate) : [defaultOrderItemForm()],
    )
    setSaveError(null)
  }, [order, mode])

  useEffect(() => {
    let cancelled = false
    void fetchProducts().then((productsResult) => {
      if (cancelled) return
      if (productsResult.ok) setProducts(productsResult.products)
      else toast.error('품목 목록을 불러오지 못했습니다', productsResult.detail)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setPartnersLoading(true)
    fetchSalesBusinessPartners().then((result) => {
      if (cancelled) return
      setPartnersLoading(false)
      if (result.ok) {
        setSalesPartners(result.partners)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  function updateForm<K extends keyof OrderFormState>(key: K, value: OrderFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function commitSave(payload: OrderRowPayload, reason?: string) {
    setSaving(true)
    setSaveError(null)

    const result = await busyUi.run(() =>
      mode === 'edit' && order
        ? updateOrder(order.orderId, payload, reason ? { reason } : undefined)
        : createOrder(payload),
    )

    setSaving(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setSaveError(result.detail)
      return
    }

    if (result.changeLogWarning) {
      toast.info('변경이력 미기록', result.changeLogWarning)
    }

    setReasonOpen(false)
    setPendingPayload(null)
    onSaved?.()
  }

  async function handleSave() {
    const resolvedPartner = resolvePartnerFromInput(salesPartners, form.customer)
    if (!resolvedPartner) {
      setSaveError('거래처등록에 등록된 거래처만 선택할 수 있습니다.')
      return
    }

    const headerDeliveryDate = String(form.deliveryDate || '').trim()
    if (!headerDeliveryDate) {
      setSaveError('납기일을 입력하세요.')
      return
    }

    const customerName = resolvedPartner.name
    const validation = validateOrderItems(items, products, customerName, headerDeliveryDate)
    if (!validation.ok) {
      setSaveError(validation.message)
      return
    }

    const payload: OrderRowPayload = {
      order_date: form.orderDate || todayYmdSeoul(),
      delivery_date: headerDeliveryDate,
      customer: customerName,
      category: form.category,
      currency: normalizeOrderCurrency(form.currency),
      note: form.note,
      customer_po_number: form.customerPoNumber,
      source: order?.source || 'manual',
      source_quote_id: order?.sourceQuoteId || null,
      items: validation.items.map(
        ({ productId, productCode, productName, quantity, unitPrice, orderAmount, deliveryDate }) => ({
          productId,
          productCode,
          productName,
          quantity,
          unitPrice,
          orderAmount,
          deliveryDate,
        }),
      ),
    }

    if (
      mode === 'edit' &&
      order &&
      hasOrderUnitPriceChange(order.items, payload.items)
    ) {
      setPendingPayload(payload)
      setReasonOpen(true)
      return
    }

    await commitSave(payload)
  }

  async function handleDelete() {
    if (!order) return
    if (!window.confirm(`${order.customerPoNumber || order.orderNumber} 발주서를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`)) {
      return
    }

    setDeleting(true)
    setSaveError(null)

    const result = await busyUi.run(() => deleteOrder(order.orderId))
    setDeleting(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setSaveError(result.detail)
      return
    }

    onDeleted?.()
  }

  const busy = saving || deleting

  return (
    <ErpModal
      open
      size="lg"
      title={mode === 'edit' ? `발주서 수정 (${items.length}개 제품)` : '신규 발주서'}
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-col gap-2">
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {mode === 'edit' && canDelete ? (
              <div className="flex flex-wrap gap-2">
                <ErpButton
                  variant="danger"
                  onClick={() => void handleDelete()}
                  disabled={busy}
                  loading={deleting}
                >
                  삭제
                </ErpButton>
                {order ? (
                  <EntityChangeHistoryButton entityType="order" entityId={order.orderId} disabled={busy} />
                ) : null}
              </div>
            ) : mode === 'edit' && order ? (
              <EntityChangeHistoryButton entityType="order" entityId={order.orderId} disabled={busy} />
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {mode === 'edit' && order ? (
                <ErpButton
                  variant="secondary"
                  onClick={() => {
                    const ok = printOrder({
                      ...buildOrderPrintData(order),
                      ...(contactEmail ? { contactEmail } : {}),
                    })
                    if (!ok) setSaveError('발주서를 열 수 없습니다. 팝업 차단을 해제해 주세요.')
                  }}
                  disabled={busy}
                >
                  발주서 인쇄
                </ErpButton>
              ) : null}
              <CancelButton disabled={busy} />
              <ErpButton onClick={() => void handleSave()} disabled={busy} loading={saving}>
                저장
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <div lang="ko">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>고객사</span>
          <CustomerCombobox
            value={form.customer}
            partners={salesPartners}
            placeholder="거래처명 검색 (예: 센서)"
            inputClassName={ERP_FIELD_INPUT_CLASS}
            autoFocus={mode === 'create'}
            onValueChange={(value) => updateForm('customer', value)}
            onPartnerSelect={(partner) => updateForm('customer', partner.name)}
          />
          <p className="mt-1 text-xs text-slate-500">
            {partnersLoading
              ? '거래처 목록을 불러오는 중...'
              : salesPartners.length === 0
                ? '등록된 거래처가 없습니다. 기초등록 → 거래처등록에서 먼저 등록해 주세요.'
                : '거래처등록의 거래처를 검색해 선택하세요.'}
          </p>
        </label>
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>발주번호</span>
          <input
            value={form.customerPoNumber}
            onChange={(event) => updateForm('customerPoNumber', event.target.value)}
            placeholder={
              mode === 'create'
                ? '비우면 발주ID와 동일하게 자동 발급'
                : '고객사 PO/NO (나중에 입력·수정 가능)'
            }
            className={ERP_FIELD_INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-slate-500">
            {mode === 'create'
              ? '입력하지 않으면 저장 시 MRO-YYMMDD-NN 형식으로 자동 발급됩니다. 고객 PO를 받으면 나중에 수정할 수 있습니다.'
              : '고객 발주서를 늦게 받아도 이 칸만 수정하면 됩니다.'}
          </p>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>구분</span>
          <select
            value={form.category}
            onChange={(event) => updateForm('category', event.target.value as OrderFormState['category'])}
            className={ERP_FIELD_INPUT_CLASS}
          >
            {ORDER_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>통화</span>
          <select
            value={form.currency}
            onChange={(event) =>
              updateForm('currency', event.target.value as OrderCurrency)
            }
            className={ERP_FIELD_INPUT_CLASS}
          >
            {ORDER_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {ORDER_CURRENCY_LABELS[currency]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>발주일</span>
          <input
            type="date"
            value={form.orderDate}
            onChange={(event) => updateForm('orderDate', event.target.value)}
            className={ERP_FIELD_INPUT_CLASS}
          />
        </label>
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>납기일</span>
          <input
            type="date"
            value={form.deliveryDate}
            onChange={(event) => updateForm('deliveryDate', event.target.value)}
            className={ERP_FIELD_INPUT_CLASS}
          />
        </label>
      </div>

      <div className="mt-6">
        <OrderItemsForm
          items={items}
          customer={resolvePartnerFromInput(salesPartners, form.customer)?.name ?? form.customer}
          products={products}
          currency={form.currency}
          onChange={setItems}
        />
      </div>

      <label className="mt-6 block text-sm">
        <span className={ERP_FIELD_LABEL_CLASS}>비고</span>
        <textarea
          value={form.note}
          onChange={(event) => updateForm('note', event.target.value)}
          rows={2}
          placeholder="발주서 비고"
          lang="ko"
          className={ERP_FIELD_INPUT_CLASS}
          style={{ imeMode: 'active' }}
        />
      </label>
      </div>

      <ChangeReasonModal
        open={reasonOpen}
        saving={saving}
        onCancel={() => {
          if (saving) return
          setReasonOpen(false)
          setPendingPayload(null)
        }}
        onConfirm={(reason) => {
          if (!pendingPayload) return
          void commitSave(pendingPayload, reason)
        }}
      />
    </ErpModal>
  )
}

export function OrderModal({ open, ...props }: OrderModalProps) {
  if (!open) return null
  return <OrderModalContent {...props} />
}
