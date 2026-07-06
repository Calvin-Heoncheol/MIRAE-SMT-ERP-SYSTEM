import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import type { DeliveryHistoryRow } from '@/lib/delivery/types'
import type { OrderListGroup } from '@/lib/orders/types'
import { formatProductSummary } from '@/lib/orders/utils'
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

function groupSmtLinesByOrderNumber(smtLines: ProductionOrderLine[]) {
  const map = new Map<string, ProductionOrderLine[]>()

  for (const line of smtLines) {
    const existing = map.get(line.orderNumber) ?? []
    existing.push(line)
    map.set(line.orderNumber, existing)
  }

  return map
}

function groupAssemblyGroupsByOrderId(assemblyGroups: OrderAssemblyGroup[]) {
  const map = new Map<string, OrderAssemblyGroup[]>()

  for (const group of assemblyGroups) {
    const existing = map.get(group.orderId) ?? []
    existing.push(group)
    map.set(group.orderId, existing)
  }

  return map
}

export function buildTodayProductionStages(
  smtRecords: SmtProductionHistoryRow[],
  postRecords: PostProcessProductionHistoryRow[] = [],
  deliveryRecords: DeliveryHistoryRow[] = [],
): TodayProductionStage[] {
  const smtQuantity = smtRecords.reduce((sum, row) => sum + row.quantity, 0)
  const postQuantity = postRecords.reduce((sum, row) => sum + row.quantity, 0)
  const deliveryQuantity = deliveryRecords.reduce((sum, row) => sum + row.quantity, 0)

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
      recordCount: deliveryRecords.length,
      quantity: deliveryQuantity,
      linked: true,
    },
  ]
}

export function buildProductionStatusLines(
  orders: OrderListGroup[],
  smtLines: ProductionOrderLine[],
  assemblyGroups: OrderAssemblyGroup[],
  smtCounts: ProductionCounts,
  postCounts: ProductionCounts,
  shipCounts: ProductionCounts,
): ProductionStatusLine[] {
  const smtLinesByOrderNumber = groupSmtLinesByOrderNumber(smtLines)
  const assembliesByOrderId = groupAssemblyGroupsByOrderId(assemblyGroups)

  return orders.map((order) => {
    const orderSmtLines = smtLinesByOrderNumber.get(order.orderNumber) ?? []
    let smtTarget = 0
    let smtProduced = 0

    for (const smtLine of orderSmtLines) {
      const lineTarget = Math.max(0, Math.floor(smtLine.quantity))
      smtTarget += lineTarget
      smtProduced += resolveProductionCount(smtLine, smtCounts)
    }

    const orderAssemblies = assembliesByOrderId.get(order.orderId) ?? []
    let postTarget = 0
    let postProduced = 0
    let shipProduced = 0

    for (const assembly of orderAssemblies) {
      const assemblyTarget = Math.max(0, Math.floor(assembly.targetQuantity))
      postTarget += assemblyTarget
      postProduced += Math.max(0, Math.floor(Number(postCounts[assembly.id]) || 0))
      shipProduced += Math.max(0, Math.floor(Number(shipCounts[assembly.id]) || 0))
    }

    return {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      customer: order.customer,
      productName: formatProductSummary(order),
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
}
