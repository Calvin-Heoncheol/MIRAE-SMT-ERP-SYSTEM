'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { ErpModal } from '@/components/ui/erp-modal'
import type { BomEdge } from '@/lib/materials/outbound/types'
import type { Material } from '@/lib/materials/types'
import { buildOrderPurchaseMaterialPreview } from '@/lib/materials/purchase-orders/need-utils'
import type {
  OrderPurchaseCard,
  OrderPurchaseProductLine,
} from '@/lib/materials/purchase-orders/types'
import { ERP_TABLE_HEAD_CLASS } from '@/lib/ui/tokens'

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
  // 기본값을 잔량 전체로 두면, 수량 미수정 저장 시 전량 커버로 카드가 완료 탭으로 넘어감
  const confirm = useErpConfirm()
  const [qtyText, setQtyText] = useState('')

  useEffect(() => {
    if (!open) return
    setQtyText('')
  }, [open, product.orderLineId, product.remainingQuantity])

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
  const unregistered = preview.filter((line) => !line.registered)
  const unregisteredCodes = unregistered.map((line) => line.materialCode)
  const canCreateOrder = purchaseQuantity > 0 && unregistered.length === 0

  async function handleConfirm() {
    if (!canCreateOrder) return
    if (unregistered.length > 0) {
      window.alert(
        `품목등록에 없는 자재가 ${unregistered.length}종 있습니다.\n` +
          `${unregisteredCodes.slice(0, 10).join(', ')}` +
          (unregisteredCodes.length > 10 ? ' …' : '') +
          `\n품목등록 후 다시 구매발주해 주세요.`,
      )
      return
    }
    if (overRemaining) {
      if (
        !(await confirm({
          title: '잔량 초과 구매발주',
          message: `잔량(${product.remainingQuantity.toLocaleString('ko-KR')})보다 많은 수량입니다. 그대로 진행할까요?`,
          confirmLabel: '확인',
          tone: 'default',
        }))
      ) {
        return
      }
    } else {
      const nextRemaining = Math.max(0, product.remainingQuantity - purchaseQuantity)
      if (
        !(await confirm({
          title: '구매발주 진행',
          message:
            `이번 구매발주 ${purchaseQuantity.toLocaleString('ko-KR')}개로 진행할까요?\n` +
            `(발주 ${product.orderQuantity.toLocaleString('ko-KR')} · 기존 구매발주 ${product.coveredQuantity.toLocaleString('ko-KR')} · 구매발주 후 잔량 ${nextRemaining.toLocaleString('ko-KR')})`,
          confirmLabel: '확인',
          tone: 'default',
        }))
      ) {
        return
      }
    }
    onConfirm(purchaseQuantity)
  }

  return (
    <ErpModal
      open={open}
      size="xl"
      title="구매발주"
      description={`${card.orderNumber} · ${card.customer || '—'} · ${product.productName}${product.productCode ? ` [${product.productCode}]` : ''}`}
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {unregistered.length > 0
              ? '미등록 자재가 있으면 구매발주서를 만들 수 없습니다.'
              : '구매발주서에는 이번 수량 기준 BOM 소요가 기본으로 들어갑니다. 현재고가 있으면 구매발주서에서 수량을 줄이면 됩니다.'}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <ErpButton variant="secondary" onClick={onClose}>
              취소
            </ErpButton>
            <ErpButton onClick={() => void handleConfirm()} disabled={!canCreateOrder}>
              구매발주서 작성
            </ErpButton>
          </div>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[11px] text-slate-500">발주 수량</p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
            {product.orderQuantity.toLocaleString('ko-KR')}
          </p>
        </div>
        <div className="rounded-lg bg-sky-50 px-3 py-2">
          <p className="text-[11px] text-sky-700">구매발주</p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-sky-900">
            {product.coveredQuantity.toLocaleString('ko-KR')}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[11px] text-slate-700">잔량</p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
            {product.remainingQuantity.toLocaleString('ko-KR')}
          </p>
        </div>
        <label className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className="text-[11px] font-semibold text-slate-800">이번 구매발주 수량</span>
          <input
            type="number"
            min={1}
            step={1}
            value={qtyText}
            onChange={(event) => setQtyText(event.target.value)}
            placeholder={`최대 ${product.remainingQuantity.toLocaleString('ko-KR')}`}
            autoFocus
            className="mt-0.5 w-full border-0 bg-transparent p-0 text-base font-bold tabular-nums text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
          />
        </label>
      </div>
      {overRemaining ? (
        <p className="mb-4 text-xs font-medium text-amber-700">
          잔량보다 많습니다. 저장 시 커버 수량으로 그대로 기록됩니다.
        </p>
      ) : null}

      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800">BOM 자재 소요 미리보기</h3>
        <p className="text-xs text-slate-500">
          구매발주수량 부족 {shortageCount.toLocaleString('ko-KR')}종
          {unregistered.length > 0
            ? ` · 미등록 ${unregistered.length.toLocaleString('ko-KR')}종`
            : ''}
        </p>
      </div>

      {unregistered.length > 0 ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          <p className="font-semibold">
            품목등록에 없는 자재 {unregistered.length.toLocaleString('ko-KR')}종 — 구매발주할 수
            없습니다
          </p>
          <p className="mt-1 break-all font-mono text-xs text-rose-700">
            {unregisteredCodes.join(', ')}
          </p>
          <p className="mt-1 text-xs text-rose-600">
            품목등록에서 원자재·부자재로 등록한 뒤 다시 시도하세요.
          </p>
        </div>
      ) : null}

      {!preview.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
          구매발주 수량을 입력하면 자재 소요가 표시됩니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="erp-data-table erp-data-table--compact min-w-[760px] w-full border-collapse text-sm">
            <thead className={ERP_TABLE_HEAD_CLASS}>
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">자재</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">상태</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">공급사</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">소요</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">현재고</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">구매발주수량</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((line) => (
                <tr
                  key={line.materialId}
                  className={[
                    'border-t border-slate-100',
                    line.registered ? '' : 'bg-rose-50/80',
                  ].join(' ')}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">{line.materialName}</p>
                    <p className="font-mono text-[11px] text-slate-500">{line.materialCode}</p>
                  </td>
                  <td className="px-3 py-2">
                    {line.registered ? (
                      <span className="text-xs font-medium text-slate-500">등록</span>
                    ) : (
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-bold text-rose-700">
                        미등록
                      </span>
                    )}
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
    </ErpModal>
  )
}
