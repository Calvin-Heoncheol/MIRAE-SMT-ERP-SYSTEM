'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import type { ErpUserRow } from '@/lib/users/types'
import {
  formatAuthDepartmentLabel,
  formatAuthRoleLabel,
} from '@/lib/auth/types'
import {
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type UsersTableProps = {
  users: ErpUserRow[]
  emptyMessage: string
  onSelectUser: (user: ErpUserRow) => void
}

export function UsersTable({ users, emptyMessage, onSelectUser }: UsersTableProps) {
  if (!users.length) {
    return <EmptyListState message={emptyMessage} />
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className={`${ERP_TABLE_CLASS} min-w-[720px]`}>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className={`${ERP_TABLE_TH_CLASS} whitespace-nowrap text-left`}>이름</th>
              <th className={`${ERP_TABLE_TH_CLASS} whitespace-nowrap text-left`}>이메일</th>
              <th className={`${ERP_TABLE_TH_CLASS} whitespace-nowrap text-left`}>역할</th>
              <th className={`${ERP_TABLE_TH_CLASS} whitespace-nowrap text-left`}>부서</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                onClick={() => onSelectUser(user)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/80"
                title="클릭하여 수정"
              >
                <td className={`${ERP_TABLE_TD_CLASS} whitespace-nowrap font-semibold text-slate-900`}>
                  {user.displayName || '-'}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} whitespace-nowrap text-slate-700`}>
                  {user.email || '-'}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} whitespace-nowrap text-slate-700`}>
                  {formatAuthRoleLabel(user.role)}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} whitespace-nowrap text-slate-700`}>
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
