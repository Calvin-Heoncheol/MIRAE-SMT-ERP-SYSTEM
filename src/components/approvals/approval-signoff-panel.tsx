'use client'

import { useState } from 'react'
import type { ApprovalSignoffRole } from '@/lib/approvals/signoffs'
import {
  canApproveSignoff,
  formatSignoffDate,
  getSignoffActionLabel,
  getSignoffProgress,
  isAutoSignoffRole,
  readStoredApproverName,
  storeApproverName,
  type ApprovalSignoff,
} from '@/lib/approvals/signoffs'

type ApprovalSignoffPanelProps = {
  signoffs: ApprovalSignoff[]
  canSign?: boolean
  signing?: boolean
  onSign?: (role: ApprovalSignoffRole, approverName: string) => Promise<void> | void
}

export function ApprovalSignoffPanel({
  signoffs,
  canSign = false,
  signing = false,
  onSign,
}: ApprovalSignoffPanelProps) {
  const [activeRole, setActiveRole] = useState<ApprovalSignoffRole | null>(null)
  const [approverName, setApproverName] = useState('')
  const [error, setError] = useState('')
  const progress = getSignoffProgress(signoffs)

  function openSignDialog(role: ApprovalSignoffRole) {
    setActiveRole(role)
    setApproverName(readStoredApproverName())
    setError('')
  }

  function closeSignDialog() {
    setActiveRole(null)
    setError('')
  }

  async function handleConfirmSign() {
    if (!activeRole) return
    const name = approverName.trim()
    if (!name) {
      setError('결재자 성명을 입력해 주세요.')
      return
    }

    storeApproverName(name)
    await onSign?.(activeRole, name)
    closeSignDialog()
  }

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-slate-300">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            {signoffs.map((item) => (
              <col key={item.role} className="w-[20%]" />
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
                const isAuto = isAutoSignoffRole(item.role)
                const actionable = canSign && canApproveSignoff(signoffs, item.role)
                const actionLabel = getSignoffActionLabel(item.role)

                return (
                  <td
                    key={item.role}
                    className="h-[54px] border-r border-t border-slate-200 px-1 py-1 align-middle last:border-r-0"
                  >
                    <div className="flex h-full flex-col items-center justify-center gap-0.5 text-center">
                      {approved ? (
                        <>
                          <p className="line-clamp-1 w-full text-[11px] font-semibold leading-tight text-slate-800">
                            {item.approverName}
                          </p>
                          <p className="text-[10px] leading-tight text-slate-500">
                            {formatSignoffDate(item.approvedAt)}
                          </p>
                        </>
                      ) : actionable ? (
                        <button
                          type="button"
                          disabled={signing}
                          onClick={() => openSignDialog(item.role)}
                          className="w-full rounded bg-blue-600 px-1 py-1 text-[10px] font-bold leading-tight text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {signing ? '...' : actionLabel}
                        </button>
                      ) : isAuto ? (
                        <span className="px-0.5 text-[10px] leading-tight text-slate-400">저장 시 반영</span>
                      ) : (
                        <span className="text-[10px] text-slate-300">-</span>
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
        {!canSign ? ' · 저장 후 검토/승인' : ''}
      </p>

      {activeRole ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              {signoffs.find((item) => item.role === activeRole)?.label}{' '}
              {activeRole === 'approval' ? '승인' : '검토'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">결재자 성명을 입력하고 확인을 눌러 주세요.</p>
            <input
              value={approverName}
              onChange={(event) => setApproverName(event.target.value)}
              placeholder="예: 홍길동"
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              autoFocus
            />
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeSignDialog}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmSign}
                disabled={signing}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                결재 확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
