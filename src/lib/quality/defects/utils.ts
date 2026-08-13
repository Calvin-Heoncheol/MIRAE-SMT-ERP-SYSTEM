import type {
  DefectActionType,
  DefectHandlingListItem,
  DefectHandlingStatus,
  DefectStatusFilter,
} from './types'
import { DEFECT_ACTION_LABELS, DEFECT_STATUS_LABELS } from './types'

export function statusFromActionType(actionType: DefectActionType): DefectHandlingStatus {
  return actionType === 'hold' ? 'hold' : 'completed'
}

export function formatDefectStatus(status: DefectHandlingStatus) {
  return DEFECT_STATUS_LABELS[status]
}

export function formatDefectAction(actionType: DefectActionType | null) {
  if (!actionType) return '-'
  return DEFECT_ACTION_LABELS[actionType]
}

export function formatDefectSourceModule(module: DefectHandlingListItem['sourceModule']) {
  return module === 'smt' ? 'SMT' : '후공정'
}

export function filterDefectHandlings(
  rows: DefectHandlingListItem[],
  search: string,
  statusFilter: DefectStatusFilter,
) {
  const query = search.trim().toLowerCase()
  return rows.filter((row) => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false
    if (!query) return true
    const haystack = [
      row.orderNumber,
      row.customer,
      row.productName,
      row.productCode,
      row.note,
      row.team,
      row.createdByName,
      formatDefectStatus(row.status),
      formatDefectAction(row.actionType),
      row.actionNote,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })
}
