'use client'

import { useEffect, useMemo, useState } from 'react'
import { InboundDirectLinesForm } from '@/components/materials/inbound/inbound-direct-lines-form'
import { InboundOpeningLinesForm } from '@/components/materials/inbound/inbound-opening-lines-form'
import { InboundPurchaseLinesForm } from '@/components/materials/inbound/inbound-purchase-lines-form'
import { buildMaterialInboundPayload } from '@/lib/materials/inbound/build-payload'
import {
  createMaterialInbound,
  deleteMaterialInbound,
  updateMaterialInbound,
} from '@/lib/materials/inbound/repository'
import {
  defaultDirectInboundItemForm,
  defaultMaterialInboundFormState,
  directInboundItemsFromDetail,
  materialInboundFormStateFromDetail,
  type DirectInboundItemForm,
  type MaterialInboundFormState,
  type PurchaseInboundItemForm,
} from '@/lib/materials/inbound/form-state'
import {
  defaultOpeningInboundItemForm,
  openingInboundItemsFromDetail,
  openingToDirectInboundItems,
  type OpeningInboundItemForm,
} from '@/lib/materials/inbound/opening-form-state'
import { MATERIAL_INBOUND_TYPE_LABELS, type MaterialInboundType } from '@/lib/materials/inbound/types'
import type { MaterialInboundListGroup } from '@/lib/materials/inbound/types'
import {
  buildPurchaseInboundLineSeeds,
  filterPurchaseOrdersWithRemaining,
  inboundPurchaseItemsFromDetail,
} from '@/lib/materials/inbound/utils'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { Material } from '@/lib/materials/types'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'

type InboundModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  inbound?: MaterialInboundListGroup | null
  materials: Material[]
  purchaseOrders: MaterialPurchaseOrderListGroup[]
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
  onMaterialsChanged?: () => void
}

const INBOUND_TYPE_OPTIONS: MaterialInboundType[] = ['opening', 'purchase', 'supplied', 'return']

function createInitialOpeningItems(inbound?: MaterialInboundListGroup | null): OpeningInboundItemForm[] {
  if (inbound && inbound.inboundType === 'opening') {
    return openingInboundItemsFromDetail(inbound.items)
  }
  return [defaultOpeningInboundItemForm()]
}

function createInitialDirectItems(inbound?: MaterialInboundListGroup | null): DirectInboundItemForm[] {
  if (inbound && inbound.inboundType !== 'purchase' && inbound.inboundType !== 'opening') {
    return directInboundItemsFromDetail(inbound.items)
  }
  return [defaultDirectInboundItemForm()]
}

function InboundModalContent({
  mode,
  inbound,
  materials,
  purchaseOrders,
  onClose,
  onSaved,
  onDeleted,
  onMaterialsChanged,
}: Omit<InboundModalProps, 'open'>) {
  const isEdit = mode === 'edit'
  const [form, setForm] = useState<MaterialInboundFormState>(() =>
    inbound
      ? materialInboundFormStateFromDetail(inbound)
      : defaultMaterialInboundFormState(todayYmdSeoul()),
  )
  const [directItems, setDirectItems] = useState<DirectInboundItemForm[]>(() => createInitialDirectItems(inbound))
  const [openingItems, setOpeningItems] = useState<OpeningInboundItemForm[]>(() =>
    createInitialOpeningItems(inbound),
  )
  const [purchaseItems, setPurchaseItems] = useState<PurchaseInboundItemForm[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const selectablePurchaseOrders = useMemo(
    () => (isEdit ? purchaseOrders : filterPurchaseOrdersWithRemaining(purchaseOrders)),
    [isEdit, purchaseOrders],
  )

  const selectedOrder = useMemo(
    () => purchaseOrders.find((order) => order.orderId === form.purchaseOrderId) ?? null,
    [purchaseOrders, form.purchaseOrderId],
  )

  const hasInboundType = form.inboundType !== ''
  const activeItems = !hasInboundType
    ? []
    : form.inboundType === 'purchase'
      ? purchaseItems
      : form.inboundType === 'opening'
        ? openingItems
        : directItems
  const activeLineCount = activeItems.filter((item) => Number(item.quantity) > 0).length
  const totalInboundQty = activeItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
  const directPayloadItems =
    form.inboundType === 'opening' ? openingToDirectInboundItems(openingItems) : directItems

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

  useEffect(() => {
    if (isEdit) return
    if (form.inboundType !== 'purchase') return
    if (!selectedOrder) {
      setPurchaseItems([])
      return
    }
    setPurchaseItems(
      buildPurchaseInboundLineSeeds(selectedOrder).map((seed) => ({
        ...seed,
        quantity: '0',
      })),
    )
  }, [isEdit, form.inboundType, selectedOrder])

  useEffect(() => {
    if (!isEdit || !inbound || inbound.inboundType !== 'purchase' || !selectedOrder) return
    setPurchaseItems(inboundPurchaseItemsFromDetail(selectedOrder, inbound))
  }, [isEdit, inbound, selectedOrder])

  function updateForm<K extends keyof MaterialInboundFormState>(key: K, value: MaterialInboundFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleTypeChange(inboundType: MaterialInboundType) {
    if (isEdit) return
    setForm((current) => ({
      ...current,
      inboundType,
      purchaseOrderId: inboundType === 'purchase' ? current.purchaseOrderId : '',
    }))
    setSaveError(null)
  }

  async function handleSave() {
    if (!form.inboundType) {
      setSaveError('입고 유형을 선택해 주세요.')
      return
    }

    const payload = buildMaterialInboundPayload({
      inboundDate: form.inboundDate || todayYmdSeoul(),
      inboundType: form.inboundType,
      purchaseOrderId: form.purchaseOrderId,
      note: form.note,
      directItems: directPayloadItems,
      purchaseItems,
      materials,
    })

    if (!payload.items.length) {
      setSaveError('입고 수량이 1개 이상인 품목을 입력해 주세요.')
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = isEdit
      ? await updateMaterialInbound(inbound!.inboundId, payload)
      : await createMaterialInbound(payload)
    setSaving(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onSaved?.()
    onClose()
  }

  async function handleDelete() {
    if (!inbound) return
    if (
      !window.confirm(
        `${inbound.inboundNumber} 입고 전표를 삭제하시겠습니까?\n삭제 후 재고·발주 입고수량이 함께 반영됩니다.`,
      )
    ) {
      return
    }

    setDeleting(true)
    setSaveError(null)

    const result = await deleteMaterialInbound(inbound.inboundId)
    setDeleting(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onDeleted?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbound-modal-title"
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="inbound-modal-title" className="text-lg font-bold text-slate-900">
              {isEdit ? '입고 수정' : '입고 등록'}
            </h2>
            {isEdit && inbound ? (
              <p className="mt-1 font-mono text-xs text-blue-700">
                입고번호 {inbound.inboundNumber} <span className="text-slate-400">(수정 불가)</span>
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {isEdit ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting || saving}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[140px,minmax(0,1fr),minmax(0,1fr)]">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">입고일</span>
              <input
                type="date"
                value={form.inboundDate}
                onChange={(event) => updateForm('inboundDate', event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2 lg:col-span-1">
              <span className="mb-1 block font-medium text-slate-600">비고</span>
              <input
                value={form.note}
                onChange={(event) => updateForm('note', event.target.value)}
                placeholder="선택 입력"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>

          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-slate-600">입고 유형</p>
            <div className="flex flex-wrap gap-2">
              {INBOUND_TYPE_OPTIONS.map((type) => {
                const active = form.inboundType === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeChange(type)}
                    disabled={isEdit}
                    className={[
                      'rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      active
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {MATERIAL_INBOUND_TYPE_LABELS[type]}
                  </button>
                )
              })}
            </div>
          </div>

          {form.inboundType === 'purchase' ? (
            <div className="mb-4">
              <label className="block max-w-md text-sm">
                <span className="mb-1 block font-medium text-slate-600">발주</span>
                <select
                  value={form.purchaseOrderId}
                  onChange={(event) => updateForm('purchaseOrderId', event.target.value)}
                  disabled={isEdit}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-600"
                >
                  <option value="">발주 선택</option>
                  {(isEdit ? purchaseOrders : selectablePurchaseOrders).map((order) => (
                    <option key={order.orderId} value={order.orderId}>
                      {order.orderNumber} · {order.supplier || '공급업체 미입력'}
                    </option>
                  ))}
                </select>
              </label>
              {!isEdit && !selectablePurchaseOrders.length ? (
                <p className="mt-2 text-sm text-amber-700">입고 가능한 발주가 없습니다.</p>
              ) : null}
            </div>
          ) : null}

          {!hasInboundType ? null : form.inboundType === 'purchase' ? (
            <InboundPurchaseLinesForm items={purchaseItems} onChange={setPurchaseItems} />
          ) : form.inboundType === 'opening' ? (
            <InboundOpeningLinesForm items={openingItems} onChange={setOpeningItems} />
          ) : (
            <InboundDirectLinesForm
              items={directItems}
              materials={materials}
              onChange={setDirectItems}
              onMaterialsChanged={onMaterialsChanged}
            />
          )}

          {saveError ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {saveError}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {activeLineCount.toLocaleString('ko-KR')}건 · 총 {totalInboundQty.toLocaleString('ko-KR')}개
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || deleting || !hasInboundType}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중…' : isEdit ? '저장' : '등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InboundModal({
  open,
  mode,
  inbound,
  materials,
  purchaseOrders,
  onClose,
  onSaved,
  onDeleted,
  onMaterialsChanged,
}: InboundModalProps) {
  if (!open) return null
  if (mode === 'edit' && !inbound) return null

  return (
    <InboundModalContent
      mode={mode}
      inbound={inbound}
      materials={materials}
      purchaseOrders={purchaseOrders}
      onClose={onClose}
      onSaved={onSaved}
      onDeleted={onDeleted}
      onMaterialsChanged={onMaterialsChanged}
    />
  )
}
