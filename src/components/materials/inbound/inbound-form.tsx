'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { InboundDirectLinesForm } from '@/components/materials/inbound/inbound-direct-lines-form'
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

export type InboundFormProps = {
  mode: 'create' | 'edit'
  variant?: 'page' | 'modal'
  inbound?: MaterialInboundListGroup | null
  /** 발주서 카드에서 열 때 미리 선택할 발주 */
  seedPurchaseOrderId?: string
  materials: Material[]
  purchaseOrders: MaterialPurchaseOrderListGroup[]
  onCancel?: () => void
  onSaved?: () => void
  onDeleted?: () => void
  onMaterialsChanged?: () => void
}

/**
 * 발주 입고가 기본이므로 유형 버튼은 사급/반품만 노출.
 * 사급/반품을 다시 누르면 해제되어 발주 입고로 돌아간다.
 */
const INBOUND_TYPE_OPTIONS: MaterialInboundType[] = ['supplied', 'return']

function createInitialDirectItems(inbound?: MaterialInboundListGroup | null): DirectInboundItemForm[] {
  if (inbound && inbound.inboundType !== 'purchase') {
    return directInboundItemsFromDetail(inbound.items)
  }
  return [defaultDirectInboundItemForm()]
}

export function InboundForm({
  mode,
  variant = 'modal',
  inbound,
  seedPurchaseOrderId = '',
  materials,
  purchaseOrders,
  onCancel,
  onSaved,
  onDeleted,
  onMaterialsChanged,
}: InboundFormProps) {
  const canDelete = useCanDeleteRecords()
  const isEdit = mode === 'edit'
  const isPage = variant === 'page'
  const [form, setForm] = useState<MaterialInboundFormState>(() =>
    inbound
      ? materialInboundFormStateFromDetail(inbound)
      : {
          ...defaultMaterialInboundFormState(todayYmdSeoul()),
          inboundType: 'purchase',
          purchaseOrderId: seedPurchaseOrderId,
        },
  )
  const [formKey, setFormKey] = useState(0)
  const [directItems, setDirectItems] = useState<DirectInboundItemForm[]>(() => createInitialDirectItems(inbound))
  const [purchaseItems, setPurchaseItems] = useState<PurchaseInboundItemForm[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState<string | null>(null)

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
      : directItems
  const activeLineCount = activeItems.filter((item) => Number(item.quantity) > 0).length
  const totalInboundQty = activeItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

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

  function resetCreateForm() {
    setForm({ ...defaultMaterialInboundFormState(todayYmdSeoul()), inboundType: 'purchase' })
    setDirectItems([defaultDirectInboundItemForm()])
    setPurchaseItems([])
    setSaveError(null)
    setFormKey((value) => value + 1)
  }

  function updateForm<K extends keyof MaterialInboundFormState>(key: K, value: MaterialInboundFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleTypeChange(inboundType: MaterialInboundType) {
    if (isEdit) return
    setForm((current) => {
      // 활성 버튼을 다시 누르면 해제 → 기본(발주 입고)으로 복귀
      const nextType = current.inboundType === inboundType ? 'purchase' : inboundType
      return {
        ...current,
        inboundType: nextType,
        purchaseOrderId: nextType === 'purchase' ? current.purchaseOrderId : '',
      }
    })
    setSaveError(null)
    setSaveOk(null)
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
      directItems,
      purchaseItems,
      materials,
    })

    if (!payload.items.length) {
      setSaveError('입고 수량이 1개 이상인 품목을 입력해 주세요.')
      return
    }

    setSaving(true)
    setSaveError(null)
    setSaveOk(null)

    const result = isEdit
      ? await updateMaterialInbound(inbound!.inboundId, payload)
      : await createMaterialInbound(payload)
    setSaving(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    if (isPage && !isEdit) {
      setSaveOk(`${result.inboundNumber} 입고가 등록되었습니다.`)
      resetCreateForm()
      onSaved?.()
      return
    }

    onSaved?.()
    onCancel?.()
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

  const body = (
    <>
      <div className={isPage ? 'space-y-4' : 'min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4'}>
        {isEdit && inbound ? (
          <p className="font-mono text-xs text-slate-700">
            입고번호 {inbound.inboundNumber} <span className="text-slate-400">(수정 불가)</span>
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[140px,minmax(0,1fr),minmax(0,1fr)]">
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

        <div>
          <p className="mb-2 text-sm font-medium text-slate-600">
            입고 유형 <span className="font-normal text-slate-400">(기본: 발주 입고 · 필요 시 선택)</span>
          </p>
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
                      ? 'bg-slate-800 text-white'
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
          <div>
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

        {!hasInboundType ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
            입고 유형을 선택하면 품목 입력이 표시됩니다.
          </div>
        ) : form.inboundType === 'purchase' ? (
          <InboundPurchaseLinesForm key={`purchase-${formKey}`} items={purchaseItems} onChange={setPurchaseItems} />
        ) : (
          <InboundDirectLinesForm
            key={`direct-${formKey}`}
            items={directItems}
            materials={materials}
            onChange={setDirectItems}
            onMaterialsChanged={onMaterialsChanged}
          />
        )}

        {saveError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {saveError}
          </div>
        ) : null}
        {saveOk ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {saveOk}
          </div>
        ) : null}
      </div>

      <div
        className={[
          'flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
          isPage ? 'border-t border-slate-200 pt-4' : 'border-t border-slate-200 bg-slate-50/80 px-5 py-3',
        ].join(' ')}
      >
        <p className="text-sm text-slate-500">
          {activeLineCount.toLocaleString('ko-KR')}건 · 총 {totalInboundQty.toLocaleString('ko-KR')}개
        </p>
        <div className="flex items-center justify-end gap-2">
          {isEdit && canDelete ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting || saving}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? '삭제 중…' : '삭제'}
            </button>
          ) : null}
          {onCancel && !isPage ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving || deleting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              취소
            </button>
          ) : null}
          {isPage && !isEdit ? (
            <button
              type="button"
              onClick={resetCreateForm}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              초기화
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || deleting || !hasInboundType}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:opacity-50"
          >
            {saving ? '저장 중…' : isEdit ? '저장' : '등록'}
          </button>
        </div>
      </div>
    </>
  )

  if (isPage) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{body}</div>
  }

  return <div className="flex h-full min-h-0 flex-col">{body}</div>
}
