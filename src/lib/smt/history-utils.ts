import type { SmtPcbSide } from './types'

export function formatSmtPcbSideLabel(pcbSide: SmtPcbSide) {
  if (pcbSide === 'TOP') return 'TOP'
  if (pcbSide === 'BOT') return 'BOT'
  return '-'
}
