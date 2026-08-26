'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ProductionLabelPrintModal,
  type ProductionLabelOrderOption,
} from '@/components/production-input/production-label-print-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { useToast } from '@/components/ui/toast-provider'
import { createScanDeduper } from '@/lib/materials/inbound/scan-guards'
import { displayOrderPoNumber, todayYmdSeoul } from '@/lib/orders/utils'
import type { PostProcessPlanBlock } from '@/lib/post-process/plan/types'
import { createPostProcessProductionRecord } from '@/lib/post-process/repository'
import type { PostProcessTeam } from '@/lib/post-process/teams'
import {
  lookupProductionUnitLabel,
  markProductionUnitLabelScanned,
  unmarkProductionUnitLabelScanned,
} from '@/lib/production-input/label-repository'
import {
  buildProductionLabelBase,
  type ProductionLabelPayload,
} from '@/lib/production-input/production-label-code'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductName } from '@/lib/production-input/utils'
import { playScanSound } from '@/lib/ui/toast-sound'

type ScanFlash = 'ok' | 'err' | null

type RecentScan = {
  id: string
  code: string
  productLabel: string
  poLabel: string
  at: number
  ok: boolean
  detail: string
}

type PostProcessScanInputPanelProps = {
  team: PostProcessTeam
  orders: ProductionOrderLine[]
  counts: Record<string, number>
  defectCounts: Record<string, number>
  plans?: PostProcessPlanBlock[]
  onCountUpdated: (countKey: string, cumulative: number, defectCumulative?: number) => void
}

function assemblyIdOf(order: ProductionOrderLine) {
  return order.assemblyGroupId || order.orderLineId || ''
}

function findOrderForAssembly(
  assemblyGroupId: string,
  orders: ProductionOrderLine[],
): ProductionOrderLine | null {
  return (
    orders.find(
      (order) =>
        assemblyIdOf(order) === assemblyGroupId || order.orderLineId === assemblyGroupId,
    ) ?? null
  )
}

function jobPayloadForOrder(
  order: ProductionOrderLine,
  team: PostProcessTeam,
  plan: PostProcessPlanBlock | null,
): ProductionLabelPayload | null {
  if (plan?.id) return { kind: 'post_plan', planId: plan.id }
  const assemblyGroupId = assemblyIdOf(order)
  if (!assemblyGroupId) return null
  return { kind: 'post_order', assemblyGroupId, team }
}

export function PostProcessScanInputPanel({
  team,
  orders,
  counts,
  defectCounts,
  plans = [],
  onCountUpdated,
}: PostProcessScanInputPanelProps) {
  const toast = useToast()
  const scanInputRef = useRef<HTMLInputElement>(null)
  const scanDeduperRef = useRef(createScanDeduper(500))

  const [scanCode, setScanCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<ScanFlash>(null)
  const [statusText, setStatusText] = useState('바코드를 스캔하면 양품이 등록됩니다.')
  const [statusKind, setStatusKind] = useState<'idle' | 'ok' | 'err'>('idle')
  const [activeOrderKey, setActiveOrderKey] = useState('')
  const [recent, setRecent] = useState<RecentScan[]>([])
  const [labelModalOpen, setLabelModalOpen] = useState(false)

  const activeOrder = orders.find((order) => order.uiKey === activeOrderKey) ?? null

  const activeAssemblyId = activeOrder ? assemblyIdOf(activeOrder) : ''
  const cumulative = activeAssemblyId
    ? Math.max(0, Math.floor(Number(counts[activeAssemblyId] || 0)))
    : 0
  const defectCumulative = activeAssemblyId
    ? Math.max(0, Math.floor(Number(defectCounts[activeAssemblyId] || 0)))
    : 0
  const target = activeOrder ? Math.max(0, Math.floor(activeOrder.quantity)) : 0
  const remaining = Math.max(0, target - cumulative)

  const labelOrderOptions = useMemo((): ProductionLabelOrderOption[] => {
    return orders.flatMap((order) => {
      const aid = assemblyIdOf(order)
      const plan =
        plans.find(
          (item) =>
            item.team === team &&
            (item.assemblyGroupId === aid || item.assemblyGroupId === order.orderLineId),
        ) ?? null
      const payload = jobPayloadForOrder(order, team, plan)
      if (!payload) return []
      const done = Math.max(0, Math.floor(Number(counts[aid] || 0)))
      const tgt = Math.max(0, Math.floor(order.quantity))
      return [
        {
          key: order.uiKey,
          productLabel: formatProductionProductName(order),
          productCode: order.productCode.trim() || '—',
          orderLabel: displayOrderPoNumber(order.customerPoNumber, order.orderNumber),
          labelBaseCode: buildProductionLabelBase(payload),
          remaining: Math.max(0, tgt - done),
          assemblyGroupId: aid,
          team,
          planId: plan?.id ?? null,
        },
      ]
    })
  }, [orders, plans, team, counts])

  useEffect(() => {
    const timer = window.setTimeout(() => scanInputRef.current?.focus(), 150)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 700)
    return () => window.clearTimeout(timer)
  }, [flash])

  function pushRecent(entry: Omit<RecentScan, 'id' | 'at'>) {
    setRecent((current) =>
      [
        { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now() },
        ...current,
      ].slice(0, 8),
    )
  }

  function focusScanSoon() {
    window.setTimeout(() => scanInputRef.current?.focus(), 50)
  }

  function failScan(detail: string, code?: string, order?: ProductionOrderLine | null) {
    playScanSound('error')
    setFlash('err')
    setStatusKind('err')
    setStatusText(detail)
    toast.error('스캔 실패', detail)
    if (code) {
      pushRecent({
        code,
        productLabel: order ? formatProductionProductName(order) : '—',
        poLabel: order
          ? displayOrderPoNumber(order.customerPoNumber, order.orderNumber)
          : '—',
        ok: false,
        detail,
      })
    }
    focusScanSoon()
  }

  async function registerGood(order: ProductionOrderLine, note?: string) {
    const assemblyGroupId = assemblyIdOf(order)
    const orderCumulative = Math.max(0, Math.floor(Number(counts[assemblyGroupId] || 0)))
    const orderTarget = Math.max(0, Math.floor(order.quantity))
    const orderRemaining = Math.max(0, orderTarget - orderCumulative)
    if (orderRemaining < 1) {
      return { ok: false as const, detail: '남은 수량이 없습니다.' }
    }

    const result = await createPostProcessProductionRecord({
      assemblyGroupId,
      quantity: 1,
      defectQuantity: 0,
      note,
      recordDate: todayYmdSeoul(),
      team,
    })
    if (!result.ok) return { ok: false as const, detail: result.detail }

    onCountUpdated(assemblyGroupId, result.cumulative, result.defectCumulative)
    return {
      ok: true as const,
      cumulative: result.cumulative,
      remaining: Math.max(0, orderTarget - result.cumulative),
    }
  }

  async function handleScan(raw: string) {
    const code = raw.trim()
    setScanCode('')
    if (!code || saving) return
    if (!scanDeduperRef.current.accept(code)) return

    setSaving(true)
    try {
      const looked = await lookupProductionUnitLabel(code)
      if (!looked.ok) {
        failScan(looked.detail, code)
        return
      }

      const label = looked.label
      if (label.scannedAt) {
        failScan('이미 스캔한 라벨입니다.', code)
        return
      }
      if (label.team !== team) {
        failScan(`${label.team} 라벨입니다. ${team} 화면에서 스캔하세요.`, code)
        return
      }

      const order = findOrderForAssembly(label.assemblyGroupId, orders)
      if (!order) {
        failScan('연결된 주문 건을 찾을 수 없습니다.', code)
        return
      }

      setActiveOrderKey(order.uiKey)

      const marked = await markProductionUnitLabelScanned(label.barcode, team)
      if (!marked.ok) {
        failScan(marked.detail, code, order)
        return
      }

      const result = await registerGood(order, `라벨 ${label.barcode}`)
      if (!result.ok) {
        await unmarkProductionUnitLabelScanned(label.barcode)
        failScan(result.detail, code, order)
        return
      }

      playScanSound('success')
      setFlash('ok')
      setStatusKind('ok')
      const productLabel = formatProductionProductName(order)
      const poLabel = displayOrderPoNumber(order.customerPoNumber, order.orderNumber)
      setStatusText(
        `${productLabel} · 양품 +1 · 누적 ${result.cumulative.toLocaleString('ko-KR')} / 잔량 ${result.remaining.toLocaleString('ko-KR')}`,
      )
      toast.success('스캔 등록', `${productLabel} · 양품 +1`)
      pushRecent({
        code: label.barcode,
        productLabel,
        poLabel,
        ok: true,
        detail: `누적 ${result.cumulative.toLocaleString('ko-KR')}`,
      })
      focusScanSoon()
    } finally {
      setSaving(false)
    }
  }

  const flashClass =
    flash === 'ok'
      ? 'ring-4 ring-emerald-400 bg-emerald-50'
      : flash === 'err'
        ? 'ring-4 ring-rose-400 bg-rose-50'
        : 'ring-1 ring-slate-200 bg-white'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">
            {team}
          </span>
          <span className="text-sm text-slate-500">스캔 등록</span>
        </div>
        <ErpButton type="button" onClick={() => setLabelModalOpen(true)}>
          라벨 출력
        </ErpButton>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain bg-slate-50 p-3 sm:p-4">
        <section className={`rounded-xl border p-4 shadow-sm transition ${flashClass}`}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-800">바코드 스캔</span>
            <input
              ref={scanInputRef}
              type="text"
              value={scanCode}
              disabled={saving}
              onChange={(event) => setScanCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleScan(scanCode)
                }
              }}
              placeholder="스캐너로 찍거나 입력 후 Enter"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-4 font-mono text-xl font-semibold tracking-wide text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:opacity-50"
            />
          </label>
          <p
            className={[
              'mt-3 text-sm font-medium',
              statusKind === 'ok'
                ? 'text-emerald-700'
                : statusKind === 'err'
                  ? 'text-rose-700'
                  : 'text-slate-500',
            ].join(' ')}
          >
            {saving ? '등록 중…' : statusText}
          </p>
        </section>

        {activeOrder ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              현재 건
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {formatProductionProductName(activeOrder)}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {displayOrderPoNumber(activeOrder.customerPoNumber, activeOrder.orderNumber)}
              {activeOrder.customer ? ` · ${activeOrder.customer}` : ''}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 px-2 py-2">
                <p className="text-[10px] font-semibold text-slate-500">누적</p>
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {cumulative.toLocaleString('ko-KR')}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-2">
                <p className="text-[10px] font-semibold text-slate-500">목표</p>
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {target.toLocaleString('ko-KR')}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-2 py-2">
                <p className="text-[10px] font-semibold text-emerald-700">잔량</p>
                <p className="text-lg font-bold tabular-nums text-emerald-800">
                  {remaining.toLocaleString('ko-KR')}
                </p>
              </div>
            </div>
            {defectCumulative > 0 ? (
              <p className="mt-2 text-xs text-rose-600">
                불량 누적 {defectCumulative.toLocaleString('ko-KR')}
              </p>
            ) : null}
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center text-sm text-slate-500">
            스캔하면 주문·제품 정보가 여기에 표시됩니다.
          </section>
        )}

        {recent.length > 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">최근 스캔</h3>
            <ul className="mt-2 divide-y divide-slate-100">
              {recent.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-2 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">
                      {item.productLabel}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-slate-500">
                      {item.code}
                    </span>
                  </span>
                  <span
                    className={[
                      'shrink-0 text-xs font-semibold',
                      item.ok ? 'text-emerald-700' : 'text-rose-600',
                    ].join(' ')}
                  >
                    {item.ok ? item.detail : '실패'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <ProductionLabelPrintModal
        open={labelModalOpen}
        onClose={() => {
          setLabelModalOpen(false)
          focusScanSoon()
        }}
        orderOptions={labelOrderOptions}
        saving={saving}
      />
    </div>
  )
}
