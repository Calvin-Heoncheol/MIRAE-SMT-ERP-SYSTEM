'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { ExpenseReportFormDocument } from '@/components/expense-reports/expense-report-form-document'
import { DocumentPrintActions } from '@/components/documents/document-print-actions'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
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
  const canDelete = useCanDeleteRecords()
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

  const busy = saving || signing

  return (
    <ErpModal
      open
      size="lg"
      title={mode === 'edit' ? '지출결의서 수정' : '새 지출결의서'}
      description={
        mode === 'create'
          ? '문서번호는 저장 시 MRD-0001부터 생성 순서대로 자동 발급됩니다.'
          : report?.docNumber || report?.id
      }
      onClose={onClose}
      closeOnEscape={!busy}
      zIndexClassName="z-[80]"
      contentClassName="min-h-0 flex-1 overflow-y-auto bg-slate-100 px-5 py-4"
      headerActions={
        <DocumentPrintActions
          title={`지출결의서 ${form.docNumber || report?.docNumber || report?.id || ''}`}
          disabled={mode === 'create'}
        />
      }
      footer={
        <div className="no-print flex w-full flex-col gap-2">
          {saveError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </div>
          ) : null}
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {mode === 'edit' && canDelete ? (
              <ErpButton variant="danger" onClick={() => void handleDelete()} disabled={busy}>
                삭제
              </ErpButton>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <ErpButton variant="secondary" onClick={onClose} disabled={busy}>
                취소
              </ErpButton>
              <ErpButton onClick={() => void handleSave()} disabled={busy}>
                {saving ? '저장 중…' : mode === 'edit' ? '지출결의서 수정 저장' : '지출결의서 저장'}
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <ExpenseReportFormDocument
        form={form}
        onChange={setForm}
        canSign={mode === 'edit' && Boolean(report)}
        signing={signing}
        onSign={handleSign}
        isDocNumberDraft={mode === 'create'}
      />
    </ErpModal>
  )
}
