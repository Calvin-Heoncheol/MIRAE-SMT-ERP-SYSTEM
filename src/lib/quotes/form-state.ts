import type { DipPcbBoard, LegacyWaveCounts, SmtPcbBoard, SmtSide } from './types'
import { defaultDipPcbBoard, defaultSmtPcbBoard } from './utils'
import { foldLegacyWaveCounts, isMultiSideSmt, normalizeSmtSide } from './constants'

export type SmtBoardForm = {
  pcbName: string
  chip: string
  smtOdd: string
  smtSpecial: string
  icPin: string
  bga: string
  smtSide: SmtSide
  aoiEnabled: boolean
  pcbWashEnabled: boolean
  smtTopCount: string
  smtBotCount: string
}

export type DipBoardForm = {
  pcbName: string
  dipGeneral: string
  dipConnector: string
  dipWire: string
  dipXLarge: string
}

export function parseNumericField(value: string) {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === '-') return 0
  const parsed = Number(trimmed)
  if (Number.isNaN(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

export function toNumericField(value: number | string | undefined) {
  if (value === '' || value === undefined || value === null) return '0'
  return String(value)
}

export function defaultSmtBoardForm(index = 0): SmtBoardForm {
  const board = defaultSmtPcbBoard(index)
  return smtBoardToForm(board)
}

export function defaultDipBoardForm(index = 0): DipBoardForm {
  const board = defaultDipPcbBoard(index)
  return dipBoardToForm(board)
}

export function smtBoardToForm(board: SmtPcbBoard): SmtBoardForm {
  const smtSide = normalizeSmtSide(board.smtSide)
  const multi = isMultiSideSmt(smtSide)

  return {
    pcbName: board.pcbName,
    chip: toNumericField(board.chip),
    smtOdd: toNumericField(board.smtOdd),
    smtSpecial: toNumericField(board.smtSpecial),
    icPin: toNumericField(board.icPin),
    bga: toNumericField(board.bga),
    smtSide,
    aoiEnabled: board.aoiEnabled !== false,
    pcbWashEnabled: board.pcbWashEnabled === true,
    smtTopCount: toNumericField(board.smtTopCount),
    smtBotCount: multi ? toNumericField(board.smtBotCount) : '0',
  }
}

export function smtBoardFormToModel(form: SmtBoardForm): SmtPcbBoard {
  const smtSide = normalizeSmtSide(form.smtSide)
  const multi = isMultiSideSmt(smtSide)

  return {
    pcbName: form.pcbName.trim() || 'PCB',
    chip: parseNumericField(form.chip),
    smtOdd: parseNumericField(form.smtOdd),
    smtSpecial: parseNumericField(form.smtSpecial),
    icPin: parseNumericField(form.icPin),
    bga: parseNumericField(form.bga),
    smtSide,
    aoiEnabled: true,
    pcbWashEnabled: form.pcbWashEnabled,
    smtTopCount: parseNumericField(form.smtTopCount),
    smtBotCount: multi ? parseNumericField(form.smtBotCount) : 0,
  }
}

export function dipBoardToForm(board: DipPcbBoard & LegacyWaveCounts): DipBoardForm {
  const counts = foldLegacyWaveCounts(board)
  return {
    pcbName: board.pcbName,
    dipGeneral: toNumericField(counts.dipGeneral),
    dipConnector: toNumericField(counts.dipConnector),
    dipWire: toNumericField(counts.dipWire),
    dipXLarge: toNumericField(counts.dipXLarge),
  }
}

export function dipBoardFormToModel(form: DipBoardForm): DipPcbBoard {
  return {
    pcbName: form.pcbName.trim() || 'PCB',
    dipGeneral: parseNumericField(form.dipGeneral),
    dipConnector: parseNumericField(form.dipConnector),
    dipWire: parseNumericField(form.dipWire),
    dipXLarge: parseNumericField(form.dipXLarge),
  }
}

export function resizeBoardForms<T>(
  current: T[],
  count: number,
  factory: (index: number) => T,
): T[] {
  const next = current.slice(0, count)
  while (next.length < count) next.push(factory(next.length))
  return next
}
