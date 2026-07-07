'use client'

import type { ApprovalPaymentType } from '@/lib/approvals/types'

export const IMMEDIATE_PAYMENT_PLACEHOLDER =
  '예 : XX은행, XXX-XXXXX-XXXXXX, 예금주 : XXXX / 납품 후 7일 이내 현금 결제'

type ApprovalPaymentMethodFieldProps = {
  paymentType: ApprovalPaymentType
  paymentMethod: string
  readOnly?: boolean
  onChange: (patch: { paymentType?: ApprovalPaymentType; paymentMethod?: string }) => void
}

export function ApprovalPaymentMethodField({
  paymentType,
  paymentMethod,
  readOnly = false,
  onChange,
}: ApprovalPaymentMethodFieldProps) {
  const isImmediate = paymentType === 'immediate'
  const isRecurring = paymentType === 'recurring'

  function selectType(type: ApprovalPaymentType) {
    if (readOnly) return
    if (paymentType === type) {
      onChange({ paymentType: '', paymentMethod: '' })
      return
    }
    if (type === 'recurring') {
      onChange({ paymentType: 'recurring', paymentMethod: '' })
      return
    }
    onChange({ paymentType: 'immediate' })
  }

  return (
    <div className="block text-sm">
      <span className="mb-2 block text-xs font-semibold tracking-wide text-slate-500">2. 결제 방법</span>

      <div className="flex flex-wrap gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isImmediate}
            disabled={readOnly}
            onChange={() => selectType('immediate')}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          즉시 결제
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isRecurring}
            disabled={readOnly}
            onChange={() => selectType('recurring')}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          정기 결제
        </label>
      </div>

      {isImmediate ? (
        <div className="mt-3">
          {readOnly ? (
            <div className="min-h-[72px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {paymentMethod.trim() || '-'}
            </div>
          ) : (
            <textarea
              value={paymentMethod}
              onChange={(event) => onChange({ paymentMethod: event.target.value })}
              placeholder={IMMEDIATE_PAYMENT_PLACEHOLDER}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
