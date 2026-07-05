import type { SmtPcbSide } from './types'

export function buildSmtCountKey(orderLineId: string, pcbSide: SmtPcbSide) {
  return `${orderLineId}:${pcbSide}`
}

export function defaultSmtPcbSideForMode(pcbSideMode: 'single' | 'dual'): SmtPcbSide {
  return pcbSideMode === 'dual' ? 'TOP' : 'SINGLE'
}

export function smtPcbSidesForMode(pcbSideMode: 'single' | 'dual'): SmtPcbSide[] {
  return pcbSideMode === 'dual' ? ['TOP', 'BOT'] : ['SINGLE']
}
