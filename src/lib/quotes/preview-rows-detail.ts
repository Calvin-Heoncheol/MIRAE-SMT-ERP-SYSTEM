import { getDipUnitRates, getPostRate, getSmtUnitRates } from './constants'
import {
  calculateEstimate,
  computeSmtSetupBillingBreakdown,
  smtLineAmount,
} from './calculate-estimate'
import { roundDomesticKrw } from './format'
import { getPreviewLabels, localizePostProcessItemName, type QuoteLabelType } from './preview-i18n'
import {
  hasPostProcessLineInput,
  normalizePostProcessOrder,
  resolveCategorizedPostProcessLineForms,
  resolvePostProcessLineBilledMinutes,
  roundPostProcessMinutes,
  type PostProcessCategory,
} from './post-process-lines'
import type {
  DipBoardDetail,
  EstimateResult,
  PostProcessLine,
  QuoteListItem,
  QuoteType,
  SmtBoardDetail,
} from './types'
import { toEstimateInputFromDetail } from './utils'
import {
  quotePerUnitTotal,
  type PreviewFormFields,
  type PreviewPostProcessLine,
  type PreviewRow,
} from './preview-rows-format'

export function scalePreviewRowAmountsByQty(
  rows: PreviewRow[],
  qty: number,
  labelType: QuoteLabelType = 'domestic',
): PreviewRow[] {
  const labels = getPreviewLabels(labelType)
  const safeQty = qty || 1
  return rows.map((row) => {
    if (row.orderLevel) {
      const orderAmount = row.amount
      if (row.noUnitPrice) {
        return { ...row, productionQty: labels.oneTime, unitPrice: null }
      }
      return {
        ...row,
        productionQty: labels.oneTime,
        // 발주 1회 금액 → 대당은 수량으로 나눈 값(원 반올림)
        unitPrice:
          orderAmount != null
            ? roundDomesticKrw(quotePerUnitTotal(orderAmount, safeQty))
            : row.unitPrice,
      }
    }
    if (row.amount == null) return row
    // 대당(원) 반올림 × 수량 = 합계 — 대당·합계 표시가 어긋나지 않게
    const perUnit = row.unitPrice ?? row.amount
    const unitRounded = roundDomesticKrw(perUnit)
    return {
      ...row,
      unitPrice: unitRounded,
      amount: unitRounded * safeQty,
    }
  })
}

function withProductionQty(
  row: Omit<PreviewRow, 'productionQty'>,
  qty: number,
  labels: ReturnType<typeof getPreviewLabels>,
): PreviewRow {
  return { ...row, productionQty: labels.formatQty(qty || 1) }
}

function smtSetupPerUnit(setupAmount: number, qty: number) {
  return setupAmount / (qty || 1)
}

export function smtBoardLaborPerUnit(board: SmtBoardDetail) {
  return board.laborUnit
}

function setupComponentPerUnit(minutes: number, rate: number, qty: number) {
  return smtSetupPerUnit(minutes * rate, qty)
}

export function smtBoardInspectionPerUnit(board: SmtBoardDetail) {
  return board.inspectionUnit
}

export function previewFormFromQuote(quote: QuoteListItem): PreviewFormFields {
  const input = toEstimateInputFromDetail(quote)
  const post = quote.detailInfo.inputs?.postProcess || {}
  const categorized = resolveCategorizedPostProcessLineForms(post)
  return {
    postAssembly: input.postAssembly ?? 0,
    postDownload: input.postDownload ?? 0,
    postTest: input.postTest ?? 0,
    postPacking: input.postPacking ?? 0,
    materialCost: input.materialCost ?? 0,
    metalMaskCost: input.metalMaskCost ?? 0,
    productionKind: input.productionKind === '샘플' ? '샘플' : '양산',
    includeVat: quote.detailInfo.settings?.includeVat === true,
    includeMaterialCosts: input.includeMaterialCosts !== false,
    includeMetalMask: input.includeMetalMask !== false,
    timeBufferPercent: post.timeBufferPercent,
    postProcessOrder: normalizePostProcessOrder(post.order),
    assemblyLines: categorized.assemblyLines,
    downloadLines: categorized.downloadLines,
    testLines: categorized.testLines,
    packingLines: categorized.packingLines,
  }
}

export function estimateSavedQuote(quote: QuoteListItem): EstimateResult {
  return calculateEstimate(toEstimateInputFromDetail(quote))
}

export function smtDetailRowsForBoard(
  board: SmtBoardDetail,
  result: EstimateResult,
  quoteType: QuoteType,
  labelType: QuoteLabelType = quoteType,
): PreviewRow[] {
  const labels = getPreviewLabels(labelType)
  const rates = getSmtUnitRates(quoteType)
  const qty = result.qty || 1
  const items: Array<{ label: string; count: number; countText: string; rate: number }> = [
    { label: 'CHIP', count: board.chip, countText: labels.partsCount(board.chip), rate: rates.chip },
    { label: labels.oddParts, count: board.smtOdd, countText: labels.partsCount(board.smtOdd), rate: rates.odd },
    {
      label: labels.specialParts,
      count: board.smtSpecial,
      countText: labels.partsCount(board.smtSpecial),
      rate: rates.special,
    },
    { label: 'IC PIN', count: board.icPin, countText: `${board.icPin} PIN`, rate: rates.icPin },
    { label: 'BGA BALL', count: board.bga, countText: `${board.bga} BALL`, rate: rates.bgaBall },
  ]

  return items
    .filter((item) => item.count > 0)
    .map((item) =>
      withProductionQty(
        {
          label: item.label,
          unit: item.rate,
          count: item.countText,
          amount: smtLineAmount(item.count, item.rate),
          indent: 2,
        },
        qty,
        labels,
      ),
    )
}

export function inspectionDetailRowsForBoard(
  board: SmtBoardDetail,
  quoteType: QuoteType,
  labelType: QuoteLabelType = quoteType,
  qty = 1,
): PreviewRow[] {
  if (board.inspectionUnit <= 0) return []

  const labels = getPreviewLabels(labelType)
  const sideLabel =
    board.smtSide === 'dual'
      ? labels.sideDual
      : board.smtSide === 'double'
        ? labels.sideDouble
        : labels.sideSingle
  const rows: PreviewRow[] = []

  if (board.aoiInspectionUnit > 0) {
    rows.push(
      withProductionQty(
        {
          label: labels.aoi,
          description: sideLabel,
          unit: board.aoiInspectionUnit,
          count: labels.onePcb,
          amount: board.aoiInspectionUnit,
          indent: 2,
        },
        qty,
        labels,
      ),
    )
  }

  return rows
}

export function smtSetupDetailRowsForBoard(
  board: SmtBoardDetail,
  result: EstimateResult,
  quoteType: QuoteType,
  labelType: QuoteLabelType = quoteType,
): PreviewRow[] {
  if (board.setupAmount <= 0) return []

  const labels = getPreviewLabels(labelType)
  const qty = result.qty || 1
  const breakdown = computeSmtSetupBillingBreakdown(board.setupPartCount, board.smtSide, quoteType)

  function setupMinutesValue(minutes: number) {
    const rounded = Math.round(minutes * 10) / 10
    const value = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
    return labels.minutesCount(value)
  }

  function setupDetailRow(
    label: string,
    description: string,
    basis: string,
    minutes: number,
  ): PreviewRow {
    const perUnit = setupComponentPerUnit(minutes, board.setupRate, qty)
    return {
      label,
      description: `${description} · ${basis}`,
      unit: board.setupRate,
      count: setupMinutesValue(minutes),
      amount: perUnit,
      indent: 2,
    }
  }

  const partCountLabel =
    labelType === 'zh'
      ? `${breakdown.partCount.toLocaleString('zh-CN')}种`
      : labelType === 'domestic'
        ? `${breakdown.partCount.toLocaleString('ko-KR')}종`
        : `${breakdown.partCount.toLocaleString('en-US')} parts`

  return [
    withProductionQty(
      setupDetailRow(
        labels.setupBaseTime,
        labels.setupBaseDesc,
        labelType === 'domestic' ? '고정' : labelType === 'zh' ? '固定' : 'Fixed',
        breakdown.baseMinutes,
      ),
      qty,
      labels,
    ),
    withProductionQty(
      setupDetailRow(
        labels.firstArticle,
        labels.setupFirstArticleDesc,
        partCountLabel,
        breakdown.firstArticleMinutes,
      ),
      qty,
      labels,
    ),
    withProductionQty(
      setupDetailRow(
        labels.setting,
        labels.setupSettingDesc,
        partCountLabel,
        breakdown.settingMinutes,
      ),
      qty,
      labels,
    ),
  ]
}

export function dipDetailRowsForBoard(
  board: DipBoardDetail,
  quoteType: QuoteType,
  labelType: QuoteLabelType = quoteType,
  qty = 1,
): PreviewRow[] {
  const labels = getPreviewLabels(labelType)
  const DIP_UNIT = getDipUnitRates(quoteType)
  const rows: PreviewRow[] = []
  if (board.dipGeneral > 0) {
    rows.push(
      withProductionQty(
        {
          label: labels.dipGeneral,
          unit: DIP_UNIT.dipGeneral,
          unitPrice: board.dipGeneral * DIP_UNIT.dipGeneral,
          count: board.dipGeneral,
          amount: board.dipGeneral * DIP_UNIT.dipGeneral,
          indent: 2,
        },
        qty,
        labels,
      ),
    )
  }
  if (board.dipConnector > 0) {
    rows.push(
      withProductionQty(
        {
          label: labels.dipConnector,
          unit: DIP_UNIT.dipConnector,
          unitPrice: board.dipConnector * DIP_UNIT.dipConnector,
          count: board.dipConnector,
          amount: board.dipConnector * DIP_UNIT.dipConnector,
          indent: 2,
        },
        qty,
        labels,
      ),
    )
  }
  if (board.dipWire > 0) {
    rows.push(
      withProductionQty(
        {
          label: labels.dipWire,
          unit: DIP_UNIT.dipWire,
          unitPrice: board.dipWire * DIP_UNIT.dipWire,
          count: board.dipWire,
          amount: board.dipWire * DIP_UNIT.dipWire,
          indent: 2,
        },
        qty,
        labels,
      ),
    )
  }
  if (board.dipXLarge > 0) {
    rows.push(
      withProductionQty(
        {
          label: labels.dipXLarge,
          unit: DIP_UNIT.dipXLarge,
          unitPrice: board.dipXLarge * DIP_UNIT.dipXLarge,
          count: board.dipXLarge,
          amount: board.dipXLarge * DIP_UNIT.dipXLarge,
          indent: 2,
        },
        qty,
        labels,
      ),
    )
  }
  return rows
}

function postProcessDetailDescription(
  lines: PreviewPostProcessLine[] | PostProcessLine[] | undefined,
  labelType: QuoteLabelType = 'domestic',
) {
  const names = (lines ?? [])
    .map((line) => localizePostProcessItemName((line.name || '').trim(), labelType))
    .filter(Boolean)
  return names.length > 0 ? names.join(' · ') : undefined
}

function categoryLineForms(form: PreviewFormFields) {
  if (
    form.assemblyLines ||
    form.downloadLines ||
    form.testLines ||
    form.packingLines
  ) {
    return {
      assemblyLines: form.assemblyLines ?? [],
      downloadLines: form.downloadLines ?? [],
      testLines: form.testLines ?? [],
      packingLines: form.packingLines ?? [],
    }
  }
  if (form.postProcessLines && form.postProcessLines.length > 0) {
    return {
      assemblyLines: form.postProcessLines,
      downloadLines: [] as PreviewPostProcessLine[],
      testLines: [] as PreviewPostProcessLine[],
      packingLines: [] as PreviewPostProcessLine[],
    }
  }
  return resolveCategorizedPostProcessLineForms({
    postAssembly: Number(form.postAssembly) || 0,
    postDownload: Number(form.postDownload) || 0,
    postTest: Number(form.postTest) || 0,
    postPacking: Number(form.postPacking) || 0,
  })
}

function postCategoryDetailRows(
  categoryLabel: string,
  lines: PreviewPostProcessLine[],
  indent: number,
  quoteType: QuoteType,
  labelType: QuoteLabelType,
  qty: number,
  bufferPercent?: number | string | null,
): PreviewRow[] {
  const labels = getPreviewLabels(labelType)
  const postRate = getPostRate(quoteType)
  const active = lines.filter(
    (line) => resolvePostProcessLineBilledMinutes(line, qty, bufferPercent) > 0,
  )
  if (!active.length) return []

  const rows: PreviewRow[] = []
  let categoryTotal = 0
  let categoryMinutes = 0
  const detailRows: PreviewRow[] = []

  for (const line of active) {
    const minutes = resolvePostProcessLineBilledMinutes(line, qty, bufferPercent)
    const name = (line.name || '').trim()
    const perUnit = minutes * postRate
    categoryTotal += perUnit
    categoryMinutes += minutes
    detailRows.push(
      withProductionQty(
        {
          label: localizePostProcessItemName(name, labelType) || categoryLabel,
          unit: postRate,
          unitPrice: perUnit,
          count: labels.minutesCount(minutes),
          amount: perUnit,
          indent: indent + 1,
        },
        qty,
        labels,
      ),
    )
  }

  rows.push({
    label: categoryLabel,
    amount: categoryTotal,
    count: labels.minutesCount(roundPostProcessMinutes(categoryMinutes)),
    indent,
    boardSubtotal: true,
    emphasize: true,
    amountEmphasize: true,
    countEmphasize: true,
  })
  rows.push(...detailRows)
  return rows
}

export function postDetailRows(
  form: PreviewFormFields,
  indent: number,
  quoteType: QuoteType,
  labelType: QuoteLabelType = quoteType,
  qty = 1,
): PreviewRow[] {
  const labels = getPreviewLabels(labelType)
  const categorized = categoryLineForms(form)
  const hasCategoryLines =
    categorized.assemblyLines.some((line) => hasPostProcessLineInput(line)) ||
    categorized.downloadLines.some((line) => hasPostProcessLineInput(line)) ||
    categorized.testLines.some((line) => hasPostProcessLineInput(line)) ||
    categorized.packingLines.some((line) => hasPostProcessLineInput(line))

  if (hasCategoryLines) {
    const bufferPercent = form.timeBufferPercent
    const categories: Record<PostProcessCategory, { label: string; lines: PreviewPostProcessLine[] }> = {
      assembly: { label: labels.assembly, lines: categorized.assemblyLines },
      download: { label: labels.download, lines: categorized.downloadLines },
      test: { label: labels.test, lines: categorized.testLines },
      packing: { label: labels.packing, lines: categorized.packingLines },
    }
    return normalizePostProcessOrder(form.postProcessOrder).flatMap((category) =>
      postCategoryDetailRows(
        categories[category].label,
        categories[category].lines,
        indent,
        quoteType,
        labelType,
        qty,
        bufferPercent,
      ),
    )
  }

  // 구 견적: 합계 분만 있는 경우
  const postRate = getPostRate(quoteType)
  const rows: PreviewRow[] = []
  if (Number(form.postAssembly) > 0) {
    const minutes = Number(form.postAssembly)
    const perUnit = minutes * postRate
    rows.push(
      withProductionQty(
        {
          label: labels.assembly,
          description: postProcessDetailDescription(form.assemblyLines, labelType),
          unit: postRate,
          unitPrice: perUnit,
          count: labels.minutesCount(minutes),
          amount: perUnit,
          indent,
        },
        qty,
        labels,
      ),
    )
  }
  if (Number(form.postDownload) > 0) {
    const minutes = Number(form.postDownload)
    const perUnit = minutes * postRate
    rows.push(
      withProductionQty(
        {
          label: labels.download,
          description: postProcessDetailDescription(form.downloadLines, labelType),
          unit: postRate,
          unitPrice: perUnit,
          count: labels.minutesCount(minutes),
          amount: perUnit,
          indent,
        },
        qty,
        labels,
      ),
    )
  }
  if (Number(form.postTest) > 0) {
    const minutes = Number(form.postTest)
    const perUnit = minutes * postRate
    rows.push(
      withProductionQty(
        {
          label: labels.test,
          description: postProcessDetailDescription(form.testLines, labelType),
          unit: postRate,
          unitPrice: perUnit,
          count: labels.minutesCount(minutes),
          amount: perUnit,
          indent,
        },
        qty,
        labels,
      ),
    )
  }
  if (Number(form.postPacking) > 0) {
    const minutes = Number(form.postPacking)
    const perUnit = minutes * postRate
    rows.push(
      withProductionQty(
        {
          label: labels.packing,
          description: postProcessDetailDescription(form.packingLines, labelType),
          unit: postRate,
          unitPrice: perUnit,
          count: labels.minutesCount(minutes),
          amount: perUnit,
          indent,
        },
        qty,
        labels,
      ),
    )
  }
  return rows
}

export function hasPostInputs(form: PreviewFormFields) {
  const categorized = categoryLineForms(form)
  if (
    [
      ...categorized.assemblyLines,
      ...categorized.downloadLines,
      ...categorized.testLines,
      ...categorized.packingLines,
    ].some((line) => hasPostProcessLineInput(line))
  ) {
    return true
  }
  return (
    Number(form.postAssembly) > 0 ||
    Number(form.postDownload) > 0 ||
    Number(form.postTest) > 0 ||
    Number(form.postPacking) > 0
  )
}

export function previewMaterialRows(
  result: EstimateResult,
  form: PreviewFormFields,
  quoteType: QuoteType,
  labelType: QuoteLabelType = quoteType,
): PreviewRow[] {
  if (form.includeMaterialCosts === false) return []

  const labels = getPreviewLabels(labelType)
  const qty = result.qty || 1
  const materialPerUnit = Number(form.materialCost) || 0
  const materialMgmtPerUnit = quotePerUnitTotal(result.common.materialManagement, qty)
  const totalPerUnit = materialPerUnit + materialMgmtPerUnit

  if (totalPerUnit <= 0) return []

  const rows: PreviewRow[] = [
    {
      label: labels.materials,
      amount: totalPerUnit,
      emphasize: true,
      amountEmphasize: true,
      sectionTotal: 'material',
    },
  ]

  rows.push({
    label: labels.rawMaterial,
    unit: materialPerUnit,
    count: labels.formatQty(qty),
    amount: materialPerUnit,
    indent: 1,
  })

  rows.push({
    label: labels.managementFee,
    unit: materialMgmtPerUnit,
    count: labels.formatQty(qty),
    amount: materialMgmtPerUnit,
    indent: 1,
  })

  return rows
}

/** 견적 입력 화면 SET-UP 상세 — 기본시간·초품검사·세팅 */
export function buildQuoteSetupDetailRows(
  result: EstimateResult,
  quoteType: QuoteType,
): PreviewRow[] {
  const pcbCount = result.common.pcbBoardDetails.length
  const multiBoard = pcbCount > 1
  const rows: PreviewRow[] = []

  for (let index = 0; index < pcbCount; index += 1) {
    const smtBoard = result.common.pcbBoardDetails[index]!
    const setupDetails = smtSetupDetailRowsForBoard(smtBoard, result, quoteType)
    if (!setupDetails.length) continue
    rows.push(...(multiBoard ? withBoardName(setupDetails, smtBoard.pcbName) : setupDetails))
  }

  return rows
}

export function previewOrderLevelRows(
  result: EstimateResult,
  form: PreviewFormFields,
  _quoteType: QuoteType,
  labelType: QuoteLabelType = _quoteType,
): PreviewRow[] {
  const labels = getPreviewLabels(labelType)
  const rows: PreviewRow[] = []
  const sample = result.common.sampleCost || 0
  if (sample > 0) {
    rows.push({
      label: labels.sampleCost,
      amount: sample,
      count: '',
      orderLevel: true,
      indent: 1,
      emphasize: true,
      amountEmphasize: true,
    })
  }
  return rows
}

export function withBoardName(rows: PreviewRow[], pcbName: string): PreviewRow[] {
  return rows.map((row) => ({ ...row, boardName: pcbName }))
}
