import type { ReactNode } from 'react'
import { ERP_ERROR_BANNER_CLASS, ERP_ERROR_BANNER_HINT_CLASS } from '@/lib/ui/tokens'

type FetchErrorBannerProps = {
  title: string
  detail?: string
  hint?: ReactNode
  reason?: string
}

export function FetchErrorBanner({ title, detail, hint, reason }: FetchErrorBannerProps) {
  const heading = reason === 'env' ? '환경변수 필요' : title

  return (
    <div className={ERP_ERROR_BANNER_CLASS}>
      <p className="font-semibold">{heading}</p>
      {detail ? <p className="mt-1 whitespace-pre-wrap">{detail}</p> : null}
      {hint ? <div className={ERP_ERROR_BANNER_HINT_CLASS}>{hint}</div> : null}
    </div>
  )
}
