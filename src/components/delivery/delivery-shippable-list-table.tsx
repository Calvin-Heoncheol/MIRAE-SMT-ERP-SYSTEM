'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { ERP_TABLE_HEAD_CLASS, ERP_TABLE_SCROLL_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { DeliveryShippableOption } from '@/lib/delivery/register-form'

type DeliveryShippableListTableProps = {
  options: DeliveryShippableOption[]
  emptyMessage: string
  onSelectOption?: (option: DeliveryShippableOption) => void
}

export function DeliveryShippableListTable({
  options,
  emptyMessage,
  onSelectOption,
}: DeliveryShippableListTableProps) {
  if (!options.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className="w-full min-w-[840px] table-fixed border-collapse">
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className="px-3 py-2.5 text-left">고객사</th>
              <th className="px-3 py-2.5 text-left">발주번호</th>
              <th className="px-3 py-2.5 text-left">품목코드</th>
              <th className="px-3 py-2.5 text-left">품목명</th>
              <th className="px-3 py-2.5 text-right">단가</th>
              <th className="px-3 py-2.5 text-right">출하가능</th>
            </tr>
          </thead>
          <tbody>
            {options.map((option) => (
              <tr
                key={option.assemblyGroupId}
                onClick={() => onSelectOption?.(option)}
                className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                  onSelectOption ? 'cursor-pointer' : ''
                }`}
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-800">
                  {option.customer || '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-sm text-slate-700">
                  {displayOrderPoNumber(option.customerPoNumber, option.orderNumber) || '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-sm font-semibold text-slate-800">
                  {option.productCode || '—'}
                </td>
                <td className="px-3 py-2.5 text-sm font-medium text-slate-900">
                  <span className="block">{option.productName || '—'}</span>
                  {option.productVersion ? (
                    <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                      {option.productVersion}
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">
                  {option.unitPrice > 0 ? option.unitPrice.toLocaleString('ko-KR') : '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-800">
                  {option.maxQuantity.toLocaleString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
