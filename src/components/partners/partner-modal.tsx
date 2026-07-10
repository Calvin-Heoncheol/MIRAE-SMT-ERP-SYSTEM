'use client'

import { useEffect, useState } from 'react'
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
}: Omit<PartnerModalProps, 'open'>) {
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deleting) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, deleting])

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isCreate ? '거래처 등록' : '거래처 수정'}</h2>
            {!isCreate && partner ? (
              <p className="mt-1 font-mono text-xs text-slate-500">
                {formatBusinessRegNo(partner.businessRegNo)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
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
        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          {saveError ? <p className="mb-3 text-sm text-red-600">{saveError}</p> : null}
          <div className="flex justify-between gap-2">
            {!isCreate ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting || saving}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || deleting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || deleting}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PartnerModal({ open, ...props }: PartnerModalProps) {
  if (!open) return null
  return <PartnerModalContent {...props} />
}
