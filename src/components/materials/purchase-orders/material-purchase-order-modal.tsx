'use client'

import { useEffect, useState } from 'react'
import { MaterialPurchaseOrderItemsForm } from '@/components/materials/purchase-orders/material-purchase-order-items-form'
import { validateMaterialPurchaseOrderItems } from '@/lib/materials/purchase-orders/build-payload'
import {
  defaultMaterialPurchaseOrderItemForm,
  materialPurchaseOrderItemsFromDetail,
  type MaterialPurchaseOrderFormState,
  type MaterialPurchaseOrderItemForm,
} from '@/lib/materials/purchase-orders/form-state'
import {
  createMaterialPurchaseOrder,
  deleteMaterialPurchaseOrder,
  updateMaterialPurchaseOrder,
} from '@/lib/materials/purchase-orders/repository'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import { addDaysYmd, todayYmdSeoul } from '@/lib/materials/purchase-orders/utils'
import { fetchMaterials } from '@/lib/materials/repository'
import type { Material } from '@/lib/materials/types'

type MaterialPurchaseOrderModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  order?: MaterialPurchaseOrderListGroup | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

function createInitialForm(order?: MaterialPurchaseOrderListGroup | null): MaterialPurchaseOrderFormState {
  const today = todayYmdSeoul()
  if (order) {
    return {
      orderDate: order.orderDate || today,
      deliveryDate: order.deliveryDate || '',
      supplier: order.supplier || '',
    }
  }
  return {
    orderDate: today,
    deliveryDate: addDaysYmd(today, 14),
    supplier: '',
  }
}

function MaterialPurchaseOrderModalContent({
  mode,
  order,
  onClose,
  onSaved,
  onDeleted,
}: Omit<MaterialPurchaseOrderModalProps, 'open'>) {
  const [form, setForm] = useState<MaterialPurchaseOrderFormState>(() => createInitialForm(order))
  const [items, setItems] = useState<MaterialPurchaseOrderItemForm[]>(() =>
    order ? materialPurchaseOrderItemsFromDetail(order.items) : [defaultMaterialPurchaseOrderItemForm()],
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])

  const readOnly = mode === 'edit' && Boolean(order?.hasInbound)

  useEffect(() => {
    let cancelled = false
    fetchMaterials().then((result) => {
      if (!cancelled && result.ok) {
        setMaterials(result.materials)
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

  function updateForm<K extends keyof MaterialPurchaseOrderFormState>(
    key: K,
    value: MaterialPurchaseOrderFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function suggestSupplier(supplier: string) {
    if (!form.supplier.trim()) {
      updateForm('supplier', supplier)
    }
  }

  async function handleSave() {
    if (readOnly) return

    if (!form.supplier.trim()) {
      setSaveError('공급업체를 입력해 주세요.')
      return
    }

    const validation = validateMaterialPurchaseOrderItems(items, materials, form.supplier.trim())
    if (!validation.ok) {
      setSaveError(validation.message)
      return
    }

    const payload = {
      order_date: form.orderDate || todayYmdSeoul(),
      delivery_date: form.deliveryDate || '',
      supplier: form.supplier.trim(),
      items: validation.items,
    }

    setSaving(true)
    setSaveError(null)

    const result =
      mode === 'edit' && order
        ? await updateMaterialPurchaseOrder(order.orderId, payload)
        : await createMaterialPurchaseOrder(payload)

    setSaving(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onSaved?.()
  }

  async function handleDelete() {
    if (!order || readOnly) return
    if (!window.confirm(`${order.orderNumber} 발주를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`)) {
      return
    }

    setDeleting(true)
    setSaveError(null)

    const result = await deleteMaterialPurchaseOrder(order.orderId)
    setDeleting(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onDeleted?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === 'edit'
              ? `자재 발주 수정 (${items.length}개 품목)`
              : '신규 자재 발주'}
          </h2>
          <div className="flex items-center gap-2">
            {mode === 'edit' && !readOnly ? (
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
          {readOnly ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              입고 이력이 있는 발주는 수정·삭제할 수 없습니다.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mode === 'edit' && order ? (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-600">발주번호</span>
                <input
                  value={order.orderNumber}
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
                />
              </label>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">발주일</span>
              <input
                type="date"
                value={form.orderDate}
                onChange={(event) => updateForm('orderDate', event.target.value)}
                readOnly={readOnly}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">납기일</span>
              <input
                type="date"
                value={form.deliveryDate}
                onChange={(event) => updateForm('deliveryDate', event.target.value)}
                readOnly={readOnly}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">공급업체</span>
              <input
                value={form.supplier}
                onChange={(event) => updateForm('supplier', event.target.value)}
                placeholder="공급업체명"
                readOnly={readOnly}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50"
              />
            </label>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-bold text-slate-900">자재</h3>
            {readOnly ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-[720px] w-full border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">자재코드</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">MPN</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">자재명</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">규격</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">수량</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">단가</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order?.items.map((item, index) => (
                      <tr key={item.lineId || index} className="border-t border-slate-100">
                        <td className="px-3 py-2">{item.materialCode || '-'}</td>
                        <td className="px-3 py-2">{item.mpn || '-'}</td>
                        <td className="px-3 py-2">{item.materialName}</td>
                        <td className="px-3 py-2">{item.specification || '-'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.quantity.toLocaleString('ko-KR')}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.unitPrice.toLocaleString('ko-KR')}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.orderAmount.toLocaleString('ko-KR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <MaterialPurchaseOrderItemsForm
                items={items}
                supplier={form.supplier}
                materials={materials}
                onChange={setItems}
                onSupplierSuggest={suggestSupplier}
              />
            )}
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
            {readOnly ? '닫기' : '취소'}
          </button>
          {!readOnly ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function MaterialPurchaseOrderModal({ open, ...props }: MaterialPurchaseOrderModalProps) {
  if (!open) return null
  return <MaterialPurchaseOrderModalContent {...props} />
}
