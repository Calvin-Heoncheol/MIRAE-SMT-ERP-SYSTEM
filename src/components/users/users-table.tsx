'use client'

import type { ErpUserRow } from '@/lib/users/types'
import {
  formatAuthDepartmentLabel,
  formatAuthRoleLabel,
} from '@/lib/auth/types'

type UsersTableProps = {
  users: ErpUserRow[]
  emptyMessage: string
  onSelectUser: (user: ErpUserRow) => void
}

export function UsersTable({ users, emptyMessage, onSelectUser }: UsersTableProps) {
  if (!users.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                이름
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                이메일
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                역할
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                부서
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                onClick={() => onSelectUser(user)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                title="클릭하여 수정"
              >
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-semibold text-slate-900">
                  {user.displayName || '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-700">
                  {user.email || '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-700">
                  {formatAuthRoleLabel(user.role)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-700">
                  {formatAuthDepartmentLabel(user.department)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
