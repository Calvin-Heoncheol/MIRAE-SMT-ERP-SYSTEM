'use client'

import { ITEM_CATEGORY_LABELS, ITEM_MATERIAL_TYPE_LABELS, ITEM_PCB_SIDE_MODE_LABELS, ITEM_SUPPLY_TYPE_LABELS, isSemiFinishedItemCategory } from '@/lib/items/types'
import { formatItemUnitPrice } from '@/lib/items/utils'
import type { Item } from '@/lib/items/types'

type ItemListTableProps = {
  items: Item[]
  emptyMessage: string
  onSelectItem?: (item: Item) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

export function ItemListTable({ items, emptyMessage, onSelectItem }: ItemListTableProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">품목을 등록하면 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                품목코드
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                품목명
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                규격
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                MPN
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-700 uppercase">
                SMD/DIP
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-700 uppercase">
                도급/사급
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-700 uppercase">
                단면/양면
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-700 uppercase">
                단가
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-700 uppercase">
                품목구분
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
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm font-semibold text-slate-800">
                  {cell(item.id)}
                </td>
                <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{cell(item.name)}</td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{cell(item.specification)}</td>
                <td className="px-4 py-2.5 font-mono text-sm text-slate-700">{cell(item.mpn)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm text-slate-700">
                  {item.materialType ? ITEM_MATERIAL_TYPE_LABELS[item.materialType] : '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm text-slate-700">
                  {item.supplyType ? ITEM_SUPPLY_TYPE_LABELS[item.supplyType] : '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm text-slate-700">
                  {isSemiFinishedItemCategory(item.itemCategory) &&
                  (item.pcbSideMode === 'single' || item.pcbSideMode === 'dual')
                    ? ITEM_PCB_SIDE_MODE_LABELS[item.pcbSideMode]
                    : '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-slate-700">
                  {item.unitPrice > 0 ? formatItemUnitPrice(item.unitPrice) : '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm font-medium text-slate-700">
                  {item.itemCategory}. {ITEM_CATEGORY_LABELS[item.itemCategory]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
