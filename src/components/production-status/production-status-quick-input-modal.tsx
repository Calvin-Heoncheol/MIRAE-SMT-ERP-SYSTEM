'use client'

import { useEffect, useMemo, useState } from 'react'
import { DeliveryInputShipPanel } from '@/components/delivery/delivery-input-ship-panel'
import { ProductionInputPanel } from '@/components/production-input/production-input-panel'
import { ErpModal } from '@/components/ui/erp-modal'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import { POST_PROCESS_PRODUCTION_INPUT_CONFIG } from '@/lib/post-process/config'
import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'
import {
  formatProductionProductName,
  resolveProductionCount,
} from '@/lib/production-input/utils'
import type { ProductionStatusLine, ProductionStatusStage } from '@/lib/production-status/types'
import { SMT_PRODUCTION_INPUT_CONFIG } from '@/lib/smt/config'

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
    title: 'SMT 바로 입력',
    description: '생산계획 없이 수량만 등록합니다.',
    empty: '이 주문서에 SMT 대상 반제품이 없습니다.',
  },
  post_process: {
    title: '후공정 바로 입력',
    description: '생산계획 없이 수량만 등록합니다.',
    empty: '이 주문서에 후공정 대상이 없습니다.',
  },
  delivery: {
    title: '출하 바로 입력',
    description: '출하 가능 수량 범위에서 등록합니다.',
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
  }, [deliveryAvailabilityByGroupId, open, orderTargets, postCounts, smtCounts])

  const selectedOrder = orderTargets.find((order) => order.uiKey === selectedKey) ?? null
  const meta = STAGE_META[stage]
  const counts = stage === 'smt' ? localSmtCounts : localPostCounts
  const availability =
    selectedOrder && stage === 'delivery'
      ? localAvailability[selectedOrder.assemblyGroupId || selectedOrder.orderLineId] ?? null
      : null

  return (
    <ErpModal
      open={open}
      size="md"
      title={meta.title}
      description={
        line
          ? `${line.orderNumber} · ${line.customer || '—'} · ${line.productName || '—'} · ${meta.description}`
          : meta.description
      }
      onClose={onClose}
      contentClassName="min-h-0 flex-1 overflow-hidden p-0"
    >
      {!orderTargets.length ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">{meta.empty}</div>
      ) : (
        <div className="flex min-h-0 flex-col sm:flex-row" style={{ minHeight: '28rem' }}>
          <div className="shrink-0 border-b border-slate-200 sm:w-56 sm:border-b-0 sm:border-r">
            <p className="px-3 py-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              대상 선택
            </p>
            <ul className="max-h-40 overflow-y-auto sm:max-h-none sm:h-[calc(28rem-2rem)]">
              {orderTargets.map((order) => {
                const selected = order.uiKey === selectedKey
                const produced =
                  stage === 'delivery'
                    ? localAvailability[order.assemblyGroupId || order.orderLineId]?.shipped ?? 0
                    : resolveProductionCount(order, counts)
                return (
                  <li key={order.uiKey}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(order.uiKey)}
                      className={[
                        'w-full border-l-2 px-3 py-2.5 text-left transition',
                        selected
                          ? 'border-sky-500 bg-sky-50'
                          : 'border-transparent hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <span className="block text-sm font-semibold text-slate-900">
                        {formatProductionProductName(order)}
                      </span>
                      <span className="mt-0.5 block text-[11px] tabular-nums text-slate-500">
                        {produced.toLocaleString('ko-KR')} / {order.quantity.toLocaleString('ko-KR')}
                        {order.splitPcbSides ? ' · 양면' : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="min-h-0 min-w-0 flex-1">
            {stage === 'delivery' ? (
              <div className="h-full overflow-y-auto p-4">
                {selectedOrder && !availability ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    출하 가능 정보를 불러오지 못했습니다.
                  </p>
                ) : (
                  <DeliveryInputShipPanel
                    order={selectedOrder}
                    availability={availability}
                    embedded
                    onShipped={(assemblyGroupId, _cumulative, nextAvailability) => {
                      setLocalAvailability((prev) => ({
                        ...prev,
                        [assemblyGroupId]: nextAvailability,
                      }))
                      onRegistered()
                    }}
                  />
                )}
              </div>
            ) : (
              <ProductionInputPanel
                order={selectedOrder}
                counts={counts}
                config={
                  stage === 'smt'
                    ? SMT_PRODUCTION_INPUT_CONFIG
                    : POST_PROCESS_PRODUCTION_INPUT_CONFIG
                }
                onCountUpdated={(countKey, cumulative) => {
                  if (stage === 'smt') {
                    setLocalSmtCounts((prev) => ({ ...prev, [countKey]: cumulative }))
                  } else {
                    setLocalPostCounts((prev) => ({ ...prev, [countKey]: cumulative }))
                  }
                  onRegistered()
                }}
              />
            )}
          </div>
        </div>
      )}
    </ErpModal>
  )
}
