'use client'

import { useEffect, useRef, useState } from 'react'
import { ApprovalFormDocument } from '@/components/approvals/approval-form-document'
import type { ApprovalCategory } from '@/lib/approvals/categories'
import { getApprovalCategoryLabel } from '@/lib/approvals/categories'
import {
  deleteApprovalAttachmentFiles,
  formatApprovalSaveError,
  uploadApprovalFiles,
} from '@/lib/approvals/attachments'
import { isApprovalDepartment, normalizeApprovalDepartment } from '@/lib/approvals/departments'
import {
  approvalToForm,
  computeApprovalTotalAmount,
  createDefaultApprovalForm,
  formToDetailInfo,
  type ApprovalFormState,
} from '@/lib/approvals/form-state'
import { createApproval, deleteApprovals, updateApproval } from '@/lib/approvals/repository'
import { applySignoff, type ApprovalSignoffRole } from '@/lib/approvals/signoffs'
import type { ApprovalListItem, ApprovalRowPayload } from '@/lib/approvals/types'

type ApprovalModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  category: ApprovalCategory
  approval?: ApprovalListItem | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
  onSignoffComplete?: () => void
}

function buildPayload(category: ApprovalCategory, form: ApprovalFormState, mode: 'create' | 'edit'): ApprovalRowPayload {
  const department = normalizeApprovalDepartment(form.department)
  const payload: ApprovalRowPayload = {
    category,
    written_date: form.writtenDate,
    department,
    retention_period: form.retentionPeriod.trim(),
    author: form.author.trim(),
    processing_date: form.processingDate.trim(),
    subject: form.subject.trim(),
    intro_body: form.introBody.trim(),
    total_amount: computeApprovalTotalAmount(form, category),
    detail_info: formToDetailInfo(form),
  }

  if (mode === 'edit' && form.docNumber.trim()) {
    payload.doc_number = form.docNumber.trim()
  }

  return payload
}

export function ApprovalModal({
  open,
  mode,
  category,
  approval,
  onClose,
  onSaved,
  onDeleted,
  onSignoffComplete,
}: ApprovalModalProps) {
  const [form, setForm] = useState<ApprovalFormState>(createDefaultApprovalForm())
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [removedFilePaths, setRemovedFilePaths] = useState<string[]>([])
  const initialAttachmentPathsRef = useRef<string[]>([])
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && approval) {
      const nextForm = approvalToForm(approval)
      setForm(nextForm)
      initialAttachmentPathsRef.current = nextForm.attachmentFiles.map((file) => file.path)
    } else {
      setForm(createDefaultApprovalForm(category))
      initialAttachmentPathsRef.current = []
    }
    setPendingFiles([])
    setRemovedFilePaths([])
    setSaveError('')
  }, [open, mode, approval, category])

  if (!open) return null

  async function persistAttachments(
    approvalId: string,
    currentForm: ApprovalFormState,
  ): Promise<
    | { ok: true; attachmentFiles: ApprovalFormState['attachmentFiles'] }
    | { ok: false; detail: string }
  > {
    const pathsToDelete = removedFilePaths.filter((path) => initialAttachmentPathsRef.current.includes(path))
    if (pathsToDelete.length) {
      const deleteResult = await deleteApprovalAttachmentFiles(pathsToDelete)
      if (!deleteResult.ok) return deleteResult
    }

    if (!pendingFiles.length) {
      return { ok: true as const, attachmentFiles: currentForm.attachmentFiles }
    }

    const uploadResult = await uploadApprovalFiles(approvalId, pendingFiles)
    if (!uploadResult.ok) return uploadResult

    return {
      ok: true as const,
      attachmentFiles: [...currentForm.attachmentFiles, ...uploadResult.files],
    }
  }

  async function handleSave() {
    if (!form.subject.trim()) {
      setSaveError('제목을 입력해 주세요.')
      return
    }
    if (!form.author.trim()) {
      setSaveError('작성자를 입력해 주세요.')
      return
    }
    if (!isApprovalDepartment(form.department)) {
      setSaveError('작성부서를 선택해 주세요.')
      return
    }

    setSaving(true)
    setSaveError('')

    const baseForm = { ...form, docNumber: mode === 'create' ? '' : form.docNumber }
    const payload = buildPayload(category, baseForm, mode)

    const result =
      mode === 'edit' && approval
        ? await updateApproval(approval.id, payload)
        : await createApproval(payload)

    if (!result.ok) {
      setSaving(false)
      setSaveError(formatApprovalSaveError(result.detail))
      return
    }

    const approvalId = result.id
    const attachmentResult = await persistAttachments(approvalId, baseForm)

    if (!attachmentResult.ok) {
      setSaving(false)
      setSaveError(formatApprovalSaveError(attachmentResult.detail))
      return
    }

    const needsAttachmentUpdate =
      pendingFiles.length > 0 ||
      removedFilePaths.length > 0 ||
      attachmentResult.attachmentFiles.length !== baseForm.attachmentFiles.length

    if (needsAttachmentUpdate) {
      const attachmentPayload = buildPayload(
        category,
        {
          ...baseForm,
          docNumber: result.docNumber || result.id,
          attachmentFiles: attachmentResult.attachmentFiles,
        },
        'edit',
      )
      const attachmentUpdate = await updateApproval(approvalId, attachmentPayload)
      if (!attachmentUpdate.ok) {
        setSaving(false)
        setSaveError(formatApprovalSaveError(attachmentUpdate.detail))
        return
      }
    }

    setSaving(false)
    onSaved?.()
  }

  async function handleDelete() {
    if (!approval || !window.confirm('이 품의서를 삭제할까요?')) return

    setSaving(true)
    await deleteApprovalAttachmentFiles(form.attachmentFiles.map((file) => file.path))
    const result = await deleteApprovals([approval.id])
    setSaving(false)

    if (!result.ok) {
      setSaveError(formatApprovalSaveError(result.detail))
      return
    }

    onDeleted?.()
  }

  async function handleSign(role: ApprovalSignoffRole) {
    if (!approval || mode !== 'edit') return

    setSigning(true)
    setSaveError('')

    const nextSignoffs = applySignoff(form.signoffs, role)
    const nextForm = { ...form, signoffs: nextSignoffs }
    const payload = buildPayload(category, nextForm, 'edit')
    const result = await updateApproval(approval.id, payload)

    setSigning(false)

    if (!result.ok) {
      setSaveError(formatApprovalSaveError(result.detail))
      return
    }

    setForm(nextForm)
    onSignoffComplete?.()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6">
      <div className="my-4 w-full max-w-5xl rounded-2xl bg-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'edit' ? '품의서 수정' : '새 품의서'} · {getApprovalCategoryLabel(category)}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {mode === 'create'
                ? '문서번호는 저장 시 MRA-0001부터 생성 순서대로 자동 발급됩니다.'
                : approval?.docNumber || approval?.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
          >
            닫기
          </button>
        </div>

        <div className="space-y-4 p-5">
          <ApprovalFormDocument
            category={category}
            form={form}
            onChange={(next) => {
              setForm(next)
              const removed = initialAttachmentPathsRef.current.filter(
                (path) => !next.attachmentFiles.some((file) => file.path === path),
              )
              setRemovedFilePaths(removed)
            }}
            canSign={mode === 'edit' && Boolean(approval)}
            signing={signing}
            onSign={handleSign}
            isDocNumberDraft={mode === 'create'}
            pendingAttachmentFiles={pendingFiles}
            onPendingAttachmentFilesChange={setPendingFiles}
          />

          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? '저장 중...' : mode === 'edit' ? '품의서 수정 저장' : '품의서 저장'}
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
