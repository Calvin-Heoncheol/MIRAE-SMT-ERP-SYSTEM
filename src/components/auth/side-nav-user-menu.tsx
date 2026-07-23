'use client'

import { logoutAction } from '@/lib/auth/actions'
import {
  formatAuthDepartmentLabel,
  formatAuthRoleLabel,
  type AuthProfile,
  type AuthRole,
} from '@/lib/auth/types'

type SideNavUserMenuProps = {
  profile: AuthProfile | null
  authDisabled?: boolean
}

function getInitials(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}

function roleBadgeClass(role: AuthRole) {
  if (role === 'admin') return 'bg-violet-50 text-violet-700 ring-1 ring-violet-100'
  if (role === 'manager') return 'bg-sky-50 text-sky-700 ring-1 ring-sky-100'
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80'
}

function departmentBadgeClass(department: AuthProfile['department']) {
  if (!department) return 'bg-slate-50 text-slate-500 ring-1 ring-slate-200/80'
  if (department === 'sales') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
  if (department === 'materials') return 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
  if (department.startsWith('production')) return 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100'
  if (department === 'office') return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
  return 'bg-slate-50 text-slate-600 ring-1 ring-slate-200/80'
}

function avatarClass(role: AuthRole) {
  if (role === 'admin') return 'bg-gradient-to-br from-slate-800 to-slate-950 text-white'
  if (role === 'manager') return 'bg-gradient-to-br from-sky-600 to-sky-800 text-white'
  return 'bg-gradient-to-br from-slate-400 to-slate-500 text-white'
}

export function SideNavUserMenu({ profile, authDisabled = false }: SideNavUserMenuProps) {
  if (authDisabled) {
    return (
      <div className="border-t border-slate-200 px-3 py-3">
        <p className="text-xs font-semibold text-amber-800">개발모드 · 인증 꺼짐</p>
        <p className="mt-0.5 text-[11px] text-slate-500">AUTH_ENABLED 미설정</p>
      </div>
    )
  }

  if (!profile) return null

  const initials = getInitials(profile.displayName)

  return (
    <div className="border-t border-slate-200 px-3 py-3">
      <div className="flex items-start gap-2.5">
        <div
          className={[
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tracking-wide shadow-sm',
            avatarClass(profile.role),
          ].join(' ')}
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <p className="min-w-0 truncate text-sm font-bold text-slate-900">{profile.displayName}</p>
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${departmentBadgeClass(profile.department)}`}
            >
              {formatAuthDepartmentLabel(profile.department)}
            </span>
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${roleBadgeClass(profile.role)}`}
            >
              {formatAuthRoleLabel(profile.role)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{profile.email}</p>
        </div>
      </div>

      <form action={logoutAction} className="mt-2.5">
        <button
          type="submit"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
        >
          로그아웃
        </button>
      </form>
    </div>
  )
}
