import { fetchPostProcessProductionHistory } from '@/lib/post-process/repository'
import {
  fetchProductionLotSearchIndex,
  fetchShipmentSearchIndex,
  formatLotIdsLabel,
  resolveHistoryLotIds,
  resolveHistoryShipmentIds,
  type ProductionLotSearchIndex,
  type ShipmentSearchIndex,
} from '@/lib/production-lots/repository'
import { fetchSmtProductionHistory } from '@/lib/smt/repository'
import {
  postProcessTeamToHistoryTeam,
  type ProductionHistoryRow,
} from './types'

export type FetchProductionHistoryResult =
  | { ok: true; rows: ProductionHistoryRow[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

function lotAndShipmentLabels(
  lotIndex: ProductionLotSearchIndex,
  shipmentIndex: ShipmentSearchIndex,
  input: {
    assemblyGroupId?: string
    orderLineId?: string
    recordDate: string
    orderNumber: string
    productCode: string
  },
) {
  const lotIds = resolveHistoryLotIds(lotIndex, input)
  const shipmentIds = resolveHistoryShipmentIds(shipmentIndex, lotIndex, {
    lotIds,
    assemblyGroupId: input.assemblyGroupId,
    orderLineId: input.orderLineId,
  })
  return {
    lotLabel: formatLotIdsLabel(lotIds),
    shipmentLabel: formatLotIdsLabel(shipmentIds),
  }
}

export async function fetchProductionHistory(): Promise<FetchProductionHistoryResult> {
  const [smtResult, postResult, lotIndex, shipmentIndex] = await Promise.all([
    fetchSmtProductionHistory(),
    fetchPostProcessProductionHistory(),
    fetchProductionLotSearchIndex(),
    fetchShipmentSearchIndex(),
  ])

  if (!smtResult.ok) return smtResult
  if (!postResult.ok) return postResult

  const smtRows: ProductionHistoryRow[] = smtResult.rows.map((row) => {
    const labels = lotAndShipmentLabels(lotIndex, shipmentIndex, {
      orderLineId: row.orderLineId,
      recordDate: row.recordDate,
      orderNumber: row.orderNumber,
      productCode: row.productCode,
    })
    return {
      id: row.id,
      module: 'smt',
      team: '생산1팀',
      recordDate: row.recordDate,
      createdAt: row.createdAt,
      orderNumber: row.orderNumber,
      customer: row.customer,
      productName: row.productName,
      productCode: row.productCode,
      lotLabel: labels.lotLabel,
      shipmentLabel: labels.shipmentLabel,
      quantity: row.quantity,
      defectQuantity: row.defectQuantity,
      note: row.note,
      createdByName: row.createdByName,
      lineNo: row.lineNo,
      pcbSide: row.pcbSide,
    }
  })

  const postRows: ProductionHistoryRow[] = postResult.rows.map((row) => {
    const labels = lotAndShipmentLabels(lotIndex, shipmentIndex, {
      assemblyGroupId: row.assemblyGroupId,
      recordDate: row.recordDate,
      orderNumber: row.orderNumber,
      productCode: row.productCode,
    })
    return {
      id: row.id,
      module: 'post_process',
      team: postProcessTeamToHistoryTeam(row.team),
      recordDate: row.recordDate,
      createdAt: row.createdAt,
      orderNumber: row.orderNumber,
      customer: row.customer,
      productName: row.productName,
      productCode: row.productCode,
      lotLabel: labels.lotLabel,
      shipmentLabel: labels.shipmentLabel,
      quantity: row.quantity,
      defectQuantity: row.defectQuantity,
      note: row.note,
      createdByName: row.createdByName,
      lineNo: null,
      pcbSide: null,
    }
  })

  const rows = [...smtRows, ...postRows].sort((a, b) => {
    const createdCompare = b.createdAt.localeCompare(a.createdAt)
    if (createdCompare !== 0) return createdCompare
    return b.recordDate.localeCompare(a.recordDate)
  })

  return { ok: true, rows }
}
