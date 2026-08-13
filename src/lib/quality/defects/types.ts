export type DefectSourceModule = 'smt' | 'post_process'

export type DefectHandlingStatus = 'pending' | 'hold' | 'completed'

export type DefectActionType =
  | 'rework'
  | 'scrap'
  | 'concession_paid'
  | 'concession_free'
  | 'hold'

export type DefectStatusFilter = 'all' | 'pending' | 'hold' | 'completed'

export const DEFECT_ACTION_TYPES: DefectActionType[] = [
  'rework',
  'scrap',
  'concession_paid',
  'concession_free',
  'hold',
]

export const DEFECT_ACTION_LABELS: Record<DefectActionType, string> = {
  rework: '재작업',
  scrap: '폐기',
  concession_paid: '특채(유상)',
  concession_free: '특채(무상)',
  hold: '보류',
}

export const DEFECT_STATUS_LABELS: Record<DefectHandlingStatus, string> = {
  pending: '미대처',
  hold: '보류',
  completed: '완료',
}

export type DefectHandlingRecord = {
  id: string
  sourceModule: DefectSourceModule
  productionRecordId: string
  status: DefectHandlingStatus
  actionType: DefectActionType | null
  actionNote: string
  handledByName: string
  handledAt: string | null
  updatedAt: string
}

export type DefectHandlingListItem = {
  /** `${module}:${productionRecordId}` */
  key: string
  sourceModule: DefectSourceModule
  productionRecordId: string
  recordDate: string
  createdAt: string
  team: string
  orderNumber: string
  customer: string
  productName: string
  productCode: string
  defectQuantity: number
  note: string
  createdByName: string
  lineNo: number | null
  pcbSide: string | null
  status: DefectHandlingStatus
  actionType: DefectActionType | null
  actionNote: string
  handledByName: string
  handledAt: string | null
  handlingId: string | null
}

export type UpsertDefectHandlingInput = {
  sourceModule: DefectSourceModule
  productionRecordId: string
  actionType: DefectActionType
  actionNote: string
}
