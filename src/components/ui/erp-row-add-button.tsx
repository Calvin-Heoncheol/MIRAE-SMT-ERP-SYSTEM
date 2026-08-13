import { ERP_ROW_ADD_BUTTON_CLASS } from '@/lib/ui/tokens'

type ErpRowAddButtonProps = {
  onClick: () => void
  disabled?: boolean
  title?: string
  className?: string
}

export function ErpRowAddButton({ onClick, disabled, title = '행 추가', className }: ErpRowAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={[ERP_ROW_ADD_BUTTON_CLASS, className].filter(Boolean).join(' ')}
    >
      추가
    </button>
  )
}
