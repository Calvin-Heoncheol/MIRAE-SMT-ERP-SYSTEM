type EmptyListStateProps = {
  message: string
  /** 보조 안내. message에 이미 포함된 문장이면 자동 생략 */
  hint?: string
}

export function EmptyListState({ message, hint }: EmptyListStateProps) {
  const trimmedHint = hint?.trim() || ''
  const showHint = Boolean(trimmedHint) && !message.includes(trimmedHint)

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <p className="text-base font-semibold text-slate-700">{message}</p>
      {showHint ? <p className="mt-2 text-sm text-slate-500">{trimmedHint}</p> : null}
    </div>
  )
}
