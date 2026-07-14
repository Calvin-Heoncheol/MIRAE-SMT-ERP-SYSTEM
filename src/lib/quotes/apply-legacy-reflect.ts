import { saveBomForParent } from '@/lib/bom/repository'
import { createItem, updateItem } from '@/lib/items/repository'
import { buildLegacyQuoteRowPayload, readLegacyBoardsFromQuote } from '@/lib/quotes/build-quote-payload'
import { updateQuote } from '@/lib/quotes/repository'
import type { QuoteListItem } from '@/lib/quotes/types'
import {
  buildFinishedItemPayload,
  buildLegacyReflectDraftFromQuote,
  buildSemiItemPayloadFromBoard,
  type LegacyReflectDraft,
} from '@/lib/quotes/reflect-legacy-items'

export type ApplyLegacyReflectBoardChoice = {
  boardIndex: number
  reuseSemiItemId: string | null
  updateSemiUnitPrice: boolean
}

export type ApplyLegacyReflectInput = {
  quote: QuoteListItem
  draft: LegacyReflectDraft
  boardChoices: ApplyLegacyReflectBoardChoice[]
  createFinished: boolean
  reuseFinishedItemId: string | null
}

export type ApplyLegacyReflectResult =
  | {
      ok: true
      semiItemIds: string[]
      finishedItemId: string | null
      createdSemiCount: number
      createdFinished: boolean
    }
  | { ok: false; detail: string }

export async function applyLegacyQuoteItemReflect(
  input: ApplyLegacyReflectInput,
): Promise<ApplyLegacyReflectResult> {
  const { quote, draft } = input
  const semiItemIds: string[] = []
  let createdSemiCount = 0

  for (const board of draft.boards) {
    const choice = input.boardChoices.find((row) => row.boardIndex === board.index)
    let semiItemId = choice?.reuseSemiItemId?.trim() || ''

    if (semiItemId) {
      if (choice?.updateSemiUnitPrice) {
        const updateResult = await updateItem(semiItemId, {
          name: board.itemName,
          specification: '',
          mpn: '',
          materialType: '',
          supplyType: '',
          supplier: '',
          pcbSideMode: board.pcbSideMode,
          processType: draft.processType,
          unitPrice: board.unitPrice,
          itemCategory: 3,
        })
        if (!updateResult.ok) {
          return {
            ok: false,
            detail: `${board.itemName || `보드${board.index + 1}`} 반제품 갱신 실패: ${updateResult.detail}`,
          }
        }
      }
    } else {
      const createResult = await createItem(buildSemiItemPayloadFromBoard(board, draft.processType))
      if (!createResult.ok) {
        return {
          ok: false,
          detail: `${board.itemName || `보드${board.index + 1}`} 반제품 생성 실패: ${createResult.detail}`,
        }
      }
      semiItemId = createResult.id
      createdSemiCount += 1
    }

    semiItemIds.push(semiItemId)
  }

  let finishedItemId: string | null = null
  let createdFinished = false

  if (input.createFinished) {
    finishedItemId = input.reuseFinishedItemId?.trim() || ''
    if (!finishedItemId) {
      const createFinishedResult = await createItem(buildFinishedItemPayload(draft.productName))
      if (!createFinishedResult.ok) {
        return { ok: false, detail: `완제품 생성 실패: ${createFinishedResult.detail}` }
      }
      finishedItemId = createFinishedResult.id
      createdFinished = true
    }

    const bomResult = await saveBomForParent(
      finishedItemId,
      semiItemIds.map((childProductId, index) => ({
        childProductId,
        quantityPer: 1,
        note: `견적 ${quote.quoteNumber} · ${draft.boards[index]?.itemName || `보드${index + 1}`}`,
      })),
    )
    if (!bomResult.ok) {
      return { ok: false, detail: `BOM 연결 실패: ${bomResult.detail}` }
    }
  }

  const nextFinishedId = input.createFinished
    ? finishedItemId || undefined
    : quote.detailInfo.settings?.linkedFinishedItemId

  const payload = buildLegacyQuoteRowPayload({
    customer: quote.customer,
    productName: draft.productName,
    boards: draft.boards.map((board) => ({
      name: board.itemName,
      smtSide: board.smtSide,
    })),
    unitPrice: String(draft.unitPrice),
    includeSmd: draft.processType === 'smt' || draft.processType === 'smt_post',
    includePost: draft.processType === 'post' || draft.processType === 'smt_post',
    quoteDate: quote.quoteDate,
    linkedSemiItemId: semiItemIds[0],
    linkedSemiItemIds: semiItemIds,
    linkedFinishedItemId: nextFinishedId,
  })

  const saveQuote = await updateQuote(quote.quoteNumber, payload)
  if (!saveQuote.ok) {
    return { ok: false, detail: `견적 연결 저장 실패: ${saveQuote.detail}` }
  }

  return {
    ok: true,
    semiItemIds,
    finishedItemId,
    createdSemiCount,
    createdFinished,
  }
}

export function resolveDraftForQuote(quote: QuoteListItem): LegacyReflectDraft | { error: string } {
  return buildLegacyReflectDraftFromQuote(quote)
}

export function linkedSemiIdsFromQuote(quote: QuoteListItem): string[] {
  const ids = quote.detailInfo.settings?.linkedSemiItemIds
  if (Array.isArray(ids) && ids.length) {
    return ids.map((id) => id.trim()).filter(Boolean)
  }
  const single = quote.detailInfo.settings?.linkedSemiItemId?.trim()
  return single ? [single] : []
}

export { readLegacyBoardsFromQuote }
