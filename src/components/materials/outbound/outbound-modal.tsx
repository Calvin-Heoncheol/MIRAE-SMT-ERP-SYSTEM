'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { MaterialCombobox } from '@/components/materials/purchase-orders/material-combobox'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
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
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

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
  const canDelete = useCanDeleteRecords()
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
    const result =
      isEdit && outbound
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

  const busy = saving || deleting

  return (
    <ErpModal
      open
      size="md"
      title={isEdit ? '불출 수정' : '불출 등록'}
      description="주문·BOM 기준 미불출 수량을 가져와 등록할 수 있습니다."
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-col gap-2">
          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {isEdit && canDelete ? (
              <ErpButton variant="danger" disabled={busy} onClick={() => void handleDelete()}>
                {deleting ? '삭제 중…' : '삭제'}
              </ErpButton>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <ErpButton variant="secondary" onClick={onClose} disabled={busy}>
                취소
              </ErpButton>
              <ErpButton disabled={busy} onClick={() => void handleSave()}>
                {saving ? '저장 중…' : '저장'}
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>불출일</span>
            <input
              type="date"
              value={form.outboundDate}
              onChange={(event) => setForm((current) => ({ ...current, outboundDate: event.target.value }))}
              className={ERP_FIELD_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>유형</span>
            <select
              value={form.outboundType}
              disabled={isEdit}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  outboundType: event.target.value as MaterialOutboundType | '',
                }))
              }
              className={ERP_FIELD_INPUT_CLASS}
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
          <span className={ERP_FIELD_LABEL_CLASS}>
            주문 {form.outboundType === 'production' ? '(필수)' : '(선택)'}
          </span>
          <select
            value={form.orderId}
            onChange={(event) => setForm((current) => ({ ...current, orderId: event.target.value }))}
            className={ERP_FIELD_INPUT_CLASS}
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
            <p className="text-sm font-medium text-slate-600">불출 품목</p>
            <ErpRowAddButton
              onClick={() => setLines((current) => [...current, defaultOutboundLineForm()])}
              title="불출 품목 추가"
            />
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
                  className={`${ERP_FIELD_INPUT_CLASS} text-right tabular-nums`}
                />
                <button
                  type="button"
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`${index + 1}행 삭제`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>비고</span>
          <textarea
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            rows={2}
            className={ERP_FIELD_INPUT_CLASS}
          />
        </label>
      </div>
    </ErpModal>
  )
}

export function OutboundModal(props: OutboundModalProps) {
  if (!props.open) return null
  return <OutboundModalContent {...props} />
}
