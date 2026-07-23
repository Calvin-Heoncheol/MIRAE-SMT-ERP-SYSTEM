type EmptyListStateProps = {
  message: string
  /** 보조 안내. message에 이미 포함돼 있으면 생략 */
  hint?: string
}

export function EmptyListState({ message, hint }: EmptyListStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <p className="text-base font-semibold text-slate-700">{message}</p>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </div>
  )
}
