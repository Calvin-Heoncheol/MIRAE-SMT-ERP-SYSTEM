import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import type { PostProcessProductionHistoryRow } from '@/lib/post-process/types'
import type { SmtProductionHistoryRow } from '@/lib/smt/types'
import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'
import {
  getProgressPercent,
  resolveProductionCount,
} from '@/lib/production-input/utils'
import type { ProductionStatusLine, TodayProductionStage, TodayProductionStageKey } from './types'

export const TODAY_PRODUCTION_STAGE_LABELS: Record<TodayProductionStageKey, string> = {
  smt: 'SMT',
  post_process: '후공정',
  shipment: '출하',
}

function buildAssemblyByOrderLineId(assemblyGroups: OrderAssemblyGroup[]) {
  const map = new Map<string, OrderAssemblyGroup>()

  for (const group of assemblyGroups) {
    for (const line of group.lines) {
      map.set(line.orderLineId, group)
    }
  }

  return map
}

export function buildTodayProductionStages(
  smtRecords: SmtProductionHistoryRow[],
  postRecords: PostProcessProductionHistoryRow[] = [],
): TodayProductionStage[] {
  const smtQuantity = smtRecords.reduce((sum, row) => sum + row.quantity, 0)
  const postQuantity = postRecords.reduce((sum, row) => sum + row.quantity, 0)

  return [
    {
      key: 'smt',
      label: TODAY_PRODUCTION_STAGE_LABELS.smt,
      recordCount: smtRecords.length,
      quantity: smtQuantity,
      linked: true,
    },
    {
      key: 'post_process',
      label: TODAY_PRODUCTION_STAGE_LABELS.post_process,
      recordCount: postRecords.length,
      quantity: postQuantity,
      linked: true,
    },
    {
      key: 'shipment',
      label: TODAY_PRODUCTION_STAGE_LABELS.shipment,
      recordCount: 0,
      quantity: 0,
      linked: false,
    },
  ]
}

export function buildProductionStatusLines(
  smtLines: ProductionOrderLine[],
  assemblyGroups: OrderAssemblyGroup[],
  smtCounts: ProductionCounts,
  postCounts: ProductionCounts,
  shipCounts: ProductionCounts,
): ProductionStatusLine[] {
  const assemblyByOrderLineId = buildAssemblyByOrderLineId(assemblyGroups)

  return smtLines
    .map((smtLine) => {
      const smtTarget = Math.max(0, Math.floor(smtLine.quantity))
      const smtProduced = resolveProductionCount(smtLine, smtCounts)
      const assembly = assemblyByOrderLineId.get(smtLine.orderLineId)
      const postTarget = assembly ? assembly.targetQuantity : 0
      const postProduced = assembly ? Math.max(0, Math.floor(Number(postCounts[assembly.id]) || 0)) : 0
      const shipProduced = assembly ? Math.max(0, Math.floor(Number(shipCounts[assembly.id]) || 0)) : 0

      return {
        orderLineId: smtLine.orderLineId,
        orderNumber: smtLine.orderNumber,
        customer: smtLine.customer,
        productName: smtLine.productName || smtLine.productCode,
        quantity: smtTarget,
        smtProduced,
        smtPercent: getProgressPercent(smtProduced, smtTarget),
        postTarget,
        postProduced,
        postPercent: getProgressPercent(postProduced, postTarget),
        shipTarget: postTarget,
        shipProduced,
        shipPercent: getProgressPercent(shipProduced, postTarget),
      }
    })
    .sort((a, b) => {
      const orderCompare = b.orderNumber.localeCompare(a.orderNumber)
      if (orderCompare !== 0) return orderCompare
      return a.productName.localeCompare(b.productName)
    })
}
