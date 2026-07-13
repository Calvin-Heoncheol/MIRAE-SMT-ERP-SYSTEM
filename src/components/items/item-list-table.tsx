'use client'

import {
  ITEM_CATEGORY_LABELS,
  ITEM_MATERIAL_TYPE_LABELS,
  ITEM_PCB_SIDE_MODE_LABELS,
  ITEM_SUPPLY_TYPE_LABELS,
  isMaterialItemCategory,
  isRawMaterialItemCategory,
  isSemiFinishedItemCategory,
  type Item,
  type ItemCategory,
} from '@/lib/items/types'
import { formatItemUnitPrice } from '@/lib/items/utils'

type ItemCategoryFilter = 'all' | ItemCategory

type ItemListTableProps = {
  items: Item[]
  emptyMessage: string
  categoryFilter?: ItemCategoryFilter
  onSelectItem?: (item: Item) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

function getVisibleColumns(filter: ItemCategoryFilter) {
  const showMaterialFields = filter === 'all' || isMaterialItemCategory(filter as ItemCategory)
  const showRawMaterialFields = filter === 'all' || isRawMaterialItemCategory(filter as ItemCategory)
  const showPcbSideMode = filter === 'all' || isSemiFinishedItemCategory(filter as ItemCategory)
  const showCategory = filter === 'all'

  return {
    specification: showMaterialFields,
    mpn: showRawMaterialFields,
    materialType: showRawMaterialFields,
    supplyType: showRawMaterialFields,
    supplier: showMaterialFields,
    pcbSideMode: showPcbSideMode,
    itemCategory: showCategory,
  }
}

export function ItemListTable({
  items,
  emptyMessage,
  categoryFilter = 'all',
  onSelectItem,
}: ItemListTableProps) {
  const columns = getVisibleColumns(categoryFilter)

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">품목을 등록하면 여기에 표시됩니다.</p>
      </div>
    )
  }

  const minWidth =
    categoryFilter === 'all'
      ? 'min-w-[1100px]'
      : isMaterialItemCategory(categoryFilter)
        ? 'min-w-[900px]'
        : 'min-w-[640px]'

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidth} table-fixed border-collapse`}>
          <colgroup>
            <col className="w-[120px]" />
            <col className="w-[180px]" />
            {columns.specification ? <col className="w-[160px]" /> : null}
            {columns.mpn ? <col className="w-[140px]" /> : null}
            {columns.materialType ? <col className="w-[72px]" /> : null}
            {columns.supplyType ? <col className="w-[88px]" /> : null}
            {columns.supplier ? <col className="w-[110px]" /> : null}
            {columns.pcbSideMode ? <col className="w-[88px]" /> : null}
            <col className="w-[96px]" />
            {columns.itemCategory ? <col className="w-[88px]" /> : null}
          </colgroup>
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                품목코드
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                품목명
              </th>
              {columns.specification ? (
                <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  규격
                </th>
              ) : null}
              {columns.mpn ? (
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  MPN
                </th>
              ) : null}
              {columns.materialType ? (
                <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  구분
                </th>
              ) : null}
              {columns.supplyType ? (
                <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  도급/사급
                </th>
              ) : null}
              {columns.supplier ? (
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  공급사
                </th>
              ) : null}
              {columns.pcbSideMode ? (
                <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  단면/양면
                </th>
              ) : null}
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-700 uppercase">
                단가
              </th>
              {columns.itemCategory ? (
                <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-700 uppercase">
                  품목구분
                </th>
              ) : null}
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
                <td className="truncate whitespace-nowrap px-4 py-2.5 font-mono text-sm font-semibold text-slate-800">
                  {cell(item.id)}
                </td>
                <td className="truncate px-4 py-2.5 text-sm font-medium text-slate-900" title={item.name}>
                  {cell(item.name)}
                </td>
                {columns.specification ? (
                  <td
                    className="truncate px-3 py-2.5 text-sm text-slate-700"
                    title={item.specification.trim() || undefined}
                  >
                    {cell(item.specification)}
                  </td>
                ) : null}
                {columns.mpn ? (
                  <td className="truncate px-4 py-2.5 font-mono text-sm text-slate-700" title={item.mpn}>
                    {cell(item.mpn)}
                  </td>
                ) : null}
                {columns.materialType ? (
                  <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm text-slate-700">
                    {item.materialType ? ITEM_MATERIAL_TYPE_LABELS[item.materialType] : '-'}
                  </td>
                ) : null}
                {columns.supplyType ? (
                  <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm text-slate-700">
                    {item.supplyType ? ITEM_SUPPLY_TYPE_LABELS[item.supplyType] : '-'}
                  </td>
                ) : null}
                {columns.supplier ? (
                  <td className="truncate px-4 py-2.5 text-sm text-slate-700" title={item.supplier}>
                    {cell(item.supplier)}
                  </td>
                ) : null}
                {columns.pcbSideMode ? (
                  <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm text-slate-700">
                    {isSemiFinishedItemCategory(item.itemCategory) &&
                    (item.pcbSideMode === 'single' || item.pcbSideMode === 'dual')
                      ? ITEM_PCB_SIDE_MODE_LABELS[item.pcbSideMode]
                      : '-'}
                  </td>
                ) : null}
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-slate-700">
                  {item.unitPrice > 0 ? formatItemUnitPrice(item.unitPrice) : '-'}
                </td>
                {columns.itemCategory ? (
                  <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm font-medium text-slate-700">
                    {ITEM_CATEGORY_LABELS[item.itemCategory]}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
