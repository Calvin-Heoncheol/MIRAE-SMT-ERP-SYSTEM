'use client'

import { useEffect, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

type ChangeReasonModalProps = {
  open: boolean
  title?: string
  description?: string
  saving?: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export function ChangeReasonModal({
  open,
  title = '변경사유 입력',
  description = '단가(금액)가 변경되었습니다. 변경사유를 입력한 뒤 저장하세요.',
  saving = false,
  onConfirm,
  onCancel,
}: ChangeReasonModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setReason('')
    setError(null)
  }, [open])

  function handleConfirm() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError('변경사유를 입력하세요.')
      return
    }
    onConfirm(trimmed)
  }

  return (
    <ErpModal
      open={open}
      size="form"
      title={title}
      description={description}
      onClose={onCancel}
      closeOnEscape={!saving}
      zIndexClassName="z-[60]"
      footer={
        <div className="flex w-full flex-col gap-2">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <ErpButton variant="secondary" onClick={onCancel} disabled={saving}>
              취소
            </ErpButton>
            <ErpButton onClick={handleConfirm} disabled={saving} loading={saving}>
              사유 확인 후 저장
            </ErpButton>
          </div>
        </div>
      }
    >
      <label className="block text-sm">
        <span className={ERP_FIELD_LABEL_CLASS}>변경사유</span>
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            if (error) setError(null)
          }}
          rows={4}
          placeholder="예: SMD 단가인상, DIP 단가인상, 자재비 인상"
          className={ERP_FIELD_INPUT_CLASS}
          autoFocus
        />
      </label>
    </ErpModal>
  )
}
