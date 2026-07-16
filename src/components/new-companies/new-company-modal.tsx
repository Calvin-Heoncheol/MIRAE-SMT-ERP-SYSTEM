'use client'

import { useEffect, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import {
  emptyNewCompanyInquiryForm,
  formToInquiryPayload,
  inquiryToForm,
  validateNewCompanyInquiryForm,
  type NewCompanyInquiryFormState,
} from '@/lib/new-companies/form-state'
import {
  createNewCompanyInquiry,
  deleteNewCompanyInquiry,
  updateNewCompanyInquiry,
} from '@/lib/new-companies/repository'
import {
  NEW_COMPANY_STATUS_BADGE_CLASS,
  NEW_COMPANY_STATUS_LABELS,
  NEW_COMPANY_STATUSES,
  type NewCompanyInquiry,
  type NewCompanyStatus,
} from '@/lib/new-companies/types'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

type NewCompanyModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  inquiry?: NewCompanyInquiry | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

function NewCompanyModalContent({
  mode,
  inquiry,
  onClose,
  onSaved,
  onDeleted,
}: Omit<NewCompanyModalProps, 'open'>) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState<NewCompanyInquiryFormState>(() =>
    inquiry ? inquiryToForm(inquiry) : emptyNewCompanyInquiryForm(),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setForm(inquiry ? inquiryToForm(inquiry) : emptyNewCompanyInquiryForm())
    setSaveError(null)
  }, [inquiry, mode])

  function updateForm<K extends keyof NewCompanyInquiryFormState>(
    key: K,
    value: NewCompanyInquiryFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateProgressLine(index: number, value: string) {
    setForm((current) => ({
      ...current,
      progressLines: current.progressLines.map((line, i) => (i === index ? value : line)),
    }))
  }

  function addProgressLine() {
    setForm((current) => ({
      ...current,
      progressLines: [...current.progressLines, ''],
    }))
  }

  function removeProgressLine(index: number) {
    setForm((current) => {
      if (current.progressLines.length <= 1) {
        return { ...current, progressLines: [''] }
      }
      return {
        ...current,
        progressLines: current.progressLines.filter((_, i) => i !== index),
      }
    })
  }

  async function handleSave() {
    const validationError = validateNewCompanyInquiryForm(form)
    if (validationError) {
      setSaveError(validationError)
      return
    }

    setSaving(true)
    setSaveError(null)
    const payload = formToInquiryPayload(form)

    const result = isCreate
      ? await createNewCompanyInquiry(payload)
      : await updateNewCompanyInquiry(inquiry!.id, payload)

    setSaving(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onSaved?.()
  }

  async function handleDelete() {
    if (!inquiry) return
    if (!window.confirm(`${inquiry.companyName || '이'} 신규업체를 삭제하시겠습니까?`)) return

    setDeleting(true)
    setSaveError(null)
    const result = await deleteNewCompanyInquiry(inquiry.id)
    setDeleting(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onDeleted?.()
  }

  const busy = saving || deleting

  return (
    <ErpModal
      open
      size="md"
      title={isCreate ? '신규업체 등록' : '신규업체 수정'}
      description={!isCreate && inquiry ? inquiry.companyName : undefined}
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-col gap-3">
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          <div className="flex justify-between gap-2">
            {!isCreate ? (
              <ErpButton variant="danger" onClick={() => void handleDelete()} disabled={busy}>
                {deleting ? '삭제 중…' : '삭제'}
              </ErpButton>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <ErpButton variant="secondary" onClick={onClose} disabled={busy}>
                취소
              </ErpButton>
              <ErpButton onClick={() => void handleSave()} disabled={busy}>
                {saving ? '저장 중…' : '저장'}
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className={ERP_FIELD_LABEL_CLASS}>상태</p>
          <div className="flex flex-wrap gap-2">
            {NEW_COMPANY_STATUSES.map((status) => {
              const active = form.status === status
              return (
                <button
                  key={status}
                  type="button"
                  disabled={busy}
                  onClick={() => updateForm('status', status as NewCompanyStatus)}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-semibold ring-1 transition',
                    NEW_COMPANY_STATUS_BADGE_CLASS[status],
                    active ? 'ring-2 ring-offset-1 ring-slate-400' : 'opacity-70 hover:opacity-100',
                  ].join(' ')}
                >
                  {NEW_COMPANY_STATUS_LABELS[status]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>
              회사명 <span className="text-red-500">*</span>
            </span>
            <input
              value={form.companyName}
              onChange={(event) => updateForm('companyName', event.target.value)}
              className={ERP_FIELD_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>
              담당자 <span className="text-red-500">*</span>
            </span>
            <input
              value={form.contactName}
              onChange={(event) => updateForm('contactName', event.target.value)}
              className={ERP_FIELD_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>이메일</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateForm('email', event.target.value)}
              className={ERP_FIELD_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>연락처</span>
            <input
              value={form.phone}
              onChange={(event) => updateForm('phone', event.target.value)}
              className={ERP_FIELD_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>제품</span>
            <input
              value={form.product}
              onChange={(event) => updateForm('product', event.target.value)}
              className={ERP_FIELD_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>예상수량</span>
            <input
              type="number"
              min={0}
              step="any"
              value={form.quantity}
              onChange={(event) => updateForm('quantity', event.target.value)}
              className={`${ERP_FIELD_INPUT_CLASS} tabular-nums`}
            />
          </label>
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className={ERP_FIELD_LABEL_CLASS}>진행사항</span>
              <button
                type="button"
                disabled={busy}
                onClick={addProgressLine}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                + 추가
              </button>
            </div>
            <div className="space-y-2">
              {form.progressLines.map((line, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-right text-sm tabular-nums text-slate-500">
                    {index + 1}.
                  </span>
                  <input
                    value={line}
                    disabled={busy}
                    onChange={(event) => updateProgressLine(index, event.target.value)}
                    placeholder={
                      index === 0 ? '예: 담당자 공장심사' : index === 1 ? '예: 임원진방문' : '진행사항 입력'
                    }
                    className={`${ERP_FIELD_INPUT_CLASS} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeProgressLine(index)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
                    aria-label={`${index + 1}번 진행사항 삭제`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ErpModal>
  )
}

export function NewCompanyModal({ open, ...props }: NewCompanyModalProps) {
  if (!open) return null
  return <NewCompanyModalContent {...props} />
}
