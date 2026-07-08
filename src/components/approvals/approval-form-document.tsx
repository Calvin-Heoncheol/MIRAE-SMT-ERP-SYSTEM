'use client'

import { ApprovalAttachmentsField } from '@/components/approvals/approval-attachments-field'
import { ApprovalPaymentMethodField } from '@/components/approvals/approval-payment-method-field'
import { DocumentBrandFooter } from '@/components/documents/document-brand-footer'
import { DocumentFormHeader } from '@/components/documents/document-form-header'
import type { ApprovalCategory, ApprovalDetailColumn } from '@/lib/approvals/categories'
import {
  getApprovalCategoryLabel,
  getApprovalDetailColumns,
  getApprovalIntroBodyPlaceholder,
  getApprovalSubjectPlaceholder,
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

type ApprovalFormDocumentProps = {
  category: ApprovalCategory
  form: ApprovalFormState
  onChange: (form: ApprovalFormState) => void
  readOnly?: boolean
  canSign?: boolean
  signing?: boolean
  onSign?: (role: ApprovalSignoffRole) => Promise<void> | void
  isDocNumberDraft?: boolean
  pendingAttachmentFiles?: File[]
  onPendingAttachmentFilesChange?: (files: File[]) => void
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
      <span className="mb-2 block text-xs font-semibold tracking-wide text-slate-500">금액 기준</span>
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
      <span className="mb-1 block text-xs font-semibold tracking-wide text-slate-500">{label}</span>
      {readOnly ? (
        <div className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          {value || '-'}
        </div>
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
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
      <span className="mb-1 block text-xs font-semibold tracking-wide text-slate-500">{label}</span>
      {readOnly ? (
        <div className="min-h-[72px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          {value || '-'}
        </div>
      ) : (
        <textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
        />
      )}
    </label>
  )
}

export function ApprovalFormDocument({
  category,
  form,
  onChange,
  readOnly = false,
  canSign = false,
  signing = false,
  onSign,
  isDocNumberDraft = false,
  pendingAttachmentFiles = [],
  onPendingAttachmentFilesChange,
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
            'block rounded px-2 py-1.5 text-sm',
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
    <div id="document-print-root" className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
      <DocumentFormHeader
        title="품 의 서"
        titleTracking="0.15em"
        subtitle={getApprovalCategoryLabel(category)}
        signoffs={form.signoffs}
        canSign={canSign}
        signing={signing}
        onSign={onSign}
      />

      <div className="document-meta-grid mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2">
        <Field
          label="작성일자"
          type="date"
          value={form.writtenDate}
          readOnly={readOnly}
          onChange={(writtenDate) => patch({ writtenDate })}
        />
        <div>
          <Field
            label="문서번호"
            value={isDocNumberDraft && !form.docNumber ? '저장 시 자동 부여' : form.docNumber}
            readOnly
          />
          {isDocNumberDraft ? (
            <p className="no-print mt-1 text-[11px] text-slate-400">MRA-0001부터 생성 순서대로 자동 발급됩니다.</p>
          ) : null}
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-slate-500">작성부서</span>
          {readOnly ? (
            <div className="min-h-[38px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
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
          label="보존기간"
          value={form.retentionPeriod}
          readOnly={readOnly}
          onChange={(retentionPeriod) => patch({ retentionPeriod })}
        />
        <Field
          label="작 성 자"
          value={form.author}
          readOnly={readOnly}
          onChange={(author) => patch({ author })}
        />
        <Field
          label="처리일자"
          value={form.processingDate}
          readOnly={readOnly}
          onChange={(processingDate) => patch({ processingDate })}
        />
      </div>

      <div className="mt-4">
        <Field
          label="제     목"
          value={form.subject}
          readOnly={readOnly}
          placeholder={subjectPlaceholder || undefined}
          onChange={(subject) => patch({ subject })}
        />
      </div>

      <div className="mt-5">
        <TextAreaField
          label="본문"
          value={form.introBody}
          readOnly={readOnly}
          rows={4}
          placeholder={introBodyPlaceholder || undefined}
          onChange={(introBody) => patch({ introBody })}
        />
      </div>

      <div className="my-5 text-center text-sm font-semibold tracking-[0.4em] text-slate-500">
        - &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 다 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 음 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; -
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">1. 상세 내역</p>
            {showAmountBasisSelector ? (
              <p className="mt-0.5 text-xs font-medium text-red-600">
                {amountBasis === 'total'
                  ? '단가·금액은 공급대가 기준으로 입력합니다. 공급가액과 부가세는 자동 역산됩니다.'
                  : amountBasis === 'exempt'
                    ? '단가·금액은 면세 금액 기준으로 입력합니다. 부가세는 0원으로 처리됩니다.'
                    : '단가·금액은 공급가액(VAT 별도) 기준으로 입력합니다.'}
              </p>
            ) : (
              <p className="mt-0.5 text-xs font-medium text-red-600">
                관세/부가세는 각각 별도 입력하며, 최종 금액은 두 금액의 합산으로 계산됩니다.
              </p>
            )}
          </div>
          {!readOnly ? (
            <button
              type="button"
              onClick={addDetailRow}
              className="no-print rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              행 추가
            </button>
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

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[920px] w-full border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">NO</th>
                {detailColumns.map((column) => (
                  <th key={column.key} className="px-3 py-2 text-left font-semibold text-slate-600">
                    {column.label}
                  </th>
                ))}
                {!readOnly ? <th className="no-print px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {form.detailItems.map((item, index) => (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                  {detailColumns.map((column) => (
                    <td key={column.key} className="px-2 py-2">
                      {renderDetailCell(item, index, column)}
                    </td>
                  ))}
                  {!readOnly ? (
                    <td className="no-print px-2 py-2">
                      <button
                        type="button"
                        onClick={() => removeDetailRow(index)}
                        className="text-xs font-semibold text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 space-y-1 text-right text-sm text-slate-800">
          <p>
            {category === 'duty-tax' ? '관세 합계' : '공급가액 합계'}:{' '}
            <span className="font-semibold tabular-nums">{formatApprovalMoney(supplyAmount)}</span>
          </p>
          <p>
            {category === 'duty-tax' ? '부가세 합계' : `부가세 (${amountBasis === 'exempt' ? '0%' : '10%'})`}:{' '}
            <span className="font-semibold tabular-nums">{formatApprovalMoney(vatAmount)}</span>
          </p>
          <p className="text-base">
            {category === 'duty-tax' ? '합계금액' : '공급대가'} ({category === 'duty-tax' ? '관세+부가세' : amountBasis === 'exempt' ? '면세' : 'VAT 포함'}):{' '}
            <span className="font-bold tabular-nums text-slate-900">{formatApprovalMoney(grandTotal)}</span>
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <ApprovalPaymentMethodField
          paymentType={form.paymentType}
          paymentMethod={form.paymentMethod}
          readOnly={readOnly}
          onChange={(paymentPatch) => patch(paymentPatch)}
        />
        <ApprovalAttachmentsField
          description={form.attachments}
          files={form.attachmentFiles}
          pendingFiles={pendingAttachmentFiles}
          readOnly={readOnly}
          onDescriptionChange={(attachments) => patch({ attachments })}
          onFilesChange={(attachmentFiles) => patch({ attachmentFiles })}
          onPendingFilesChange={(files) => onPendingAttachmentFilesChange?.(files)}
        />
        <TextAreaField
          label="4. 특이사항"
          value={form.remarks}
          readOnly={readOnly}
          rows={2}
          onChange={(remarks) => patch({ remarks })}
        />
      </div>

      <DocumentBrandFooter />
    </div>
  )
}
