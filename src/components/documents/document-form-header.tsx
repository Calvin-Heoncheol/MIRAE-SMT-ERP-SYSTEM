'use client'

import { ApprovalSignoffPanel } from '@/components/approvals/approval-signoff-panel'
import type { ApprovalSignoffRole } from '@/lib/approvals/signoffs'
import type { ApprovalSignoff } from '@/lib/approvals/signoffs'
import { PRINT_SUBTITLE, PRINT_TITLE } from '@/lib/documents/print-classes'

type DocumentFormHeaderProps = {
  title: string
  titleTracking?: string
  subtitle?: string
  /** 제목·부제(문서번호)를 영역 가운데 정렬 */
  centerTitle?: boolean
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
  centerTitle = false,
  signoffs,
  canSign = false,
  signing = false,
  onSign,
  className = 'border-b border-slate-200 pb-6',
}: DocumentFormHeaderProps) {
  return (
    <div className={`document-form-header px-3 py-6 sm:px-4 ${className}`}>
      <div className="flex items-center justify-between gap-6 sm:gap-10 print:flex-row print:items-center print:justify-between">
        <div
          className={[
            'document-form-header__title flex min-w-0 flex-1 flex-col justify-center',
            centerTitle ? 'items-center text-center' : '',
          ].join(' ')}
        >
          <h2
            className={`${PRINT_TITLE} text-[2.25rem] font-bold leading-tight text-slate-900 sm:text-[2.5rem]`}
            style={{ letterSpacing: titleTracking }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className={`${PRINT_SUBTITLE} mt-2.5 text-base font-medium text-slate-600`}>{subtitle}</p>
          ) : null}
        </div>

        <div className="document-signoff-slot w-[min(100%,320px)] shrink-0 sm:w-[300px] print:w-[300px]">
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