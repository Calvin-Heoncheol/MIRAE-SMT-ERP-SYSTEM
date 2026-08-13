'use client'

import { useMemo, useState } from 'react'
import type { BomEdge } from '@/lib/materials/outbound/types'
import type { Material } from '@/lib/materials/types'
import { buildOrderPurchaseMaterialPreview } from '@/lib/materials/purchase-orders/need-utils'
import type {
  MaterialPurchaseSuggestionLine,
  OrderPurchaseCard,
} from '@/lib/materials/purchase-orders/types'
import { ERP_TABLE_TD_WRAP_CLASS } from '@/lib/ui/tokens'

export type PurchaseAssistFillPayload = {
  items: {
    materialId: string
    materialCode: string
    materialName: string
    specification: string
    mpn: string
    quantity: string
    unitPrice: string
    deliveryDate: string
  }[]
  supplier: string
  sourceOrderId?: string
  coveredOrderLineId?: string
  coveredProductQuantity?: number
}

type MaterialPurchaseAssistPanelProps = {
  mode: 'order' | 'stock'
  cards: OrderPurchaseCard[]
  suggestionLines: MaterialPurchaseSuggestionLine[]
  materials: Material[]
  bomEdges: BomEdge[]
  onHandByMaterialId: Record<string, number>
  onClose: () => void
  onFill: (payload: PurchaseAssistFillPayload) => void
}

function openOrderCards(cards: OrderPurchaseCard[]) {
  return cards.filter((card) =>
    card.products.some((product) => product.hasBom && product.remainingQuantity > 0),
  )
}

export function MaterialPurchaseAssistPanel({
  mode,
  cards,
  suggestionLines,
  materials,
  bomEdges,
  onHandByMaterialId,
  onClose,
  onFill,
}: MaterialPurchaseAssistPanelProps) {
  const [search, setSearch] = useState('')
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(
    () => new Set(suggestionLines.map((line) => line.materialId)),
  )
  const [expandedOrderKey, setExpandedOrderKey] = useState<string | null>(null)
  /** 제품별 발주 수량 입력 (orderLineId → text) */
  const [qtyByLineId, setQtyByLineId] = useState<Record<string, string>>({})

  const query = search.trim().toLowerCase()

  const filteredCards = useMemo(() => {
    const open = openOrderCards(cards)
    if (!query) return open
    return open.filter((card) => {
      const haystack = [
        card.orderNumber,
        card.customer,
        ...card.products.flatMap((p) => [p.productName, p.productCode]),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [cards, query])

  const filteredSuggestions = useMemo(() => {
    if (!query) return suggestionLines
    return suggestionLines.filter((line) =>
      [line.materialId, line.materialName, line.specification, line.mpn, line.supplier]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [suggestionLines, query])

  function qtyTextFor(orderLineId: string, remainingQuantity: number) {
    if (Object.prototype.hasOwnProperty.call(qtyByLineId, orderLineId)) {
      return qtyByLineId[orderLineId]
    }
    return String(remainingQuantity)
  }

  function applyOrderProduct(card: OrderPurchaseCard, orderLineId: string) {
    const product = card.products.find((item) => item.orderLineId === orderLineId)
    if (!product || !product.hasBom || product.remainingQuantity <= 0) return

    const purchaseQuantity = Math.max(0, Math.floor(Number(qtyTextFor(orderLineId, product.remainingQuantity)) || 0))
    if (purchaseQuantity <= 0) {
      window.alert('발주 수량을 1 이상 입력하세요.')
      return
    }
    if (purchaseQuantity > product.remainingQuantity) {
      const ok = window.confirm(
        `잔량(${product.remainingQuantity.toLocaleString('ko-KR')})보다 많은 수량입니다. 그대로 진행할까요?`,
      )
      if (!ok) return
    }

    const preview = buildOrderPurchaseMaterialPreview({
      productId: product.productId,
      purchaseQuantity,
      bomEdges,
      materials,
      onHandByMaterialId: new Map(Object.entries(onHandByMaterialId)),
    })

    const unregistered = preview.filter((line) => !line.registered)
    if (unregistered.length > 0) {
      window.alert(
        `품목등록에 없는 자재가 ${unregistered.length}종 있어 발주할 수 없습니다.\n` +
          unregistered
            .map((line) => line.materialCode)
            .slice(0, 15)
            .join(', ') +
          (unregistered.length > 15 ? ' …' : ''),
      )
      return
    }

    const fillLines = preview.filter((line) => line.suggestedQuantity > 0)
    if (!fillLines.length) {
      window.alert('현재고로 충당 가능해 발주할 자재가 없습니다.')
      return
    }

    const suppliers = [...new Set(fillLines.map((line) => line.supplier.trim()).filter(Boolean))]
    onFill({
      items: fillLines.map((line) => ({
        materialId: line.materialId,
        materialCode: line.materialCode,
        materialName: line.materialName,
        specification: line.specification,
        mpn: line.mpn,
        quantity: String(line.suggestedQuantity),
        unitPrice: String(line.unitPrice || 0),
        deliveryDate: '',
      })),
      supplier: suppliers.length === 1 ? suppliers[0] : '',
      sourceOrderId: card.orderId,
      coveredOrderLineId: product.orderLineId,
      coveredProductQuantity: purchaseQuantity,
    })
  }

  function applyStockSelection() {
    const selected = filteredSuggestions.filter((line) => selectedMaterialIds.has(line.materialId))
    if (!selected.length) {
      window.alert('발주할 자재를 선택하세요.')
      return
    }
    const suppliers = [...new Set(selected.map((line) => line.supplier.trim()).filter(Boolean))]
    onFill({
      items: selected.map((line) => ({
        materialId: line.materialId,
        materialCode: line.materialId,
        materialName: line.materialName,
        specification: line.specification,
        mpn: line.mpn,
        quantity: String(line.suggestedQuantity),
        unitPrice: String(line.unitPrice || 0),
        deliveryDate: '',
      })),
      supplier: suppliers.length === 1 ? suppliers[0] : '',
    })
  }

  const allSelected =
    filteredSuggestions.length > 0 &&
    filteredSuggestions.every((line) => selectedMaterialIds.has(line.materialId))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {mode === 'order' ? '미발주 주문서' : '재고현황 · 발주필요'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {mode === 'order'
                ? '제품별 발주 수량을 입력한 뒤 BOM 채우기를 누르면, 소요(현재고 차감)가 품목표에 채워집니다.'
                : '발주필요 자재를 고른 뒤 품목표에 반영하세요.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-2xl text-slate-500 hover:bg-slate-100"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-100 px-5 py-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              mode === 'order'
                ? '주문번호 · 고객사 · 제품명 검색…'
                : '자재코드 · 자재명 · 공급사 검색…'
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {mode === 'order' ? (
            !filteredCards.length ? (
              <p className="py-10 text-center text-sm text-slate-500">미발주 주문서가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {filteredCards.map((card) => {
                  const expanded = expandedOrderKey === card.key
                  const openProducts = card.products.filter(
                    (product) => product.hasBom && product.remainingQuantity > 0,
                  )
                  return (
                    <div
                      key={card.key}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOrderKey(expanded ? null : card.key)
                        }
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-bold text-slate-900">
                            {card.orderNumber}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {card.customer || '—'} · 납기 {card.deliveryDate || '—'} · 미발주{' '}
                            {openProducts.length}종
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-slate-400">
                          {expanded ? '접기' : '펼치기'}
                        </span>
                      </button>
                      {expanded ? (
                        <div className="space-y-1.5 border-t border-slate-100 bg-slate-50 px-3 py-3">
                          {openProducts.map((product) => {
                            const qtyText = qtyTextFor(product.orderLineId, product.remainingQuantity)
                            return (
                            <div
                              key={product.orderLineId}
                              className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {product.productName}
                                </p>
                                <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                                  주문 {product.orderQuantity.toLocaleString('ko-KR')} · 기발주{' '}
                                  {product.coveredQuantity.toLocaleString('ko-KR')} · 잔량{' '}
                                  <span className="font-bold text-rose-600">
                                    {product.remainingQuantity.toLocaleString('ko-KR')}
                                  </span>
                                </p>
                              </div>
                              <label className="block shrink-0">
                                <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                                  발주 수량
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  value={qtyText}
                                  onChange={(event) =>
                                    setQtyByLineId((current) => ({
                                      ...current,
                                      [product.orderLineId]: event.target.value,
                                    }))
                                  }
                                  onClick={(event) => event.stopPropagation()}
                                  className="w-28 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm tabular-nums outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                                  aria-label={`${product.productName} 발주 수량`}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => applyOrderProduct(card, product.orderLineId)}
                                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900"
                              >
                                BOM 채우기
                              </button>
                            </div>
                            )
                          })}
                          {card.products.some((product) => !product.hasBom) ? (
                            <p className="px-1 text-xs text-amber-700">
                              BOM 미등록 제품은 표시·발주에서 제외됩니다.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )
          ) : !filteredSuggestions.length ? (
            <p className="py-10 text-center text-sm text-slate-500">발주필요한 자재가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-300">
              <table className="min-w-[880px] w-full border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => {
                          if (allSelected) setSelectedMaterialIds(new Set())
                          else
                            setSelectedMaterialIds(
                              new Set(filteredSuggestions.map((line) => line.materialId)),
                            )
                        }}
                        aria-label="전체 선택"
                        className="size-4 accent-slate-700"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                      자재코드
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                      자재명
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">
                      총소요
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">
                      현재고
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">
                      입고예정
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-rose-600">
                      발주필요
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuggestions.map((line) => {
                    const selected = selectedMaterialIds.has(line.materialId)
                    return (
                      <tr
                        key={line.materialId}
                        onClick={() => {
                          setSelectedMaterialIds((current) => {
                            const next = new Set(current)
                            if (next.has(line.materialId)) next.delete(line.materialId)
                            else next.add(line.materialId)
                            return next
                          })
                        }}
                        className={[
                          'cursor-pointer border-t border-slate-200',
                          selected ? 'bg-slate-50' : 'hover:bg-slate-50/80',
                        ].join(' ')}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              setSelectedMaterialIds((current) => {
                                const next = new Set(current)
                                if (next.has(line.materialId)) next.delete(line.materialId)
                                else next.add(line.materialId)
                                return next
                              })
                            }}
                            onClick={(event) => event.stopPropagation()}
                            className="size-4 accent-slate-700"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">
                          {line.materialId}
                        </td>
                        <td className={`px-3 py-2 text-slate-800 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                          {line.materialName}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {line.totalRequiredQuantity.toLocaleString('ko-KR')}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {line.onHandQuantity.toLocaleString('ko-KR')}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                          {line.pendingInboundQuantity > 0
                            ? line.pendingInboundQuantity.toLocaleString('ko-KR')
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-rose-600">
                          {line.suggestedQuantity.toLocaleString('ko-KR')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            닫기
          </button>
          {mode === 'stock' ? (
            <button
              type="button"
              onClick={applyStockSelection}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
            >
              선택 자재 채우기 ({selectedMaterialIds.size.toLocaleString('ko-KR')})
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
