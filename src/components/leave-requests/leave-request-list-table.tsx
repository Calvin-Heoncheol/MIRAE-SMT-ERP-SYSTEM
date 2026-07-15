'use client'

import type { LeaveRequestListItem } from '@/lib/leave-requests/types'
import { formatLeavePeriodLabel } from '@/lib/leave-requests/form-state'
import { getLeaveTypeLabel, getSignoffStatusLabel } from '@/lib/leave-requests/utils'

type LeaveRequestListTableProps = {
  requests: LeaveRequestListItem[]
  emptyMessage: string
  onSelectRequest?: (request: LeaveRequestListItem) => void
}

export function LeaveRequestListTable({ requests, emptyMessage, onSelectRequest }: LeaveRequestListTableProps) {
  if (!requests.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">새 휴가원 버튼으로 작성할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                제출일
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                문서번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                부서
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                작성자
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                종류
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                기간
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
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
                <td className="px-4 py-3 text-sm text-slate-700">{request.writtenDate || '-'}</td>
                <td className="px-4 py-3 font-mono text-xs text-blue-700">{request.docNumber || request.id}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{request.department || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {request.position ? `${request.position} ` : ''}
                  {request.author || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{getLeaveTypeLabel(request.leaveType)}</td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {formatLeavePeriodLabel({
                    startDate: request.startDate,
                    startTime: request.startTime,
                    endDate: request.endDate,
                    endTime: request.endTime,
                  })}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={[
                      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                      getSignoffStatusLabel(request.detailInfo.signoffs) === '결재완료'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700',
                    ].join(' ')}
                  >
                    {getSignoffStatusLabel(request.detailInfo.signoffs)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
