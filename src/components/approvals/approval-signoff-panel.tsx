'use client'

import type { ApprovalSignoffRole } from '@/lib/approvals/signoffs'
import {
  canApproveSignoff,
  canRevokeSignoff,
  formatSignoffDate,
  getSignoffProgress,
  type ApprovalSignoff,
} from '@/lib/approvals/signoffs'

type ApprovalSignoffPanelProps = {
  signoffs: ApprovalSignoff[]
  canSign?: boolean
  signing?: boolean
  compact?: boolean
  showSideLabel?: boolean
  onSign?: (role: ApprovalSignoffRole) => Promise<void> | void
}

export function ApprovalSignoffPanel({
  signoffs,
  canSign = false,
  signing = false,
  compact = false,
  showSideLabel = false,
  onSign,
}: ApprovalSignoffPanelProps) {
  const progress = getSignoffProgress(signoffs)

  async function handleToggle(role: ApprovalSignoffRole) {
    if (!canSign || signing) return

    const item = signoffs.find((signoff) => signoff.role === role)
    if (!item) return

    if (item.status === 'approved') {
      if (!canRevokeSignoff(signoffs, role)) return
    } else if (!canApproveSignoff(signoffs, role)) {
      return
    }

    await onSign?.(role)
  }

  return (
    <div>
      <div className="approval-signoff-panel flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        {showSideLabel ? (
          <div className="flex w-8 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50">
            <span
              className="text-[11px] font-semibold tracking-[0.25em] text-slate-600"
              style={{ writingMode: 'vertical-rl' }}
            >
              결재
            </span>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            {signoffs.map((item) => (
              <col key={item.role} style={{ width: `${100 / signoffs.length}%` }} />
            ))}
          </colgroup>
          <thead className="bg-slate-50">
            <tr>
              {signoffs.map((item) => (
                <th
                  key={item.role}
                  className={[
                    'border-r border-slate-200 text-center font-semibold text-slate-700 last:border-r-0',
                    compact ? 'px-1 py-1 text-[10px]' : 'px-1 py-1.5 text-[11px]',
                  ].join(' ')}
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
                const canApprove = canSign && canApproveSignoff(signoffs, item.role)
                const canRevoke = canSign && canRevokeSignoff(signoffs, item.role)
                const boxSize = compact ? 'h-[18px] w-[18px] text-[10px]' : 'h-5 w-5 text-[11px]'

                return (
                  <td
                    key={item.role}
                    className={[
                      'border-r border-t border-slate-200 align-middle last:border-r-0',
                      compact ? 'h-[48px] px-1 py-1' : 'h-[54px] px-1 py-1',
                    ].join(' ')}
                  >
                    <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
                      {approved ? (
                        <>
                          {canRevoke ? (
                            <button
                              type="button"
                              disabled={signing}
                              onClick={() => handleToggle(item.role)}
                              className={[
                                'no-print inline-flex items-center justify-center rounded border-2 border-blue-600 bg-blue-600 font-bold text-white hover:border-blue-700 hover:bg-blue-700 disabled:opacity-60',
                                boxSize,
                              ].join(' ')}
                              aria-label={`${item.label} 결재 취소`}
                              title="결재 취소"
                            >
                              ✓
                            </button>
                          ) : null}
                          <span
                            className={[
                              'items-center justify-center rounded border-2 border-blue-600 bg-blue-600 font-bold text-white',
                              boxSize,
                              canRevoke ? 'hidden print:inline-flex' : 'inline-flex',
                            ].join(' ')}
                          >
                            ✓
                          </span>
                          {!compact ? (
                            <p className="text-[10px] leading-tight text-slate-500">
                              {formatSignoffDate(item.approvedAt)}
                            </p>
                          ) : null}
                        </>
                      ) : canApprove ? (
                        <>
                          <span
                            className={[
                              'hidden items-center justify-center rounded border-2 border-slate-200 bg-slate-50 print:inline-flex',
                              boxSize,
                            ].join(' ')}
                          />
                          <button
                            type="button"
                            disabled={signing}
                            onClick={() => handleToggle(item.role)}
                            className={[
                              'no-print inline-flex items-center justify-center rounded border-2 border-slate-300 bg-white hover:border-blue-500 disabled:opacity-60',
                              boxSize,
                            ].join(' ')}
                            aria-label={`${item.label} 결재`}
                          />
                        </>
                      ) : (
                        <span
                          className={[
                            'inline-flex items-center justify-center rounded border-2 border-slate-200 bg-slate-50',
                            boxSize,
                          ].join(' ')}
                        />
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <p className="no-print mt-1.5 text-right text-[10px] text-slate-400">
        {progress.approvedCount}/{progress.total} 완료
        {!canSign ? ' · 저장 후 결재' : ''}
      </p>
    </div>
  )
}
