'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpModal } from '@/components/ui/erp-modal'
import { createDeliveryRecord } from '@/lib/delivery/repository'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import { describeDeliveryBlockReason } from '@/lib/delivery/utils'
import { createPostProcessProductionRecord } from '@/lib/post-process/repository'
import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'
import {
  formatProductionProductName,
  getProgressPercent,
  resolveProductionCount,
  resolveProductionSideCount,
} from '@/lib/production-input/utils'
import type { ProductionStatusLine, ProductionStatusStage } from '@/lib/production-status/types'
import { buildSmtCountKey } from '@/lib/smt/count-keys'
import { createSmtProductionRecord } from '@/lib/smt/repository'
import type { SmtPcbSide } from '@/lib/smt/types'
import {
  ERP_FIELD_INPUT_CLASS,
  ERP_PRIMARY_BUTTON_CLASS,
  ERP_SECONDARY_BUTTON_CLASS,
} from '@/lib/ui/tokens'

/** 생산현황(총관리자)에서 등록한 이력 비고 */
export const ADMIN_DIRECT_PRODUCTION_NOTE = '직접생산(관리자)'
export const ADMIN_DIRECT_DELIVERY_NOTE = '직접출하(관리자)'

type ProductionStatusQuickInputModalProps = {
  open: boolean
  stage: ProductionStatusStage
  line: ProductionStatusLine | null
  smtOrders: ProductionOrderLine[]
  postOrders: ProductionOrderLine[]
  deliveryOrders: ProductionOrderLine[]
  smtCounts: ProductionCounts
  postCounts: ProductionCounts
  deliveryAvailabilityByGroupId: Record<string, DeliveryAvailability>
  onClose: () => void
  onRegistered: () => void
}

const STAGE_META: Record<
  ProductionStatusStage,
  { title: string; description: string; empty: string }
> = {
  smt: {
    title: 'SMT 직접 입력 (총관리자)',
    description: '생산계획·라인 선택 없이 수량만 등록합니다. 이력 비고에 「직접생산(관리자)」가 기록됩니다.',
    empty: '이 주문서에 SMT 대상 반제품이 없습니다.',
  },
  post_process: {
    title: '후공정 직접 입력 (총관리자)',
    description: '생산계획·팀 선택 없이 수량만 등록합니다. 이력 비고에 「직접생산(관리자)」가 기록됩니다.',
    empty: '이 주문서에 후공정 대상이 없습니다.',
  },
  delivery: {
    title: '출하 직접 입력 (총관리자)',
    description: '출하 가능 수량 범위에서 등록합니다. 이력 비고에 「직접출하(관리자)」가 기록됩니다.',
    empty: '이 주문서에 출하 대상이 없습니다.',
  },
}

export function ProductionStatusQuickInputModal({
  open,
  stage,
  line,
  smtOrders,
  postOrders,
  deliveryOrders,
  smtCounts,
  postCounts,
  deliveryAvailabilityByGroupId,
  onClose,
  onRegistered,
}: ProductionStatusQuickInputModalProps) {
  const [selectedKey, setSelectedKey] = useState('')
  const [localSmtCounts, setLocalSmtCounts] = useState(smtCounts)
  const [localPostCounts, setLocalPostCounts] = useState(postCounts)
  const [localAvailability, setLocalAvailability] = useState(deliveryAvailabilityByGroupId)
  const [activeSide, setActiveSide] = useState<SmtPcbSide>('TOP')
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const orderTargets = useMemo(() => {
    if (!line) return [] as ProductionOrderLine[]
    if (stage === 'smt') {
      return smtOrders.filter((order) => order.orderId === line.orderId)
    }
    if (stage === 'post_process') {
      return postOrders.filter((order) => order.orderId === line.orderId)
    }
    return deliveryOrders.filter((order) => order.orderId === line.orderId)
  }, [deliveryOrders, line, postOrders, smtOrders, stage])

  useEffect(() => {
    if (!open) return
    setLocalSmtCounts(smtCounts)
    setLocalPostCounts(postCounts)
    setLocalAvailability(deliveryAvailabilityByGroupId)
    setSelectedKey(orderTargets[0]?.uiKey || '')
    setQty('')
    setMessage(null)
    setActiveSide('TOP')
  }, [deliveryAvailabilityByGroupId, open, orderTargets, postCounts, smtCounts])

  const selectedOrder = orderTargets.find((order) => order.uiKey === selectedKey) ?? null
  const meta = STAGE_META[stage]
  const isDual = Boolean(selectedOrder?.splitPcbSides) && stage === 'smt'
  const pcbSide: SmtPcbSide = isDual ? (activeSide === 'BOT' ? 'BOT' : 'TOP') : 'SINGLE'

  const produced =
    stage === 'delivery'
      ? selectedOrder
        ? localAvailability[selectedOrder.assemblyGroupId || selectedOrder.orderLineId]?.shipped ?? 0
        : 0
      : selectedOrder
        ? stage === 'smt'
          ? resolveProductionSideCount(selectedOrder, localSmtCounts, pcbSide)
          : resolveProductionCount(selectedOrder, localPostCounts)
        : 0

  const target = selectedOrder?.quantity ?? 0
  const remaining = Math.max(0, target - produced)

  const deliveryAvailability =
    selectedOrder && stage === 'delivery'
      ? localAvailability[selectedOrder.assemblyGroupId || selectedOrder.orderLineId] ?? null
      : null

  const deliveryRegisterMax = deliveryAvailability
    ? Math.min(
        Math.max(0, deliveryAvailability.targetQuantity - deliveryAvailability.shipped),
        deliveryAvailability.shippable,
      )
    : 0

  const registerMax = stage === 'delivery' ? deliveryRegisterMax : remaining
  const percent = getProgressPercent(produced, target)

  useEffect(() => {
    if (!selectedOrder) {
      setQty('')
      return
    }
    setQty(registerMax > 0 ? String(registerMax) : '')
    setMessage(null)
  }, [pcbSide, registerMax, selectedOrder?.uiKey, stage])

  async function handleSubmit() {
    if (!selectedOrder) return

    const value = Math.floor(Number(qty))
    if (!value || value < 1) {
      setMessage({ text: '수량을 입력하세요.', kind: 'err' })
      return
    }
    if (value > registerMax) {
      setMessage({
        text:
          registerMax > 0
            ? `남은 수량(${registerMax.toLocaleString('ko-KR')})을 초과할 수 없습니다.`
            : stage === 'delivery' && deliveryAvailability
              ? describeDeliveryBlockReason(deliveryAvailability)
              : '등록 가능한 수량이 없습니다.',
        kind: 'err',
      })
      return
    }

    setSaving(true)
    setMessage(null)

    if (stage === 'smt') {
      const result = await createSmtProductionRecord({
        orderLineId: selectedOrder.orderLineId,
        quantity: value,
        pcbSide,
        note: ADMIN_DIRECT_PRODUCTION_NOTE,
        source: 'manual',
      })
      setSaving(false)
      if (!result.ok) {
        setMessage({ text: result.detail, kind: 'err' })
        return
      }
      const countKey = buildSmtCountKey(selectedOrder.orderLineId, pcbSide)
      setLocalSmtCounts((prev) => ({ ...prev, [countKey]: result.cumulative }))
      setMessage({
        text: `${value.toLocaleString('ko-KR')}개 등록 · 누적 ${result.cumulative.toLocaleString('ko-KR')}`,
        kind: 'ok',
      })
      setQty('')
      onRegistered()
      return
    }

    if (stage === 'post_process') {
      const assemblyGroupId = selectedOrder.assemblyGroupId || selectedOrder.orderLineId
      const result = await createPostProcessProductionRecord({
        assemblyGroupId,
        quantity: value,
        note: ADMIN_DIRECT_PRODUCTION_NOTE,
        source: 'manual',
      })
      setSaving(false)
      if (!result.ok) {
        setMessage({ text: result.detail, kind: 'err' })
        return
      }
      setLocalPostCounts((prev) => ({ ...prev, [assemblyGroupId]: result.cumulative }))
      setMessage({
        text: `${value.toLocaleString('ko-KR')}개 등록 · 누적 ${result.cumulative.toLocaleString('ko-KR')}`,
        kind: 'ok',
      })
      setQty('')
      onRegistered()
      return
    }

    if (!deliveryAvailability) {
      setSaving(false)
      setMessage({ text: '출하 가능 정보를 불러오지 못했습니다.', kind: 'err' })
      return
    }

    const assemblyGroupId = selectedOrder.assemblyGroupId || selectedOrder.orderLineId
    const result = await createDeliveryRecord({
      assemblyGroupId,
      quantity: value,
      note: ADMIN_DIRECT_DELIVERY_NOTE,
    })
    setSaving(false)
    if (!result.ok) {
      setMessage({ text: result.detail, kind: 'err' })
      return
    }

    const nextAvailability: DeliveryAvailability = {
      ...deliveryAvailability,
      shipped: result.cumulative,
      shippable: Math.max(0, deliveryAvailability.productionCap - result.cumulative),
    }
    setLocalAvailability((prev) => ({ ...prev, [assemblyGroupId]: nextAvailability }))
    setMessage({
      text: `출하번호 ${result.record.id} · ${value.toLocaleString('ko-KR')}개 등록`,
      kind: 'ok',
    })
    setQty(nextAvailability.shippable > 0 ? String(Math.min(
      Math.max(0, nextAvailability.targetQuantity - nextAvailability.shipped),
      nextAvailability.shippable,
    )) : '')
    onRegistered()
  }

  return (
    <ErpModal
      open={open}
      size="md"
      title={meta.title}
      description={
        line
          ? `${line.orderNumber} · ${line.customer || '—'} · ${line.productName || '—'}`
          : undefined
      }
      onClose={onClose}
      contentClassName="min-h-0 flex-1 overflow-hidden p-0"
    >
      {!orderTargets.length ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">{meta.empty}</div>
      ) : (
        <div className="flex min-h-0 flex-col sm:flex-row" style={{ minHeight: '26rem' }}>
          <div className="shrink-0 border-b border-slate-200 bg-amber-50/40 sm:w-56 sm:border-b-0 sm:border-r">
            <p className="px-3 py-2 text-[11px] font-semibold tracking-wide text-amber-800/80 uppercase">
              총관리자 · 대상
            </p>
            <ul className="max-h-40 overflow-y-auto sm:max-h-none sm:h-[calc(26rem-2rem)]">
              {orderTargets.map((order) => {
                const selected = order.uiKey === selectedKey
                const done =
                  stage === 'delivery'
                    ? localAvailability[order.assemblyGroupId || order.orderLineId]?.shipped ?? 0
                    : resolveProductionCount(
                        order,
                        stage === 'smt' ? localSmtCounts : localPostCounts,
                      )
                return (
                  <li key={order.uiKey}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(order.uiKey)}
                      className={[
                        'w-full border-l-2 px-3 py-2.5 text-left transition',
                        selected
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-transparent hover:bg-white/80',
                      ].join(' ')}
                    >
                      <span className="block text-sm font-semibold text-slate-900">
                        {formatProductionProductName(order)}
                      </span>
                      <span className="mt-0.5 block text-[11px] tabular-nums text-slate-500">
                        {done.toLocaleString('ko-KR')} / {order.quantity.toLocaleString('ko-KR')}
                        {order.splitPcbSides ? ' · 양면' : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {meta.description}
            </div>

            {!selectedOrder ? (
              <p className="py-8 text-center text-sm text-slate-500">왼쪽에서 대상을 선택하세요.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">
                    {selectedOrder.customer} · {selectedOrder.orderNumber}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    {formatProductionProductName(selectedOrder)}
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                    <p className="text-[11px] font-semibold text-slate-500">목표</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-800">
                      {target.toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                    <p className="text-[11px] font-semibold text-slate-500">누적</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-800">
                      {produced.toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                    <p className="text-[11px] font-semibold text-slate-500">가능</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-slate-800">
                      {registerMax.toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-[11px] font-medium text-slate-500">
                    <span>진행</span>
                    <span className="tabular-nums">{percent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {isDual ? (
                  <div className="flex gap-2">
                    {(['TOP', 'BOT'] as const).map((side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setActiveSide(side)}
                        className={[
                          'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition',
                          pcbSide === side
                            ? 'border-amber-500 bg-amber-50 text-amber-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        {side}
                      </button>
                    ))}
                  </div>
                ) : null}

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">등록 수량</span>
                  <input
                    type="number"
                    min={1}
                    max={registerMax || undefined}
                    value={qty}
                    onChange={(event) => setQty(event.target.value)}
                    disabled={registerMax <= 0 || saving}
                    className={ERP_FIELD_INPUT_CLASS}
                    placeholder={registerMax > 0 ? `최대 ${registerMax}` : '등록 불가'}
                  />
                </label>

                {message ? (
                  <p
                    className={[
                      'text-sm',
                      message.kind === 'ok' ? 'text-emerald-700' : 'text-rose-600',
                    ].join(' ')}
                  >
                    {message.text}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={saving || registerMax <= 0}
                    className={ERP_PRIMARY_BUTTON_CLASS}
                  >
                    {saving ? '등록 중…' : '등록'}
                  </button>
                  <button type="button" onClick={onClose} className={ERP_SECONDARY_BUTTON_CLASS}>
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ErpModal>
  )
}
