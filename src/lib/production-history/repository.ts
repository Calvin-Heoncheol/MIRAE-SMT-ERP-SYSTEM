import { fetchPostProcessProductionHistory } from '@/lib/post-process/repository'
import { fetchSmtProductionHistory } from '@/lib/smt/repository'
import {
  postProcessTeamToHistoryTeam,
  type ProductionHistoryRow,
} from './types'

export type FetchProductionHistoryResult =
  | { ok: true; rows: ProductionHistoryRow[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export async function fetchProductionHistory(): Promise<FetchProductionHistoryResult> {
  const [smtResult, postResult] = await Promise.all([
    fetchSmtProductionHistory(),
    fetchPostProcessProductionHistory(),
  ])

  if (!smtResult.ok) return smtResult
  if (!postResult.ok) return postResult

  const smtRows: ProductionHistoryRow[] = smtResult.rows.map((row) => ({
    id: row.id,
    module: 'smt',
    team: '생산1팀',
    recordDate: row.recordDate,
    createdAt: row.createdAt,
    orderNumber: row.orderNumber,
    customer: row.customer,
    productName: row.productName,
    productCode: row.productCode,
    quantity: row.quantity,
    defectQuantity: row.defectQuantity,
    note: row.note,
    createdByName: row.createdByName,
    lineNo: row.lineNo,
    pcbSide: row.pcbSide,
  }))

  const postRows: ProductionHistoryRow[] = postResult.rows.map((row) => ({
    id: row.id,
    module: 'post_process',
    team: postProcessTeamToHistoryTeam(row.team),
    recordDate: row.recordDate,
    createdAt: row.createdAt,
    orderNumber: row.orderNumber,
    customer: row.customer,
    productName: row.productName,
    productCode: row.productCode,
    quantity: row.quantity,
    defectQuantity: row.defectQuantity,
    note: row.note,
    createdByName: row.createdByName,
    lineNo: null,
    pcbSide: null,
  }))

  const rows = [...smtRows, ...postRows].sort((a, b) => {
    const createdCompare = b.createdAt.localeCompare(a.createdAt)
    if (createdCompare !== 0) return createdCompare
    return b.recordDate.localeCompare(a.recordDate)
  })

  return { ok: true, rows }
}
