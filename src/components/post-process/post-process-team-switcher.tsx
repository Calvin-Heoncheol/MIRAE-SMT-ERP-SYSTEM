'use client'

import {
  POST_PROCESS_TEAMS,
  type PostProcessTeam,
} from '@/lib/post-process/teams'

type PostProcessTeamSwitcherProps = {
  value: PostProcessTeam
  onChange: (team: PostProcessTeam) => void
  /** 'bar' = 전체 폭 탭, 'inline' = 컴팩트 */
  variant?: 'bar' | 'inline'
  className?: string
}

export function PostProcessTeamSwitcher({
  value,
  onChange,
  variant = 'bar',
  className = '',
}: PostProcessTeamSwitcherProps) {
  if (variant === 'inline') {
    return (
      <div
        className={`inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 ${className}`}
        role="tablist"
        aria-label="생산팀"
      >
        {POST_PROCESS_TEAMS.map((team) => {
          const active = team === value
          return (
            <button
              key={team}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(team)}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-semibold transition',
                active
                  ? 'bg-white text-sky-800 shadow-sm ring-1 ring-sky-200'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {team}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className={`grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 ${className}`}
      role="tablist"
      aria-label="생산팀"
    >
      {POST_PROCESS_TEAMS.map((team) => {
        const active = team === value
        return (
          <button
            key={team}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(team)}
            className={[
              'rounded-lg px-3 py-2 text-sm font-bold transition',
              active
                ? 'bg-white text-sky-800 shadow-sm ring-1 ring-sky-200'
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-700',
            ].join(' ')}
          >
            {team}
          </button>
        )
      })}
    </div>
  )
}
