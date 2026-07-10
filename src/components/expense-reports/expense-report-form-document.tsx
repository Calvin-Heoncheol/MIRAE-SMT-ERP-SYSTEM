'use client'

import { DocumentBrandFooter } from '@/components/documents/document-brand-footer'
import { DocumentFormHeader } from '@/components/documents/document-form-header'
import { APPROVAL_DEPARTMENTS } from '@/lib/approvals/departments'
import type { ApprovalSignoffRole } from '@/lib/approvals/signoffs'
import {
  computeExpenseReportTotalAmount,
  createDefaultExpenseReportLineItems,
  defaultExpenseReportLineItem,
  parseNumericField,
  type ExpenseReportFormState,
} from '@/lib/expense-reports/form-state'
import { formatExpenseReportMoney, formatKoreanMoneyText } from '@/lib/expense-reports/utils'
import { EXPENSE_REPORT_ACCOUNT_CATEGORIES } from '@/lib/expense-reports/account-categories'
import { EXPENSE_REPORT_PROCESSING_METHODS } from '@/lib/expense-reports/processing-methods'
import {
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

type ExpenseReportFormDocumentProps = {
  form: ExpenseReportFormState
  onChange: (form: ExpenseReportFormState) => void
  readOnly?: boolean
  canSign?: boolean
  signing?: boolean
  onSign?: (role: ApprovalSignoffRole) => Promise<void> | void
  isDocNumberDraft?: boolean
}

const cellBorder = 'border border-slate-400'
const labelCell = `${PRINT_TABLE_LABEL} ${cellBorder} bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700`
const inputCell = `${PRINT_TABLE_VALUE} ${cellBorder} px-2 py-2`

function InlineInput({
  value,
  onChange,
  readOnly,
  type = 'text',
  className = '',
  placeholder,
}: {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  type?: string
  className?: string
  placeholder?: string
}) {
  if (readOnly) {
    return <span className={`${PRINT_VALUE} block px-1 py-1 text-sm text-slate-800 ${className}`}>{value || '\u00A0'}</span>
  }
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
      className={`${PRINT_VALUE} w-full border-0 bg-transparent px-1 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 ${className}`}
    />
  )
}

function formatLineAmount(value: string) {
  const numeric = parseNumericField(value)
  if (numeric <= 0) return value || ''
  return numeric.toLocaleString('ko-KR')
}

function ProcessingMethodField({
  value,
  readOnly,
  onChange,
}: {
  value: ExpenseReportFormState['processingDetails']
  readOnly: boolean
  onChange: (value: ExpenseReportFormState['processingDetails']) => void
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {EXPENSE_REPORT_PROCESSING_METHODS.map((item) => (
        <label
          key={item.value}
          className={[
            'inline-flex items-center gap-2 text-sm text-slate-800',
            readOnly ? '' : 'cursor-pointer',
          ].join(' ')}
        >
          {readOnly ? (
            <>
              <span
                className={[
                  'inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px]',
                  value === item.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300',
                ].join(' ')}
              >
                {value === item.value ? '●' : ''}
              </span>
              <span>{item.label}</span>
            </>
          ) : (
            <>
              <input
                type="radio"
                name="processingDetails"
                checked={value === item.value}
                onChange={() => onChange(item.value)}
                className="h-4 w-4 border-slate-300 text-blue-600"
              />
              <span>{item.label}</span>
            </>
          )}
        </label>
      ))}
    </div>
  )
}

export function ExpenseReportFormDocument({
  form,
  onChange,
  readOnly = false,
  canSign = false,
  signing = false,
  onSign,
  isDocNumberDraft = false,
}: ExpenseReportFormDocumentProps) {
  const totalAmount = computeExpenseReportTotalAmount(form)

  function patch(patch: Partial<ExpenseReportFormState>) {
    onChange({ ...form, ...patch })
  }

  function updateLine(index: number, patch: Partial<ExpenseReportFormState['lineItems'][number]>) {
    const lineItems = form.lineItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    )
    onChange({ ...form, lineItems })
  }

  function addLineRow() {
    onChange({ ...form, lineItems: [...form.lineItems, defaultExpenseReportLineItem()] })
  }

  function removeLineRow(index: number) {
    if (form.lineItems.length <= 1) return
    onChange({ ...form, lineItems: form.lineItems.filter((_, itemIndex) => itemIndex !== index) })
  }

  function resetLineRows() {
    onChange({ ...form, lineItems: createDefaultExpenseReportLineItems() })
  }

  return (
    <div
      id="document-print-root"
      className={`${PRINT_SHEET} rounded-xl border border-slate-300 bg-white shadow-sm`}
    >
      <div className={PRINT_CONTENT}>
      <DocumentFormHeader
        title="지 출 결 의 서"
        titleTracking="0.15em"
        className="pb-2"
        signoffs={form.signoffs}
        canSign={canSign}
        signing={signing}
        onSign={onSign}
      />

      <div className={`expense-report-amount-row ${cellBorder} mt-4`}>
        <div className="expense-report-amount-inner flex items-end gap-2 px-5 py-4">
          <span className="expense-report-amount-label w-8 shrink-0 pb-1 text-xs font-semibold text-slate-800">일금</span>
          <div className="expense-report-amount-korean w-[34%] max-w-[220px] shrink-0 border-b border-slate-500 pb-1 text-center text-sm font-semibold tracking-wide text-slate-900">
            {totalAmount > 0 ? formatKoreanMoneyText(totalAmount) : '\u00A0'}
          </div>
          <div className="expense-report-amount-number-wrap flex min-w-0 flex-1 items-end gap-1 border-b border-slate-500 pb-1">
            <span className="shrink-0 pb-px text-sm font-semibold text-slate-700">₩</span>
            <span className="expense-report-amount-number min-w-0 flex-1 text-right text-sm font-semibold tabular-nums text-slate-900">
              {totalAmount > 0 ? Math.round(totalAmount).toLocaleString('ko-KR') : '\u00A0'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className={`${PRINT_TABLE} min-w-[640px] w-full border-collapse text-sm`}>
          <tbody>
            <tr>
              <td className={`${labelCell} w-[14%]`}>문서번호</td>
              <td className={`${inputCell} w-[36%]`}>
                <span className="block px-1 py-1 font-mono text-sm text-slate-800">
                  {isDocNumberDraft && !form.docNumber ? '저장 시 자동 부여' : form.docNumber || '-'}
                </span>
                {isDocNumberDraft ? (
                  <p className="no-print px-1 pb-1 text-[11px] text-slate-400">
                    MRD-0001부터 생성 순서대로 자동 발급됩니다.
                  </p>
                ) : null}
              </td>
              <td className={`${labelCell} w-[14%]`}>작성부서</td>
              <td className={`${inputCell} w-[36%]`}>
                {readOnly ? (
                  <span className="block px-1 py-1 text-sm text-slate-800">{form.department || '-'}</span>
                ) : (
                  <select
                    value={form.department}
                    onChange={(event) => patch({ department: event.target.value })}
                    className="w-full border-0 bg-transparent px-1 py-1 text-sm text-slate-800 outline-none"
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
              <td className={labelCell}>발의일자</td>
              <td className={inputCell}>
                <InlineInput
                  type="date"
                  value={form.writtenDate}
                  readOnly={readOnly}
                  onChange={(writtenDate) => patch({ writtenDate })}
                />
              </td>
              <td className={labelCell}>지출일자</td>
              <td className={inputCell}>
                <InlineInput
                  type="date"
                  value={form.expenditureDate}
                  readOnly={readOnly}
                  onChange={(expenditureDate) => patch({ expenditureDate })}
                />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>결재일자</td>
              <td className={inputCell}>
                <InlineInput type="date" value={form.approvalDate} readOnly />
                {!readOnly && !form.approvalDate ? (
                  <p className="no-print px-1 pb-1 text-[11px] text-slate-400">최종 결재 완료 시 자동 입력됩니다.</p>
                ) : null}
              </td>
              <td className={labelCell}>처리사항</td>
              <td className={inputCell}>
                <div className="px-1 py-1">
                  <ProcessingMethodField
                    value={form.processingDetails}
                    readOnly={readOnly}
                    onChange={(processingDetails) => patch({ processingDetails })}
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <p className={`${PRINT_SECTION_TITLE} text-sm font-semibold text-slate-800`}>내역</p>
          {!readOnly ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addLineRow}
                className="no-print rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                행 추가
              </button>
              <button
                type="button"
                onClick={resetLineRows}
                className="no-print rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                7행 초기화
              </button>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className={`${PRINT_TABLE} min-w-[760px] w-full border-collapse text-sm`}>
            <thead>
              <tr>
                <th className={`${labelCell} w-[22%]`}>계정과목</th>
                <th className={`${labelCell} w-[38%]`}>적요</th>
                <th className={`${labelCell} w-[18%]`}>금액</th>
                <th className={`${labelCell} w-[22%]`}>비고</th>
                {!readOnly ? <th className="no-print w-12" /> : null}
              </tr>
            </thead>
            <tbody>
              {form.lineItems.map((item, index) => {
                const hasContent =
                  Boolean(item.accountCategory?.trim()) ||
                  Boolean(item.description.trim()) ||
                  parseNumericField(item.amount) > 0 ||
                  Boolean(item.note.trim())

                return (
                <tr
                  key={index}
                  data-expense-line-row="true"
                  data-expense-line-empty={hasContent ? 'false' : 'true'}
                  className={hasContent ? undefined : 'print:hidden'}
                >
                  <td className={inputCell}>
                    {readOnly ? (
                      <span className="block px-1 py-1 text-sm text-slate-800">
                        {item.accountCategory || '\u00A0'}
                      </span>
                    ) : (
                      <select
                        value={item.accountCategory ?? ''}
                        onChange={(event) => updateLine(index, { accountCategory: event.target.value })}
                        className="w-full min-h-[32px] rounded border border-slate-200 bg-white px-1.5 py-1 text-sm text-slate-800 outline-none"
                        data-print-value={item.accountCategory ?? ''}
                      >
                        <option value="">선택</option>
                        {EXPENSE_REPORT_ACCOUNT_CATEGORIES.map((category) => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className={inputCell}>
                    <InlineInput
                      value={item.description}
                      readOnly={readOnly}
                      onChange={(description) => updateLine(index, { description })}
                    />
                  </td>
                  <td className={inputCell}>
                    {readOnly ? (
                      <span className="block px-1 py-1 text-right text-sm tabular-nums text-slate-800">
                        {parseNumericField(item.amount) > 0 ? formatExpenseReportMoney(parseNumericField(item.amount)) : '\u00A0'}
                      </span>
                    ) : (
                      <input
                        value={item.amount}
                        onChange={(event) => updateLine(index, { amount: event.target.value })}
                        onBlur={() => updateLine(index, { amount: formatLineAmount(item.amount) })}
                        className="w-full border-0 bg-transparent px-1 py-1 text-right text-sm tabular-nums text-slate-800 outline-none"
                      />
                    )}
                  </td>
                  <td className={inputCell}>
                    <InlineInput
                      value={item.note}
                      readOnly={readOnly}
                      onChange={(note) => updateLine(index, { note })}
                    />
                  </td>
                  {!readOnly ? (
                    <td className="no-print px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeLineRow(index)}
                        className="text-xs font-semibold text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </td>
                  ) : null}
                </tr>
                )
              })}
              <tr>
                <td className={`${labelCell} text-left`} colSpan={2}>
                  계
                </td>
                <td className={`${inputCell} text-right font-semibold tabular-nums text-slate-900`}>
                  {formatExpenseReportMoney(totalAmount)}
                </td>
                <td className={inputCell} />
                {!readOnly ? <td className="no-print" /> : null}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${PRINT_CLOSING} mt-6 space-y-3 text-center`}>
        <p className="text-sm font-medium text-slate-800">위 금액을 영수(청구)합니다.</p>
        <div className={`${PRINT_VALUE} flex flex-wrap items-center justify-center gap-2 text-sm text-slate-700`}>
          {readOnly ? (
            <span>{form.receiptDate || '-'}</span>
          ) : (
            <input
              type="date"
              value={form.receiptDate}
              onChange={(event) => patch({ receiptDate: event.target.value })}
              className="rounded border border-slate-200 px-2 py-1 text-sm"
            />
          )}
        </div>
        <div className={`${PRINT_VALUE} flex flex-wrap items-center justify-center gap-3 text-sm`}>
          <span className={`${PRINT_LABEL} font-medium text-slate-700`}>영수자</span>
          <div className="min-w-[180px] border-b border-slate-400 px-2 pb-1">
            <InlineInput value={form.recipient} readOnly={readOnly} onChange={(recipient) => patch({ recipient })} />
          </div>
        </div>
      </div>

      </div>

      <DocumentBrandFooter />
    </div>
  )
}
