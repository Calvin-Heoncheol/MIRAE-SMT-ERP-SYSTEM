import type { DipPcbBoard, SmtPcbBoard } from './types'
import { defaultDipPcbBoard, defaultSmtPcbBoard } from './utils'

export type SmtBoardForm = {
  pcbName: string
  chip: string
  smtOdd: string
  smtSpecial: string
  icPin: string
  bga: string
  smtSide: 'single' | 'double'
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
  waveGeneral: string
  waveConnector: string
  waveWire: string
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
  const isDouble = board.smtSide === 'double'

  return {
    pcbName: board.pcbName,
    chip: toNumericField(board.chip),
    smtOdd: toNumericField(board.smtOdd),
    smtSpecial: toNumericField(board.smtSpecial),
    icPin: toNumericField(board.icPin),
    bga: toNumericField(board.bga),
    smtSide: isDouble ? 'double' : 'single',
    aoiEnabled: board.aoiEnabled,
    pcbWashEnabled: board.pcbWashEnabled,
    smtTopCount: toNumericField(board.smtTopCount),
    smtBotCount: isDouble ? toNumericField(board.smtBotCount) : '0',
  }
}

export function smtBoardFormToModel(form: SmtBoardForm): SmtPcbBoard {
  const isDouble = form.smtSide === 'double'

  return {
    pcbName: form.pcbName.trim() || 'PCB',
    chip: parseNumericField(form.chip),
    smtOdd: parseNumericField(form.smtOdd),
    smtSpecial: parseNumericField(form.smtSpecial),
    icPin: parseNumericField(form.icPin),
    bga: parseNumericField(form.bga),
    smtSide: form.smtSide,
    aoiEnabled: form.aoiEnabled,
    pcbWashEnabled: form.pcbWashEnabled,
    smtTopCount: parseNumericField(form.smtTopCount),
    smtBotCount: isDouble ? parseNumericField(form.smtBotCount) : 0,
  }
}

export function dipBoardToForm(board: DipPcbBoard): DipBoardForm {
  return {
    pcbName: board.pcbName,
    dipGeneral: toNumericField(board.dipGeneral),
    dipConnector: toNumericField(board.dipConnector),
    dipWire: toNumericField(board.dipWire),
    waveGeneral: toNumericField(board.waveGeneral),
    waveConnector: toNumericField(board.waveConnector),
    waveWire: toNumericField(board.waveWire),
  }
}

export function dipBoardFormToModel(form: DipBoardForm): DipPcbBoard {
  return {
    pcbName: form.pcbName.trim() || 'PCB',
    dipGeneral: parseNumericField(form.dipGeneral),
    dipConnector: parseNumericField(form.dipConnector),
    dipWire: parseNumericField(form.dipWire),
    waveGeneral: parseNumericField(form.waveGeneral),
    waveConnector: parseNumericField(form.waveConnector),
    waveWire: parseNumericField(form.waveWire),
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
