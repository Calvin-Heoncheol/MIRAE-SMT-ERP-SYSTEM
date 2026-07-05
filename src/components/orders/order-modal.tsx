'use client'

import { useEffect, useState } from 'react'
import { OrderItemsForm } from '@/components/orders/order-items-form'
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
import { addDaysYmd, todayYmdSeoul } from '@/lib/orders/utils'
import { fetchProducts } from '@/lib/products/repository'
import type { Product } from '@/lib/products/types'

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
      orderDate: order.orderDate || today,
      deliveryDate: order.deliveryDate || '',
      customer: order.customer || '',
      category: order.category,
    }
  }
  return {
    orderDate: today,
    deliveryDate: addDaysYmd(today, 30),
    customer: '',
    category: '양산',
  }
}

function OrderModalContent({
  mode,
  order,
  onClose,
  onSaved,
  onDeleted,
}: Omit<OrderModalProps, 'open'>) {
  const [form, setForm] = useState<OrderFormState>(() => createInitialForm(order))
  const [items, setItems] = useState<OrderItemForm[]>(() =>
    order ? orderItemsFromDetail(order.items) : [defaultOrderItemForm()],
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])

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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deleting) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, deleting])

  function updateForm<K extends keyof OrderFormState>(key: K, value: OrderFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSave() {
    const validation = validateOrderItems(items, products, form.customer.trim())
    if (!validation.ok) {
      setSaveError(validation.message)
      return
    }

    if (!form.customer.trim()) {
      setSaveError('고객사를 입력해 주세요.')
      return
    }

    const payload = {
      order_date: form.orderDate || todayYmdSeoul(),
      delivery_date: form.deliveryDate || '',
      customer: form.customer.trim(),
      category: form.category,
      source: order?.source || 'manual',
      source_quote_id: order?.sourceQuoteId || null,
      items: validation.items,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === 'edit' ? `주문서 수정 (${items.length}개 제품)` : '신규 주문서'}
          </h2>
          <div className="flex items-center gap-2">
            {mode === 'edit' ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="inline-flex items-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-2xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mode === 'edit' && order ? (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-600">주문코드</span>
                <input
                  value={order.orderNumber}
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
                />
              </label>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">구분</span>
              <select
                value={form.category}
                onChange={(event) => updateForm('category', event.target.value as OrderFormState['category'])}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                {ORDER_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">주문일</span>
              <input
                type="date"
                value={form.orderDate}
                onChange={(event) => updateForm('orderDate', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">납기일</span>
              <input
                type="date"
                value={form.deliveryDate}
                onChange={(event) => updateForm('deliveryDate', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">고객사</span>
              <input
                value={form.customer}
                onChange={(event) => updateForm('customer', event.target.value)}
                placeholder="고객사명"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-bold text-slate-900">제품</h3>
            <OrderItemsForm
              items={items}
              customer={form.customer}
              products={products}
              onChange={setItems}
            />
          </div>

          {saveError ? <p className="mt-4 text-sm text-red-600">{saveError}</p> : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function OrderModal({ open, ...props }: OrderModalProps) {
  if (!open) return null
  return <OrderModalContent {...props} />
}
