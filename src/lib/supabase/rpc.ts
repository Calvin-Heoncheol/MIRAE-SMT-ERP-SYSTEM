/** PostgREST / Postgres 에서 RPC 미적용(함수 없음) 여부 */
export function isMissingRpcFunction(detail: string) {
  const text = String(detail || '')
  return (
    text.includes('Could not find the function') ||
    text.includes('PGRST202') ||
    (text.includes('function') && text.includes('does not exist')) ||
    text.includes('schema cache')
  )
}
