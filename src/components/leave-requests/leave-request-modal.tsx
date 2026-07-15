'use client'

import { useEffect, useState } from 'react'
import { LeaveRequestFormDocument } from '@/components/leave-requests/leave-request-form-document'
import { DocumentPrintActions } from '@/components/documents/document-print-actions'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { isApprovalDepartment, normalizeApprovalDepartment } from '@/lib/approvals/departments'
import { toggleSignoff, type ApprovalSignoffRole } from '@/lib/approvals/signoffs'
import {
  buildLeaveTimeFields,
  createDefaultLeaveRequestForm,
  formToDetailInfo,
  leaveRequestToForm,
  type LeaveRequestFormState,
} from '@/lib/leave-requests/form-state'
import {
  createLeaveRequest,
  deleteLeaveRequests,
  formatLeaveRequestSaveError,
  updateLeaveRequest,
} from '@/lib/leave-requests/repository'
import type { LeaveRequestListItem, LeaveRequestRowPayload } from '@/lib/leave-requests/types'

type LeaveRequestModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  request?: LeaveRequestListItem | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
  onSignoffComplete?: () => void
}

function buildPayload(form: LeaveRequestFormState, mode: 'create' | 'edit'): LeaveRequestRowPayload {
  const timeFields = buildLeaveTimeFields(form)
  const payload: LeaveRequestRowPayload = {
    written_date: form.writtenDate,
    department: normalizeApprovalDepartment(form.department),
    position: form.position.trim(),
    author: form.author.trim(),
    leave_type: form.leaveType,
    start_date: timeFields.start_date,
    start_time: timeFields.start_time,
    end_date: timeFields.end_date,
    end_time: timeFields.end_time,
    reason: form.reason.trim(),
    detail_info: formToDetailInfo(form),
  }

  if (mode === 'edit' && form.docNumber.trim()) {
    payload.doc_number = form.docNumber.trim()
  }

  return payload
}

export function LeaveRequestModal({
  open,
  mode,
  request,
  onClose,
  onSaved,
  onDeleted,
  onSignoffComplete,
}: LeaveRequestModalProps) {
  const [form, setForm] = useState<LeaveRequestFormState>(createDefaultLeaveRequestForm())
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && request) {
      setForm(leaveRequestToForm(request))
    } else {
      setForm(createDefaultLeaveRequestForm())
    }
    setSaveError('')
  }, [open, mode, request])

  if (!open) return null

  async function handleSave() {
    if (!form.author.trim()) {
      setSaveError('작성자(성명)를 입력해 주세요.')
      return
    }
    if (!form.position.trim()) {
      setSaveError('직위를 입력해 주세요.')
      return
    }
    if (!isApprovalDepartment(form.department)) {
      setSaveError('부서를 선택해 주세요.')
      return
    }
    if (!form.reason.trim()) {
      setSaveError('사유를 입력해 주세요.')
      return
    }
    if (!form.startDate || !form.endDate) {
      setSaveError('휴가 기간을 입력해 주세요.')
      return
    }

    setSaving(true)
    setSaveError('')

    const baseForm = { ...form, docNumber: mode === 'create' ? '' : form.docNumber }
    const payload = buildPayload(baseForm, mode)

    const result =
      mode === 'edit' && request
        ? await updateLeaveRequest(request.id, payload)
        : await createLeaveRequest(payload)

    setSaving(false)

    if (!result.ok) {
      setSaveError(formatLeaveRequestSaveError(result.detail))
      return
    }

    onSaved?.()
  }

  async function handleDelete() {
    if (!request || !window.confirm('이 휴가원을 삭제할까요?')) return

    setSaving(true)
    const result = await deleteLeaveRequests([request.id])
    setSaving(false)

    if (!result.ok) {
      setSaveError(formatLeaveRequestSaveError(result.detail))
      return
    }

    onDeleted?.()
  }

  async function handleSign(role: ApprovalSignoffRole) {
    if (!request || mode !== 'edit') return

    setSigning(true)
    setSaveError('')

    const nextSignoffs = toggleSignoff(form.signoffs, role)
    const nextForm = { ...form, signoffs: nextSignoffs }
    const payload = buildPayload(nextForm, 'edit')
    const result = await updateLeaveRequest(request.id, payload)

    setSigning(false)

    if (!result.ok) {
      setSaveError(formatLeaveRequestSaveError(result.detail))
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
      title={mode === 'edit' ? '휴가원 수정' : '새 휴가원'}
      description={
        mode === 'create'
          ? '문서번호는 저장 시 MRL-0001부터 생성 순서대로 자동 발급됩니다.'
          : request?.docNumber || request?.id
      }
      onClose={onClose}
      closeOnEscape={!busy}
      zIndexClassName="z-[80]"
      contentClassName="min-h-0 flex-1 overflow-y-auto bg-slate-100 px-5 py-4"
      headerActions={
        <DocumentPrintActions
          title={`휴가/조퇴원 ${form.docNumber || request?.docNumber || request?.id || ''}`}
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
            {mode === 'edit' ? (
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
                {saving ? '저장 중…' : mode === 'edit' ? '휴가원 수정 저장' : '휴가원 저장'}
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <LeaveRequestFormDocument
        form={form}
        onChange={setForm}
        canSign={mode === 'edit' && Boolean(request)}
        signing={signing}
        onSign={handleSign}
        isDocNumberDraft={mode === 'create'}
      />
    </ErpModal>
  )
}
