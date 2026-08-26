'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'
import { type Item, type ItemCategory, isProductItemCategory } from '@/lib/items/types'
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
  /** 반제품·조립제품 — 버전·생산공정 표시, 패키지·사양·MPN 숨김 */
  categoryFilter?: ItemCategory | 'all'
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

function productionProcessCell(item: Item) {
  return cell(formatItemProductionProcessLabel(item))
}

function unitPriceCell(item: Item) {
  const total = displayItemUnitPrice(item)
  return total > 0 ? formatItemUnitPrice(total) : '-'
}

export function ItemListTable({
  items,
  emptyMessage,
  onSelectItem,
  categoryFilter = 'all',
}: ItemListTableProps) {
  const showProductColumns =
    categoryFilter !== 'all' && isProductItemCategory(categoryFilter)
  const hideMaterialDetailColumns = showProductColumns
  const showProductionProcessColumn =
    categoryFilter === 'all' || categoryFilter === 3 || categoryFilter === 4
  const showPcbSideColumn = categoryFilter === 'all' || categoryFilter === 3

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
        <table
          className={`w-full table-fixed border-collapse ${
            showProductColumns
              ? showPcbSideColumn
                ? 'min-w-[980px]'
                : 'min-w-[880px]'
              : showProductionProcessColumn
                ? 'min-w-[1240px]'
                : 'min-w-[1060px]'
          }`}
        >
          <colgroup>
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[180px]" />
            {showProductColumns ? <col className="w-[88px]" /> : null}
            {showProductColumns && showProductionProcessColumn ? (
              <>
                <col className="w-[108px]" />
                {showPcbSideColumn ? <col className="w-[72px]" /> : null}
                <col className="w-[100px]" />
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
              {showProductColumns && showProductionProcessColumn ? (
                <>
                  <th className="px-3 py-2.5 text-center">생산 공정</th>
                  {showPcbSideColumn ? <th className="px-3 py-2.5 text-center">면</th> : null}
                  <th className="px-3 py-2.5 text-right">단가</th>
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
                  {showProductColumns && showProductionProcessColumn ? (
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
                        {unitPriceCell(item)}
                      </td>
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
                        {unitPriceCell(item)}
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
