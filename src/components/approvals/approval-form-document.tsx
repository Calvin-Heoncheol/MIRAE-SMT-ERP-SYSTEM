'use client'

import { ApprovalAttachmentsField } from '@/components/approvals/approval-attachments-field'
import { ApprovalSignoffPanel } from '@/components/approvals/approval-signoff-panel'
import type { ApprovalCategory } from '@/lib/approvals/categories'
import { getApprovalCategoryLabel, getApprovalDetailColumns } from '@/lib/approvals/categories'
import type { ApprovalFormState } from '@/lib/approvals/form-state'
import {
  computeApprovalTotalAmount,
  computeLineAmount,
  defaultApprovalDetailItem,
} from '@/lib/approvals/form-state'
import { APPROVAL_DEPARTMENTS } from '@/lib/approvals/departments'
import { formatApprovalMoney } from '@/lib/approvals/utils'
import type { ApprovalSignoffRole } from '@/lib/approvals/signoffs'

type ApprovalFormDocumentProps = {
  category: ApprovalCategory
  form: ApprovalFormState
  onChange: (form: ApprovalFormState) => void
  readOnly?: boolean
  canSign?: boolean
  signing?: boolean
  onSign?: (role: ApprovalSignoffRole, approverName: string) => Promise<void> | void
  isDocNumberDraft?: boolean
  pendingAttachmentFiles?: File[]
  onPendingAttachmentFilesChange?: (files: File[]) => void
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  className = '',
  type = 'text',
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  className?: string
  type?: string
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
          onChange={(event) => onChange?.(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
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
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  rows?: number
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
          onChange={(event) => onChange?.(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
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
  const totalAmount = computeApprovalTotalAmount(form)
  const detailColumns = getApprovalDetailColumns(category)

  function patch(patch: Partial<ApprovalFormState>) {
    onChange({ ...form, ...patch })
  }

  function updateDetail(index: number, patch: Partial<ApprovalFormState['detailItems'][number]>) {
    const detailItems = form.detailItems.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const next = { ...item, ...patch }
      if ('qty' in patch || 'unitPrice' in patch) {
        next.amount = computeLineAmount(next.qty, next.unitPrice)
      }
      return next
    })
    onChange({ ...form, detailItems })
  }

  function addDetailRow() {
    onChange({ ...form, detailItems: [...form.detailItems, defaultApprovalDetailItem()] })
  }

  function removeDetailRow(index: number) {
    if (form.detailItems.length <= 1) return
    onChange({ ...form, detailItems: form.detailItems.filter((_, itemIndex) => itemIndex !== index) })
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-200 pb-4">
        <div className="mb-4 flex justify-end">
          <div className="w-full sm:w-[min(100%,420px)]">
            <p className="mb-1 text-right text-[11px] font-semibold text-slate-500">결 재</p>
            <ApprovalSignoffPanel
              signoffs={form.signoffs}
              canSign={canSign}
              signing={signing}
              onSign={onSign}
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 text-center">
          <h2 className="text-2xl font-bold tracking-[0.45em] text-slate-900">품 의 서</h2>
          <p className="mt-1.5 text-xs text-slate-500">{getApprovalCategoryLabel(category)}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
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
            <p className="mt-1 text-[11px] text-slate-400">MRA-0001부터 생성 순서대로 자동 발급됩니다.</p>
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
          onChange={(subject) => patch({ subject })}
        />
      </div>

      <div className="mt-5">
        <TextAreaField
          label="본문"
          value={form.introBody}
          readOnly={readOnly}
          rows={4}
          onChange={(introBody) => patch({ introBody })}
        />
      </div>

      <div className="my-5 text-center text-sm font-semibold tracking-[0.4em] text-slate-500">
        - &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 다 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 음 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; -
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800">1. 상세 내역</p>
          {!readOnly ? (
            <button
              type="button"
              onClick={addDetailRow}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              행 추가
            </button>
          ) : null}
        </div>

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
                {!readOnly ? <th className="px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {form.detailItems.map((item, index) => (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                  {detailColumns.map((column) => (
                    <td key={column.key} className="px-2 py-2">
                      {readOnly || column.computed ? (
                        <span
                          className={[
                            'block rounded px-2 py-1.5 text-sm',
                            column.computed ? 'bg-slate-50 text-slate-700 tabular-nums' : 'text-slate-800',
                          ].join(' ')}
                        >
                          {item[column.key]
                            ? column.computed
                              ? formatApprovalMoney(Number(item[column.key]))
                              : item[column.key]
                            : '-'}
                        </span>
                      ) : (
                        <input
                          value={item[column.key]}
                          onChange={(event) => updateDetail(index, { [column.key]: event.target.value })}
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                        />
                      )}
                    </td>
                  ))}
                  {!readOnly ? (
                    <td className="px-2 py-2">
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

        <p className="mt-3 text-right text-sm font-semibold text-slate-800">
          합계금액: {formatApprovalMoney(totalAmount)}
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <TextAreaField
          label="2. 결제 방법"
          value={form.paymentMethod}
          readOnly={readOnly}
          rows={2}
          onChange={(paymentMethod) => patch({ paymentMethod })}
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
    </div>
  )
}
