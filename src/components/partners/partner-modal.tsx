'use client'

import { useEffect, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import {
  createBusinessPartner,
  deleteBusinessPartner,
  updateBusinessPartner,
} from '@/lib/partners/repository'
import {
  emptyPartnerForm,
  formToPartnerPayload,
  partnerToForm,
  type PartnerFormState,
} from '@/lib/partners/form-state'
import {
  PARTNER_TRADE_ROLES,
  PARTNER_TRADE_ROLE_LABELS,
  type BusinessPartner,
  type PartnerTradeRole,
} from '@/lib/partners/types'
import { formatBusinessRegNo } from '@/lib/partners/utils'

type PartnerModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  partner?: BusinessPartner | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

function PartnerModalContent({
  mode,
  partner,
  onClose,
  onSaved,
  onDeleted,
}: Omit<PartnerModalProps, 'open'> & { open: boolean }) {
  const isCreate = mode === 'create'
  const [form, setForm] = useState<PartnerFormState>(() =>
    partner ? partnerToForm(partner) : emptyPartnerForm(),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setForm(partner ? partnerToForm(partner) : emptyPartnerForm())
    setSaveError(null)
  }, [partner, mode])

  function updateForm<K extends keyof PartnerFormState>(key: K, value: PartnerFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    const result = isCreate
      ? await createBusinessPartner(formToPartnerPayload(form))
      : await updateBusinessPartner(partner!.businessRegNo, formToPartnerPayload(form))

    setSaving(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onSaved?.()
  }

  async function handleDelete() {
    if (!partner) return
    if (!window.confirm(`${partner.name} 거래처를 삭제하시겠습니까?`)) return

    setDeleting(true)
    setSaveError(null)

    const result = await deleteBusinessPartner(partner.businessRegNo)
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
      size="form"
      title={isCreate ? '거래처 등록' : '거래처 수정'}
      description={
        !isCreate && partner ? formatBusinessRegNo(partner.businessRegNo) : undefined
      }
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
      <div className="grid grid-cols-1 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">사업자번호</span>
          <input
            value={form.businessRegNo}
            onChange={(event) => updateForm('businessRegNo', event.target.value)}
            onBlur={() => updateForm('businessRegNo', formatBusinessRegNo(form.businessRegNo))}
            placeholder="000-00-00000"
            readOnly={!isCreate}
            className={`w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums ${
              !isCreate ? 'bg-slate-50 text-slate-600' : ''
            }`}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">거래처명</span>
          <input
            value={form.name}
            onChange={(event) => updateForm('name', event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">대표자명</span>
          <input
            value={form.representativeName}
            onChange={(event) => updateForm('representativeName', event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">업태</span>
          <input
            value={form.businessType}
            onChange={(event) => updateForm('businessType', event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">전화</span>
          <input
            value={form.phone}
            onChange={(event) => updateForm('phone', event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">매입/매출</span>
          <select
            value={form.tradeRole}
            onChange={(event) => updateForm('tradeRole', event.target.value as PartnerTradeRole)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {PARTNER_TRADE_ROLES.map((role) => (
              <option key={role} value={role}>
                {PARTNER_TRADE_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </ErpModal>
  )
}

export function PartnerModal({ open, ...props }: PartnerModalProps) {
  if (!open) return null
  return <PartnerModalContent open={open} {...props} />
}
