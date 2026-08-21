export type SolderCreamEquipmentType = 'fridge' | 'mixer' | 'unknown'

export type SolderCreamEventType =
  | 'store'
  | 'open'
  | 'mix_start'
  | 'mix_complete'
  | 'alarm'
  | 'discard'
  | 'unknown'

/** 현황 상태 — 로그 자동 + 수동(폐기 등) */
export type SolderCreamLotStatus = 'cold' | 'discarded' | 'scrapped' | 'unknown'

export type SolderCreamEditableLotStatus = Exclude<SolderCreamLotStatus, 'unknown'>

export type SolderCreamLogImportRow = {
  sourceRow: number
  recordedAt: string
  equipmentType: SolderCreamEquipmentType
  equipmentId: string
  lotNumber: string
  eventType: SolderCreamEventType
  temperature: number | null
  mixSeconds: number | null
  result: string
  note: string
}

export type SolderCreamLogImport = {
  id: string
  sourceName: string
  rowCount: number
  importedAt: string
  note: string
}

export type SolderCreamEquipmentLog = {
  id: string
  importId: string
  sourceRow: number
  recordedAt: string
  equipmentType: SolderCreamEquipmentType
  equipmentId: string
  lotNumber: string
  eventType: SolderCreamEventType
  temperature: number | null
  mixSeconds: number | null
  result: string
  note: string
  createdAt: string
}

export type SolderCreamLotStatusOverride = {
  lotNumber: string
  status: SolderCreamEditableLotStatus
  note: string
  updatedAt: string
}

export type SolderCreamLotSummary = {
  lotNumber: string
  status: SolderCreamLotStatus
  lastRecordedAt: string
  lastEventType: SolderCreamEventType
  lastTemperature: number | null
  lastMixSeconds: number | null
  eventCount: number
}

export type SolderCreamStatusRow = {
  barcode: string
  manufacturedAt: string | null
  expiresAt: string | null
  lastEventAt: string | null
  inboundCount: number
  status: SolderCreamLotStatus
  /** 로그만으로 계산한 상태 (수동 수정 전) */
  derivedStatus: SolderCreamLotStatus
  manualStatus: boolean
  note: string
}
