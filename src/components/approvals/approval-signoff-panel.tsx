'use client'

import type { ApprovalSignoffRole } from '@/lib/approvals/signoffs'
import {
  canApproveSignoff,
  formatSignoffDate,
  getSignoffProgress,
  type ApprovalSignoff,
} from '@/lib/approvals/signoffs'

type ApprovalSignoffPanelProps = {
  signoffs: ApprovalSignoff[]
  canSign?: boolean
  signing?: boolean
  onSign?: (role: ApprovalSignoffRole) => Promise<void> | void
}

export function ApprovalSignoffPanel({
  signoffs,
  canSign = false,
  signing = false,
  onSign,
}: ApprovalSignoffPanelProps) {
  const progress = getSignoffProgress(signoffs)

  async function handleToggle(role: ApprovalSignoffRole) {
    if (!canSign || signing) return
    if (!canApproveSignoff(signoffs, role)) return
    await onSign?.(role)
  }

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-slate-300">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            {signoffs.map((item) => (
              <col key={item.role} className="w-1/4" />
            ))}
          </colgroup>
          <thead className="bg-slate-50">
            <tr>
              {signoffs.map((item) => (
                <th
                  key={item.role}
                  className="border-r border-slate-200 px-1 py-1.5 text-center text-[11px] font-semibold text-slate-700 last:border-r-0"
                >
                  {item.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {signoffs.map((item) => {
                const approved = item.status === 'approved'
                const actionable = canSign && canApproveSignoff(signoffs, item.role)

                return (
                  <td
                    key={item.role}
                    className="h-[54px] border-r border-t border-slate-200 px-1 py-1 align-middle last:border-r-0"
                  >
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                      {approved ? (
                        <>
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded border-2 border-blue-600 bg-blue-600 text-[11px] font-bold text-white">
                            ✓
                          </span>
                          <p className="text-[10px] leading-tight text-slate-500">
                            {formatSignoffDate(item.approvedAt)}
                          </p>
                        </>
                      ) : actionable ? (
                        <button
                          type="button"
                          disabled={signing}
                          onClick={() => handleToggle(item.role)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded border-2 border-slate-300 bg-white hover:border-blue-500 disabled:opacity-60"
                          aria-label={`${item.label} 결재`}
                        />
                      ) : (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded border-2 border-slate-200 bg-slate-50" />
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-1.5 text-right text-[10px] text-slate-400">
        {progress.approvedCount}/{progress.total} 완료
        {!canSign ? ' · 저장 후 결재' : ''}
      </p>
    </div>
  )
}
