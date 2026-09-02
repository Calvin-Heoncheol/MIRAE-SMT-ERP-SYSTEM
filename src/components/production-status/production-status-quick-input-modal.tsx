'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { ErpModal } from '@/components/ui/erp-modal'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import {
  createDeliveryRecordsBatch,
  deleteDeliveryRecord,
  fetchDeliveryHistoryByAssemblyGroups,
} from '@/lib/delivery/repository'
import type { DeliveryHistoryRow } from '@/lib/delivery/types'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import { createPostProcessProductionRecord } from '@/lib/post-process/repository'
import { DEFAULT_POST_PROCESS_TEAM } from '@/lib/post-process/teams'
import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'
import {
  formatProductionProductName,
  getProgressPercent,
  resolveProductionCount,
  resolveProductionSideCount,
} from '@/lib/production-input/utils'
import { ADMIN_DIRECT_PRODUCTION_NOTE } from '@/lib/production-status/constants'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { formatProductPcbSideModeLabel } from '@/lib/products/utils'
import type {
  ProductionStatusLine,
  ProductionStatusProductLine,
  ProductionStatusStage,
} from '@/lib/production-status/types'
import { buildSmtCountKey } from '@/lib/smt/count-keys'
import { createSmtProductionRecord } from '@/lib/smt/repository'
import type { SmtPcbSide } from '@/lib/smt/types'
import {
  ERP_FIELD_INPUT_CLASS,
  ERP_FIELD_LABEL_CLASS,
  ERP_PRIMARY_BUTTON_CLASS,
  ERP_SECONDARY_BUTTON_CLASS,
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type ProductionStatusQuickInputModalProps = {
  open: boolean
  stage: ProductionStatusStage
  line: ProductionStatusLine | null
  product?: ProductionStatusProductLine | null
  smtOrders: ProductionOrderLine[]
  postOrders: ProductionOrderLine[]
  deliveryOrders: ProductionOrderLine[]
  smtCounts: ProductionCounts
  postCounts: ProductionCounts
  deliveryCounts: ProductionCounts
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
    description: '생산계획·라인 선택 없이 수량만 등록합니다. 이력 비고에 「생산실사(관리자)」가 기록됩니다.',
    empty: '이 발주서에 SMT 대상 반제품이 없습니다.',
  },
  post_process: {
    title: '후공정 직접 입력 (총관리자)',
    description: '생산계획·팀 선택 없이 수량만 등록합니다. 이력 비고에 「생산실사(관리자)」가 기록됩니다.',
    empty: '이 발주서에 후공정 대상이 없습니다.',
  },
  delivery: {
    title: '출하 직접 입력 (총관리자)',
    description: '',
    empty: '이 발주서에 출하 대상이 없습니다.',
  },
}

type DeliveryRowMeta = {
  order: ProductionOrderLine
  produced: number
  target: number
  shippable: number
  registerMax: number
}

function buildDeliveryRowMeta(
  order: ProductionOrderLine,
  counts: ProductionCounts,
  availabilityByGroupId: Record<string, DeliveryAvailability>,
): DeliveryRowMeta {
  const produced = resolveProductionCount(order, counts)
  const target = order.quantity
  const groupId = order.assemblyGroupId || order.orderLineId
  const shippable = Math.max(
    0,
    Math.floor(Number(availabilityByGroupId[groupId]?.shippable) || 0),
  )
  const orderRemaining = Math.max(0, target - produced)
  const registerMax = orderRemaining
  return { order, produced, target, shippable, registerMax }
}

function buildDefaultDeliveryQtyMap(
  orders: ProductionOrderLine[],
  counts: ProductionCounts,
  availabilityByGroupId: Record<string, DeliveryAvailability>,
) {
  const next: Record<string, string> = {}
  for (const order of orders) {
    const { registerMax } = buildDeliveryRowMeta(order, counts, availabilityByGroupId)
    next[order.uiKey] = registerMax > 0 ? String(registerMax) : ''
  }
  return next
}

function patchDeliveryAvailability(
  availabilityByGroupId: Record<string, DeliveryAvailability>,
  deltas: Array<{ assemblyGroupId: string; shippedDelta: number }>,
) {
  const next = { ...availabilityByGroupId }
  for (const { assemblyGroupId, shippedDelta } of deltas) {
    const avail = next[assemblyGroupId]
    if (!avail) continue
    const shipped = Math.max(0, avail.shipped + shippedDelta)
    next[assemblyGroupId] = {
      ...avail,
      shipped,
      shippable: Math.max(0, avail.productionCap - shipped),
    }
  }
  return next
}

export function ProductionStatusQuickInputModal({
  open,
  stage,
  line,
  product = null,
  smtOrders,
  postOrders,
  deliveryOrders,
  smtCounts,
  postCounts,
  deliveryCounts,
  deliveryAvailabilityByGroupId,
  onClose,
  onRegistered,
}: ProductionStatusQuickInputModalProps) {
  const [selectedKey, setSelectedKey] = useState('')
  const [localSmtCounts, setLocalSmtCounts] = useState(smtCounts)
  const [localPostCounts, setLocalPostCounts] = useState(postCounts)
  const [localDeliveryCounts, setLocalDeliveryCounts] = useState(deliveryCounts)
  const [localAvailability, setLocalAvailability] = useState(deliveryAvailabilityByGroupId)
  const [activeSide, setActiveSide] = useState<SmtPcbSide>('TOP')
  const [qty, setQty] = useState('')
  const [deliveryQtyByKey, setDeliveryQtyByKey] = useState<Record<string, string>>({})
  const [deliveryRecordDate, setDeliveryRecordDate] = useState(() => todayYmdSeoul())
  const [recentHistory, setRecentHistory] = useState<DeliveryHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [deletingRecordId, setDeletingRecordId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)
  const confirm = useErpConfirm()
  const canDelete = useCanDeleteRecords()
  const historyLoadSeq = useRef(0)

  const orderTargets = useMemo(() => {
    if (!line) return [] as ProductionOrderLine[]
    if (stage === 'smt') {
      return smtOrders.filter((order) => {
        if (order.orderId !== line.orderId) return false
        if (!product) return true
        return product.smtOrderLineIds.includes(order.orderLineId)
      })
    }
    if (stage === 'post_process') {
      return postOrders.filter((order) => {
        if (order.orderId !== line.orderId) return false
        if (!product) return true
        const groupId = order.assemblyGroupId || order.orderLineId
        return product.assemblyGroupIds.includes(groupId)
      })
    }
    return deliveryOrders.filter((order) => {
      if (order.orderId !== line.orderId) return false
      if (!product) return true
      const groupId = order.assemblyGroupId || order.orderLineId
      return product.assemblyGroupIds.includes(groupId)
    })
  }, [deliveryOrders, line, postOrders, product, smtOrders, stage])

  const deliveryRows = useMemo(() => {
    if (stage !== 'delivery') return [] as DeliveryRowMeta[]
    return orderTargets.map((order) =>
      buildDeliveryRowMeta(order, localDeliveryCounts, localAvailability),
    )
  }, [localAvailability, localDeliveryCounts, orderTargets, stage])

  const deliveryAssemblyGroupIds = useMemo(
    () =>
      orderTargets
        .map((order) => String(order.assemblyGroupId || order.orderLineId || '').trim())
        .filter(Boolean),
    [orderTargets],
  )

  const loadRecentHistory = useCallback(async () => {
    const seq = ++historyLoadSeq.current
    if (!deliveryAssemblyGroupIds.length) {
      if (seq === historyLoadSeq.current) setRecentHistory([])
      return
    }
    setHistoryLoading(true)
    const result = await fetchDeliveryHistoryByAssemblyGroups(deliveryAssemblyGroupIds, { limit: 20 })
    if (seq !== historyLoadSeq.current) return
    setHistoryLoading(false)
    if (result.ok) setRecentHistory(result.rows)
  }, [deliveryAssemblyGroupIds])

  useEffect(() => {
    if (!open) return
    setLocalSmtCounts(smtCounts)
    setLocalPostCounts(postCounts)
    setLocalDeliveryCounts(deliveryCounts)
    setLocalAvailability(deliveryAvailabilityByGroupId)
    setSelectedKey(orderTargets[0]?.uiKey || '')
    setQty('')
    setMessage(null)
    setActiveSide('TOP')
    if (stage === 'delivery') {
      setDeliveryRecordDate(todayYmdSeoul())
      setDeliveryQtyByKey(
        buildDefaultDeliveryQtyMap(orderTargets, deliveryCounts, deliveryAvailabilityByGroupId),
      )
      void loadRecentHistory()
    }
    return () => {
      historyLoadSeq.current += 1
    }
  }, [
    deliveryAvailabilityByGroupId,
    deliveryCounts,
    loadRecentHistory,
    open,
    orderTargets,
    postCounts,
    smtCounts,
    stage,
  ])

  const selectedOrder = orderTargets.find((order) => order.uiKey === selectedKey) ?? null
  const meta = STAGE_META[stage]
  const isDual = Boolean(selectedOrder?.splitPcbSides) && stage === 'smt'
  const pcbSide: SmtPcbSide = isDual ? (activeSide === 'BOT' ? 'BOT' : 'TOP') : 'SINGLE'

  const produced = selectedOrder
    ? stage === 'smt'
      ? resolveProductionSideCount(selectedOrder, localSmtCounts, pcbSide)
      : resolveProductionCount(
          selectedOrder,
          stage === 'delivery' ? localDeliveryCounts : localPostCounts,
        )
    : 0

  const target = selectedOrder?.quantity ?? 0
  const registerMax = Math.max(0, target - produced)
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

    const assemblyGroupId = selectedOrder.assemblyGroupId || selectedOrder.orderLineId
    const result = await createPostProcessProductionRecord({
      assemblyGroupId,
      quantity: value,
      note: ADMIN_DIRECT_PRODUCTION_NOTE,
      source: 'manual',
      team: DEFAULT_POST_PROCESS_TEAM,
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
  }

  async function handleDeliveryTableSubmit() {
    const shipDate = deliveryRecordDate.trim()
    if (!shipDate) {
      setMessage({ text: '출하일을 선택하세요.', kind: 'err' })
      return
    }

    const entries = deliveryRows
      .map((row) => ({
        row,
        value: Math.floor(Number(deliveryQtyByKey[row.order.uiKey] || 0)),
      }))
      .filter(({ value }) => value >= 1)

    if (!entries.length) {
      setMessage({ text: '등록할 수량을 입력하세요.', kind: 'err' })
      return
    }

    for (const { row, value } of entries) {
      if (value > row.registerMax) {
        setMessage({
          text: `${formatProductionProductName(row.order)}: 남은 수량(${row.registerMax.toLocaleString('ko-KR')})을 초과할 수 없습니다.`,
          kind: 'err',
        })
        return
      }
    }

    setSaving(true)
    setMessage(null)

    const batchResult = await createDeliveryRecordsBatch(
      entries.map(({ row, value }) => ({
        assemblyGroupId: row.order.assemblyGroupId || row.order.orderLineId,
        quantity: value,
        recordDate: shipDate,
        note: ADMIN_DIRECT_PRODUCTION_NOTE,
        source: 'manual' as const,
      })),
    )

    if (!batchResult.ok) {
      setSaving(false)
      setMessage({ text: batchResult.detail, kind: 'err' })
      return
    }

    let totalQty = 0
    let nextCounts = { ...localDeliveryCounts }
    for (const { record, cumulative } of batchResult.results) {
      nextCounts = { ...nextCounts, [record.assemblyGroupId]: cumulative }
      totalQty += record.quantity
    }

    const nextAvailability = patchDeliveryAvailability(
      localAvailability,
      batchResult.results.map((item) => ({
        assemblyGroupId: item.record.assemblyGroupId,
        shippedDelta: item.record.quantity,
      })),
    )

    setLocalDeliveryCounts(nextCounts)
    setLocalAvailability(nextAvailability)
    setSaving(false)
    setMessage({
      text: `${entries.length}건 · ${totalQty.toLocaleString('ko-KR')}개 등록 완료`,
      kind: 'ok',
    })
    setDeliveryQtyByKey(buildDefaultDeliveryQtyMap(orderTargets, nextCounts, nextAvailability))
    await loadRecentHistory()
    onRegistered()
  }

  async function handleDeleteHistoryRecord(row: DeliveryHistoryRow) {
    if (
      !(await confirm({
        title: '출하 이력 삭제',
        message: `${row.recordDate} · ${row.productName} ${row.quantity.toLocaleString('ko-KR')}개를 삭제할까요?`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }

    setDeletingRecordId(row.id)
    setMessage(null)
    const result = await deleteDeliveryRecord(row.id)
    setDeletingRecordId('')
    if (!result.ok) {
      setMessage({ text: result.detail, kind: 'err' })
      return
    }
    setMessage({ text: '출하 이력을 삭제했습니다.', kind: 'ok' })
    const nextCounts = {
      ...localDeliveryCounts,
      [row.assemblyGroupId]: Math.max(0, (localDeliveryCounts[row.assemblyGroupId] || 0) - row.quantity),
    }
    const nextAvailability = patchDeliveryAvailability(localAvailability, [
      { assemblyGroupId: row.assemblyGroupId, shippedDelta: -row.quantity },
    ])
    setLocalDeliveryCounts(nextCounts)
    setLocalAvailability(nextAvailability)
    setDeliveryQtyByKey(buildDefaultDeliveryQtyMap(orderTargets, nextCounts, nextAvailability))
    await loadRecentHistory()
    onRegistered()
  }

  if (stage === 'delivery') {
    const hasRegisterable = deliveryRows.some((row) => row.registerMax > 0)

    return (
      <ErpModal
        open={open}
        size="lg"
        title={meta.title}
        description={
          line
            ? `${line.orderNumber} · ${line.customer || '—'} · ${product?.productName || line.productName || '—'}`
            : undefined
        }
        onClose={onClose}
        contentClassName="min-h-0 flex-1 overflow-hidden p-0"
      >
        {!orderTargets.length ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">{meta.empty}</div>
        ) : (
          <div className="flex min-h-0 flex-col p-5" style={{ minHeight: '20rem' }}>
            <label className="mb-4 block shrink-0 text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>
                출하일 <span className="text-rose-600">*</span>
              </span>
              <input
                type="date"
                value={deliveryRecordDate}
                disabled={saving}
                onChange={(event) => setDeliveryRecordDate(event.target.value)}
                className={ERP_FIELD_INPUT_CLASS}
              />
            </label>

            <div className={`${ERP_TABLE_WRAP_CLASS} min-h-0 flex-1`}>
              <div className={ERP_TABLE_SCROLL_CLASS}>
                <table className={`${ERP_TABLE_CLASS} min-w-[640px]`}>
                  <thead className={ERP_TABLE_HEAD_CLASS}>
                    <tr>
                      <th className={ERP_TABLE_TH_CLASS}>품목</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-right`}>목표</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-right`}>누적</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-right`}>출하가능</th>
                      <th className={`${ERP_TABLE_TH_CLASS} w-32 text-right`}>등록수량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryRows.map((row) => {
                      const qtyValue = deliveryQtyByKey[row.order.uiKey] ?? ''
                      const disabled = row.registerMax <= 0 || saving
                      return (
                        <tr key={row.order.uiKey}>
                          <td className={ERP_TABLE_TD_CLASS}>
                            <span className="font-medium text-slate-900">
                              {formatProductionProductName(row.order)}
                            </span>
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-600`}>
                            {row.target.toLocaleString('ko-KR')}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-600`}>
                            {row.produced.toLocaleString('ko-KR')}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-600`}>
                            {row.shippable.toLocaleString('ko-KR')}
                          </td>
                          <td className={ERP_TABLE_TD_CLASS}>
                            <input
                              type="number"
                              min={0}
                              max={row.registerMax || undefined}
                              value={qtyValue}
                              onChange={(event) =>
                                setDeliveryQtyByKey((prev) => ({
                                  ...prev,
                                  [row.order.uiKey]: event.target.value,
                                }))
                              }
                              disabled={disabled}
                              className={`${ERP_FIELD_INPUT_CLASS} w-full text-right tabular-nums`}
                              placeholder={row.registerMax > 0 ? String(row.registerMax) : '—'}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {message ? (
              <p
                className={[
                  'mt-3 shrink-0 text-sm',
                  message.kind === 'ok' ? 'text-emerald-700' : 'text-rose-600',
                ].join(' ')}
              >
                {message.text}
              </p>
            ) : null}

            <div className="mt-4 flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleDeliveryTableSubmit()}
                disabled={saving || !hasRegisterable}
                className={ERP_PRIMARY_BUTTON_CLASS}
              >
                {saving ? '등록 중…' : '등록'}
              </button>
              <button type="button" onClick={onClose} className={ERP_SECONDARY_BUTTON_CLASS}>
                닫기
              </button>
            </div>

            <section className="mt-5 shrink-0 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">최근 출하 이력</h3>
              {historyLoading ? (
                <p className="mt-2 text-sm text-slate-500">불러오는 중…</p>
              ) : recentHistory.length ? (
                <div className={`${ERP_TABLE_WRAP_CLASS} mt-2 max-h-48`}>
                  <div className={ERP_TABLE_SCROLL_CLASS}>
                    <table className={`${ERP_TABLE_CLASS} min-w-[520px]`}>
                      <thead className={ERP_TABLE_HEAD_CLASS}>
                        <tr>
                          <th className={ERP_TABLE_TH_CLASS}>출하일</th>
                          <th className={ERP_TABLE_TH_CLASS}>품목</th>
                          <th className={`${ERP_TABLE_TH_CLASS} text-right`}>수량</th>
                          <th className={`${ERP_TABLE_TH_CLASS} text-right`}>등록자</th>
                          {canDelete ? <th className={`${ERP_TABLE_TH_CLASS} w-16 text-center`} /> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {recentHistory.map((row) => (
                          <tr key={row.id}>
                            <td className={`${ERP_TABLE_TD_CLASS} whitespace-nowrap text-slate-700`}>
                              {row.recordDate || '—'}
                            </td>
                            <td className={ERP_TABLE_TD_CLASS}>
                              <span className="font-medium text-slate-900">{row.productName || '—'}</span>
                            </td>
                            <td className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-700`}>
                              {row.quantity.toLocaleString('ko-KR')}
                            </td>
                            <td className={`${ERP_TABLE_TD_CLASS} text-right text-xs text-slate-500`}>
                              {row.createdByName || '—'}
                            </td>
                            {canDelete ? (
                              <td className={`${ERP_TABLE_TD_CLASS} text-center`}>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteHistoryRecord(row)}
                                  disabled={Boolean(deletingRecordId) || saving}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-40"
                                >
                                  {deletingRecordId === row.id ? '…' : '삭제'}
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">출하 이력이 없습니다.</p>
              )}
            </section>
          </div>
        )}
      </ErpModal>
    )
  }

  return (
    <ErpModal
      open={open}
      size="md"
      title={meta.title}
      description={
        line
          ? `${line.orderNumber} · ${line.customer || '—'} · ${product?.productName || line.productName || '—'}`
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
                const done = resolveProductionCount(
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
                        {stage === 'smt' ? ` · ${formatProductPcbSideModeLabel(order.pcbSideMode)}` : ''}
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
