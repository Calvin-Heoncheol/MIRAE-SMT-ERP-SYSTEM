'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import { CategoryBadge } from '@/components/ui/category-badge'
import { SignoffStatusBadge } from '@/components/ui/status-badge'
import type { LeaveRequestListItem } from '@/lib/leave-requests/types'
import { formatLeavePeriodLabel } from '@/lib/leave-requests/form-state'
import { getLeaveTypeLabel, getSignoffStatusLabel } from '@/lib/leave-requests/utils'

type LeaveRequestListTableProps = {
  requests: LeaveRequestListItem[]
  emptyMessage: string
  onSelectRequest?: (request: LeaveRequestListItem) => void
}

export function LeaveRequestListTable({
  requests,
  emptyMessage,
  onSelectRequest,
}: LeaveRequestListTableProps) {
  if (!requests.length) {
    return (
      <EmptyListState message={emptyMessage} hint="새 휴가원 버튼으로 작성할 수 있습니다." />
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                제출일
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                문서번호
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                부서
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                작성자
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                종류
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                기간
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                결재상태
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr
                key={request.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/80"
                onClick={() => onSelectRequest?.(request)}
              >
                <td className="px-3 py-2.5 text-sm text-slate-700">{request.writtenDate || '-'}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-700">
                  {request.docNumber || request.id}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{request.department || '-'}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">
                  {request.position ? `${request.position} ` : ''}
                  {request.author || '-'}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <CategoryBadge
                    label={getLeaveTypeLabel(request.leaveType)}
                    className="bg-sky-100 text-sky-800"
                  />
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-700">
                  {formatLeavePeriodLabel({
                    startDate: request.startDate,
                    startTime: request.startTime,
                    endDate: request.endDate,
                    endTime: request.endTime,
                  })}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <SignoffStatusBadge label={getSignoffStatusLabel(request.detailInfo.signoffs)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
