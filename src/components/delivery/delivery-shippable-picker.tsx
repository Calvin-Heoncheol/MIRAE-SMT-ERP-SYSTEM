'use client'

import { useMemo, useState } from 'react'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import {
  filterDeliveryShippableOptions,
  type DeliveryShippableOption,
} from '@/lib/delivery/register-form'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import {
  ERP_SEARCH_INPUT_BASE,
  erpSearchFocusClass,
  formatEmptyListMessage,
} from '@/lib/ui/tokens'

type DeliveryShippablePickerProps = {
  options: DeliveryShippableOption[]
  selectedIds: Set<string>
  lockedCustomer: string
  disabled?: boolean
  onToggle: (option: DeliveryShippableOption, checked: boolean) => void
}

export function DeliveryShippablePicker({
  options,
  selectedIds,
  lockedCustomer,
  disabled = false,
  onToggle,
}: DeliveryShippablePickerProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => filterDeliveryShippableOptions(options, search),
    [options, search],
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-2 border-b border-slate-200 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">출하가능</h3>
          <span className="text-xs tabular-nums text-slate-500">
            {selectedIds.size.toLocaleString('ko-KR')} / {filtered.length.toLocaleString('ko-KR')}
          </span>
        </div>
        <input
          type="search"
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="고객사, 발주번호, 품목 검색…"
          className={`${ERP_SEARCH_INPUT_BASE} max-w-none ${erpSearchFocusClass('sky')}`}
        />
        {lockedCustomer ? (
          <p className="text-[11px] leading-4 text-sky-800">
            같은 고객사만 선택 가능 · <span className="font-semibold">{lockedCustomer}</span>
          </p>
        ) : (
          <p className="text-[11px] leading-4 text-slate-500">여러 품목을 체크해 출하할 수 있습니다.</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!filtered.length ? (
          <EmptyListState
            message={formatEmptyListMessage({
              hasQuery: Boolean(search.trim()),
              emptyLabel: '출하 가능한 품목이 없습니다',
              actionHint: '생산 완료 후 출하할 수 있습니다',
            })}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((option) => {
              const checked = selectedIds.has(option.assemblyGroupId)
              const blockedByCustomer =
                Boolean(lockedCustomer) && option.customer !== lockedCustomer && !checked
              const rowDisabled = disabled || blockedByCustomer

              return (
                <li key={option.assemblyGroupId}>
                  <label
                    className={[
                      'flex cursor-pointer gap-3 px-4 py-3 transition-colors',
                      checked ? 'bg-sky-50/80' : 'hover:bg-slate-50',
                      rowDisabled ? 'cursor-not-allowed opacity-50' : '',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-700 focus:ring-sky-200"
                      checked={checked}
                      disabled={rowDisabled}
                      onChange={(event) => onToggle(option, event.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-sm font-semibold text-slate-900">
                              {option.customer || '—'}
                            </span>
                            <span className="font-mono text-xs text-slate-500">
                              {displayOrderPoNumber(option.customerPoNumber, option.orderNumber) ||
                                '—'}
                            </span>
                          </span>
                          <span className="mt-1 block font-mono text-xs font-semibold text-slate-800">
                            {option.productCode || '—'}
                          </span>
                          <span className="mt-0.5 block text-sm text-slate-700">
                            {option.productName || '—'}
                            {option.productVersion ? (
                              <span className="text-slate-400"> · {option.productVersion}</span>
                            ) : null}
                          </span>
                          <span className="mt-1.5 block">
                            <DeliveryDueBadge deliveryDate={option.deliveryDate} />
                          </span>
                        </span>
                        <span className="shrink-0 rounded-md bg-sky-50 px-2 py-1 text-right ring-1 ring-inset ring-sky-200">
                          <span className="block text-[10px] font-semibold text-sky-700">가능</span>
                          <span className="block text-sm font-bold tabular-nums text-sky-900">
                            {option.maxQuantity.toLocaleString('ko-KR')}
                          </span>
                        </span>
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
