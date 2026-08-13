'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import {
  MaterialPurchaseAssistPanel,
  type PurchaseAssistFillPayload,
} from '@/components/materials/purchase-orders/material-purchase-assist-panel'
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
  fetchMaterialPurchaseOrderRegisterData,
  updateMaterialPurchaseOrder,
} from '@/lib/materials/purchase-orders/repository'
import {
  buildMaterialPurchaseOrderPrintData,
  printMaterialPurchaseOrder,
} from '@/lib/materials/purchase-orders/print-material-purchase-order'
import type {
  MaterialPurchaseOrderListGroup,
  MaterialPurchaseSuggestionLine,
  OrderPurchaseCard,
} from '@/lib/materials/purchase-orders/types'
import {
  addDaysYmd,
  latestMaterialPurchaseOrderDeliveryDate,
  todayYmdSeoul,
} from '@/lib/materials/purchase-orders/utils'
import type { BomEdge } from '@/lib/materials/outbound/types'
import { fetchMaterials } from '@/lib/materials/repository'
import type { Material } from '@/lib/materials/types'
import { resolveMaterialByInventoryCode } from '@/lib/materials/utils'
import { ERP_PRIMARY_BUTTON_CLASS, ERP_SECONDARY_BUTTON_CLASS } from '@/lib/ui/tokens'

type MaterialPurchaseOrderModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  order?: MaterialPurchaseOrderListGroup | null
  initialItems?: MaterialPurchaseOrderItemForm[] | null
  initialSupplier?: string
  /** 구매발주 화면에서 이미 로드한 자재 목록 (부분구매발주 시드용) */
  initialMaterials?: Material[] | null
  /** 발주서 카드에서 구매발주 시 연결할 고객 발주서 id */
  sourceOrderId?: string | null
  /** 부분 구매발주 — 커버한 주문 라인 / 제품 수량 */
  coveredOrderLineId?: string | null
  coveredProductQuantity?: number | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

function mergeMaterialLists(base: Material[], extra: Material[]) {
  if (!extra.length) return base
  const byId = new Map<string, Material>()
  for (const material of [...base, ...extra]) {
    const id = material.id.trim()
    if (!id) continue
    byId.set(id.toLowerCase(), material)
  }
  return [...byId.values()]
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
  initialMaterials,
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
    const defaultDelivery = createInitialForm(order, initialSupplier).deliveryDate
    if (order) {
      return materialPurchaseOrderItemsFromDetail(order.items).map((item) => ({
        ...item,
        deliveryDate: item.deliveryDate || order.deliveryDate || defaultDelivery,
      }))
    }
    if (initialItems?.length) {
      return initialItems.map((item) => ({
        ...defaultMaterialPurchaseOrderItemForm(defaultDelivery),
        ...item,
        deliveryDate: item.deliveryDate || defaultDelivery,
      }))
    }
    // 신규 수동 구매발주: 입력표 3행으로 시작
    return [
      defaultMaterialPurchaseOrderItemForm(defaultDelivery),
      defaultMaterialPurchaseOrderItemForm(defaultDelivery),
      defaultMaterialPurchaseOrderItemForm(defaultDelivery),
    ]
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [materials, setMaterials] = useState<Material[]>(() => initialMaterials ?? [])
  const [assistMode, setAssistMode] = useState<'order' | 'stock' | null>(null)
  const [assistLoading, setAssistLoading] = useState(false)
  const [assistError, setAssistError] = useState<string | null>(null)
  const [orderCards, setOrderCards] = useState<OrderPurchaseCard[]>([])
  const [suggestionLines, setSuggestionLines] = useState<MaterialPurchaseSuggestionLine[]>([])
  const [bomEdges, setBomEdges] = useState<BomEdge[]>([])
  const [onHandByMaterialId, setOnHandByMaterialId] = useState<Record<string, number>>({})
  const [registerLoaded, setRegisterLoaded] = useState(false)
  const [coverSourceOrderId, setCoverSourceOrderId] = useState<string | null>(
    sourceOrderId ?? null,
  )
  const [coverOrderLineId, setCoverOrderLineId] = useState<string | null>(
    coveredOrderLineId ?? null,
  )
  const [coverProductQuantity, setCoverProductQuantity] = useState<number | null>(
    coveredProductQuantity != null && coveredProductQuantity > 0
      ? coveredProductQuantity
      : null,
  )

  const readOnly = mode === 'edit' && Boolean(order?.hasInbound)
  /** 발주서/제안에서 시드된 신규 구매발주 — 자재코드·공급사·수량·단가 잠금 */
  const lockSeededFields = mode === 'create' && Boolean(initialItems?.length)

  async function ensureRegisterData() {
    if (registerLoaded) return true
    setAssistLoading(true)
    setAssistError(null)
    const result = await fetchMaterialPurchaseOrderRegisterData()
    setAssistLoading(false)
    if (!result.ok) {
      setAssistError(result.detail)
      return false
    }
    setOrderCards(result.cards)
    setSuggestionLines(result.suggestionLines)
    setBomEdges(result.bomEdges)
    setOnHandByMaterialId(result.onHandByMaterialId)
    setMaterials((current) => mergeMaterialLists(current, result.materials))
    setRegisterLoaded(true)
    return true
  }

  async function openAssist(next: 'order' | 'stock') {
    const ok = await ensureRegisterData()
    if (!ok) return
    setAssistMode(next)
  }

  function applyAssistFill(payload: PurchaseAssistFillPayload) {
    const defaultDelivery = form.deliveryDate
    setItems(
      payload.items.map((item) => ({
        ...defaultMaterialPurchaseOrderItemForm(defaultDelivery),
        ...item,
        deliveryDate: item.deliveryDate || defaultDelivery,
      })),
    )
    if (payload.supplier.trim()) {
      setForm((current) => ({
        ...current,
        supplier: current.supplier.trim() || payload.supplier.trim(),
      }))
    }
    setCoverSourceOrderId(payload.sourceOrderId ?? null)
    setCoverOrderLineId(payload.coveredOrderLineId ?? null)
    setCoverProductQuantity(
      payload.coveredProductQuantity != null && payload.coveredProductQuantity > 0
        ? payload.coveredProductQuantity
        : null,
    )
    setAssistMode(null)
  }

  useEffect(() => {
    let cancelled = false
    fetchMaterials().then((result) => {
      if (cancelled || !result.ok) return
      setMaterials((current) => mergeMaterialLists(result.materials, current))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!initialMaterials?.length) return
    setMaterials((current) => mergeMaterialLists(current, initialMaterials))
  }, [initialMaterials])

  // 부분구매발주·구매발주제안에서 넘어온 행: 품목 마스터로 MPN·규격·자재명 보강
  useEffect(() => {
    if (!lockSeededFields || !materials.length) return
    setItems((current) => {
      let changed = false
      const next = current.map((item) => {
        const code = (item.materialId || item.materialCode || '').trim()
        if (!code) return item
        const matched = resolveMaterialByInventoryCode(materials, code)
        if (!matched) return item
        const needsEnrich =
          !item.mpn.trim() ||
          !item.specification.trim() ||
          !item.materialName.trim() ||
          item.materialName.trim() === code
        if (!needsEnrich && item.materialId === matched.id) return item
        changed = true
        return {
          ...item,
          materialId: matched.id,
          materialCode: matched.id,
          materialName: matched.materialName || item.materialName,
          specification: matched.specification || item.specification,
          mpn: matched.mpn || item.mpn,
          unitPrice:
            Math.round(Number(item.unitPrice) || 0) > 0
              ? item.unitPrice
              : String(matched.unitPrice || 0),
        }
      })
      return changed ? next : current
    })
  }, [materials, lockSeededFields])

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
    setForm((current) => {
      if (key === 'deliveryDate') {
        const previous = current.deliveryDate
        const nextDate = String(value || '')
        setItems((rows) =>
          rows.map((item) =>
            !item.deliveryDate || item.deliveryDate === previous
              ? { ...item, deliveryDate: nextDate }
              : item,
          ),
        )
      }
      return { ...current, [key]: value }
    })
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

    const validation = validateMaterialPurchaseOrderItems(
      items,
      materials,
      form.supplier.trim(),
      form.deliveryDate,
    )
    if (!validation.ok) {
      setSaveError(validation.message)
      return
    }

    const headerDelivery =
      latestMaterialPurchaseOrderDeliveryDate(validation.items.map((item) => item.deliveryDate)) ||
      form.deliveryDate ||
      ''

    const payload = {
      order_date: form.orderDate || todayYmdSeoul(),
      delivery_date: headerDelivery,
      supplier: form.supplier.trim(),
      source_order_id: mode === 'create' ? coverSourceOrderId || null : undefined,
      covered_order_line_id: mode === 'create' ? coverOrderLineId || null : undefined,
      covered_product_quantity:
        mode === 'create' && coverProductQuantity != null && coverProductQuantity > 0
          ? coverProductQuantity
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
            mode === 'create' ? coverSourceOrderId : order?.sourceOrderId || coverSourceOrderId,
          orderDate: payload.order_date,
          deliveryDate: payload.delivery_date,
          supplier: payload.supplier,
          items: validation.items,
        }),
      )
      if (!printed) {
        window.alert('구매발주는 저장됐지만 구매발주서를 열 수 없습니다. 팝업 차단을 해제해 주세요.')
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
      setSaveError('구매발주서를 열 수 없습니다. 팝업 차단을 해제해 주세요.')
    }
  }

  async function handleDelete() {
    if (!order || readOnly) return
    if (!window.confirm(`${order.orderNumber} 구매발주를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`)) {
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
      <div className="relative flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === 'edit'
              ? `구매발주 수정 (${items.length}개 품목)`
              : '신규 구매발주'}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {mode === 'create' && !readOnly ? (
              <>
                <button
                  type="button"
                  onClick={() => void openAssist('order')}
                  disabled={assistLoading || saving || deleting}
                  className={`${ERP_SECONDARY_BUTTON_CLASS} disabled:opacity-50`}
                >
                  {assistLoading && assistMode == null ? '불러오는 중…' : '발주서'}
                </button>
                <button
                  type="button"
                  onClick={() => void openAssist('stock')}
                  disabled={assistLoading || saving || deleting}
                  className={`${ERP_SECONDARY_BUTTON_CLASS} disabled:opacity-50`}
                >
                  재고현황
                </button>
              </>
            ) : null}
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
              입고 이력이 있는 구매발주는 수정·삭제할 수 없습니다.
            </div>
          ) : null}

          {assistError ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {assistError}
            </div>
          ) : null}

          {mode === 'create' && coverProductQuantity != null && coverProductQuantity > 0 ? (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
              이 구매발주서가 커버하는 제품 수량:{' '}
              <span className="font-bold tabular-nums">
                {coverProductQuantity.toLocaleString('ko-KR')}
              </span>
              개 (발주서 카드의 구매발주 수량에 합산됩니다)
              {coverSourceOrderId ? (
                <span className="ml-2 font-mono text-xs text-slate-500">({coverSourceOrderId})</span>
              ) : null}
            </div>
          ) : null}

          {mode === 'edit' && order?.coveredProductQuantity ? (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
              부분 구매발주 · 커버 제품 수량{' '}
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
                <span className="mb-1 block font-medium text-slate-600">구매발주번호</span>
                <input
                  value={order.orderNumber}
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
                />
              </label>
            ) : null}
            {(mode === 'edit' ? order?.sourceOrderId : coverSourceOrderId) ? (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-600">구분 · 연결 발주서</span>
                <input
                  value={`부분 구매발주 · ${(mode === 'edit' ? order?.sourceOrderId : coverSourceOrderId) || ''}`}
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
                />
              </label>
            ) : mode === 'edit' ? (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-600">구분</span>
                <input
                  value="자재별 구매발주"
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                />
              </label>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">구매발주일</span>
              <input
                type="date"
                value={form.orderDate}
                onChange={(event) => updateForm('orderDate', event.target.value)}
                readOnly={readOnly}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">공급사</span>
              <input
                value={form.supplier}
                onChange={(event) => updateForm('supplier', event.target.value)}
                readOnly={readOnly || lockSeededFields}
                placeholder="공급사명"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50 read-only:bg-slate-50"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">기본 납기일</span>
              <input
                type="date"
                value={form.deliveryDate}
                onChange={(event) => updateForm('deliveryDate', event.target.value)}
                readOnly={readOnly}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50"
              />
              <span className="mt-1 block text-xs text-slate-500">
                행에 비어 있는 납기일자를 채우고, 목록 요약에도 사용됩니다.
              </span>
            </label>
          </div>

          <div className="mt-6">
            {readOnly ? <h3 className="mb-3 text-sm font-bold text-slate-900">구매발주 품목</h3> : null}
            {readOnly ? (
              <div className="overflow-x-auto rounded-lg border border-slate-300">
                <table className="min-w-[760px] w-full border-collapse text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                        품목코드
                      </th>
                      <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                        품목명
                      </th>
                      <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                        규격
                      </th>
                      <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                        수량
                      </th>
                      <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                        단가
                      </th>
                      <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                        공급가액
                      </th>
                      <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                        납기일자
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {order?.items.map((item, index) => (
                      <tr key={item.lineId || index} className="border-t border-slate-200">
                        <td className="px-2.5 py-2 text-center">{item.materialCode || '-'}</td>
                        <td className="px-2.5 py-2">{item.materialName}</td>
                        <td className="px-2.5 py-2">{item.specification || '-'}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums">
                          {item.quantity.toLocaleString('ko-KR')}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums">
                          {item.unitPrice.toLocaleString('ko-KR')}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums">
                          {item.orderAmount.toLocaleString('ko-KR')}
                        </td>
                        <td className="px-2.5 py-2 text-center tabular-nums">
                          {item.deliveryDate || order?.deliveryDate || '-'}
                        </td>
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
                defaultDeliveryDate={form.deliveryDate}
                lockSeededFields={lockSeededFields}
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
              구매발주서 출력
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
                {saving ? '저장 중...' : '저장 후 구매발주서'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {assistMode ? (
        <MaterialPurchaseAssistPanel
          mode={assistMode}
          cards={orderCards}
          suggestionLines={suggestionLines}
          materials={materials}
          bomEdges={bomEdges}
          onHandByMaterialId={onHandByMaterialId}
          onClose={() => setAssistMode(null)}
          onFill={applyAssistFill}
        />
      ) : null}
    </div>
  )
}

export function MaterialPurchaseOrderModal({ open, ...props }: MaterialPurchaseOrderModalProps) {
  if (!open) return null
  return <MaterialPurchaseOrderModalContent {...props} />
}
