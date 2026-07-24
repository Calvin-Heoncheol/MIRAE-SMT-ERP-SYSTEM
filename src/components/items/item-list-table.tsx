'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import {
  ITEM_MATERIAL_TYPE_LABELS,
  ITEM_PCB_SIDE_MODE_LABELS,
  ITEM_PROCESS_TYPE_LABELS,
  ITEM_SUPPLY_TYPE_LABELS,
  isMaterialItemCategory,
  isRawMaterialItemCategory,
  isSemiFinishedItemCategory,
  type Item,
  type ItemCategory,
} from '@/lib/items/types'
import { formatItemUnitPrice } from '@/lib/items/utils'
import { formatItemVersionLabel, parseItemVersionCode } from '@/lib/items/version-code'

type ItemListTableProps = {
  items: Item[]
  emptyMessage: string
  categoryFilter: ItemCategory
  onSelectItem?: (item: Item) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

function versionLabelFromItemId(itemId: string) {
  return formatItemVersionLabel(parseItemVersionCode(itemId.trim()).version)
}

function getVisibleColumns(filter: ItemCategory) {
  return {
    version: !isRawMaterialItemCategory(filter),
    specification: isMaterialItemCategory(filter),
    mpn: isRawMaterialItemCategory(filter),
    materialType: isRawMaterialItemCategory(filter),
    supplyType: isRawMaterialItemCategory(filter),
    supplier: isMaterialItemCategory(filter),
    pcbSideMode: isSemiFinishedItemCategory(filter),
    processType: isSemiFinishedItemCategory(filter),
  }
}

export function ItemListTable({
  items,
  emptyMessage,
  categoryFilter,
  onSelectItem,
}: ItemListTableProps) {
  const columns = getVisibleColumns(categoryFilter)

  if (!items.length) {
    return (
      <EmptyListState message={emptyMessage} hint="품목을 등록하면 여기에 표시됩니다." />
    )
  }

  const minWidth = isMaterialItemCategory(categoryFilter)
    ? 'min-w-[960px]'
    : isSemiFinishedItemCategory(categoryFilter)
      ? 'min-w-[780px]'
      : 'min-w-[700px]'

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidth} table-fixed border-collapse`}>
          <colgroup>
            <col className="w-[120px]" />
            <col className="w-[180px]" />
            {columns.version ? <col className="w-[64px]" /> : null}
            {columns.specification ? <col className="w-[160px]" /> : null}
            {columns.mpn ? <col className="w-[140px]" /> : null}
            {columns.materialType ? <col className="w-[72px]" /> : null}
            {columns.supplyType ? <col className="w-[88px]" /> : null}
            {columns.supplier ? <col className="w-[110px]" /> : null}
            {columns.pcbSideMode ? <col className="w-[88px]" /> : null}
            {columns.processType ? <col className="w-[110px]" /> : null}
            <col className="w-[96px]" />
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                품목코드
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                품목명
              </th>
              {columns.version ? (
                <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  버전
                </th>
              ) : null}
              {columns.specification ? (
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  규격
                </th>
              ) : null}
              {columns.mpn ? (
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  MPN
                </th>
              ) : null}
              {columns.materialType ? (
                <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  구분
                </th>
              ) : null}
              {columns.supplyType ? (
                <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  도급/사급
                </th>
              ) : null}
              {columns.supplier ? (
                <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  공급사
                </th>
              ) : null}
              {columns.pcbSideMode ? (
                <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  면 구분
                </th>
              ) : null}
              {columns.processType ? (
                <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  공정
                </th>
              ) : null}
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                단가
              </th>
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
                <td className="truncate whitespace-nowrap px-3 py-2.5 font-mono text-sm font-semibold text-slate-800">
                  {cell(item.id)}
                </td>
                <td className="truncate px-3 py-2.5 text-sm font-medium text-slate-900" title={item.name}>
                  {cell(item.name)}
                </td>
                {columns.version ? (
                  <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm font-medium tabular-nums text-slate-700">
                    {versionLabelFromItemId(item.id)}
                  </td>
                ) : null}
                {columns.specification ? (
                  <td
                    className="truncate px-3 py-2.5 text-sm text-slate-700"
                    title={item.specification.trim() || undefined}
                  >
                    {cell(item.specification)}
                  </td>
                ) : null}
                {columns.mpn ? (
                  <td className="truncate px-3 py-2.5 font-mono text-sm text-slate-700" title={item.mpn}>
                    {cell(item.mpn)}
                  </td>
                ) : null}
                {columns.materialType ? (
                  <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-slate-700">
                    {item.materialType ? ITEM_MATERIAL_TYPE_LABELS[item.materialType] : '-'}
                  </td>
                ) : null}
                {columns.supplyType ? (
                  <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-slate-700">
                    {item.supplyType ? ITEM_SUPPLY_TYPE_LABELS[item.supplyType] : '-'}
                  </td>
                ) : null}
                {columns.supplier ? (
                  <td className="truncate px-3 py-2.5 text-sm text-slate-700" title={item.supplier}>
                    {cell(item.supplier)}
                  </td>
                ) : null}
                {columns.pcbSideMode ? (
                  <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-slate-700">
                    {isSemiFinishedItemCategory(item.itemCategory) &&
                    (item.pcbSideMode === 'single' ||
                      item.pcbSideMode === 'duo' ||
                      item.pcbSideMode === 'double')
                      ? ITEM_PCB_SIDE_MODE_LABELS[item.pcbSideMode]
                      : '-'}
                  </td>
                ) : null}
                {columns.processType ? (
                  <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-slate-700">
                    {isSemiFinishedItemCategory(item.itemCategory) &&
                    (item.processType === 'smt' ||
                      item.processType === 'post' ||
                      item.processType === 'smt_post')
                      ? ITEM_PROCESS_TYPE_LABELS[item.processType]
                      : '-'}
                  </td>
                ) : null}
                <td
                  className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-700"
                  title={
                    isSemiFinishedItemCategory(item.itemCategory) &&
                    (item.smdUnitPrice > 0 || item.dipUnitPrice > 0 || item.materialUnitPrice > 0)
                      ? `SMD ${formatItemUnitPrice(item.smdUnitPrice)} + DIP ${formatItemUnitPrice(item.dipUnitPrice)} + 자재 ${formatItemUnitPrice(item.materialUnitPrice)}`
                      : undefined
                  }
                >
                  {item.unitPrice > 0 ? formatItemUnitPrice(item.unitPrice) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
