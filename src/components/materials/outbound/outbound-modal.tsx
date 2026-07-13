'use client'

import { useEffect, useState } from 'react'
import { MaterialCombobox } from '@/components/materials/purchase-orders/material-combobox'
import { buildMaterialOutboundPayload } from '@/lib/materials/outbound/build-payload'
import {
  createMaterialOutbound,
  deleteMaterialOutbound,
  updateMaterialOutbound,
} from '@/lib/materials/outbound/repository'
import {
  defaultMaterialOutboundFormState,
  defaultOutboundLineForm,
  materialOutboundFormStateFromDetail,
  outboundLinesFromDetail,
  outboundLinesFromNeedRows,
  type MaterialOutboundFormState,
  type OutboundLineForm,
} from '@/lib/materials/outbound/form-state'
import {
  MATERIAL_OUTBOUND_TYPE_LABELS,
  type MaterialOutboundListGroup,
  type MaterialOutboundNeedRow,
  type MaterialOutboundType,
} from '@/lib/materials/outbound/types'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { Material } from '@/lib/materials/types'
import type { OrderListGroup } from '@/lib/orders/types'

type OutboundModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  outbound?: MaterialOutboundListGroup | null
  seedOrderId?: string
  seedNeedLines?: MaterialOutboundNeedRow[]
  materials: Material[]
  orders: OrderListGroup[]
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

const OUTBOUND_TYPE_OPTIONS: MaterialOutboundType[] = ['production', 'scrap', 'adjustment']

function OutboundModalContent({
  mode,
  outbound,
  seedOrderId,
  seedNeedLines,
  materials,
  orders,
  onClose,
  onSaved,
  onDeleted,
}: Omit<OutboundModalProps, 'open'>) {
  const isEdit = mode === 'edit'
  const [form, setForm] = useState<MaterialOutboundFormState>(() => {
    if (outbound) return materialOutboundFormStateFromDetail(outbound)
    const base = defaultMaterialOutboundFormState(todayYmdSeoul())
    return seedOrderId ? { ...base, outboundType: 'production', orderId: seedOrderId } : base
  })
  const [lines, setLines] = useState<OutboundLineForm[]>(() => {
    if (outbound) return outboundLinesFromDetail(outbound.items)
    if (seedNeedLines?.length) return outboundLinesFromNeedRows(seedNeedLines)
    return [defaultOutboundLineForm()]
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (outbound) {
      setForm(materialOutboundFormStateFromDetail(outbound))
      setLines(outboundLinesFromDetail(outbound.items))
      return
    }
    const base = defaultMaterialOutboundFormState(todayYmdSeoul())
    setForm(seedOrderId ? { ...base, outboundType: 'production', orderId: seedOrderId } : base)
    setLines(seedNeedLines?.length ? outboundLinesFromNeedRows(seedNeedLines) : [defaultOutboundLineForm()])
  }, [outbound, seedOrderId, seedNeedLines])

  function updateLine(index: number, patch: Partial<OutboundLineForm>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  async function handleSave() {
    if (!form.outboundType) {
      setError('불출 유형을 선택해 주세요.')
      return
    }

    const payload = buildMaterialOutboundPayload({
      outboundDate: form.outboundDate,
      outboundType: form.outboundType,
      orderId: form.orderId,
      note: form.note,
      lines,
      materials,
    })

    setSaving(true)
    setError('')
    const result = isEdit && outbound
      ? await updateMaterialOutbound(outbound.outboundId, payload)
      : await createMaterialOutbound(payload)
    setSaving(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }
    onSaved?.()
  }

  async function handleDelete() {
    if (!outbound) return
    if (!window.confirm(`${outbound.outboundNumber} 불출 전표를 삭제할까요?`)) return

    setDeleting(true)
    setError('')
    const result = await deleteMaterialOutbound(outbound.outboundId)
    setDeleting(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }
    onDeleted?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-10">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? '불출 수정' : '불출 등록'}</h2>
            <p className="mt-1 text-sm text-slate-500">주문·BOM 기준 미불출 수량을 가져와 등록할 수 있습니다.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100"
          >
            닫기
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-slate-700">불출일</span>
              <input
                type="date"
                value={form.outboundDate}
                onChange={(event) => setForm((current) => ({ ...current, outboundDate: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-slate-700">유형</span>
              <select
                value={form.outboundType}
                disabled={isEdit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    outboundType: event.target.value as MaterialOutboundType | '',
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50"
              >
                {OUTBOUND_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {MATERIAL_OUTBOUND_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">
              주문 {form.outboundType === 'production' ? '(필수)' : '(선택)'}
            </span>
            <select
              value={form.orderId}
              onChange={(event) => setForm((current) => ({ ...current, orderId: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              <option value="">주문 선택</option>
              {orders.map((order) => (
                <option key={order.orderId} value={order.orderId}>
                  {order.orderNumber} · {order.customer}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">불출 품목</p>
              <button
                type="button"
                onClick={() => setLines((current) => [...current, defaultOutboundLineForm()])}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                행 추가
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, index) => (
                <div
                  key={`outbound-line-${index}`}
                  className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]"
                >
                  <MaterialCombobox
                    value={line.materialId}
                    materials={materials}
                    ariaLabel={`불출 자재 ${index + 1}`}
                    placeholder="자재코드 · 자재명"
                    onValueChange={(value) => updateLine(index, { materialId: value })}
                    onMaterialSelect={(material) =>
                      updateLine(index, {
                        materialId: material.id,
                        materialName: material.materialName,
                        specification: material.specification,
                        mpn: material.mpn,
                      })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={line.quantity}
                    onChange={(event) => updateLine(index, { quantity: event.target.value })}
                    placeholder="수량"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-right tabular-nums outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                  <button
                    type="button"
                    onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                    className="rounded-lg px-2 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">비고</span>
            <textarea
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-4">
          {isEdit ? (
            <button
              type="button"
              disabled={saving || deleting}
              onClick={handleDelete}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? '삭제 중…' : '삭제'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              disabled={saving || deleting}
              onClick={handleSave}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OutboundModal(props: OutboundModalProps) {
  if (!props.open) return null
  return <OutboundModalContent {...props} />
}
