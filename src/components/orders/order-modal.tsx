'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { OrderItemsForm } from '@/components/orders/order-items-form'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { validateOrderItems } from '@/lib/orders/build-order-payload'
import {
  defaultOrderItemForm,
  orderItemsFromDetail,
  type OrderFormState,
  type OrderItemForm,
} from '@/lib/orders/form-state'
import { createOrder, deleteOrder, updateOrder } from '@/lib/orders/repository'
import { ORDER_CATEGORIES } from '@/lib/orders/types'
import type { OrderListGroup } from '@/lib/orders/types'
import { todayYmdSeoul, validateOrderCodeInput } from '@/lib/orders/utils'
import { formatAutoOrderCodeExample } from '@/lib/orders/order-code-prefix'
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

function createInitialForm(order?: OrderListGroup | null): OrderFormState {
  const today = todayYmdSeoul()
  if (order) {
    return {
      orderCode: order.orderNumber,
      orderDate: order.orderDate || today,
      deliveryDate: order.deliveryDate || '',
      customer: order.customer || '',
      category: order.category,
      note: order.note || '',
    }
  }
  return {
    orderCode: '',
    orderDate: today,
    deliveryDate: '',
    customer: '',
    category: '양산',
    note: '',
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
  const [form, setForm] = useState<OrderFormState>(() => createInitialForm(order))
  const [items, setItems] = useState<OrderItemForm[]>(() =>
    order ? orderItemsFromDetail(order.items) : [defaultOrderItemForm()],
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [salesPartners, setSalesPartners] = useState<BusinessPartner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchProducts().then((result) => {
      if (!cancelled && result.ok) {
        setProducts(result.products)
      }
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

  async function handleSave() {
    const resolvedPartner = resolvePartnerFromInput(salesPartners, form.customer)
    if (!resolvedPartner) {
      setSaveError('거래처등록에 등록된 매출 고객사만 선택할 수 있습니다.')
      return
    }

    const customerName = resolvedPartner.name
    const validation = validateOrderItems(items, products, customerName)
    if (!validation.ok) {
      setSaveError(validation.message)
      return
    }

    const orderCodeResult = validateOrderCodeInput(form.orderCode)
    if (!orderCodeResult.ok) {
      setSaveError(orderCodeResult.message)
      return
    }

    const payload = {
      order_date: form.orderDate || todayYmdSeoul(),
      delivery_date: form.deliveryDate || '',
      customer: customerName,
      category: form.category,
      note: form.note,
      source: order?.source || 'manual',
      source_quote_id: order?.sourceQuoteId || null,
      items: validation.items,
      ...(mode === 'create' && orderCodeResult.code ? { id: orderCodeResult.code } : {}),
    }

    setSaving(true)
    setSaveError(null)

    const result =
      mode === 'edit' && order
        ? await updateOrder(order.orderId, payload)
        : await createOrder(payload)

    setSaving(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onSaved?.()
  }

  async function handleDelete() {
    if (!order) return
    if (!window.confirm(`${order.orderNumber} 주문서를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`)) {
      return
    }

    setDeleting(true)
    setSaveError(null)

    const result = await deleteOrder(order.orderId)
    setDeleting(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onDeleted?.()
  }

  const busy = saving || deleting

  return (
    <ErpModal
      open
      size="xl"
      title={mode === 'edit' ? `주문서 수정 (${items.length}개 제품)` : '신규 주문서'}
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-col gap-2">
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {mode === 'edit' && canDelete ? (
              <ErpButton variant="danger" onClick={() => void handleDelete()} disabled={busy}>
                {deleting ? '삭제 중…' : '삭제'}
              </ErpButton>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <ErpButton variant="secondary" onClick={onClose} disabled={busy}>
                취소
              </ErpButton>
              <ErpButton onClick={() => void handleSave()} disabled={busy}>
                {saving ? '저장 중…' : '저장'}
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>고객사</span>
          <CustomerCombobox
            value={form.customer}
            partners={salesPartners}
            placeholder="거래처명 검색 (예: 센서)"
            inputClassName={ERP_FIELD_INPUT_CLASS}
            onValueChange={(value) => updateForm('customer', value)}
            onPartnerSelect={(partner) => updateForm('customer', partner.name)}
          />
          <p className="mt-1 text-xs text-slate-500">
            {partnersLoading
              ? '매출 거래처 목록을 불러오는 중...'
              : salesPartners.length === 0
                ? '등록된 매출 거래처가 없습니다. 기초등록 → 거래처등록에서 먼저 등록해 주세요.'
                : '거래처등록의 매출·매입/매출 거래처만 선택할 수 있습니다.'}
          </p>
        </label>
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>주문서번호</span>
          {mode === 'edit' && order ? (
            <input
              value={order.orderNumber}
              readOnly
              className={`${ERP_FIELD_INPUT_CLASS} bg-slate-50 font-mono text-xs text-slate-600`}
            />
          ) : (
            <>
              <input
                value={form.orderCode}
                onChange={(event) => updateForm('orderCode', event.target.value.toUpperCase())}
                placeholder="주문서번호"
                className={`${ERP_FIELD_INPUT_CLASS} font-mono uppercase placeholder:normal-case placeholder:text-slate-400`}
                autoCapitalize="characters"
                spellCheck={false}
              />
              <p className="mt-1 text-xs text-slate-500">
                {form.customer.trim()
                  ? `비우면 ${formatAutoOrderCodeExample(form.customer)} 형식으로 자동 발급됩니다.`
                  : '비우면 고객사명 접두사로 자동 발급됩니다. (예: 서창 → SC-0001)'}
              </p>
            </>
          )}
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <span className={ERP_FIELD_LABEL_CLASS}>주문일</span>
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
          onChange={setItems}
        />
      </div>

      <label className="mt-6 block text-sm">
        <span className={ERP_FIELD_LABEL_CLASS}>비고</span>
        <textarea
          value={form.note}
          onChange={(event) => updateForm('note', event.target.value)}
          rows={2}
          placeholder="주문서 비고"
          className={ERP_FIELD_INPUT_CLASS}
        />
      </label>
    </ErpModal>
  )
}

export function OrderModal({ open, ...props }: OrderModalProps) {
  if (!open) return null
  return <OrderModalContent {...props} />
}
