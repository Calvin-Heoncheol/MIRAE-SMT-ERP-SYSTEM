'use client'

import { useEffect, useState } from 'react'
import { ExpenseReportFormDocument } from '@/components/expense-reports/expense-report-form-document'
import { DocumentPrintActions } from '@/components/documents/document-print-actions'
import { isApprovalDepartment, normalizeApprovalDepartment } from '@/lib/approvals/departments'
import { resolveApprovalDateFromSignoffs, toggleSignoff, type ApprovalSignoffRole } from '@/lib/approvals/signoffs'
import { formatExpenseReportSaveError } from '@/lib/expense-reports/attachments'
import { isExpenseReportProcessingMethod } from '@/lib/expense-reports/processing-methods'
import {
  computeExpenseReportTotalAmount,
  createDefaultExpenseReportForm,
  expenseReportToForm,
  formToDetailInfo,
  toNullableDate,
  type ExpenseReportFormState,
} from '@/lib/expense-reports/form-state'
import {
  createExpenseReport,
  deleteExpenseReports,
  updateExpenseReport,
} from '@/lib/expense-reports/repository'
import type { ExpenseReportListItem, ExpenseReportRowPayload } from '@/lib/expense-reports/types'

type ExpenseReportModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  report?: ExpenseReportListItem | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
  onSignoffComplete?: () => void
}

function buildPayload(form: ExpenseReportFormState, mode: 'create' | 'edit'): ExpenseReportRowPayload {
  const department = normalizeApprovalDepartment(form.department)
  const payload: ExpenseReportRowPayload = {
    written_date: form.writtenDate,
    department,
    author: '',
    account_category: '',
    processing_details: form.processingDetails,
    approval_date: toNullableDate(resolveApprovalDateFromSignoffs(form.signoffs)),
    expenditure_date: toNullableDate(form.expenditureDate),
    recipient: form.recipient.trim(),
    receipt_date: toNullableDate(form.receiptDate),
    total_amount: computeExpenseReportTotalAmount(form),
    detail_info: formToDetailInfo(form),
  }

  if (mode === 'edit' && form.docNumber.trim()) {
    payload.doc_number = form.docNumber.trim()
  }

  return payload
}

export function ExpenseReportModal({
  open,
  mode,
  report,
  onClose,
  onSaved,
  onDeleted,
  onSignoffComplete,
}: ExpenseReportModalProps) {
  const [form, setForm] = useState<ExpenseReportFormState>(createDefaultExpenseReportForm())
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && report) {
      setForm(expenseReportToForm(report))
    } else {
      setForm(createDefaultExpenseReportForm())
    }
    setSaveError('')
  }, [open, mode, report])

  if (!open) return null

  async function handleSave() {
    if (!isExpenseReportProcessingMethod(form.processingDetails)) {
      setSaveError('처리사항을 선택해 주세요.')
      return
    }
    if (!isApprovalDepartment(form.department)) {
      setSaveError('작성부서를 선택해 주세요.')
      return
    }
    if (computeExpenseReportTotalAmount(form) <= 0) {
      setSaveError('내역 금액을 1건 이상 입력해 주세요.')
      return
    }

    setSaving(true)
    setSaveError('')

    const baseForm = { ...form, docNumber: mode === 'create' ? '' : form.docNumber }
    const payload = buildPayload(baseForm, mode)

    const result =
      mode === 'edit' && report
        ? await updateExpenseReport(report.id, payload)
        : await createExpenseReport(payload)

    setSaving(false)

    if (!result.ok) {
      setSaveError(formatExpenseReportSaveError(result.detail))
      return
    }

    onSaved?.()
  }

  async function handleDelete() {
    if (!report || !window.confirm('이 지출결의서를 삭제할까요?')) return

    setSaving(true)
    const result = await deleteExpenseReports([report.id])
    setSaving(false)

    if (!result.ok) {
      setSaveError(formatExpenseReportSaveError(result.detail))
      return
    }

    onDeleted?.()
  }

  async function handleSign(role: ApprovalSignoffRole) {
    if (!report || mode !== 'edit') return

    setSigning(true)
    setSaveError('')

    const nextSignoffs = toggleSignoff(form.signoffs, role)
    const nextForm = {
      ...form,
      signoffs: nextSignoffs,
      approvalDate: resolveApprovalDateFromSignoffs(nextSignoffs),
    }
    const payload = buildPayload(nextForm, 'edit')
    const result = await updateExpenseReport(report.id, payload)

    setSigning(false)

    if (!result.ok) {
      setSaveError(formatExpenseReportSaveError(result.detail))
      return
    }

    setForm(nextForm)
    onSignoffComplete?.()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6">
      <div className="my-4 w-full max-w-5xl rounded-2xl bg-slate-100 shadow-2xl">
        <div className="no-print flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'edit' ? '지출결의서 수정' : '새 지출결의서'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {mode === 'create'
                ? '문서번호는 저장 시 MRD-0001부터 생성 순서대로 자동 발급됩니다.'
                : report?.docNumber || report?.id}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DocumentPrintActions
              title={`지출결의서 ${form.docNumber || report?.docNumber || report?.id || ''}`}
              disabled={mode === 'create'}
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <ExpenseReportFormDocument
            form={form}
            onChange={setForm}
            canSign={mode === 'edit' && Boolean(report)}
            signing={signing}
            onSign={handleSign}
            isDocNumberDraft={mode === 'create'}
          />

          <div className="no-print flex flex-col gap-2">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? '저장 중...' : mode === 'edit' ? '지출결의서 수정 저장' : '지출결의서 저장'}
              </button>
              {mode === 'edit' ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  삭제
                </button>
              ) : null}
            </div>
            {saveError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
