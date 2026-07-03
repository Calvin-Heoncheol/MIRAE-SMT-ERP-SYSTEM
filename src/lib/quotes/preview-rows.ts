import {
  AOI_UNIT_PRICE_DOUBLE,
  AOI_UNIT_PRICE_SINGLE,
  DIP_UNIT,
  PCB_WASH_UNIT_PRICE,
  POST_RATE,
  SMT_PLACEMENT_MIN_SCORE,
  getSmtSetupRate,
  getSmtPlacementMinFee,
  SMT_UNIT_BGA_BALL,
  SMT_UNIT_CHIP,
  SMT_UNIT_IC_PIN,
  SMT_UNIT_ODD,
  SMT_UNIT_SPECIAL,
} from './constants'
import { calculateEstimate } from './calculate-estimate'
import { formatQuoteMoneyUnit } from './format'
import type { EstimateResult, QuoteListItem, QuoteType } from './types'
import { toEstimateInputFromDetail } from './utils'

export type PreviewSection = 'smt' | 'dip' | 'post' | 'material'

export type PreviewRow = {
  label: string
  subLabel?: string
  unit?: number | null
  unitLabel?: string
  count?: number | string | null
  amount?: number | null
  indent?: number
  emphasize?: boolean
  amountEmphasize?: boolean
  sectionTotal?: PreviewSection
}

export type PreviewFormFields = {
  postAssembly: string | number
  postTest: string | number
  postPacking: string | number
  materialCost: string | number
}

export const SECTION_TOTAL_ROW_CLASS = 'bg-slate-100'

export function formatPreviewRowUnit(row: PreviewRow, quoteType: QuoteType) {
  if (row.unitLabel) return row.unitLabel
  if (row.unit != null) return formatQuoteMoneyUnit(row.unit, quoteType)
  return '-'
}

function quotePerUnitTotal(total: number, qty: number) {
  return Math.round(total / (qty || 1))
}

export function previewFormFromQuote(quote: QuoteListItem): PreviewFormFields {
  const input = toEstimateInputFromDetail(quote)
  return {
    postAssembly: input.postAssembly ?? 0,
    postTest: input.postTest ?? 0,
    postPacking: input.postPacking ?? 0,
    materialCost: input.materialCost ?? 0,
  }
}

export function estimateSavedQuote(quote: QuoteListItem): EstimateResult {
  return calculateEstimate(toEstimateInputFromDetail(quote), {})
}

function previewSmtRows(result: EstimateResult, quoteType: QuoteType): PreviewRow[] {
  const rows: PreviewRow[] = [
    {
      label: `SMT 공정${result.common.pcbBoardDetails.length > 1 ? ` (${result.common.pcbBoardDetails.length} PCB)` : ''}`,
      amount: quotePerUnitTotal(result.values.smt, result.qty),
      emphasize: true,
      amountEmphasize: true,
      sectionTotal: 'smt',
    },
  ]

  for (const board of result.common.pcbBoardDetails) {
    rows.push({
      label: `■ ${board.pcbName}`,
      amount: board.laborUnit,
      indent: 1,
    })

    const useMinPlacementFee = board.laborMinApplied && board.laborMinAdjustment > 0
    const placementScore = board.chip + board.smtOdd

    if (useMinPlacementFee) {
      rows.push({
        label: '최소 실장비',
        subLabel: `(${placementScore}점 · ${SMT_PLACEMENT_MIN_SCORE}점 이하)`,
        unit: getSmtPlacementMinFee(quoteType),
        count: '1 PCB',
        amount: board.laborMinAdjustment,
        indent: 2,
      })
      if (board.aoiEnabled && board.aoiUnit > 0) {
        rows.push({
          label: `AOI 및 외관검사 (${board.smtSide === 'double' ? '양면' : '단면'})`,
          unit: board.smtSide === 'double' ? AOI_UNIT_PRICE_DOUBLE : AOI_UNIT_PRICE_SINGLE,
          count: '1 PCB',
          amount: board.aoiUnit,
          indent: 2,
        })
      }
    } else {
      if (board.chip > 0) {
        rows.push({ label: 'CHIP', unit: SMT_UNIT_CHIP, count: `${board.chip}개`, amount: board.chip * SMT_UNIT_CHIP, indent: 2 })
      }
      if (board.smtOdd > 0) {
        rows.push({ label: '이형', unit: SMT_UNIT_ODD, count: `${board.smtOdd}개`, amount: board.smtOdd * SMT_UNIT_ODD, indent: 2 })
      }
      if (board.smtSpecial > 0) {
        rows.push({
          label: '특수/모듈',
          unit: SMT_UNIT_SPECIAL,
          count: `${board.smtSpecial}개`,
          amount: board.smtSpecial * SMT_UNIT_SPECIAL,
          indent: 2,
        })
      }
      if (board.icPin > 0) {
        rows.push({
          label: 'IC PIN',
          unit: SMT_UNIT_IC_PIN,
          count: `${board.icPin} PIN`,
          amount: board.icPin * SMT_UNIT_IC_PIN,
          indent: 2,
        })
      }
      if (board.bga > 0) {
        rows.push({
          label: 'BGA BALL',
          unit: SMT_UNIT_BGA_BALL,
          count: `${board.bga} BALL`,
          amount: board.bga * SMT_UNIT_BGA_BALL,
          indent: 2,
        })
      }
      if (board.aoiEnabled && board.aoiUnit > 0) {
        rows.push({
          label: `AOI 및 외관검사 (${board.smtSide === 'double' ? '양면' : '단면'})`,
          unit: board.smtSide === 'double' ? AOI_UNIT_PRICE_DOUBLE : AOI_UNIT_PRICE_SINGLE,
          count: '1 PCB',
          amount: board.aoiUnit,
          indent: 2,
        })
      }
      if (board.pcbWashEnabled && board.pcbWashUnit > 0) {
        rows.push({
          label: 'PCB 세척',
          unit: PCB_WASH_UNIT_PRICE,
          count: '1 PCB',
          amount: board.pcbWashUnit,
          indent: 2,
        })
      }
    }

    if (board.setupAmount > 0) {
      const billedMinutes = board.setupMinutes
      const setupCount = `${billedMinutes}분`

      rows.push({
        label: 'SET-UP',
        unit: board.setupRate,
        count: setupCount,
        amount: Math.round(board.setupAmount / (result.qty || 1)),
        indent: 2,
      })
    }
  }

  return rows
}

function previewDipRows(result: EstimateResult): PreviewRow[] {
  const rows: PreviewRow[] = [
    {
      label: `납땜${result.common.dipBoardDetails.length > 1 ? ` (${result.common.dipBoardDetails.length} PCB)` : ''}`,
      amount: quotePerUnitTotal(result.values.dip, result.qty),
      emphasize: true,
      amountEmphasize: true,
      sectionTotal: 'dip',
    },
  ]

  for (const board of result.common.dipBoardDetails) {
    rows.push({ label: `■ ${board.pcbName}`, amount: board.boardUnit, indent: 1 })
    if (board.dipGeneral > 0) rows.push({ label: '수납땜 일반(1~3PIN)', unit: DIP_UNIT.dipGeneral, count: board.dipGeneral, amount: board.dipGeneral * DIP_UNIT.dipGeneral, indent: 2 })
    if (board.dipConnector > 0) rows.push({ label: '수납땜 중형(4~10PIN)', unit: DIP_UNIT.dipConnector, count: board.dipConnector, amount: board.dipConnector * DIP_UNIT.dipConnector, indent: 2 })
    if (board.dipWire > 0) rows.push({ label: '수납땜 대형(10PIN+)', unit: DIP_UNIT.dipWire, count: board.dipWire, amount: board.dipWire * DIP_UNIT.dipWire, indent: 2 })
    if (board.waveGeneral > 0) rows.push({ label: 'WAVE 일반(1~3PIN)', unit: DIP_UNIT.waveGeneral, count: board.waveGeneral, amount: board.waveGeneral * DIP_UNIT.waveGeneral, indent: 2 })
    if (board.waveConnector > 0) rows.push({ label: 'WAVE 중형(4~10PIN)', unit: DIP_UNIT.waveConnector, count: board.waveConnector, amount: board.waveConnector * DIP_UNIT.waveConnector, indent: 2 })
    if (board.waveWire > 0) rows.push({ label: 'WAVE 대형(10PIN+)', unit: DIP_UNIT.waveWire, count: board.waveWire, amount: board.waveWire * DIP_UNIT.waveWire, indent: 2 })
  }

  return rows
}

function previewPostRows(result: EstimateResult, form: PreviewFormFields): PreviewRow[] {
  const rows: PreviewRow[] = [
    { label: '후공정', amount: quotePerUnitTotal(result.values.postProcess, result.qty), emphasize: true, amountEmphasize: true, sectionTotal: 'post' },
  ]

  if (Number(form.postAssembly) > 0) rows.push({ label: '조립', unit: POST_RATE, count: `${form.postAssembly}분`, amount: Number(form.postAssembly) * POST_RATE, indent: 1 })
  if (Number(form.postTest) > 0) rows.push({ label: '테스트', unit: POST_RATE, count: `${form.postTest}분`, amount: Number(form.postTest) * POST_RATE, indent: 1 })
  if (Number(form.postPacking) > 0) rows.push({ label: '포장', unit: POST_RATE, count: `${form.postPacking}분`, amount: Number(form.postPacking) * POST_RATE, indent: 1 })

  return rows
}

function previewMaterialRows(result: EstimateResult, form: PreviewFormFields): PreviewRow[] {
  const materialPerUnit = Number(form.materialCost) || 0
  const subMaterialPerUnit = quotePerUnitTotal(result.common.subMaterial, result.qty)
  const hasRaw = materialPerUnit > 0
  const hasSub = result.common.subMaterial > 0
  if (!hasRaw && !hasSub) return []

  const rows: PreviewRow[] = [
    {
      label: '자재',
      amount: materialPerUnit + subMaterialPerUnit,
      emphasize: true,
      amountEmphasize: true,
      sectionTotal: 'material',
    },
  ]

  if (hasRaw) {
    rows.push({
      label: '원자재',
      unit: materialPerUnit,
      count: '1대',
      amount: materialPerUnit,
      indent: 1,
    })
  }
  if (hasSub) {
    rows.push({
      label: '부자재',
      unitLabel: '(생산비용의 10%)',
      amount: subMaterialPerUnit,
      indent: 1,
    })
  }

  return rows
}

export function buildPreviewRows(result: EstimateResult, form: PreviewFormFields, quoteType: QuoteType) {
  return [
    ...previewSmtRows(result, quoteType),
    ...previewDipRows(result),
    ...previewPostRows(result, form),
    ...previewMaterialRows(result, form),
  ]
}

export function buildQuotePreviewData(quote: QuoteListItem) {
  const estimate = estimateSavedQuote(quote)
  const form = previewFormFromQuote(quote)
  const rows = buildPreviewRows(estimate, form, quote.quoteType)
  return { estimate, rows, form }
}
