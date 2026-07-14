import {
  APP_SHORT_NAME,
  COMPANY_ADDRESS_DOMESTIC,
  COMPANY_ADDRESS_EXPORT,
  COMPANY_NAME_EN,
  COMPANY_QUOTE_CONTACT_EXPORT,
  COMPANY_QUOTE_EMAIL_DOMESTIC,
  COMPANY_QUOTE_EMAIL_EXPORT,
} from '@/lib/app-config'
import { formatQuoteMoneyByDisplay, formatQuotePreviewSummary, formatQuoteValidityText } from '@/lib/quotes/format'
import { getPreviewLabels } from '@/lib/quotes/preview-i18n'
import {
  BOARD_SUBTOTAL_ROW_BG,
  breakdownBoardColLabel,
  buildProcessBreakdownSections,
  buildProcessCentricPdfBreakdownRows,
  computeBreakdownBoardRowSpans,
  formatPreviewRowDescription,
  formatPreviewRowUnit,
  isBreakdownBoardGroupStart,
  PDF_SECTION_COLORS,
  type BreakdownSectionPreview,
  type PreviewFormFields,
  type PreviewRow,
} from '@/lib/quotes/preview-rows'
import type { EstimateResult, QuoteDisplayCurrency, QuoteType } from '@/lib/quotes/types'

type QuoteBreakdownPreviewProps = {
  quoteType: QuoteType
  result: EstimateResult | null
  form: PreviewFormFields
  displayCurrency: QuoteDisplayCurrency
  customer: string
  productName: string
  issueDate: string
  loading?: boolean
  emptyMessage?: string
}

function breakdownPageTitle(quoteType: QuoteType) {
  return quoteType === 'domestic' ? '공정별 세부 산정내역' : 'Detailed Breakdown by Process'
}

function breakdownPageNote(quoteType: QuoteType) {
  return quoteType === 'domestic'
    ? 'SMT·납땜·후공정·자재 항목별 단가·수량 기준 산정식입니다.'
    : 'Itemized calculation for SMT, soldering, post-process, and materials.'
}

function formatAmount(
  krw: number,
  quoteType: QuoteType,
  displayCurrency: QuoteDisplayCurrency,
) {
  return formatQuoteMoneyByDisplay(krw, quoteType, displayCurrency)
}

function rowIndentClass(indent?: number) {
  if (indent === 1) return 'pl-6'
  if (indent === 2) return 'pl-10 text-xs'
  return ''
}

function BreakdownTableRow({
  row,
  quoteType,
  displayCurrency,
  showBoardColumn,
  boardRowSpan,
  boardGroupStart,
}: {
  row: PreviewRow
  quoteType: QuoteType
  displayCurrency: QuoteDisplayCurrency
  showBoardColumn: boolean
  boardRowSpan?: number
  boardGroupStart: boolean
}) {
  const isBoardSubtotal = Boolean(row.boardSubtotal)
  const sectionColors = row.sectionFooter ? PDF_SECTION_COLORS[row.sectionFooter] : null
  const bgColor = sectionColors?.bg ?? (isBoardSubtotal ? BOARD_SUBTOTAL_ROW_BG : undefined)
  const rowStyle = bgColor ? { backgroundColor: bgColor } : undefined
  const borderTopClass = boardGroupStart ? 'border-t-2 border-slate-400' : 'border-t border-slate-200'

  const unitText = isBoardSubtotal ? '' : formatPreviewRowUnit(row, quoteType, displayCurrency)
  const countText = isBoardSubtotal ? '' : row.count != null ? String(row.count) : '-'
  const amountText =
    isBoardSubtotal || row.amount == null ? (isBoardSubtotal ? '' : '-') : formatAmount(row.amount, quoteType, displayCurrency)

  const labelClass = row.emphasize || row.sectionFooter ? 'font-bold text-slate-900' : 'text-slate-700'
  const amountClass = row.amountEmphasize || row.sectionFooter ? 'font-bold text-slate-900' : 'text-xs text-slate-600'

  return (
    <tr className={borderTopClass} style={rowStyle}>
      {showBoardColumn && boardRowSpan !== 0 ? (
        <td
          rowSpan={boardRowSpan && boardRowSpan > 1 ? boardRowSpan : undefined}
          className="border-r-2 border-slate-300 px-2 py-1.5 align-middle text-xs font-semibold text-slate-800 lg:px-3 lg:py-2"
          style={row.boardName || isBoardSubtotal ? { backgroundColor: BOARD_SUBTOTAL_ROW_BG } : rowStyle}
        >
          {row.boardName ?? ''}
        </td>
      ) : null}
      <td className={`px-2 py-1.5 lg:px-3 lg:py-2 ${rowIndentClass(row.indent)} ${labelClass}`}>
        <span className="block">{row.label}</span>
        {formatPreviewRowDescription(row) ? (
          <span className="mt-0.5 block text-[11px] text-slate-500">{formatPreviewRowDescription(row)}</span>
        ) : null}
      </td>
      <td className="px-2 py-1.5 text-right text-xs text-slate-600 lg:px-3 lg:py-2">{unitText}</td>
      <td className="whitespace-nowrap px-2 py-1.5 text-center text-xs tabular-nums text-slate-600 lg:px-3 lg:py-2">
        {countText}
      </td>
      <td className={`px-2 py-1.5 text-right lg:px-3 lg:py-2 ${amountClass}`}>{amountText}</td>
    </tr>
  )
}

function BreakdownSectionTable({
  section,
  quoteType,
  displayCurrency,
}: {
  section: BreakdownSectionPreview
  quoteType: QuoteType
  displayCurrency: QuoteDisplayCurrency
}) {
  const labels = getPreviewLabels(quoteType)
  const showBoardColumn = section.rows.some((row) => row.boardName)
  const boardSpans = showBoardColumn ? computeBreakdownBoardRowSpans(section.rows) : []

  return (
    <div className={`breakdown-section-${section.key}`}>
      <h4 className="mb-2 text-xs font-bold tracking-[0.08em] text-slate-600">{section.title}</h4>
      <div className="overflow-x-auto rounded border-2 border-slate-400">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-100">
            <tr>
              {showBoardColumn ? (
                <th className="border border-slate-400 px-2 py-1.5 text-center text-xs font-bold text-slate-600 lg:px-3 lg:py-2">
                  {breakdownBoardColLabel(quoteType)}
                </th>
              ) : null}
              <th className="border border-slate-400 px-2 py-1.5 text-left text-xs font-bold text-slate-600 lg:px-3 lg:py-2">
                {labels.colItem}
              </th>
              <th className="border border-slate-400 px-2 py-1.5 text-right text-xs font-bold text-slate-600 lg:px-3 lg:py-2">
                {labels.colUnit}
              </th>
              <th className="border border-slate-400 px-2 py-1.5 text-center text-xs font-bold text-slate-600 lg:px-3 lg:py-2">
                {labels.colQty}
              </th>
              <th className="border border-slate-400 px-2 py-1.5 text-right text-xs font-bold text-slate-600 lg:px-3 lg:py-2">
                {labels.colPerUnitTotal}
              </th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, index) => (
              <BreakdownTableRow
                key={`${section.key}-${row.label}-${index}`}
                row={row}
                quoteType={quoteType}
                displayCurrency={displayCurrency}
                showBoardColumn={showBoardColumn}
                boardRowSpan={showBoardColumn ? boardSpans[index] : undefined}
                boardGroupStart={showBoardColumn && isBreakdownBoardGroupStart(section.rows, index)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function QuoteBreakdownPreview({
  quoteType,
  result,
  form,
  displayCurrency,
  customer,
  productName,
  issueDate,
  loading = false,
  emptyMessage,
}: QuoteBreakdownPreviewProps) {
  const isDomestic = quoteType === 'domestic'
  const previewLabels = getPreviewLabels(quoteType)
  const companyName = isDomestic ? APP_SHORT_NAME : COMPANY_NAME_EN
  const recipientLabel = isDomestic ? '수신' : 'Bill To'
  const supplierLabel = isDomestic ? '공급' : 'From'
  const breakdownRows = result ? buildProcessCentricPdfBreakdownRows(result, form, quoteType) : []
  const sections = result ? buildProcessBreakdownSections(breakdownRows, quoteType) : []
  const previewSummary = result
    ? formatQuotePreviewSummary(result.values.grandTotal, result.qty || 1, quoteType, displayCurrency)
    : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="flex items-end justify-between gap-4 bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-5 text-white lg:px-6">
        <div>
          <p className="text-lg font-extrabold tracking-tight lg:text-xl">{companyName}</p>
          <p className="mt-0.5 text-[11px] tracking-wide text-slate-400">
            {isDomestic ? 'SMT 전자조립 · EMS' : 'SMT Assembly · EMS'}
          </p>
        </div>
        <div className="text-right">
          <h3 className="text-xl font-light tracking-[0.2em] lg:text-2xl lg:tracking-[0.28em]">{previewLabels.title}</h3>
          <p className="mt-1 text-xs font-semibold tracking-wide text-blue-300 lg:text-sm">{result?.estNo || '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 border-b border-slate-200 sm:grid-cols-2">
        <div className="border-b border-slate-200 p-4 sm:border-b-0 sm:border-r lg:p-5">
          <p className="mb-3 text-[11px] font-bold tracking-[0.2em] text-slate-500">{recipientLabel}</p>
          <dl className="space-y-2 text-sm">
            <div className="grid grid-cols-[72px_1fr] gap-2">
              <dt className="text-slate-500">{previewLabels.customer}</dt>
              <dd className="font-semibold text-slate-900">{customer}</dd>
            </div>
            <div className="grid grid-cols-[72px_1fr] gap-2">
              <dt className="text-slate-500">{previewLabels.product}</dt>
              <dd className="font-semibold text-slate-900">{productName}</dd>
            </div>
            <div className="grid grid-cols-[72px_1fr] gap-2">
              <dt className="text-slate-500">{previewLabels.quantity}</dt>
              <dd className="font-semibold text-slate-900">
                {result ? previewLabels.formatQty(result.qty) : '-'}
              </dd>
            </div>
          </dl>
        </div>
        <div className="bg-slate-50 p-4 lg:p-5">
          <p className="mb-3 text-[11px] font-bold tracking-[0.2em] text-slate-500">{supplierLabel}</p>
          <dl className="space-y-2 text-sm">
            <div className="grid grid-cols-[72px_1fr] gap-2">
              <dt className="text-slate-500">{isDomestic ? '업체명' : 'Company'}</dt>
              <dd className="font-semibold text-slate-900">{companyName}</dd>
            </div>
            <div className="grid grid-cols-[72px_1fr] gap-2">
              <dt className="text-slate-500">{isDomestic ? '주소' : 'Address'}</dt>
              <dd className="font-semibold leading-snug text-slate-900">
                {isDomestic ? COMPANY_ADDRESS_DOMESTIC : COMPANY_ADDRESS_EXPORT}
              </dd>
            </div>
            <div className="grid grid-cols-[72px_1fr] gap-2">
              <dt className="text-slate-500">E-mail</dt>
              <dd className="font-semibold text-blue-700">
                {isDomestic ? COMPANY_QUOTE_EMAIL_DOMESTIC : COMPANY_QUOTE_EMAIL_EXPORT}
              </dd>
            </div>
            <div className="grid grid-cols-[72px_1fr] gap-2">
              <dt className="text-slate-500">{previewLabels.contact}</dt>
              <dd className="font-semibold text-slate-900">
                {isDomestic ? '영업관리팀' : COMPANY_QUOTE_CONTACT_EXPORT}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="flex justify-between gap-4 border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-xs text-slate-600 lg:px-6 lg:text-sm">
        <span>
          <b className="text-slate-700">{previewLabels.issueDate}</b> {issueDate || '-'}
        </span>
        <span>
          <b className="text-slate-700">{previewLabels.validity}</b>{' '}
          {issueDate ? formatQuoteValidityText(issueDate) : '-'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 lg:p-4">
        {!result ? (
          <p className="py-16 text-center text-sm text-slate-400">
            {loading ? previewLabels.loadingPreview : emptyMessage ?? previewLabels.emptyPreview}
          </p>
        ) : sections.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">{previewLabels.emptyPreview}</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h4 className="text-xs font-bold tracking-[0.12em] text-slate-500">{breakdownPageTitle(quoteType)}</h4>
              <p className="mt-1 text-[11px] text-slate-500">{breakdownPageNote(quoteType)}</p>
            </div>
            {sections.map((section) => (
              <BreakdownSectionTable
                key={section.key}
                section={section}
                quoteType={quoteType}
                displayCurrency={displayCurrency}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5 border-t border-slate-200 bg-white px-4 py-3 text-sm lg:px-6">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700">{previewLabels.perUnitPriceVat}</span>
          <span className="font-semibold text-slate-900">
            {previewSummary ? previewSummary.unitFormatted : formatAmount(0, quoteType, displayCurrency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-base">
          <span className="font-bold text-slate-900">{previewLabels.grandTotalVat}</span>
          <span className="font-bold text-blue-700">
            {previewSummary ? previewSummary.totalFormatted : formatAmount(0, quoteType, displayCurrency)}
          </span>
        </div>
      </div>
    </div>
  )
}
