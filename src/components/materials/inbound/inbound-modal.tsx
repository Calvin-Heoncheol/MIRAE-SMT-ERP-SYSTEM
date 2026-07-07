'use client'

import { useEffect, useMemo, useState } from 'react'
import { InboundDirectLinesForm } from '@/components/materials/inbound/inbound-direct-lines-form'
import { InboundPurchaseLinesForm } from '@/components/materials/inbound/inbound-purchase-lines-form'
import { buildMaterialInboundPayload } from '@/lib/materials/inbound/build-payload'
import { createMaterialInbound } from '@/lib/materials/inbound/repository'
import {
  defaultDirectInboundItemForm,
  defaultMaterialInboundFormState,
  type DirectInboundItemForm,
  type MaterialInboundFormState,
  type PurchaseInboundItemForm,
} from '@/lib/materials/inbound/form-state'
import { MATERIAL_INBOUND_TYPE_LABELS, type MaterialInboundType } from '@/lib/materials/inbound/types'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { buildPurchaseInboundLineSeeds } from '@/lib/materials/inbound/utils'
import type { Material } from '@/lib/materials/types'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'

type InboundModalProps = {
  open: boolean
  materials: Material[]
  purchaseOrders: MaterialPurchaseOrderListGroup[]
  onClose: () => void
  onSaved?: () => void
}

const INBOUND_TYPE_OPTIONS: MaterialInboundType[] = ['opening', 'purchase', 'supplied', 'return']

function InboundModalContent({
  materials,
  purchaseOrders,
  onClose,
  onSaved,
}: Omit<InboundModalProps, 'open'>) {
  const [form, setForm] = useState<MaterialInboundFormState>(() => defaultMaterialInboundFormState(todayYmdSeoul()))
  const [directItems, setDirectItems] = useState<DirectInboundItemForm[]>([defaultDirectInboundItemForm()])
  const [purchaseItems, setPurchaseItems] = useState<PurchaseInboundItemForm[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const selectedOrder = useMemo(
    () => purchaseOrders.find((order) => order.orderId === form.purchaseOrderId) ?? null,
    [purchaseOrders, form.purchaseOrderId],
  )
  const activeItems = form.inboundType === 'purchase' ? purchaseItems : directItems
  const activeLineCount = activeItems.filter((item) => Number(item.quantity) > 0).length
  const totalInboundQty = activeItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
  const modeTitle = form.inboundType === 'purchase' ? '발주 잔량 입고' : '바코드 스캔 입고'

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, saving])

  useEffect(() => {
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
  }, [form.inboundType, selectedOrder])

  function updateForm<K extends keyof MaterialInboundFormState>(key: K, value: MaterialInboundFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleTypeChange(inboundType: MaterialInboundType) {
    setForm((current) => ({
      ...current,
      inboundType,
      purchaseOrderId: inboundType === 'purchase' ? current.purchaseOrderId : '',
    }))
    setSaveError(null)
  }

  async function handleSave() {
    const payload = buildMaterialInboundPayload({
      inboundDate: form.inboundDate || todayYmdSeoul(),
      inboundType: form.inboundType,
      purchaseOrderId: form.purchaseOrderId,
      note: form.note,
      directItems,
      purchaseItems,
    })

    if (!payload.items.length) {
      setSaveError('입고 수량이 1개 이상인 품목을 입력해 주세요.')
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = await createMaterialInbound(payload)
    setSaving(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onSaved?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbound-modal-title"
        className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="inbound-modal-title" className="text-xl font-bold text-slate-900">
                입고 등록
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                기초·발주·사급·반품 입고를 등록합니다. 직접입고는 스캐너 중심으로 빠르게 누적할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">현재 모드</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{modeTitle}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">입고 라인</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                  {activeLineCount.toLocaleString('ko-KR')}건
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">총 수량</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                  {totalInboundQty.toLocaleString('ko-KR')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-[320px,minmax(0,1fr)]">
            <aside className="border-b border-slate-200 bg-slate-50/70 p-6 lg:border-b-0 lg:border-r">
              <div className="space-y-6 lg:sticky lg:top-0">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">입고 기본 정보</p>
                  <div className="mt-4 space-y-4">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-600">입고일</span>
                      <input
                        type="date"
                        value={form.inboundDate}
                        onChange={(event) => updateForm('inboundDate', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-600">비고</span>
                      <input
                        value={form.note}
                        onChange={(event) => updateForm('note', event.target.value)}
                        placeholder="예: 1차 납품분, 급입고"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-900">입고 유형</p>
                  <div className="grid grid-cols-2 gap-2">
                    {INBOUND_TYPE_OPTIONS.map((type) => {
                      const active = form.inboundType === type
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleTypeChange(type)}
                          className={[
                            'rounded-xl px-3 py-3 text-[13px] font-semibold transition-colors',
                            active
                              ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
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
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-600">발주 선택</span>
                      <select
                        value={form.purchaseOrderId}
                        onChange={(event) => updateForm('purchaseOrderId', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
                      >
                        <option value="">발주를 선택하세요</option>
                        {purchaseOrders.map((order) => (
                          <option key={order.orderId} value={order.orderId}>
                            {order.orderNumber} · {order.supplier || '공급업체 미입력'}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!purchaseOrders.length ? (
                      <p className="mt-3 text-sm text-amber-700">입고 가능한 발주(미입고 잔량)가 없습니다.</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                    <p className="text-sm font-semibold text-blue-900">스캔 운영 팁</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-blue-900/80">
                      <li>스캐너 포커스를 유지한 채 연속 스캔하면 품목별 수량이 자동 누적됩니다.</li>
                      <li>매칭이 안 되는 자재만 우측 표에서 수동 보정하면 됩니다.</li>
                      <li>CPN, MPN, 대체 MPN을 기준으로 자동 매칭합니다.</li>
                    </ul>
                  </div>
                )}
              </div>
            </aside>

            <section className="p-6">
              {form.inboundType === 'purchase' ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">발주 잔량 기준 입고</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      발주 라인별 잔량을 보면서 실제 입고수량을 빠르게 입력합니다.
                    </p>
                  </div>
                  <InboundPurchaseLinesForm items={purchaseItems} onChange={setPurchaseItems} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">스캔 작업 영역</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      직접입고, 사급입고, 반품입고는 바코드 스캔 중심으로 빠르게 등록할 수 있습니다.
                    </p>
                  </div>
                  <InboundDirectLinesForm items={directItems} materials={materials} onChange={setDirectItems} />
                </div>
              )}

              {saveError ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {saveError}
                </div>
              ) : null}
            </section>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            저장 대상: <span className="font-semibold text-slate-900">{activeLineCount}개 라인</span> / 총{' '}
            <span className="font-semibold text-slate-900">{totalInboundQty.toLocaleString('ko-KR')}</span>개
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '입고 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InboundModal({ open, materials, purchaseOrders, onClose, onSaved }: InboundModalProps) {
  if (!open) return null
  return (
    <InboundModalContent
      materials={materials}
      purchaseOrders={purchaseOrders}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}
