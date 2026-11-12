import {
  getPreviewLabels,
  resolveLabelQuoteType,
  type QuoteDocumentLanguage,
  type QuoteLabelType,
} from './preview-i18n'
import type { EstimateResult, QuoteListItem, QuoteType } from './types'
import {
  dipDetailRowsForBoard,
  estimateSavedQuote,
  hasPostInputs,
  inspectionDetailRowsForBoard,
  previewFormFromQuote,
  postDetailRows,
  previewMaterialRows,
  previewOrderLevelRows,
  scalePreviewRowAmountsByQty,
  smtBoardInspectionPerUnit,
  smtBoardLaborPerUnit,
  smtDetailRowsForBoard,
  smtSetupDetailRowsForBoard,
  withBoardName,
} from './preview-rows-detail'
import {
  pdfSummarySectionLabel,
  quotePerUnitTotal,
  type PreviewFormFields,
  type PreviewRow,
} from './preview-rows-format'

export {
  BOARD_SUBTOTAL_ROW_BG,
  breakdownBoardColLabel,
  buildProcessBreakdownSections,
  computeBreakdownBoardRowSpans,
  filterPdfBreakdownRows,
  formatPreviewRowDescription,
  formatPreviewRowUnit,
  isBreakdownBoardGroupStart,
  isPreviewHighlightRow,
  PDF_SECTION_COLORS,
  pdfSummarySectionLabel,
  prepareBreakdownSectionTableRows,
  quotePerUnitTotal,
  SECTION_TOTAL_ROW_BG,
  type BreakdownSectionPreview,
  type PdfBreakdownSection,
  type PreviewFormFields,
  type PreviewRow,
  type PreviewSection,
} from './preview-rows-format'
export { buildQuoteSetupDetailRows, estimateSavedQuote } from './preview-rows-detail'

/** PDF 세부 산정내역 — SET-UP / SMD / 납땜 / 후공정 / 자재 / 기타 */
export function buildProcessCentricPdfBreakdownRows(
  result: EstimateResult,
  form: PreviewFormFields,
  quoteType: QuoteType,
  labelType: QuoteLabelType = quoteType,
): PreviewRow[] {
  const labels = getPreviewLabels(labelType)
  const qty = result.qty || 1
  const pcbCount = result.common.pcbBoardDetails.length
  const multiBoard = pcbCount > 1
  const rows: PreviewRow[] = []

  const setupTotal = pdfOrderLevelSectionTotal(result)
  if (setupTotal > 0) {
    rows.push({
      label: 'SET-UP',
      amount: setupTotal,
      count: '',
      orderLevel: true,
      sectionTotal: 'setup',
      emphasize: true,
      amountEmphasize: true,
    })

    for (let index = 0; index < pcbCount; index += 1) {
      const smtBoard = result.common.pcbBoardDetails[index]
      const boardName = multiBoard ? smtBoard.pcbName : undefined
      const setupDetails = smtSetupDetailRowsForBoard(smtBoard, result, quoteType, labelType)
      if (!setupDetails.length) continue
      rows.push(...(multiBoard ? withBoardName(setupDetails, boardName!) : setupDetails))
    }

    rows.push(...previewOrderLevelRows(result, form, quoteType, labelType))
  }

  const smtTotal = pdfSmtSectionTotal(result)
  if (smtTotal > 0) {
    rows.push({
      label: pdfSummarySectionLabel('SMD', labelType),
      amount: smtTotal,
      sectionTotal: 'smt',
      emphasize: true,
      amountEmphasize: true,
    })

    for (let index = 0; index < pcbCount; index += 1) {
      const smtBoard = result.common.pcbBoardDetails[index]
      const boardName = multiBoard ? smtBoard.pcbName : undefined
      const smtLabor = smtBoardLaborPerUnit(smtBoard)
      const inspectionPerUnit = smtBoardInspectionPerUnit(smtBoard)
      const smtDetails = smtDetailRowsForBoard(smtBoard, result, quoteType, labelType)
      const inspectionDetails = inspectionDetailRowsForBoard(smtBoard, quoteType, labelType, qty)
      const hasSmdContent =
        smtLabor > 0 || smtDetails.length > 0 || inspectionPerUnit > 0 || inspectionDetails.length > 0
      if (!hasSmdContent) continue

      if (multiBoard && smtDetails.length === 0 && inspectionDetails.length === 0) {
        rows.push({
          label: '',
          amount: smtLabor + inspectionPerUnit,
          boardSubtotal: true,
          emphasize: true,
          amountEmphasize: true,
          boardName,
        })
        continue
      }

      rows.push({
        label: 'SMD',
        amount: null,
        indent: 1,
        boardSubtotal: true,
        emphasize: true,
        boardName,
      })
      rows.push(...(multiBoard ? withBoardName(smtDetails, smtBoard.pcbName) : smtDetails))
      rows.push(...(multiBoard ? withBoardName(inspectionDetails, smtBoard.pcbName) : inspectionDetails))
    }
  }

  const dipTotal = pdfSolderingSectionTotal(result)
  const postPerUnit = quotePerUnitTotal(result.values.postProcess, qty)

  if (dipTotal > 0) {
    rows.push({
      label: labels.soldering,
      amount: dipTotal,
      sectionTotal: 'dip',
      emphasize: true,
      amountEmphasize: true,
    })

    for (let index = 0; index < pcbCount; index += 1) {
      const smtBoard = result.common.pcbBoardDetails[index]
      const dipBoard = result.common.dipBoardDetails[index]
      if (!dipBoard) continue

      const boardName = multiBoard ? smtBoard.pcbName : undefined
      const dip = dipBoard.boardUnit ?? 0
      const dipDetails = dipDetailRowsForBoard(dipBoard, quoteType, labelType, qty)
      if (dip <= 0 && !dipDetails.length) continue

      if (multiBoard && !dipDetails.length) {
        rows.push({
          label: '',
          amount: dip,
          indent: 1,
          boardSubtotal: true,
          emphasize: true,
          amountEmphasize: true,
          boardName,
        })
      }
      rows.push(
        ...(multiBoard
          ? withBoardName(
              dipDetails.map((row) => ({ ...row, indent: Math.max(1, row.indent ?? 1) })),
              smtBoard.pcbName,
            )
          : dipDetails.map((row) => ({ ...row, indent: Math.max(1, row.indent ?? 1) }))),
      )
    }
  }

  if (postPerUnit > 0 || hasPostInputs(form)) {
    rows.push({
      label: pdfSummarySectionLabel(labels.postProcess, labelType),
      amount: postPerUnit,
      sectionTotal: 'post',
      emphasize: true,
      amountEmphasize: true,
    })
    rows.push(...postDetailRows(form, 1, quoteType, labelType, qty))
  }

  const materialRows = previewMaterialRows(result, form, quoteType, labelType)
  if (materialRows.length > 0) {
    const [materialHeader, ...materialDetails] = materialRows
    rows.push({
      ...materialHeader,
      label: pdfSummarySectionLabel(labels.materials, labelType),
    })
    rows.push(...materialDetails)
  }

  // 메탈마스크·샘플은 SET-UP(발주 1회)에만 포함. 여기 다시 붙이면 납땜 등 마지막 섹션으로 잘못 분류됨.
  return scalePreviewRowAmountsByQty(rows, qty)
}

function pdfSmtSectionTotal(result: EstimateResult) {
  return result.common.pcbBoardDetails.reduce((sum, smtBoard) => {
    const smt = smtBoardLaborPerUnit(smtBoard)
    const inspection = smtBoardInspectionPerUnit(smtBoard)
    return sum + smt + inspection
  }, 0)
}

function pdfSetupSectionTotal(result: EstimateResult) {
  return result.common.smtSetup || 0
}

function pdfOrderLevelSectionTotal(result: EstimateResult) {
  return pdfSetupSectionTotal(result) + (result.common.sampleCost || 0)
}

function pdfSolderingSectionTotal(result: EstimateResult) {
  return result.common.pcbBoardDetails.reduce((sum, _smtBoard, index) => {
    const dipBoard = result.common.dipBoardDetails[index]
    return sum + (dipBoard?.boardUnit ?? 0)
  }, 0)
}

export type PreviewBoardRow = {
  pcbName: string
  smtPerUnit: number
  dipPerUnit: number
  postPerUnit: number | null
  rowTotalPerUnit: number
}

export function buildQuotePreviewData(
  quote: QuoteListItem,
  options?: { labelLanguage?: QuoteDocumentLanguage },
) {
  const estimate = estimateSavedQuote(quote)
  const form = previewFormFromQuote(quote)
  const quoteType = quote.quoteType
  const labelType = resolveLabelQuoteType(quoteType, options?.labelLanguage)
  const pdfBreakdownRows = buildProcessCentricPdfBreakdownRows(estimate, form, quoteType, labelType)
  return { estimate, pdfBreakdownRows, form, labelType }
}
