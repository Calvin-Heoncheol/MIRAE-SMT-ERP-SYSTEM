export type SolderCreamEquipmentType = 'fridge' | 'mixer' | 'unknown'

export type SolderCreamEventType =
  | 'store'
  | 'open'
  | 'mix_start'
  | 'mix_complete'
  | 'alarm'
  | 'discard'
  | 'unknown'

export type SolderCreamLotStatus =
  | 'cold'
  | 'opened'
  | 'mixed'
  | 'ready'
  | 'discarded'
  | 'alarm'
  | 'unknown'

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
  lastInboundAt: string | null
  lastEventAt: string | null
  inboundCount: number
  status: SolderCreamLotStatus
}

