type ModuleTabPlaceholderProps = {
  description?: string
}

export function ModuleTabPlaceholder({
  description = '페이지 내용은 추후 구현 예정입니다.',
}: ModuleTabPlaceholderProps) {
  return (
    <div className="erp-panel px-7 py-12 text-center lg:px-8">
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  )
}
