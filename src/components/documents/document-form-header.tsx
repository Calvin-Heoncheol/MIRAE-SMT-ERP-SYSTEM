'use client'

import { ApprovalSignoffPanel } from '@/components/approvals/approval-signoff-panel'
import type { ApprovalSignoffRole } from '@/lib/approvals/signoffs'
import type { ApprovalSignoff } from '@/lib/approvals/signoffs'

type DocumentFormHeaderProps = {
  title: string
  titleTracking?: string
  subtitle?: string
  signoffs: ApprovalSignoff[]
  canSign?: boolean
  signing?: boolean
  onSign?: (role: ApprovalSignoffRole) => Promise<void> | void
  className?: string
}

export function DocumentFormHeader({
  title,
  titleTracking = '0.35em',
  subtitle,
  signoffs,
  canSign = false,
  signing = false,
  onSign,
  className = 'border-b border-slate-200 pb-6',
}: DocumentFormHeaderProps) {
  return (
    <div className={`document-form-header px-1 pt-4 sm:pt-5 ${className}`}>
      <div className="flex items-start justify-between gap-6 sm:gap-10 print:flex-row print:items-start print:justify-between">
        <div className="flex min-h-[76px] min-w-0 flex-1 flex-col justify-center">
          <h2
            className="text-[1.75rem] font-bold leading-tight text-slate-900 sm:text-[2rem]"
            style={{ letterSpacing: titleTracking }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2.5 text-sm font-medium text-slate-600">{subtitle}</p>
          ) : null}
        </div>

        <div className="document-signoff-slot w-[min(100%,320px)] shrink-0 pt-0.5 sm:w-[300px] print:w-[300px]">
          <ApprovalSignoffPanel
            signoffs={signoffs}
            canSign={canSign}
            signing={signing}
            onSign={onSign}
            compact
            showSideLabel
          />
        </div>
      </div>
    </div>
  )
}