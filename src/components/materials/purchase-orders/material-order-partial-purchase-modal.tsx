'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BomEdge } from '@/lib/materials/outbound/types'
import type { Material } from '@/lib/materials/types'
import { buildOrderPurchaseMaterialPreview } from '@/lib/materials/purchase-orders/need-utils'
import type {
  OrderPurchaseCard,
  OrderPurchaseProductLine,
} from '@/lib/materials/purchase-orders/types'

type MaterialOrderPartialPurchaseModalProps = {
  open: boolean
  card: OrderPurchaseCard
  product: OrderPurchaseProductLine
  materials: Material[]
  bomEdges: BomEdge[]
  onHandByMaterialId: Record<string, number>
  onClose: () => void
  onConfirm: (purchaseQuantity: number) => void
}

export function MaterialOrderPartialPurchaseModal({
  open,
  card,
  product,
  materials,
  bomEdges,
  onHandByMaterialId,
  onClose,
  onConfirm,
}: MaterialOrderPartialPurchaseModalProps) {
  const [qtyText, setQtyText] = useState(String(product.remainingQuantity || ''))

  useEffect(() => {
    if (!open) return
    setQtyText(String(product.remainingQuantity || ''))
  }, [open, product.orderLineId, product.remainingQuantity])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const purchaseQuantity = Math.max(0, Math.floor(Number(qtyText) || 0))
  const overRemaining = purchaseQuantity > product.remainingQuantity

  const preview = useMemo(() => {
    if (purchaseQuantity <= 0) return []
    return buildOrderPurchaseMaterialPreview({
      productId: product.productId,
      purchaseQuantity,
      bomEdges,
      materials,
      onHandByMaterialId: new Map(Object.entries(onHandByMaterialId)),
    })
  }, [bomEdges, materials, onHandByMaterialId, product.productId, purchaseQuantity])

  const shortageCount = preview.filter((line) => line.suggestedQuantity > 0).length

  function handleConfirm() {
    if (purchaseQuantity <= 0) return
    if (overRemaining) {
      const ok = window.confirm(
        `잔량(${product.remainingQuantity.toLocaleString('ko-KR')})보다 많은 수량입니다. 그대로 진행할까요?`,
      )
      if (!ok) return
    }
    onConfirm(purchaseQuantity)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="partial-purchase-title"
        className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="partial-purchase-title" className="text-lg font-bold text-slate-900">
              발주
            </h2>
            <p className="mt-1 font-mono text-sm font-semibold text-violet-700">{card.orderNumber}</p>
            <p className="mt-0.5 truncate text-sm text-slate-600">
              {card.customer || '—'} · {product.productName}
              {product.productCode ? ` [${product.productCode}]` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">주문 수량</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                {product.orderQuantity.toLocaleString('ko-KR')}
              </p>
            </div>
            <div className="rounded-lg bg-sky-50 px-3 py-2">
              <p className="text-[11px] text-sky-700">발주</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-sky-900">
                {product.coveredQuantity.toLocaleString('ko-KR')}
              </p>
            </div>
            <div className="rounded-lg bg-violet-50 px-3 py-2">
              <p className="text-[11px] text-violet-700">잔량</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-violet-900">
                {product.remainingQuantity.toLocaleString('ko-KR')}
              </p>
            </div>
            <label className="rounded-lg border border-violet-200 bg-white px-3 py-2">
              <span className="text-[11px] font-semibold text-violet-800">이번 발주 수량</span>
              <input
                type="number"
                min={1}
                step={1}
                value={qtyText}
                onChange={(event) => setQtyText(event.target.value)}
                className="mt-0.5 w-full border-0 bg-transparent p-0 text-base font-bold tabular-nums text-slate-900 outline-none"
              />
            </label>
          </div>
          {overRemaining ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              잔량보다 많습니다. 저장 시 커버 수량으로 그대로 기록됩니다.
            </p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800">BOM 자재 소요 미리보기</h3>
            <p className="text-xs text-slate-500">
              발주수량 부족 {shortageCount.toLocaleString('ko-KR')}종
            </p>
          </div>

          {!preview.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              발주 수량을 입력하면 자재 소요가 표시됩니다.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[760px] w-full border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">자재</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">공급사</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600">소요</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600">현재고</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600">발주수량</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((line) => (
                    <tr key={line.materialId} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{line.materialName}</p>
                        <p className="font-mono text-[11px] text-slate-500">{line.materialCode}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{line.supplier || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                        {line.requiredQuantity.toLocaleString('ko-KR')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                        {line.onHandQuantity.toLocaleString('ko-KR')}
                      </td>
                      <td
                        className={[
                          'px-3 py-2 text-right font-semibold tabular-nums',
                          line.suggestedQuantity > 0 ? 'text-rose-600' : 'text-emerald-700',
                        ].join(' ')}
                      >
                        {line.suggestedQuantity.toLocaleString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p className="text-xs text-slate-500">
            발주서에는 이번 수량 기준 BOM 소요가 기본으로 들어갑니다. 현재고가 있으면 발주서에서 수량을
            줄이면 됩니다.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={purchaseQuantity <= 0}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              발주서 작성
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
