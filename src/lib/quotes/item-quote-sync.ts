import { calcParentUnitPriceFromBom } from '@/lib/bom/repository'
import type { Product } from '@/lib/products/types'
import type { DipBoardForm, SmtBoardForm } from '@/lib/quotes/form-state'
import {
  defaultDipBoardForm,
  defaultSmtBoardForm,
  resizeBoardForms,
} from '@/lib/quotes/form-state'
import { itemPcbSideToSmtSide } from '@/lib/items/smt-quote-parts'

export type ApplyProductToQuoteResult = {
  smtForms: SmtBoardForm[]
  dipForms: DipBoardForm[]
  materialCostPerUnit: number
  materialFromBom: boolean
  pcbBoardCount: number
}

function money(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0))
}

/** 품목 선택 시: 면·자재(BOM 우선)만 반영 */
export async function buildQuoteDefaultsFromProduct(input: {
  product: Product
  currentSmtForms: SmtBoardForm[]
  currentDipForms: DipBoardForm[]
}): Promise<ApplyProductToQuoteResult> {
  let materialCostPerUnit = money(input.product.materialUnitPrice)
  let materialFromBom = false
  const bom = await calcParentUnitPriceFromBom(input.product.id)
  if (bom.ok && bom.unitPrice > 0) {
    materialCostPerUnit = bom.unitPrice
    materialFromBom = true
  }

  const base = input.currentSmtForms[0] || defaultSmtBoardForm(0)
  const smtForms: SmtBoardForm[] = [
    {
      ...base,
      pcbName: base.pcbName?.trim() || input.product.productName || 'PCB',
      smtSide: itemPcbSideToSmtSide(input.product.pcbSideMode),
    },
  ]
  const dipForms = resizeBoardForms(input.currentDipForms, 1, defaultDipBoardForm).map(
    (board) => ({
      ...board,
      pcbName: smtForms[0]?.pcbName || board.pcbName,
    }),
  )

  return {
    smtForms,
    dipForms,
    materialCostPerUnit,
    materialFromBom,
    pcbBoardCount: 1,
  }
}
