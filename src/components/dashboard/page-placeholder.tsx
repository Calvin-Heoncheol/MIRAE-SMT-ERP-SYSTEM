type PagePlaceholderProps = {
  title: string
  description?: string
}

export function PagePlaceholder({
  title,
  description = '페이지 내용은 추후 구현 예정입니다.',
}: PagePlaceholderProps) {
  return (
    <div className="erp-panel px-7 py-8 text-center lg:px-8">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-3 text-sm text-slate-500">{description}</p>
    </div>
  )
}
