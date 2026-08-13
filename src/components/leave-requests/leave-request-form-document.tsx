'use client'

import { DocumentBrandFooter } from '@/components/documents/document-brand-footer'
import { DocumentFormHeader } from '@/components/documents/document-form-header'
import { APPROVAL_DEPARTMENTS } from '@/lib/approvals/departments'
import type { ApprovalSignoffRole } from '@/lib/approvals/signoffs'
import { formatLeavePeriodLabel, type LeaveRequestFormState } from '@/lib/leave-requests/form-state'
import { LEAVE_TYPES } from '@/lib/leave-requests/leave-types'
import {
  PRINT_BODY,
  PRINT_CLOSING,
  PRINT_LABEL,
  PRINT_SECTION_TITLE,
  PRINT_SHEET,
  PRINT_CONTENT,
  PRINT_TABLE,
  PRINT_TABLE_LABEL,
  PRINT_TABLE_VALUE,
  PRINT_VALUE,
} from '@/lib/documents/print-classes'

type LeaveRequestFormDocumentProps = {
  form: LeaveRequestFormState
  onChange: (form: LeaveRequestFormState) => void
  readOnly?: boolean
  canSign?: boolean
  signing?: boolean
  onSign?: (role: ApprovalSignoffRole) => Promise<void> | void
  isDocNumberDraft?: boolean
}

const cellBorder = 'border border-slate-400'
const labelCell = `${PRINT_TABLE_LABEL} ${cellBorder} bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700`
const inputCell = `${PRINT_TABLE_VALUE} ${cellBorder} px-3 py-2`

function InlineInput({
  value,
  onChange,
  readOnly,
  type = 'text',
  className = '',
  placeholder,
  maxLength,
}: {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  type?: string
  className?: string
  placeholder?: string
  maxLength?: number
}) {
  if (readOnly) {
    return <span className={`${PRINT_VALUE} block text-sm text-slate-800 ${className}`}>{value || '\u00A0'}</span>
  }
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(event) => onChange?.(event.target.value)}
      className={`w-full border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 ${className}`}
    />
  )
}

function formatWrittenDateParts(value: string) {
  const [year = '', month = '', day = ''] = value.split('-')
  return { year, month, day }
}

export function LeaveRequestFormDocument({
  form,
  onChange,
  readOnly = false,
  canSign = false,
  signing = false,
  onSign,
  isDocNumberDraft = false,
}: LeaveRequestFormDocumentProps) {
  const writtenParts = formatWrittenDateParts(form.writtenDate)

  function patch(patch: Partial<LeaveRequestFormState>) {
    onChange({ ...form, ...patch })
  }

  return (
    <div
      id="document-print-root"
      className={`${PRINT_SHEET} rounded-xl border border-slate-300 bg-white shadow-sm`}
    >
      <div className={PRINT_CONTENT}>
      <DocumentFormHeader
        title="휴가/조퇴원"
        titleTracking="0.15em"
        signoffs={form.signoffs}
        canSign={canSign}
        signing={signing}
        onSign={onSign}
      />

      <div className="document-meta-grid mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 print:grid-cols-2">
        <div className="text-sm">
          <span className={`${PRINT_LABEL} mb-1 block text-xs font-semibold text-slate-500`}>문서번호</span>
          <div className={`${PRINT_VALUE} rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800`}>
            {isDocNumberDraft && !form.docNumber ? '저장 시 자동 부여' : form.docNumber || '-'}
          </div>
          {isDocNumberDraft ? (
            <p className="no-print mt-1 text-[11px] text-slate-400">MRL-0001부터 생성 순서대로 자동 발급됩니다.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className={`${PRINT_TABLE} min-w-[640px] w-full border-collapse text-sm`}>
          <tbody>
            <tr>
              <td className={`${labelCell} w-24`}>부서</td>
              <td className={inputCell} colSpan={3}>
                {readOnly ? (
                  <span className="text-sm text-slate-800">{form.department || '\u00A0'}</span>
                ) : (
                  <select
                    value={form.department}
                    onChange={(event) => patch({ department: event.target.value })}
                    className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none"
                  >
                    {APPROVAL_DEPARTMENTS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                )}
              </td>
            </tr>
            <tr>
              <td className={labelCell}>직위</td>
              <td className={inputCell}>
                <InlineInput value={form.position} readOnly={readOnly} onChange={(position) => patch({ position })} />
              </td>
              <td className={`${labelCell} w-24`}>성명</td>
              <td className={inputCell}>
                <InlineInput value={form.author} readOnly={readOnly} onChange={(author) => patch({ author })} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={`mt-4 ${cellBorder}`}>
        <div className={`${PRINT_SECTION_TITLE} ${labelCell} border-b border-slate-400 text-left`}>휴가의 종류</div>
        <div className="grid gap-2 px-4 py-4 sm:grid-cols-2">
          {LEAVE_TYPES.map((item) => (
            <label key={item.value} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
              {readOnly ? (
                <>
                  <span
                    className={[
                      'inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px]',
                      form.leaveType === item.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300',
                    ].join(' ')}
                  >
                    {form.leaveType === item.value ? '●' : ''}
                  </span>
                  <span>
                    {item.order}. {item.label}
                  </span>
                </>
              ) : (
                <>
                  <input
                    type="radio"
                    name="leaveType"
                    checked={form.leaveType === item.value}
                    onChange={() => patch({ leaveType: item.value })}
                    className="h-4 w-4 border-slate-300 text-blue-600"
                  />
                  <span>
                    {item.order}. {item.label}
                  </span>
                </>
              )}
            </label>
          ))}
        </div>
      </div>

      <div className={`mt-4 ${cellBorder}`}>
        <div className={`${PRINT_SECTION_TITLE} ${labelCell} border-b border-slate-400 text-left`}>기간</div>
        <div className={`${PRINT_VALUE} space-y-3 px-4 py-4 text-sm text-slate-800`}>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {readOnly ? (
              <span>{formatLeavePeriodLabel(form).split(' ~ ')[0]}</span>
            ) : (
              <>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => patch({ startDate: event.target.value })}
                  className="rounded border border-slate-200 px-2 py-1 text-sm"
                />
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(event) => patch({ startTime: event.target.value })}
                  className="rounded border border-slate-200 px-2 py-1 text-sm"
                />
              </>
            )}
            <span className="font-medium text-slate-700">부터</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {readOnly ? (
              <span>{formatLeavePeriodLabel(form).split(' ~ ')[1] ?? '-'}</span>
            ) : (
              <>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => patch({ endDate: event.target.value })}
                  className="rounded border border-slate-200 px-2 py-1 text-sm"
                />
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(event) => patch({ endTime: event.target.value })}
                  className="rounded border border-slate-200 px-2 py-1 text-sm"
                />
              </>
            )}
            <span className="font-medium text-slate-700">까지</span>
          </div>
          {readOnly ? null : (
            <p className="no-print text-center text-xs text-slate-500">
              미리보기: {formatLeavePeriodLabel(form)}
            </p>
          )}
        </div>
      </div>

      <div className={`mt-4 ${cellBorder}`}>
        <div className={`${PRINT_SECTION_TITLE} ${labelCell} border-b border-slate-400 text-left`}>사유</div>
        <div className="px-4 py-4">
          {readOnly ? (
            <div className={`${PRINT_BODY} min-h-[120px] whitespace-pre-wrap text-sm text-slate-800`}>{form.reason || '-'}</div>
          ) : (
            <textarea
              value={form.reason}
              rows={5}
              onChange={(event) => patch({ reason: event.target.value })}
              className="w-full resize-y border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="휴가·조퇴 사유를 입력해 주세요."
            />
          )}
        </div>
      </div>

      <div className={`${PRINT_CLOSING} mt-8 space-y-4 text-center`}>
        <p className="text-sm font-medium text-slate-800">
          위와 같이 휴가/조퇴원을 제출하오니 허락하여 주시기 바랍니다.
        </p>
        <div className={`${PRINT_VALUE} flex flex-wrap items-center justify-center gap-2 text-sm text-slate-700`}>
          {readOnly ? (
            <span>
              {writtenParts.year}년 {writtenParts.month}월 {writtenParts.day}일
            </span>
          ) : (
            <input
              type="date"
              value={form.writtenDate}
              onChange={(event) => patch({ writtenDate: event.target.value })}
              className="rounded border border-slate-200 px-2 py-1 text-sm"
            />
          )}
        </div>
        <div className={`${PRINT_VALUE} flex flex-wrap items-center justify-center gap-3 text-sm`}>
          <span className={`${PRINT_LABEL} font-medium text-slate-700`}>작성자</span>
          <div className="min-w-[180px] border-b border-slate-400 px-2 pb-1">
            <InlineInput value={form.author} readOnly={readOnly} onChange={(author) => patch({ author })} />
          </div>
        </div>
      </div>

      </div>

      <DocumentBrandFooter />
    </div>
  )
}
