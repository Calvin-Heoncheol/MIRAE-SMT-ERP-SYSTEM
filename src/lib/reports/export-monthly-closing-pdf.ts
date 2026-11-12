import {
  APP_SHORT_NAME,
  COMPANY_ADDRESS_DOMESTIC_EN,
  COMPANY_ADDRESS_STATEMENT,
  COMPANY_BANK_ACCOUNT,
  COMPANY_BANK_SWIFT,
  COMPANY_BIZ_NO,
  COMPANY_CEO_NAME,
  COMPANY_NAME_DOMESTIC_EN,
  COMPANY_PAYMENT_TERMS_EN,
  COMPANY_PAYMENT_TERMS_KO,
  COMPANY_TEL,
} from '@/lib/app-config'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { summarizeMonthlyClosingRows, type MonthlyClosingRow } from '@/lib/reports/monthly-closing'
import { escapeHtml } from '@/lib/print/escape-html'
import { printHtmlDocument } from '@/lib/print/print-html'

export type MonthlyClosingCustomerInfo = {
  businessRegNo?: string
  representativeName?: string
  address?: string
  phone?: string
}

export type MonthlyClosingPdfLanguage = 'ko' | 'en'

export type ExportMonthlyClosingPdfInput = {
  rows: MonthlyClosingRow[]
  customer?: string
  customerInfo?: MonthlyClosingCustomerInfo
  startDate?: string
  endDate?: string
  language?: MonthlyClosingPdfLanguage
}

const MONTHLY_CLOSING_LABELS = {
  ko: {
    htmlLang: 'ko',
    allPeriod: '전체',
    heading: '월 마감',
    titleFallback: '월마감',
    companyMeta: `사업자번호 ${COMPANY_BIZ_NO} · 대표 ${COMPANY_CEO_NAME} · TEL ${COMPANY_TEL}`,
    companyAddress: COMPANY_ADDRESS_STATEMENT,
    docTitle: '청구서',
    docSubtitle: 'INVOICE',
    invoiceNo: '청구번호',
    issueDate: '발행일',
    period: '청구기간',
    billTo: 'BILL TO · 청구처',
    businessRegNo: '사업자번호',
    representative: '대표',
    address: '주소',
    phone: '연락처',
    amountDue: '청구 금액 · AMOUNT DUE',
    vatExcluded: 'VAT 별도',
    vatIncluded: 'VAT 포함',
    vatPartial: '일부 VAT 포함',
    count: (n: string) => `${n}건`,
    shipDate: '출하일자',
    orderNumber: '발주번호',
    productCode: '품목코드',
    productName: '품목명',
    quantity: '수량',
    unitPrice: '단가',
    amount: '금액',
    bankAccount: '입금계좌',
    bankValue: `기업은행 ${COMPANY_BANK_ACCOUNT}`,
    paymentTerms: '결제조건',
    paymentTermsValue: COMPANY_PAYMENT_TERMS_KO,
    thanks: '상기 금액을 청구합니다. 감사합니다.',
    total: '합계 금액',
    totalPartialVat: ' (일부 VAT INC.)',
  },
  en: {
    htmlLang: 'en',
    allPeriod: 'All',
    heading: 'Monthly Closing',
    titleFallback: 'Monthly Closing',
    companyMeta: `Business Reg. No. ${COMPANY_BIZ_NO} · TEL ${COMPANY_TEL}`,
    companyAddress: COMPANY_ADDRESS_DOMESTIC_EN,
    docTitle: 'INVOICE',
    docSubtitle: '',
    invoiceNo: 'Invoice No.',
    issueDate: 'Issue Date',
    period: 'Billing Period',
    billTo: 'BILL TO',
    businessRegNo: 'Reg. No.',
    representative: 'Rep.',
    address: 'Address',
    phone: 'Phone',
    amountDue: 'AMOUNT DUE',
    vatExcluded: 'VAT excluded',
    vatIncluded: 'VAT included',
    vatPartial: 'VAT partially included',
    count: (n: string) => `${n} items`,
    shipDate: 'Ship Date',
    orderNumber: 'PO No.',
    productCode: 'Item Code',
    productName: 'Description',
    quantity: 'Qty',
    unitPrice: 'Unit Price',
    amount: 'Amount',
    bankAccount: 'Bank',
    bankValue: `Industrial Bank of Korea (SWIFT ${COMPANY_BANK_SWIFT}) ${COMPANY_BANK_ACCOUNT}`,
    paymentTerms: 'Terms',
    paymentTermsValue: COMPANY_PAYMENT_TERMS_EN,
    thanks: 'Thank you for your business.',
    total: 'Total',
    totalPartialVat: ' (PARTIAL VAT INC.)',
  },
} as const

function resolveLabels(language?: MonthlyClosingPdfLanguage) {
  return MONTHLY_CLOSING_LABELS[language === 'en' ? 'en' : 'ko']
}

function sanitizePdfFilenamePart(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function formatCount(value: number) {
  return value.toLocaleString('ko-KR')
}

function formatPeriodLabel(startDate?: string, endDate?: string, allLabel = '전체') {
  const start = String(startDate || '').trim()
  const end = String(endDate || '').trim()
  if (start && end) {
    if (start === end) return start
    return `${start} ~ ${end}`
  }
  if (start) return `${start} ~`
  if (end) return `~ ${end}`
  return allLabel
}

function buildMonthlyClosingHeading(customer: string | undefined, headingLabel: string) {
  const name = String(customer || '').trim()
  return name ? `${name} ${headingLabel}` : headingLabel
}

export function buildMonthlyClosingPdfTitle(input: ExportMonthlyClosingPdfInput) {
  const t = resolveLabels(input.language)
  const heading = sanitizePdfFilenamePart(buildMonthlyClosingHeading(input.customer, t.heading))
  const period = sanitizePdfFilenamePart(formatPeriodLabel(input.startDate, input.endDate, t.allPeriod))
  if (heading && period) return `${heading}_${period}`
  return heading || period || t.titleFallback
}

function buildInvoiceNo(input: ExportMonthlyClosingPdfInput, issueDate: string) {
  const base = String(input.endDate || input.startDate || issueDate).replace(/-/g, '').slice(0, 6)
  return `INV-${base}`
}

function partyLine(label: string, value?: string) {
  const text = String(value || '').trim()
  if (!text) return ''
  return `<div class="party-line"><span>${label}</span>${escapeHtml(text)}</div>`
}

function buildMonthlyClosingPdfHtml(input: ExportMonthlyClosingPdfInput) {
  const t = resolveLabels(input.language)
  const isEn = input.language === 'en'
  const issueDate = todayYmdSeoul()
  const periodLabel = formatPeriodLabel(input.startDate, input.endDate, t.allPeriod)
  const customer = String(input.customer || '').trim()
  const info = input.customerInfo ?? {}
  const summary = summarizeMonthlyClosingRows(input.rows)
  const vatRowCount = input.rows.filter((row) => row.vatIncluded).length
  const allVatIncluded = vatRowCount === input.rows.length
  const noVat = vatRowCount === 0
  const totalVatSuffix = noVat ? '' : allVatIncluded ? ' (VAT INC.)' : t.totalPartialVat
  const totalNote = noVat ? t.vatExcluded : allVatIncluded ? t.vatIncluded : t.vatPartial

  const bodyRows = input.rows
    .map((row, index) => {
      const vatTag = !allVatIncluded && row.vatIncluded ? '<span class="vat-tag">VAT INC.</span>' : ''
      return `<tr>
        <td class="c-no">${index + 1}</td>
        <td class="c-fixed">${escapeHtml(row.recordDate || '—')}</td>
        <td class="c-fixed">${escapeHtml(row.orderNumber || '—')}</td>
        <td class="c-fixed">${escapeHtml(row.productCode || '—')}</td>
        <td class="c-name">${escapeHtml(row.productName || '—')}</td>
        <td class="c-num">${formatCount(row.quantity)}</td>
        <td class="c-num">${formatCount(row.unitPrice)}</td>
        <td class="c-num">${formatCount(row.amount)}${vatTag}</td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page { size: A4 landscape; margin: 12mm 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      font-size: 10.5px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding-bottom: 12px;
      border-bottom: 3px solid #0f172a;
    }
    .brand-name { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
    .brand-en { font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.12em; }
    .brand-meta { margin-top: 6px; color: #475569; font-size: 10px; }
    .doc-title { text-align: right; }
    .doc-title h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 0.3em; }
    .doc-title p { margin: 0; font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 0.35em; }
    .meta { margin-top: 8px; margin-left: auto; border-collapse: collapse; }
    .meta th, .meta td { padding: 2px 0 2px 12px; font-size: 10.5px; white-space: nowrap; text-align: right; }
    .meta th { color: #64748b; font-weight: 600; }
    .meta td { font-weight: 700; }
    .parties { display: flex; gap: 16px; margin-top: 14px; }
    .party { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; }
    .party-label { font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.1em; }
    .party-name { margin: 2px 0 4px; font-size: 15px; font-weight: 800; }
    .party-line { color: #334155; font-size: 10px; }
    .party-line span { display: inline-block; min-width: 64px; color: #64748b; }
    .amount-box {
      flex: 0 0 260px;
      border-radius: 6px;
      padding: 10px 14px;
      background: #0f172a;
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .amount-box .label { font-size: 10px; font-weight: 700; color: #cbd5e1; letter-spacing: 0.1em; }
    .amount-box .value { font-size: 22px; font-weight: 800; white-space: nowrap; }
    .amount-box .note { font-size: 10px; color: #cbd5e1; }
    table.items { width: 100%; margin-top: 14px; border-collapse: collapse; }
    table.items thead { display: table-header-group; }
    table.items th {
      background: #f1f5f9;
      border-top: 2px solid #0f172a;
      border-bottom: 1px solid #0f172a;
      padding: 6px 6px;
      font-size: 10px;
      font-weight: 700;
      text-align: left;
      white-space: nowrap;
    }
    table.items td { border-bottom: 1px solid #e2e8f0; padding: 5px 6px; vertical-align: top; }
    table.items tr { break-inside: avoid; page-break-inside: avoid; }
    table.items tbody tr:nth-child(even) td { background: #f8fafc; }
    .c-no { width: 1%; text-align: center; color: #64748b; white-space: nowrap; }
    .c-fixed { width: 1%; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .c-name { word-break: break-word; }
    .c-num { width: 1%; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    th.c-num { text-align: right; }
    th.c-no { text-align: center; }
    .vat-tag { display: block; font-size: 8.5px; font-weight: 700; color: #0369a1; }
    .bottom { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-top: 14px; break-inside: avoid; page-break-inside: avoid; }
    .pay { font-size: 10px; color: #334155; }
    .pay div { margin-bottom: 2px; }
    .pay span { display: inline-block; min-width: 64px; color: #64748b; }
    .pay .thanks { margin-top: 10px; font-weight: 700; color: #0f172a; }
    table.summary { border-collapse: collapse; min-width: 300px; }
    table.summary th, table.summary td { padding: 5px 10px; white-space: nowrap; border-bottom: 1px solid #e2e8f0; }
    table.summary th { text-align: left; color: #475569; font-weight: 600; }
    table.summary td { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    table.summary tr.grand th, table.summary tr.grand td {
      border-top: 2px solid #0f172a;
      border-bottom: none;
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <div class="brand-name">${escapeHtml(isEn ? COMPANY_NAME_DOMESTIC_EN : APP_SHORT_NAME)}</div>
      ${isEn ? '' : `<div class="brand-en">${escapeHtml(COMPANY_NAME_DOMESTIC_EN)}</div>`}
      <div class="brand-meta">
        ${escapeHtml(t.companyMeta)}<br>
        ${escapeHtml(t.companyAddress)}
      </div>
    </div>
    <div class="doc-title">
      <h1>${escapeHtml(t.docTitle)}</h1>
      ${t.docSubtitle ? `<p>${escapeHtml(t.docSubtitle)}</p>` : ''}
      <table class="meta">
        <tr><th>${t.invoiceNo}</th><td>${escapeHtml(buildInvoiceNo(input, issueDate))}</td></tr>
        <tr><th>${t.issueDate}</th><td>${escapeHtml(issueDate)}</td></tr>
        <tr><th>${t.period}</th><td>${escapeHtml(periodLabel)}</td></tr>
      </table>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">${t.billTo}</div>
      <div class="party-name">${customer ? escapeHtml(customer) : '&nbsp;'}</div>
      ${partyLine(t.businessRegNo, info.businessRegNo)}
      ${partyLine(t.representative, info.representativeName)}
      ${partyLine(t.address, info.address)}
      ${partyLine(t.phone, info.phone)}
    </div>
    <div class="amount-box">
      <div class="label">${t.amountDue}</div>
      <div class="value">₩ ${formatCount(summary.amount)}</div>
      <div class="note">${totalNote} · ${t.count(formatCount(input.rows.length))}</div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="c-no">No.</th>
        <th class="c-fixed">${t.shipDate}</th>
        <th class="c-fixed">${t.orderNumber}</th>
        <th class="c-fixed">${t.productCode}</th>
        <th class="c-name">${t.productName}</th>
        <th class="c-num">${t.quantity}</th>
        <th class="c-num">${t.unitPrice}</th>
        <th class="c-num">${t.amount}</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <div class="bottom">
    <div class="pay">
      <div><span>${t.bankAccount}</span>${escapeHtml(t.bankValue)}</div>
      <div><span>${t.paymentTerms}</span>${escapeHtml(t.paymentTermsValue)}</div>
      <div class="thanks">${t.thanks}</div>
    </div>
    <table class="summary">
      <tr class="grand"><th>${t.total}${totalVatSuffix}</th><td>₩ ${formatCount(summary.amount)}</td></tr>
    </table>
  </div>
</body>
</html>`
}

export function exportMonthlyClosingPdf(input: ExportMonthlyClosingPdfInput) {
  if (!input.rows.length) return false
  return printHtmlDocument(buildMonthlyClosingPdfHtml(input), buildMonthlyClosingPdfTitle(input))
}
