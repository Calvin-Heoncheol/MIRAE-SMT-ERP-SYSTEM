import type { Item, ItemPayload, ItemPcbSideModeValue, ItemProcessTypeValue } from '@/lib/items/types'
import { isSemiFinishedItemCategory, isFinishedItemCategory } from '@/lib/items/types'
import { defaultLegacyBoardName, readLegacyBoardsFromQuote, readLegacyUnitPrice } from './build-quote-payload'
import type { QuoteListItem } from './types'

export type LegacyReflectDraft = {
  productName: string
  boards: LegacyReflectBoard[]
  unitPrice: number
  processType: ItemProcessTypeValue
}

export type LegacyReflectBoard = {
  index: number
  smtSide: 'single' | 'double'
  pcbSideMode: ItemPcbSideModeValue
  itemName: string
  unitPrice: number
}

export type LegacyReflectMatch = {
  item: Item
  score: 'exact' | 'name'
}

export function normalizeItemNameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function toPcbSideMode(smtSide: 'single' | 'double'): ItemPcbSideModeValue {
  return smtSide === 'double' ? 'dual' : 'single'
}

export function legacyBoardItemName(
  productName: string,
  board: { name?: string; smtSide: 'single' | 'double' },
  boardIndex: number,
  boardCount: number,
) {
  const base = productName.trim()
  if (boardCount <= 1) return base
  const custom = board.name?.trim()
  if (custom) return custom
  return defaultLegacyBoardName(boardIndex)
}

export function buildLegacyReflectDraft(input: {
  productName: string
  boards: Array<{ name?: string; smtSide: 'single' | 'double' }>
  unitPrice: number
  processType?: ItemProcessTypeValue | null
}): LegacyReflectDraft | { error: string } {
  const productName = input.productName.trim()
  if (!productName) return { error: '제품명이 필요합니다.' }

  const boardsInput = input.boards.length ? input.boards : [{ name: '', smtSide: 'single' as const }]
  const unitPrice = Math.max(0, input.unitPrice || 0)
  const processType =
    input.processType === 'smt' || input.processType === 'post' || input.processType === 'smt_post'
      ? input.processType
      : 'smt_post'

  const unitEach = unitPrice / boardsInput.length

  return {
    productName,
    unitPrice,
    processType,
    boards: boardsInput.map((board, index) => ({
      index,
      smtSide: board.smtSide === 'double' ? 'double' : 'single',
      pcbSideMode: toPcbSideMode(board.smtSide === 'double' ? 'double' : 'single'),
      itemName: legacyBoardItemName(productName, board, index, boardsInput.length),
      unitPrice: unitEach,
    })),
  }
}

export function buildLegacyReflectDraftFromQuote(quote: QuoteListItem): LegacyReflectDraft | { error: string } {
  const settingsProcess = quote.detailInfo.settings?.processType
  return buildLegacyReflectDraft({
    productName: quote.productName,
    boards: readLegacyBoardsFromQuote(quote.detailInfo),
    unitPrice: readLegacyUnitPrice({
      amounts: quote.detailInfo.amounts,
      settings: quote.detailInfo.settings,
      totalAmount: quote.totalAmount,
    }),
    processType:
      settingsProcess === 'smt' || settingsProcess === 'post' || settingsProcess === 'smt_post'
        ? settingsProcess
        : null,
  })
}

export function findSemiItemMatches(
  items: Item[],
  productOrBoardName: string,
  pcbSideMode: ItemPcbSideModeValue,
  processType: ItemProcessTypeValue,
): LegacyReflectMatch[] {
  const nameKey = normalizeItemNameKey(productOrBoardName)
  const semis = items.filter((item) => isSemiFinishedItemCategory(item.itemCategory) && item.isActive)

  const exact: LegacyReflectMatch[] = []
  const byName: LegacyReflectMatch[] = []

  for (const item of semis) {
    if (normalizeItemNameKey(item.name) !== nameKey) continue
    const sameSide = item.pcbSideMode === pcbSideMode
    const sameProcess = item.processType === processType
    if (sameSide && sameProcess) {
      exact.push({ item, score: 'exact' })
    } else {
      byName.push({ item, score: 'name' })
    }
  }

  return [...exact, ...byName]
}

export function findFinishedItemMatches(items: Item[], productName: string): Item[] {
  const nameKey = normalizeItemNameKey(productName)
  return items.filter(
    (item) =>
      isFinishedItemCategory(item.itemCategory) &&
      item.isActive &&
      normalizeItemNameKey(item.name) === nameKey,
  )
}

export function buildSemiItemPayloadFromBoard(
  board: LegacyReflectBoard,
  processType: ItemProcessTypeValue,
): ItemPayload {
  return {
    id: '',
    name: board.itemName,
    specification: '',
    mpn: '',
    materialType: '',
    supplyType: '',
    supplier: '',
    pcbSideMode: board.pcbSideMode,
    processType,
    unitPrice: board.unitPrice,
    itemCategory: 3,
  }
}

export function buildSemiItemPayloadFromDraft(draft: LegacyReflectDraft): ItemPayload {
  const board = draft.boards[0]
  if (!board) {
    return {
      id: '',
      name: draft.productName,
      specification: '',
      mpn: '',
      materialType: '',
      supplyType: '',
      supplier: '',
      pcbSideMode: 'single',
      processType: draft.processType,
      unitPrice: draft.unitPrice,
      itemCategory: 3,
    }
  }
  return buildSemiItemPayloadFromBoard(board, draft.processType)
}

export function buildFinishedItemPayload(productName: string): ItemPayload {
  return {
    id: '',
    name: productName.trim(),
    specification: '',
    mpn: '',
    materialType: '',
    supplyType: '',
    supplier: '',
    pcbSideMode: '',
    processType: '',
    unitPrice: 0,
    itemCategory: 4,
  }
}
