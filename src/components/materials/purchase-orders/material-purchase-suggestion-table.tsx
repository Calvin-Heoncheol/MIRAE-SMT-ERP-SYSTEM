'use client'

import { useMemo, useState } from 'react'
import type { MaterialPurchaseOrderItemForm } from '@/lib/materials/purchase-orders/form-state'
import type { MaterialPurchaseSuggestionLine } from '@/lib/materials/purchase-orders/types'

type MaterialPurchaseSuggestionTableProps = {
  lines: MaterialPurchaseSuggestionLine[]
  onCreateOrder: (items: MaterialPurchaseOrderItemForm[], supplier: string) => void
}

/** 자재 기준 발주 제안 — 전체 주문 소요 합산 대비 부족한 자재 목록 (표준 MRP) */
export function MaterialPurchaseSuggestionTable({
  lines,
  onCreateOrder,
}: MaterialPurchaseSuggestionTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(lines.map((line) => line.materialId)),
  )

  const selectedLines = useMemo(
    () => lines.filter((line) => selectedIds.has(line.materialId)),
    [lines, selectedIds],
  )

  const allSelected = lines.length > 0 && selectedLines.length === lines.length

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(lines.map((line) => line.materialId)))
  }

  function toggleOne(materialId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(materialId)) next.delete(materialId)
      else next.add(materialId)
      return next
    })
  }

  function handleCreateOrder() {
    if (!selectedLines.length) return
    const items: MaterialPurchaseOrderItemForm[] = selectedLines.map((line) => ({
      materialId: line.materialId,
      materialCode: line.materialId,
      materialName: line.materialName,
      specification: line.specification,
      mpn: line.mpn,
      quantity: String(line.suggestedQuantity),
      unitPrice: String(line.unitPrice || 0),
    }))
    const suppliers = [...new Set(selectedLines.map((line) => line.supplier.trim()).filter(Boolean))]
    onCreateOrder(items, suppliers.length === 1 ? suppliers[0] : '')
  }

  if (!lines.length) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-bold text-slate-900">발주 제안</h3>
        </div>
        <div className="px-5 py-8 text-center text-sm text-slate-500">
          발주가 필요한 자재가 없습니다. 모든 주문 소요가 현재고와 입고예정으로 충당됩니다.
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            발주 제안{' '}
            <span className="tabular-nums font-semibold text-rose-600">{lines.length}</span>종
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            전체 주문 소요 합계 기준: 발주필요 = 총소요 − 현재고 − 입고예정
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateOrder}
          disabled={!selectedLines.length}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          선택 자재 발주 ({selectedLines.length.toLocaleString('ko-KR')})
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[44px]" />
            <col className="w-[120px]" />
            <col className="w-[180px]" />
            <col className="w-[150px]" />
            <col className="w-[120px]" />
            <col className="w-[92px]" />
            <col className="w-[92px]" />
            <col className="w-[92px]" />
            <col className="w-[96px]" />
          </colgroup>
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                  className="size-4 accent-violet-600"
                />
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                자재코드
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                자재명
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                규격
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                공급사
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600">
                총소요
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600">
                현재고
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600">
                입고예정
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-rose-600">
                발주필요
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const selected = selectedIds.has(line.materialId)
              return (
                <tr
                  key={line.materialId}
                  onClick={() => toggleOne(line.materialId)}
                  className={[
                    'cursor-pointer border-t border-slate-100 transition-colors',
                    selected ? 'bg-violet-50/40' : 'hover:bg-slate-50',
                  ].join(' ')}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleOne(line.materialId)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`${line.materialName} 선택`}
                      className="size-4 accent-violet-600"
                    />
                  </td>
                  <td className="truncate whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700">
                    {line.materialId}
                  </td>
                  <td className="truncate px-3 py-2 text-slate-800" title={line.materialName}>
                    {line.materialName}
                  </td>
                  <td
                    className="truncate px-3 py-2 text-slate-600"
                    title={line.specification || undefined}
                  >
                    {line.specification || '—'}
                  </td>
                  <td className="truncate whitespace-nowrap px-3 py-2 text-slate-600">
                    {line.supplier || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-800">
                    {line.totalRequiredQuantity.toLocaleString('ko-KR')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-800">
                    {line.onHandQuantity.toLocaleString('ko-KR')}
                  </td>
                  <td
                    className={[
                      'whitespace-nowrap px-3 py-2 text-right tabular-nums',
                      line.pendingInboundQuantity > 0
                        ? 'font-semibold text-violet-700'
                        : 'text-slate-400',
                    ].join(' ')}
                  >
                    {line.pendingInboundQuantity > 0
                      ? line.pendingInboundQuantity.toLocaleString('ko-KR')
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-rose-600">
                    {line.suggestedQuantity.toLocaleString('ko-KR')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
