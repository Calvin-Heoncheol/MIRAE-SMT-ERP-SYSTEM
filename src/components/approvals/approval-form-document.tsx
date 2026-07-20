'use client'

import { ApprovalPaymentMethodField } from '@/components/approvals/approval-payment-method-field'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import { DocumentBrandFooter } from '@/components/documents/document-brand-footer'
import { DocumentFormHeader } from '@/components/documents/document-form-header'
import type { ApprovalCategory, ApprovalDetailColumn } from '@/lib/approvals/categories'
import {
  APPROVAL_CATEGORIES,
  getApprovalCategoryLabel,
  getApprovalDetailColumns,
  getApprovalIntroBodyPlaceholder,
  getApprovalSubjectPlaceholder,
  isApprovalCategory,
  usesAmountBasisSelector,
  usesComputedLineAmount,
} from '@/lib/approvals/categories'
import type { ApprovalFormState } from '@/lib/approvals/form-state'
import {
  computeApprovalGrandTotal,
  computeApprovalSupplyAmount,
  computeApprovalVatAmount,
  computeLineAmount,
  defaultApprovalDetailItem,
} from '@/lib/approvals/form-state'
import { APPROVAL_DEPARTMENTS } from '@/lib/approvals/departments'
import { formatApprovalMoney } from '@/lib/approvals/utils'
import type { ApprovalSignoffRole } from '@/lib/approvals/signoffs'
import type { ApprovalAmountBasis } from '@/lib/approvals/types'
import {
  PRINT_BODY,
  PRINT_DIVIDER,
  PRINT_LABEL,
  PRINT_SECTION_TITLE,
  PRINT_SHEET,
  PRINT_CONTENT,
  PRINT_VALUE,
} from '@/lib/documents/print-classes'

const approvalSectionClass =
  'approval-document-section rounded-lg border border-slate-200 bg-white px-6 py-5'
const approvalHeaderClass =
  'approval-document-header border-b border-slate-200 px-3 pb-5 pt-2 sm:px-4'

type ApprovalFormDocumentProps = {
  category: ApprovalCategory
  form: ApprovalFormState
  onChange: (form: ApprovalFormState) => void
  onCategoryChange?: (category: ApprovalCategory) => void
  readOnly?: boolean
  canSign?: boolean
  signing?: boolean
  onSign?: (role: ApprovalSignoffRole) => Promise<void> | void
  isDocNumberDraft?: boolean
}

function AmountBasisField({
  amountBasis,
  readOnly,
  onChange,
}: {
  amountBasis: ApprovalAmountBasis
  readOnly: boolean
  onChange: (value: ApprovalAmountBasis) => void
}) {
  return (
    <div className="block text-sm">
      <span className={`${PRINT_LABEL} mb-2 block text-xs font-semibold tracking-wide text-slate-500`}>금액 기준</span>
      <div className="flex flex-wrap gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={amountBasis === 'supply'}
            disabled={readOnly}
            onChange={() => onChange(amountBasis === 'supply' ? '' : 'supply')}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          공급가액 기준
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={amountBasis === 'total'}
            disabled={readOnly}
            onChange={() => onChange(amountBasis === 'total' ? '' : 'total')}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          공급대가 기준
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={amountBasis === 'exempt'}
            disabled={readOnly}
            onChange={() => onChange(amountBasis === 'exempt' ? '' : 'exempt')}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          면세
        </label>
      </div>
    </div>
  )
}

function InlineField({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  placeholder?: string
}) {
  return (
    <div className="approval-inline-field flex items-center gap-3 text-sm">
      <span className={`${PRINT_LABEL} shrink-0 text-xs font-semibold tracking-wide text-slate-500`}>{label}</span>
      {readOnly ? (
        <div className={`${PRINT_VALUE} min-h-[38px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800`}>
          {value || '-'}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          className={`${PRINT_VALUE} min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400`}
        />
      )}
    </div>
  )
}

function getDetailColumnStyle(column: ApprovalDetailColumn): React.CSSProperties | undefined {
  switch (column.key) {
    case 'amount':
      return { width: 80 }
    case 'qty':
    case 'unit':
      return { width: 36 }
    case 'unitPrice':
      return { width: 56 }
    case 'note':
      return { width: 72 }
    case 'dueDate':
      return { width: 88 }
    default:
      return undefined
  }
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  className = '',
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  className?: string
  type?: string
  placeholder?: string
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className={`${PRINT_LABEL} mb-1 block text-xs font-semibold tracking-wide text-slate-500`}>{label}</span>
      {readOnly ? (
        <input
          readOnly
          type={type}
          value={value || '-'}
          className={`${PRINT_VALUE} w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800`}
        />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          className={`${PRINT_VALUE} w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400`}
        />
      )}
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  readOnly,
  rows = 3,
  placeholder,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  rows?: number
  placeholder?: string
}) {
  return (
    <label className="block text-sm">
      <span className={`${PRINT_LABEL} mb-1 block text-xs font-semibold tracking-wide text-slate-500`}>{label}</span>
      {readOnly ? (
        <div className={`${PRINT_BODY} min-h-[72px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800`}>
          {value || '-'}
        </div>
      ) : (
        <textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          className={`${PRINT_BODY} w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400`}
        />
      )}
    </label>
  )
}

export function ApprovalFormDocument({
  category,
  form,
  onChange,
  onCategoryChange,
  readOnly = false,
  canSign = false,
  signing = false,
  onSign,
  isDocNumberDraft = false,
}: ApprovalFormDocumentProps) {
  const supplyAmount = computeApprovalSupplyAmount(form, category)
  const vatAmount = computeApprovalVatAmount(supplyAmount, category, form)
  const grandTotal = computeApprovalGrandTotal(form, category)
  const detailColumns = getApprovalDetailColumns(category)
  const introBodyPlaceholder = getApprovalIntroBodyPlaceholder(category)
  const subjectPlaceholder = getApprovalSubjectPlaceholder(category)
  const amountBasis = form.amountBasis || 'supply'
  const showAmountBasisSelector = usesAmountBasisSelector(category)

  function patch(patch: Partial<ApprovalFormState>) {
    onChange({ ...form, ...patch })
  }

  function updateDetail(index: number, patch: Partial<ApprovalFormState['detailItems'][number]>) {
    const detailItems = form.detailItems.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const next = { ...item, ...patch }
      if (usesComputedLineAmount(category) && ('qty' in patch || 'unitPrice' in patch)) {
        next.amount = computeLineAmount(next.qty, next.unitPrice)
      }
      return next
    })
    onChange({ ...form, detailItems })
  }

  function addDetailRow() {
    onChange({ ...form, detailItems: [...form.detailItems, defaultApprovalDetailItem(category)] })
  }

  function removeDetailRow(index: number) {
    if (form.detailItems.length <= 1) return
    onChange({ ...form, detailItems: form.detailItems.filter((_, itemIndex) => itemIndex !== index) })
  }

  function formatDetailCellValue(item: ApprovalFormState['detailItems'][number], column: ApprovalDetailColumn) {
    const raw = item[column.key]
    if (!raw) return '-'
    if (column.computed || column.key === 'amount') {
      const numeric = Number(String(raw).replace(/,/g, ''))
      if (!Number.isNaN(numeric) && numeric > 0) return formatApprovalMoney(numeric)
    }
    return raw
  }

  function renderDetailCell(
    item: ApprovalFormState['detailItems'][number],
    index: number,
    column: ApprovalDetailColumn,
  ) {
    if (readOnly || column.computed) {
      return (
        <span
          className={[
            'approval-detail-cell-value block rounded px-2 py-1.5 text-sm',
            column.computed || column.key === 'amount'
              ? 'bg-slate-50 text-slate-700 tabular-nums'
              : 'text-slate-800',
          ].join(' ')}
        >
          {formatDetailCellValue(item, column)}
        </span>
      )
    }

    if (column.inputType === 'date') {
      return (
        <input
          type="date"
          value={item[column.key]}
          onChange={(event) => updateDetail(index, { [column.key]: event.target.value })}
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
      )
    }

    return (
      <input
        value={item[column.key]}
        onChange={(event) => updateDetail(index, { [column.key]: event.target.value })}
        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
      />
    )
  }

  return (
    <div
      id="document-print-root"
      className={`${PRINT_SHEET} rounded-xl border border-slate-300 bg-white shadow-sm`}
    >
      <div className={PRINT_CONTENT}>
      <DocumentFormHeader
        title="품 의 서"
        titleTracking="0.15em"
        centerTitle
        subtitle={
          isDocNumberDraft && !form.docNumber
            ? '자동번호'
            : form.docNumber || undefined
        }
        signoffs={form.signoffs}
        canSign={canSign}
        signing={signing}
        onSign={onSign}
        className={approvalHeaderClass}
      />

      <div
        className={`approval-meta-grid document-meta-grid ${approvalSectionClass} mt-4 grid grid-cols-1 gap-4 md:grid-cols-2`}
      >
        <label className="approval-meta-field block text-sm">
          <span className={`${PRINT_LABEL} mb-1 block text-xs font-semibold tracking-wide text-slate-500`}>
            카테고리
          </span>
          {readOnly ? (
            <div
              className={`${PRINT_VALUE} min-h-[38px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800`}
            >
              {getApprovalCategoryLabel(category)}
            </div>
          ) : (
            <select
              value={category}
              onChange={(event) => {
                const next = event.target.value
                if (isApprovalCategory(next)) onCategoryChange?.(next)
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {APPROVAL_CATEGORIES.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.label}
                </option>
              ))}
            </select>
          )}
        </label>
        <Field
          label="작성일자"
          type="date"
          value={form.writtenDate}
          readOnly={readOnly}
          className="approval-meta-field"
          onChange={(writtenDate) => patch({ writtenDate })}
        />
        <label className="approval-meta-field block text-sm">
          <span className={`${PRINT_LABEL} mb-1 block text-xs font-semibold tracking-wide text-slate-500`}>작성부서</span>
          {readOnly ? (
            <div className={`${PRINT_VALUE} min-h-[38px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800`}>
              {form.department || '-'}
            </div>
          ) : (
            <select
              value={form.department}
              onChange={(event) => patch({ department: event.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {APPROVAL_DEPARTMENTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          )}
        </label>
        <Field
          label="작 성 자"
          value={form.author}
          readOnly={readOnly}
          className="approval-meta-field"
          onChange={(author) => patch({ author })}
        />
      </div>

      <div className={`${approvalSectionClass} mt-4`}>
        <InlineField
          label="제     목"
          value={form.subject}
          readOnly={readOnly}
          placeholder={subjectPlaceholder || undefined}
          onChange={(subject) => patch({ subject })}
        />
      </div>

      <div className={`${approvalSectionClass} mt-4`}>
        <TextAreaField
          label="본문"
          value={form.introBody}
          readOnly={readOnly}
          rows={4}
          placeholder={introBodyPlaceholder || undefined}
          onChange={(introBody) => patch({ introBody })}
        />
      </div>

      <div className={`${PRINT_DIVIDER} my-5 text-center text-sm font-semibold tracking-[0.4em] text-slate-500`}>
        - &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 다 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 음 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; -
      </div>

      <div className={`${approvalSectionClass} approval-document-section--breakable mt-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`${PRINT_SECTION_TITLE} text-xs font-bold tracking-[0.14em] text-slate-600 uppercase`}>
              1. 상세 내역
            </p>
            {showAmountBasisSelector ? (
              <p className="no-print mt-0.5 text-xs font-medium text-red-600">
                {amountBasis === 'total'
                  ? '단가·금액은 공급대가 기준으로 입력합니다. 공급가액과 부가세는 자동 역산됩니다.'
                  : amountBasis === 'exempt'
                    ? '단가·금액은 면세 금액 기준으로 입력합니다. 부가세는 0원으로 처리됩니다.'
                    : '단가·금액은 공급가액(VAT 별도) 기준으로 입력합니다.'}
              </p>
            ) : (
              <p className="no-print mt-0.5 text-xs font-medium text-red-600">
                관세/부가세는 각각 별도 입력하며, 최종 금액은 두 금액의 합산으로 계산됩니다.
              </p>
            )}
          </div>
          {!readOnly ? (
            <ErpRowAddButton onClick={addDetailRow} title="내역 행 추가" className="no-print" />
          ) : null}
        </div>

        {showAmountBasisSelector ? (
          <div className="mb-3">
            <AmountBasisField
              amountBasis={amountBasis}
              readOnly={readOnly}
              onChange={(value) => patch({ amountBasis: value || 'supply' })}
            />
          </div>
        ) : null}

        <div className="overflow-x-auto rounded border border-slate-300">
          <table className="approval-detail-table min-w-[920px] w-full border-collapse text-sm print:min-w-0">
            <colgroup>
              <col style={{ width: 32 }} />
              {detailColumns.map((column) => (
                <col key={column.key} style={getDetailColumnStyle(column)} />
              ))}
              {!readOnly ? <col className="no-print" style={{ width: 48 }} /> : null}
            </colgroup>
            <thead className="approval-detail-thead bg-slate-800">
              <tr>
                <th className="whitespace-nowrap px-2 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-100">
                  NO
                </th>
                {detailColumns.map((column) => (
                  <th
                    key={column.key}
                    className="whitespace-nowrap px-2 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-100"
                  >
                    {column.label}
                  </th>
                ))}
                {!readOnly ? <th className="no-print px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {form.detailItems.map((item, index) => (
                <tr key={index} className="border-t border-slate-200">
                  <td className="px-2 py-2 text-center text-xs text-slate-500">{index + 1}</td>
                  {detailColumns.map((column) => (
                    <td key={column.key} className="px-1.5 py-1.5">
                      {renderDetailCell(item, index, column)}
                    </td>
                  ))}
                  {!readOnly ? (
                    <td className="no-print px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeDetailRow(index)}
                        className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        aria-label={`${index + 1}행 삭제`}
                      >
                        ×
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="approval-totals-wrap mt-4 space-y-3">
          <div className="approval-totals-row document-print-totals flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1 text-sm text-slate-600">
            <p>
              {category === 'duty-tax' ? '관세 합계' : '공급가액 합계'}:{' '}
              <span className="font-semibold tabular-nums text-slate-800">{formatApprovalMoney(supplyAmount)}</span>
            </p>
            <p>
              {category === 'duty-tax' ? '부가세 합계' : `부가세 (${amountBasis === 'exempt' ? '0%' : '10%'})`}:{' '}
              <span className="font-semibold tabular-nums text-slate-800">{formatApprovalMoney(vatAmount)}</span>
            </p>
          </div>
          <div className="approval-grand-total flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-blue-700 bg-gradient-to-r from-blue-50 to-white px-5 py-3.5">
            <span className="text-sm font-bold text-blue-900">
              {category === 'duty-tax'
                ? '합계금액 (관세+부가세)'
                : amountBasis === 'exempt'
                  ? '공급대가 (면세)'
                  : '공급대가 (VAT 포함)'}
            </span>
            <span className="text-xl font-extrabold tracking-tight text-blue-700 tabular-nums">
              {formatApprovalMoney(grandTotal)}
            </span>
          </div>
        </div>
      </div>

      <div className={`${approvalSectionClass} mt-4`}>
        <ApprovalPaymentMethodField
          paymentType={form.paymentType}
          paymentMethod={form.paymentMethod}
          processingDate={form.processingDate}
          readOnly={readOnly}
          onChange={(paymentPatch) => patch(paymentPatch)}
        />
      </div>

      </div>

      <DocumentBrandFooter />
    </div>
  )
}
