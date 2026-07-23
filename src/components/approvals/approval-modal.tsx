'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { ApprovalFormDocument } from '@/components/approvals/approval-form-document'
import { DocumentPrintActions } from '@/components/documents/document-print-actions'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import type { ApprovalCategory } from '@/lib/approvals/categories'
import {
  deleteApprovalAttachmentFiles,
  formatApprovalSaveError,
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
import { toggleSignoff, type ApprovalSignoffRole } from '@/lib/approvals/signoffs'
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
  const canDelete = useCanDeleteRecords()
  const [selectedCategory, setSelectedCategory] = useState<ApprovalCategory>(category)
  const [form, setForm] = useState<ApprovalFormState>(createDefaultApprovalForm())
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && approval) {
      setSelectedCategory(approval.category)
      setForm(approvalToForm(approval))
    } else {
      setSelectedCategory(category)
      setForm(createDefaultApprovalForm(category))
    }
    setSaveError('')
  }, [open, mode, approval, category])

  if (!open) return null

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
    const payload = buildPayload(selectedCategory, baseForm, mode)

    const result =
      mode === 'edit' && approval
        ? await updateApproval(approval.id, payload)
        : await createApproval(payload)

    setSaving(false)

    if (!result.ok) {
      setSaveError(formatApprovalSaveError(result.detail))
      return
    }

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

    const nextSignoffs = toggleSignoff(form.signoffs, role)
    const nextForm = { ...form, signoffs: nextSignoffs }
    const payload = buildPayload(selectedCategory, nextForm, 'edit')
    const result = await updateApproval(approval.id, payload)

    setSigning(false)

    if (!result.ok) {
      setSaveError(formatApprovalSaveError(result.detail))
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
      title={mode === 'edit' ? '품의서 수정' : '새 품의서'}
      description={
        mode === 'create'
          ? '문서번호는 저장 시 MRA-0001부터 생성 순서대로 자동 발급됩니다.'
          : approval?.docNumber || approval?.id
      }
      onClose={onClose}
      closeOnEscape={!busy}
      zIndexClassName="z-[80]"
      contentClassName="min-h-0 flex-1 overflow-y-auto bg-slate-100 px-5 py-4"
      headerActions={
        <DocumentPrintActions
          title={`품의서 ${form.docNumber || approval?.docNumber || approval?.id || ''}`}
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
                {saving ? '저장 중…' : mode === 'edit' ? '품의서 수정 저장' : '품의서 저장'}
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <ApprovalFormDocument
        category={selectedCategory}
        form={form}
        onChange={setForm}
        onCategoryChange={setSelectedCategory}
        canSign={mode === 'edit' && Boolean(approval)}
        signing={signing}
        onSign={handleSign}
        isDocNumberDraft={mode === 'create'}
      />
    </ErpModal>
  )
}
