'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
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
import {
  buildMaterialPurchaseOrderPrintData,
  printMaterialPurchaseOrder,
} from '@/lib/materials/purchase-orders/print-material-purchase-order'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import { addDaysYmd, todayYmdSeoul } from '@/lib/materials/purchase-orders/utils'
import { fetchMaterials } from '@/lib/materials/repository'
import type { Material } from '@/lib/materials/types'
import { ERP_PRIMARY_BUTTON_CLASS, ERP_SECONDARY_BUTTON_CLASS } from '@/lib/ui/tokens'

type MaterialPurchaseOrderModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  order?: MaterialPurchaseOrderListGroup | null
  initialItems?: MaterialPurchaseOrderItemForm[] | null
  initialSupplier?: string
  /** 주문서 카드에서 발주 시 연결할 고객 주문서 id */
  sourceOrderId?: string | null
  /** 부분 발주 — 커버한 주문 라인 / 제품 수량 */
  coveredOrderLineId?: string | null
  coveredProductQuantity?: number | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

function createInitialForm(
  order?: MaterialPurchaseOrderListGroup | null,
  initialSupplier?: string,
): MaterialPurchaseOrderFormState {
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
    deliveryDate: addDaysYmd(today, 42),
    supplier: initialSupplier || '',
  }
}

function MaterialPurchaseOrderModalContent({
  mode,
  order,
  initialItems,
  initialSupplier,
  sourceOrderId,
  coveredOrderLineId,
  coveredProductQuantity,
  onClose,
  onSaved,
  onDeleted,
}: Omit<MaterialPurchaseOrderModalProps, 'open'>) {
  const canDelete = useCanDeleteRecords()
  const [form, setForm] = useState<MaterialPurchaseOrderFormState>(() =>
    createInitialForm(order, initialSupplier),
  )
  const [items, setItems] = useState<MaterialPurchaseOrderItemForm[]>(() => {
    if (order) return materialPurchaseOrderItemsFromDetail(order.items)
    if (initialItems?.length) return initialItems
    return [defaultMaterialPurchaseOrderItemForm()]
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])

  const readOnly = mode === 'edit' && Boolean(order?.hasInbound)
  /** 주문서/제안에서 시드된 신규 발주 — 자재코드·공급사·수량·단가 잠금 */
  const lockSeededFields = mode === 'create' && Boolean(initialItems?.length)

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
    if (lockSeededFields) return
    if (!form.supplier.trim()) {
      updateForm('supplier', supplier)
    }
  }

  async function handleSave(printAfter = false) {
    if (readOnly) return

    if (!form.supplier.trim()) {
      setSaveError('공급사를 입력해 주세요.')
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
      source_order_id: mode === 'create' ? sourceOrderId || null : undefined,
      covered_order_line_id: mode === 'create' ? coveredOrderLineId || null : undefined,
      covered_product_quantity:
        mode === 'create' && coveredProductQuantity != null && coveredProductQuantity > 0
          ? coveredProductQuantity
          : undefined,
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

    if (printAfter) {
      const printed = printMaterialPurchaseOrder(
        buildMaterialPurchaseOrderPrintData({
          orderNumber: result.orderNumber,
          sourceOrderNumber:
            mode === 'create' ? sourceOrderId : order?.sourceOrderId || sourceOrderId,
          orderDate: payload.order_date,
          deliveryDate: payload.delivery_date,
          supplier: payload.supplier,
          items: validation.items,
        }),
      )
      if (!printed) {
        window.alert('발주는 저장됐지만 발주서를 열 수 없습니다. 팝업 차단을 해제해 주세요.')
      }
    }

    onSaved?.()
  }

  function handlePrintOnly() {
    if (!order) return
    const printed = printMaterialPurchaseOrder(
      buildMaterialPurchaseOrderPrintData({
        orderNumber: order.orderNumber,
        sourceOrderNumber: order.sourceOrderId,
        orderDate: order.orderDate || form.orderDate || todayYmdSeoul(),
        deliveryDate: order.deliveryDate || form.deliveryDate || '',
        supplier: order.supplier || form.supplier,
        items: order.items,
      }),
    )
    if (!printed) {
      setSaveError('발주서를 열 수 없습니다. 팝업 차단을 해제해 주세요.')
    }
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
      <div className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === 'edit'
              ? `자재 발주 수정 (${items.length}개 품목)`
              : '신규 자재 발주'}
          </h2>
          <div className="flex items-center gap-2">
            {mode === 'edit' && !readOnly && canDelete ? (
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

          {mode === 'create' && coveredProductQuantity != null && coveredProductQuantity > 0 ? (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
              이 발주서가 커버하는 제품 수량:{' '}
              <span className="font-bold tabular-nums">
                {coveredProductQuantity.toLocaleString('ko-KR')}
              </span>
              개 (주문 카드의 발주 수량에 합산됩니다)
            </div>
          ) : null}

          {mode === 'edit' && order?.coveredProductQuantity ? (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
              주문서 발주 · 커버 제품 수량{' '}
              <span className="font-bold tabular-nums">
                {order.coveredProductQuantity.toLocaleString('ko-KR')}
              </span>
              개
              {order.sourceOrderId ? (
                <span className="ml-2 font-mono text-xs text-slate-500">
                  ({order.sourceOrderId})
                </span>
              ) : null}
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
            {(mode === 'edit' ? order?.sourceOrderId : sourceOrderId) ? (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-600">구분 · 연결 주문서</span>
                <input
                  value={`주문서 · ${(mode === 'edit' ? order?.sourceOrderId : sourceOrderId) || ''}`}
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
                />
              </label>
            ) : mode === 'edit' ? (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-600">구분</span>
                <input
                  value="자재별 발주"
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
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
          </div>

          <div className="mt-6">
            {readOnly ? <h3 className="mb-3 text-sm font-bold text-slate-900">자재</h3> : null}
            {readOnly ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-[720px] w-full border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">자재코드</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">MPN</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">자재명</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">규격</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">공급사</th>
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
                        <td className="px-3 py-2">{order?.supplier || '-'}</td>
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
                lockSeededFields={lockSeededFields}
                onChange={setItems}
                onSupplierChange={(supplier) => updateForm('supplier', supplier)}
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
            className={`${ERP_SECONDARY_BUTTON_CLASS} disabled:opacity-50`}
          >
            {readOnly ? '닫기' : '취소'}
          </button>
          {mode === 'edit' && order ? (
            <button
              type="button"
              onClick={handlePrintOnly}
              disabled={saving || deleting}
              className={`${ERP_SECONDARY_BUTTON_CLASS} disabled:opacity-50`}
            >
              발주서 출력
            </button>
          ) : null}
          {!readOnly ? (
            <>
              <button
                type="button"
                onClick={() => void handleSave(false)}
                disabled={saving || deleting}
                className={`${ERP_PRIMARY_BUTTON_CLASS} disabled:opacity-50`}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                type="button"
                onClick={() => void handleSave(true)}
                disabled={saving || deleting}
                className={`${ERP_SECONDARY_BUTTON_CLASS} disabled:opacity-50`}
              >
                {saving ? '저장 중...' : '저장 후 발주서'}
              </button>
            </>
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
