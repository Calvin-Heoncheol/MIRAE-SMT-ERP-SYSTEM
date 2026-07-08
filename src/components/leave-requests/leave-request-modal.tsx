'use client'

import { useEffect, useState } from 'react'
import { LeaveRequestFormDocument } from '@/components/leave-requests/leave-request-form-document'
import { DocumentPrintActions } from '@/components/documents/document-print-actions'
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

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6">
      <div className="my-4 w-full max-w-4xl rounded-2xl bg-slate-100 shadow-2xl">
        <div className="no-print flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'edit' ? '휴가원 수정' : '새 휴가원'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {mode === 'create'
                ? '문서번호는 저장 시 MRL-0001부터 생성 순서대로 자동 발급됩니다.'
                : request?.docNumber || request?.id}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DocumentPrintActions
              title={`휴가/조퇴원 ${form.docNumber || request?.docNumber || request?.id || ''}`}
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
          <LeaveRequestFormDocument
            form={form}
            onChange={setForm}
            canSign={mode === 'edit' && Boolean(request)}
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
                {saving ? '저장 중...' : mode === 'edit' ? '휴가원 수정 저장' : '휴가원 저장'}
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
