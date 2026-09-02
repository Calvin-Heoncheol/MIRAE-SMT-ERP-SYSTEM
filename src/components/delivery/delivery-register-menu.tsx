'use client'

import { ERP_PRIMARY_BUTTON_CLASS } from '@/lib/ui/tokens'

type DeliveryRegisterMenuProps = {
  onOpenRegister: () => void
  disabled?: boolean
}

export function DeliveryRegisterMenu({ onOpenRegister, disabled = false }: DeliveryRegisterMenuProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onOpenRegister}
      className={ERP_PRIMARY_BUTTON_CLASS}
    >
      출하 등록
    </button>
  )
}
