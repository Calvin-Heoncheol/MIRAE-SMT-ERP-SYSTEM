/**
 * 공정별 분리 청구 — 한 제품을 고객 서류에서만 SMD 줄 / 후공정 줄로 나눠 표시한다.
 * 생산·자재·출하 수량은 품목 하나로 그대로 관리한다.
 */
export type ProcessBillingCodes = {
  smdCode: string
  postCode: string
}

export type ProcessBillingPart = 'smd' | 'post'

export function resolveProcessBillingCodes(
  item: { smdBillingCode?: string | null; postBillingCode?: string | null } | null | undefined,
): ProcessBillingCodes | null {
  const smdCode = String(item?.smdBillingCode || '').trim()
  const postCode = String(item?.postBillingCode || '').trim()
  if (!smdCode || !postCode) return null
  return { smdCode, postCode }
}

/**
 * 대당 단가·공급가액을 SMD / 후공정으로 나눈다.
 * 후공정 = 후공정 단가, SMD = 나머지(SET-UP·SMD·자재). 합계는 원래 금액과 정확히 같다.
 */
export function splitAmountByProcess(input: {
  qty: number
  unitPrice: number
  amount?: number
  postUnitPrice: number
}) {
  const qty = Math.max(0, Math.floor(Number(input.qty) || 0))
  const unitPrice = Math.max(0, Math.round(Number(input.unitPrice) || 0))
  const amount =
    input.amount != null && Number.isFinite(Number(input.amount))
      ? Math.max(0, Math.round(Number(input.amount) || 0))
      : qty * unitPrice
  const postUnitPrice = Math.min(unitPrice, Math.max(0, Math.round(Number(input.postUnitPrice) || 0)))
  const postAmount = Math.min(amount, qty * postUnitPrice)
  return {
    smd: { unitPrice: unitPrice - postUnitPrice, amount: amount - postAmount },
    post: { unitPrice: postUnitPrice, amount: postAmount },
  }
}

export function processBillingPartName(
  productName: string,
  part: ProcessBillingPart,
  language: 'ko' | 'en' = 'ko',
) {
  const name = String(productName || '').trim()
  const suffix = part === 'smd' ? 'SMD' : language === 'en' ? 'Post-Process' : '후공정'
  return name ? `${name} (${suffix})` : suffix
}
