import { resolveQuoteDetailRates, withQuoteRates } from './constants'
import { resolveQuoteDisplayCurrency } from './format'
import { resolvePdfLanguage, type QuoteDocumentLanguage } from './preview-i18n'
import type { QuoteListItem } from './types'
import type { ProcessBillingCodes } from '@/lib/items/process-billing'
import { buildQuoteDetailedBreakdownPage } from './export-quote-pdf-breakdown'
import {
  buildQuotePdfDocumentTitle,
  pdfText,
  resolveQuoteProcessBillingCodes,
  setActivePdfCurrency,
  type ExportQuotePdfOptions,
} from './export-quote-pdf-shared'
import { buildQuotePdfCss } from './export-quote-pdf-styles'
import { buildQuoteSummaryPage } from './export-quote-pdf-summary'

export type { ExportQuotePdfOptions }

function buildQuotePages(
  quote: QuoteListItem,
  language?: QuoteDocumentLanguage,
  contactEmail?: string,
  processBillingCodes?: ProcessBillingCodes | null,
) {
  return (
    buildQuoteSummaryPage(quote, language, contactEmail, processBillingCodes) +
    buildQuoteDetailedBreakdownPage(quote, language)
  )
}

export function buildQuotesPdfHtml(quotes: QuoteListItem[], options?: ExportQuotePdfOptions) {
  const language = options?.language
  const contactEmail = options?.contactEmail
  const pages = quotes
    .map((quote) => {
      setActivePdfCurrency(resolveQuoteDisplayCurrency(quote.quoteType, options?.displayCurrency))
      try {
        return withQuoteRates(resolveQuoteDetailRates(quote.detailInfo), () =>
          buildQuotePages(
            quote,
            language,
            contactEmail,
            resolveQuoteProcessBillingCodes(quote, options),
          ),
        )
      } finally {
        setActivePdfCurrency('krw')
      }
    })
    .join('')
  const primaryQuoteType = quotes[0]?.quoteType ?? 'domestic'
  const docLang = resolvePdfLanguage(primaryQuoteType, language)
  const printHint = pdfText(
    docLang,
    '인쇄 설정에서 「머리글 및 바닥글」 체크를 해제한 뒤 「PDF로 저장」을 선택하세요.',
    'In the print dialog: turn off “Headers and footers”, then choose “Save as PDF”.',
    '请在打印设置中取消勾选「页眉和页脚」，然后选择「另存为PDF」。',
  )
  const printButton = pdfText(docLang, 'PDF로 저장', 'Save as PDF', '另存为PDF')
  const fontStack =
    docLang === 'zh'
      ? '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif'
      : '"Malgun Gothic", "Apple SD Gothic Neo", "Microsoft YaHei", sans-serif'

  return `<!DOCTYPE html>
<html lang="${docLang}">
<head>
  <meta charset="utf-8" />
  <!-- 브라우저 인쇄 머리글에 파일명이 찍히지 않도록 비움 (저장 파일명은 부모 document.title 사용) -->
  <title></title>
  <style>
    ${buildQuotePdfCss(fontStack)}
  </style>
</head>
<body>
  <div class="no-print">
    ${printHint}
    <button type="button" onclick="window.print()">${printButton}</button>
  </div>
  ${pages}
</body>
</html>`
}

export function exportQuotesToPdf(quotes: QuoteListItem[], options?: ExportQuotePdfOptions) {
  if (!quotes.length || typeof document === 'undefined') return false

  const pdfTitle = buildQuotePdfDocumentTitle(quotes)
  const html = buildQuotesPdfHtml(quotes, options)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', pdfTitle)
  iframe.style.position = 'fixed'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'

  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  const printWindow = iframe.contentWindow
  if (!doc || !printWindow) {
    iframe.remove()
    window.alert('인쇄 창을 열지 못했습니다. 다시 시도해 주세요.')
    return false
  }

  doc.open()
  doc.write(html)
  doc.close()
  // 인쇄 머리글에 견적번호·품명이 나오지 않도록 iframe 문서 제목은 비움
  try {
    doc.title = ''
  } catch {
    /* ignore */
  }

  // Chrome 등: iframe print 시 부모 document.title 이 「다른 이름으로 저장」기본명으로 쓰임
  const previousTitle = document.title
  document.title = pdfTitle

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    document.title = previousTitle
    window.removeEventListener('afterprint', cleanup)
    try {
      printWindow.removeEventListener('afterprint', cleanup)
    } catch {
      /* ignore */
    }
    iframe.remove()
  }

  window.addEventListener('afterprint', cleanup)
  try {
    printWindow.addEventListener('afterprint', cleanup)
  } catch {
    /* ignore */
  }
  // 대화상자가 열린 동안 제목 유지 (저장 후 afterprint 또는 타임아웃)
  window.setTimeout(cleanup, 120_000)

  printWindow.focus()
  printWindow.print()

  return true
}
