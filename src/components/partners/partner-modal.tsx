'use client'

import { useEffect, useState } from 'react'
import { useBusy } from '@/components/ui/busy-provider'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import {
  createBusinessPartner,
  deleteBusinessPartner,
  updateBusinessPartner,
} from '@/lib/partners/repository'
import {
  emptyPartnerForm,
  formToPartnerPayload,
  partnerToForm,
  validatePartnerForm,
  type PartnerFormState,
} from '@/lib/partners/form-state'
import {
  PARTNER_PAYMENT_TERM_TYPE_HINTS,
  PARTNER_PAYMENT_TERM_TYPE_LABELS,
  PARTNER_PAYMENT_TERM_TYPES,
  type BusinessPartner,
  type PartnerPaymentTermType,
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

function CancelButton({ disabled }: { disabled?: boolean }) {
  const requestClose = useErpModalRequestClose()
  return (
    <ErpButton variant="secondary" disabled={disabled} onClick={() => requestClose?.()}>
      취소
    </ErpButton>
  )
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

  const busyUi = useBusy()
  const { notifyAuthOrFailure } = useWriteFailureToast()

  useEffect(() => {
    setForm(partner ? partnerToForm(partner) : emptyPartnerForm())
    setSaveError(null)
  }, [partner, mode])

  function updateForm<K extends keyof PartnerFormState>(key: K, value: PartnerFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updatePaymentTermType(type: PartnerPaymentTermType) {
    setForm((current) => ({
      ...current,
      paymentTermType: type,
      paymentDepositPercent:
        type === 'installment' ? current.paymentDepositPercent || '30' : current.paymentDepositPercent,
      paymentNetDays: type === 'net' ? current.paymentNetDays || '30' : current.paymentNetDays,
      paymentMonthlyDay: type === 'monthly' ? current.paymentMonthlyDay || '15' : current.paymentMonthlyDay,
    }))
  }

  async function handleSave() {
    const invalid = validatePartnerForm(form)
    if (invalid) {
      setSaveError(invalid)
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = await busyUi.run(() =>
      isCreate
        ? createBusinessPartner(formToPartnerPayload(form))
        : updateBusinessPartner(partner!.id, formToPartnerPayload(form)),
    )

    setSaving(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setSaveError(result.detail)
      return
    }

    onSaved?.()
  }

  async function handleDelete() {
    if (!partner) return
    if (!window.confirm(`${partner.name} 거래처를 삭제하시겠습니까?`)) return

    setDeleting(true)
    setSaveError(null)

    const result = await busyUi.run(() => deleteBusinessPartner(partner.id))
    setDeleting(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setSaveError(result.detail)
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
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-col gap-3">
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          <div className="flex justify-between gap-2">
            {!isCreate ? (
              <ErpButton
                variant="danger"
                onClick={() => void handleDelete()}
                disabled={busy}
                loading={deleting}
              >
                삭제
              </ErpButton>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <CancelButton disabled={busy} />
              <ErpButton onClick={() => void handleSave()} disabled={busy} loading={saving}>
                저장
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">
            사업자번호 <span className="font-normal text-slate-400">(선택)</span>
          </span>
          <input
            value={form.businessRegNo}
            onChange={(event) => updateForm('businessRegNo', event.target.value)}
            onBlur={() => updateForm('businessRegNo', formatBusinessRegNo(form.businessRegNo))}
            placeholder="000-00-00000"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums"
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
          <span className="mb-1 block font-medium text-slate-600">
            주소 <span className="font-normal text-slate-400">(거래명세서)</span>
          </span>
          <textarea
            value={form.address}
            onChange={(event) => updateForm('address', event.target.value)}
            rows={2}
            placeholder="사업장 주소"
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2"
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
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">결제조건</span>
            <select
              value={form.paymentTermType}
              onChange={(event) => updatePaymentTermType(event.target.value as PartnerPaymentTermType)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {PARTNER_PAYMENT_TERM_TYPES.map((type) => (
                <option key={type || 'none'} value={type}>
                  {PARTNER_PAYMENT_TERM_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            {form.paymentTermType ? (
              <p className="mt-1 text-xs text-slate-500">{PARTNER_PAYMENT_TERM_TYPE_HINTS[form.paymentTermType]}</p>
            ) : null}
          </label>
          {form.paymentTermType === 'installment' ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">선금 비율 (%)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={form.paymentDepositPercent}
                  onChange={(event) => updateForm('paymentDepositPercent', event.target.value)}
                  className="w-28 rounded-lg border border-slate-200 px-3 py-2 tabular-nums"
                />
                <span className="text-sm text-slate-500">
                  잔금 {Math.max(0, 100 - Math.floor(Number(form.paymentDepositPercent) || 0))}%
                </span>
              </div>
            </label>
          ) : null}
          {form.paymentTermType === 'net' ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">후불 일수 (Net)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={form.paymentNetDays}
                  onChange={(event) => updateForm('paymentNetDays', event.target.value)}
                  className="w-28 rounded-lg border border-slate-200 px-3 py-2 tabular-nums"
                />
                <span className="text-sm text-slate-500">일</span>
              </div>
            </label>
          ) : null}
          {form.paymentTermType === 'monthly' ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">익월 입금일</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.paymentMonthlyDay}
                  onChange={(event) => updateForm('paymentMonthlyDay', event.target.value)}
                  className="w-28 rounded-lg border border-slate-200 px-3 py-2 tabular-nums"
                />
                <span className="text-sm text-slate-500">일 (월말 마감)</span>
              </div>
            </label>
          ) : null}
        </div>
      </div>
    </ErpModal>
  )
}

export function PartnerModal({ open, ...props }: PartnerModalProps) {
  if (!open) return null
  return <PartnerModalContent open={open} {...props} />
}
