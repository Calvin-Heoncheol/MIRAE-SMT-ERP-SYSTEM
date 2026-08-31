'use client'

import { useEffect, useState } from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'
import { type ItemPriceField } from '@/lib/items/form-state'
import { type Item, type ItemCategory, isProductItemCategory, isSemiFinishedItemCategory } from '@/lib/items/types'
import {
  displayItemUnitPrice,
  formatItemDisplayCode,
  formatItemPcbSideModeLabel,
  formatItemProductionProcessLabel,
  formatItemUnitPrice,
} from '@/lib/items/utils'

type ItemListTableProps = {
  items: Item[]
  emptyMessage: string
  onSelectItem?: (item: Item) => void
  /** 반제품 — SET-UP·SMD·후공정·자재 테이블 인라인 수정 */
  inlineEditPrices?: boolean
  onPriceFieldSave?: (item: Item, field: ItemPriceField, value: number) => Promise<boolean>
  /** 반제품·조립제품 — 버전·생산공정 표시, 패키지·사양·MPN 숨김 */
  categoryFilter?: ItemCategory | 'all'
}

const INLINE_PRICE_INPUT_CLASS =
  'w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-slate-800 outline-none hover:border-slate-200 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:opacity-60'

function InlinePriceCell({
  item,
  field,
  value,
  onSave,
}: {
  item: Item
  field: ItemPriceField
  value: number
  onSave?: (item: Item, field: ItemPriceField, value: number) => Promise<boolean>
}) {
  const [draft, setDraft] = useState(String(Math.max(0, Math.round(value || 0))))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(String(Math.max(0, Math.round(value || 0))))
  }, [value])

  async function commit(raw: string) {
    const next = Math.max(0, Math.round(Number(raw) || 0))
    const current = Math.max(0, Math.round(value || 0))
    if (next === current || !onSave) {
      setDraft(String(current))
      return
    }
    setSaving(true)
    try {
      const ok = await onSave(item, field, next)
      if (!ok) setDraft(String(current))
    } finally {
      setSaving(false)
    }
  }

  return (
    <td
      className="px-1 py-1.5 align-top"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <QuoteNumericInput
        value={draft}
        onChange={setDraft}
        disabled={saving || !onSave}
        onBlur={() => void commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          }
        }}
        className={INLINE_PRICE_INPUT_CLASS}
        aria-label={`${item.name || item.id} ${field}`}
      />
    </td>
  )
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

function productionProcessCell(item: Item) {
  return cell(formatItemProductionProcessLabel(item))
}

function moneyCell(value: number) {
  const amount = Math.max(0, Math.round(Number(value) || 0))
  return amount > 0 ? formatItemUnitPrice(amount) : '-'
}

function assemblyUnitPriceCell(item: Item) {
  const total = displayItemUnitPrice(item)
  return total > 0 ? formatItemUnitPrice(total) : '-'
}

function semiFinishedPriceCells(
  item: Item,
  options?: {
    inlineEdit?: boolean
    onSave?: (item: Item, field: ItemPriceField, value: number) => Promise<boolean>
  },
) {
  if (options?.inlineEdit) {
    return (
      <>
        <InlinePriceCell item={item} field="setupUnitPrice" value={item.setupUnitPrice} onSave={options.onSave} />
        <InlinePriceCell item={item} field="smdUnitPrice" value={item.smdUnitPrice} onSave={options.onSave} />
        <InlinePriceCell item={item} field="dipUnitPrice" value={item.dipUnitPrice} onSave={options.onSave} />
        <InlinePriceCell item={item} field="materialUnitPrice" value={item.materialUnitPrice} onSave={options.onSave} />
      </>
    )
  }
  return (
    <>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-800">
        {moneyCell(item.setupUnitPrice)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-800">
        {moneyCell(item.smdUnitPrice)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-800">
        {moneyCell(item.dipUnitPrice)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-800">
        {moneyCell(item.materialUnitPrice)}
      </td>
    </>
  )
}

function PriceHeaderCells({
  showSemiFinishedPriceBreakdown,
}: {
  showSemiFinishedPriceBreakdown: boolean
}) {
  if (showSemiFinishedPriceBreakdown) {
    return (
      <>
        <th className="px-3 py-2.5 text-right">SET-UP</th>
        <th className="px-3 py-2.5 text-right">SMD</th>
        <th className="px-3 py-2.5 text-right">후공정</th>
        <th className="px-3 py-2.5 text-right">자재</th>
      </>
    )
  }
  return <th className="px-3 py-2.5 text-right">단가</th>
}

function PriceBodyCells({
  item,
  showSemiFinishedPriceBreakdown,
  inlineEditPrices,
  onPriceFieldSave,
}: {
  item: Item
  showSemiFinishedPriceBreakdown: boolean
  inlineEditPrices?: boolean
  onPriceFieldSave?: (item: Item, field: ItemPriceField, value: number) => Promise<boolean>
}) {
  if (showSemiFinishedPriceBreakdown && isSemiFinishedItemCategory(item.itemCategory)) {
    return semiFinishedPriceCells(item, {
      inlineEdit: inlineEditPrices,
      onSave: onPriceFieldSave,
    })
  }
  return (
    <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-800">
      {assemblyUnitPriceCell(item)}
    </td>
  )
}

export function ItemListTable({
  items,
  emptyMessage,
  onSelectItem,
  inlineEditPrices = false,
  onPriceFieldSave,
  categoryFilter = 'all',
}: ItemListTableProps) {
  const showSemiFinishedPriceBreakdown = categoryFilter === 3
  const showProductColumns =
    categoryFilter !== 'all' && isProductItemCategory(categoryFilter)
  const hideMaterialDetailColumns = showProductColumns
  /** 반제품은 SMD·후공정 단가로 공정 파악 가능 — 목록에서 생산 공정 컬럼 생략 */
  const showProductionProcessColumn = categoryFilter === 'all' || categoryFilter === 4
  const showPcbSideColumn = categoryFilter === 'all' || categoryFilter === 3

  const tableMinWidth = showProductColumns
    ? showPcbSideColumn
      ? showSemiFinishedPriceBreakdown
        ? 'min-w-[1310px]'
        : 'min-w-[1100px]'
      : showSemiFinishedPriceBreakdown
        ? 'min-w-[1320px]'
        : 'min-w-[1000px]'
    : showProductionProcessColumn
      ? 'min-w-[1360px]'
      : 'min-w-[1180px]'

  if (!items.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className={`erp-data-table w-full table-fixed border-collapse ${tableMinWidth}`}>
          <colgroup>
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[180px]" />
            {showProductColumns ? <col className="w-[88px]" /> : null}
            {showProductColumns ? (
              <>
                {showProductionProcessColumn ? <col className="w-[108px]" /> : null}
                {showPcbSideColumn ? <col className="w-[72px]" /> : null}
                {showSemiFinishedPriceBreakdown ? (
                  <>
                    <col className="w-[92px]" />
                    <col className="w-[92px]" />
                    <col className="w-[92px]" />
                    <col className="w-[92px]" />
                  </>
                ) : (
                  <col className="w-[100px]" />
                )}
              </>
            ) : null}
            {hideMaterialDetailColumns ? null : (
              <>
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[160px]" />
                <col className="w-[140px]" />
                <col className="w-[88px]" />
              </>
            )}
            {!showProductColumns && showProductionProcessColumn ? (
              <>
                <col className="w-[108px]" />
                {showPcbSideColumn ? <col className="w-[72px]" /> : null}
                <col className="w-[100px]" />
              </>
            ) : null}
            <col className="w-[88px]" />
          </colgroup>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className="px-3 py-2.5 text-left">고객사명</th>
              <th className="px-3 py-2.5 text-left">품목코드</th>
              <th className="px-3 py-2.5 text-left">품목명</th>
              {showProductColumns ? (
                <th className="px-3 py-2.5 text-center">버전</th>
              ) : null}
              {showProductColumns ? (
                <>
                  {showProductionProcessColumn ? (
                    <th className="px-3 py-2.5 text-center">생산 공정</th>
                  ) : null}
                  {showPcbSideColumn ? <th className="px-3 py-2.5 text-center">면</th> : null}
                  <PriceHeaderCells showSemiFinishedPriceBreakdown={showSemiFinishedPriceBreakdown} />
                </>
              ) : null}
              {hideMaterialDetailColumns ? null : (
                <>
                  <th className="px-3 py-2.5 text-center">공정구분</th>
                  <th className="px-3 py-2.5 text-left">패키지</th>
                  <th className="px-3 py-2.5 text-left">사양</th>
                  <th className="px-3 py-2.5 text-left">MPN</th>
                  <th className="px-3 py-2.5 text-center">도급/사급</th>
                </>
              )}
              {!showProductColumns && showProductionProcessColumn ? (
                <>
                  <th className="px-3 py-2.5 text-center">생산 공정</th>
                  {showPcbSideColumn ? <th className="px-3 py-2.5 text-center">면</th> : null}
                  <th className="px-3 py-2.5 text-right">단가</th>
                </>
              ) : null}
              <th className="px-3 py-2.5 text-center">사용여부</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => onSelectItem?.(item)}
                className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                  onSelectItem ? 'cursor-pointer' : ''
                }`}
              >
                <td className={`px-3 py-2.5 text-sm text-slate-800 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  {cell(item.customerName)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-sm font-semibold text-slate-800">
                  {cell(formatItemDisplayCode(item))}
                </td>
                <td className={`px-3 py-2.5 text-sm font-medium text-slate-900 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  {cell(item.name)}
                </td>
                {showProductColumns ? (
                  <td className="whitespace-nowrap px-3 py-2.5 text-center font-mono text-sm text-slate-700">
                    {cell(item.version)}
                  </td>
                ) : null}
                {showProductColumns ? (
                  <>
                    {showProductionProcessColumn ? (
                      <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-slate-700">
                        {productionProcessCell(item)}
                      </td>
                    ) : null}
                    {showPcbSideColumn ? (
                      <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-slate-700">
                        {cell(formatItemPcbSideModeLabel(item.pcbSideMode))}
                      </td>
                    ) : null}
                    <PriceBodyCells
                      item={item}
                      showSemiFinishedPriceBreakdown={showSemiFinishedPriceBreakdown}
                      inlineEditPrices={inlineEditPrices}
                      onPriceFieldSave={onPriceFieldSave}
                    />
                  </>
                ) : null}
                {hideMaterialDetailColumns ? null : (
                  <>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-slate-700">
                      {cell(item.materialType)}
                    </td>
                    <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                      {cell(item.package)}
                    </td>
                    <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                      {cell(item.specification)}
                    </td>
                    <td className={`px-3 py-2.5 font-mono text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                      {cell(item.mpn)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-slate-700">
                      {cell(item.supplyType)}
                    </td>
                  </>
                )}
                {!showProductColumns && showProductionProcessColumn ? (
                  <>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-slate-700">
                      {productionProcessCell(item)}
                    </td>
                    {showPcbSideColumn ? (
                      <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-slate-700">
                        {cell(formatItemPcbSideModeLabel(item.pcbSideMode))}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-800">
                      {isSemiFinishedItemCategory(item.itemCategory)
                        ? moneyCell(
                            item.setupUnitPrice +
                              item.smdUnitPrice +
                              item.dipUnitPrice +
                              item.materialUnitPrice,
                          )
                        : assemblyUnitPriceCell(item)}
                    </td>
                  </>
                ) : null}
                <td className="whitespace-nowrap px-3 py-2.5 text-center">
                  <StatusBadge
                    label={item.isActive === false ? '사용중지' : '사용중'}
                    tone={item.isActive === false ? 'neutral' : 'success'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
