import {
  APP_SHORT_NAME,
  COMPANY_ADDRESS_STATEMENT,
  COMPANY_BIZ_NO,
  COMPANY_CEO_NAME,
  COMPANY_TEL,
} from '@/lib/app-config'
import { parseItemVersionCode, stripTrailingVersionFromName } from '@/lib/items/version-code'
import { normalizeOrderCurrency } from '@/lib/orders/utils'
import type { DeliveryStatementData, DeliveryStatementLine } from './types'

/** 고전 양식: 표 여백용 빈 행 */
const MIN_ITEM_ROW_COUNT = 8

const STATEMENT_SEAL_PATH = '/branding/company-seal.png'

type StatementCopyRole = 'supplier' | 'buyer'

function resolvePrintAssetSrc(path: string) {
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

function resolveStatementSealSrc() {
  return resolvePrintAssetSrc(STATEMENT_SEAL_PATH)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function formatNumber(value: number) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('ko-KR')
}

/** YYYY-MM-DD → { date, month, day } */
function parseYmd(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) {
    return { date: ymd.trim() || '—', month: '', day: '' }
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, month: m[2], day: m[3] }
}

function normalizeStatementLine(line: DeliveryStatementLine): DeliveryStatementLine {
  const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
  const unitPrice = Math.max(0, Math.round(Number(line.unitPrice) || 0))
  const supplyAmount =
    line.supplyAmount != null && Number.isFinite(Number(line.supplyAmount))
      ? Math.max(0, Math.round(Number(line.supplyAmount) || 0))
      : Math.round(qty * unitPrice)
  return {
    orderNumber: String(line.orderNumber || '').trim() || undefined,
    productCode: String(line.productCode || '').trim(),
    productName: String(line.productName || '').trim(),
    qty,
    unitPrice,
    supplyAmount,
    billingOnly: Boolean(line.billingOnly),
  }
}

function formatStatementProductLabel(item: DeliveryStatementLine) {
  const base = formatProductLabel(item.productName, item.productCode)
  if (!item.billingOnly) return base
  const trimmed = base.trim()
  if (!trimmed) return '(추가작업)'
  if (trimmed.includes('(추가작업)')) return trimmed
  return `${trimmed} (추가작업)`
}

function sumStatementTotals(items: DeliveryStatementLine[]) {
  let qty = 0
  let supply = 0
  for (const item of items) {
    if (!item.billingOnly) qty += item.qty
    supply += item.supplyAmount
  }
  return { qty, supply }
}

/** 품목명 + 버전 (코드에서 파싱, 이미 이름에 있으면 중복 안 붙임) */
function formatProductLabel(productName: string, productCode: string) {
  const { version } = parseItemVersionCode(productCode)
  const baseName = stripTrailingVersionFromName(productName, version)
  if (!version) return baseName || productName.trim()
  if (!baseName) return version
  return `${baseName} ${version}`
}

function buildItemRows(items: DeliveryStatementLine[]) {
  const rows: string[] = items.map((item, index) => {
    const code = escapeHtml(item.productCode || '')
    const name = escapeHtml(formatStatementProductLabel(item))
    // 세액은 현재 0 유지
    return `<tr>
      <td class="c-no">${index + 1}</td>
      <td class="c-code">${code}</td>
      <td class="c-name">${name}</td>
      <td class="c-num">${formatNumber(item.qty)}</td>
      <td class="c-num">${formatNumber(item.unitPrice)}</td>
      <td class="c-num">${formatNumber(item.supplyAmount)}</td>
      <td class="c-num">0</td>
    </tr>`
  })

  const padTo = Math.max(MIN_ITEM_ROW_COUNT, items.length)
  for (let i = items.length; i < padTo; i += 1) {
    rows.push(
      `<tr class="empty">
        <td class="c-no">&nbsp;</td>
        <td class="c-code">&nbsp;</td>
        <td class="c-name">&nbsp;</td>
        <td class="c-num">&nbsp;</td>
        <td class="c-num">&nbsp;</td>
        <td class="c-num">&nbsp;</td>
        <td class="c-num">&nbsp;</td>
      </tr>`,
    )
  }

  return rows.join('')
}

function partyCell(value: string) {
  const trimmed = value.trim()
  return trimmed ? escapeHtml(trimmed) : '&nbsp;'
}

function buildStatementCopyHtml(
  data: DeliveryStatementData,
  role: StatementCopyRole,
  sealSrc = STATEMENT_SEAL_PATH,
) {
  const { date } = parseYmd(data.shipDate)
  const customer = escapeHtml(data.customer.trim() || '—')
  const customerAddress = partyCell(String(data.customerAddress || ''))
  const customerPhone = partyCell(String(data.customerPhone || ''))
  const docNo = String(data.docNo || '').trim()
  const items = (data.items || []).map(normalizeStatementLine)
  const { qty, supply } = sumStatementTotals(items)
  const vat = 0
  const total = supply + vat
  const currency = normalizeOrderCurrency(data.currency)
  const moneyPrefix = currency === 'USD' ? '$' : '₩'
  const roleLabel = role === 'supplier' ? '공급자용' : '공급받는자용'
  const seal = escapeHtml(sealSrc)

  return `<section class="statement-copy">
  ${
    docNo
      ? `<div class="doc-no" aria-hidden="true">${escapeHtml(docNo)}</div>`
      : ''
  }
  <div class="top-row">
    <div class="title-box">
      <h1 class="doc-title">거 래 명 세 서</h1>
      <span class="doc-role">(${roleLabel})</span>
    </div>
  </div>

  <table class="parties">
    <colgroup>
      <col class="side" />
      <col class="lbl" />
      <col class="val" />
      <col class="lbl-sm" />
      <col class="val" />
      <col class="side" />
      <col class="lbl" />
      <col class="val" />
      <col class="lbl-sm" />
      <col class="val" />
    </colgroup>
    <tr class="date-row">
      <th class="party-label">거래일자</th>
      <td colspan="9" class="party-value date-in-box">${escapeHtml(date)}</td>
    </tr>
    <tr>
      <th rowspan="4" class="party-side">공<br/>급<br/>받<br/>는<br/>자</th>
      <th class="party-label">상호<br/>(법인명)</th>
      <td colspan="3" class="party-value buyer-name-cell">
        <span class="buyer-name">${customer}</span>
        <span class="buyer-honor">귀하</span>
      </td>
      <th rowspan="4" class="party-side">공<br/>급<br/>자</th>
      <th class="party-label">등록번호</th>
      <td colspan="3" class="party-value">${escapeHtml(COMPANY_BIZ_NO)}</td>
    </tr>
    <tr>
      <th class="party-label">사업장<br/>주소</th>
      <td colspan="3" class="party-value">${customerAddress}</td>
      <th class="party-label">상호<br/>(법인명)</th>
      <td class="party-value">${escapeHtml(APP_SHORT_NAME)}</td>
      <th class="party-label">성명</th>
      <td class="party-value supplier-ceo-cell">
        <span class="supplier-ceo-name">${escapeHtml(COMPANY_CEO_NAME)}</span>
        <img class="company-seal" src="${seal}" alt="" />
      </td>
    </tr>
    <tr>
      <th class="party-label">전화번호</th>
      <td class="party-value">${customerPhone}</td>
      <th class="party-label">팩스</th>
      <td class="party-value muted">&nbsp;</td>
      <th class="party-label">사업장<br/>주소</th>
      <td colspan="3" class="party-value">${escapeHtml(COMPANY_ADDRESS_STATEMENT)}</td>
    </tr>
    <tr class="amount-row">
      <th class="party-label">합계금액</th>
      <td colspan="3" class="party-value total-amount-cell">
        <span class="currency">${moneyPrefix}</span>
        <span class="total-amount">${formatNumber(total)}</span>
      </td>
      <th class="party-label">전화</th>
      <td class="party-value">${escapeHtml(COMPANY_TEL)}</td>
      <th class="party-label">팩스</th>
      <td class="party-value muted">&nbsp;</td>
    </tr>
  </table>

  <div class="items-grow">
    <table class="items">
      <colgroup>
        <col class="col-no" />
        <col class="col-code" />
        <col class="col-name" />
        <col class="col-num" />
        <col class="col-num" />
        <col class="col-num" />
        <col class="col-num" />
      </colgroup>
      <thead>
        <tr>
          <th class="c-no">No.</th>
          <th class="c-code">품목코드</th>
          <th class="c-name">품 목</th>
          <th class="c-num">수 량</th>
          <th class="c-num">단 가</th>
          <th class="c-num">공급가액</th>
          <th class="c-num">세 액</th>
        </tr>
      </thead>
      <tbody>
        ${buildItemRows(items)}
      </tbody>
      <tfoot>
        <tr class="summary-row">
          <th colspan="3">합계</th>
          <td class="c-num">${formatNumber(qty)}</td>
          <td class="c-num">&nbsp;</td>
          <td class="c-num">${formatNumber(supply)}</td>
          <td class="c-num">${formatNumber(vat)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</section>`
}

export function buildDeliveryStatementHtml(data: DeliveryStatementData, sealSrc = STATEMENT_SEAL_PATH) {
  return buildDeliveryStatementsHtml([data], sealSrc)
}

/** 여러 출하건 거래명세서를 한 문서(페이지 나눔)로 합침 */
export function buildDeliveryStatementsHtml(
  list: DeliveryStatementData[],
  sealSrc = STATEMENT_SEAL_PATH,
) {
  if (!list.length) return ''
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title></title><style>
@page { size: A4 portrait; margin: 0; }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 0;
  color: #111;
  background: #fff;
  font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  font-size: 10.5px;
  line-height: 1.35;
}
@media print {
  body { margin: 12mm 8mm; }
}
.sheet {
  display: flex;
  flex-direction: column;
  height: 273mm;
  gap: 0;
}
.statement-copy {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  padding: 2mm 2mm 1.5mm;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.doc-no {
  position: absolute;
  top: 1.5mm;
  right: 2mm;
  z-index: 1;
  max-width: 42%;
  color: #64748b;
  font-size: 8px;
  font-weight: 600;
  font-family: ui-monospace, "Malgun Gothic", monospace;
  letter-spacing: 0.02em;
  line-height: 1.2;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cut-line {
  flex: 0 0 auto;
  margin: 4mm 1mm;
  padding: 1.5mm 0;
  border-top: 1px dashed #64748b;
  border-bottom: 1px dashed #64748b;
  color: #64748b;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-align: center;
}

.top-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  margin-bottom: 8px;
  flex: 0 0 auto;
  padding-top: 1mm;
}
.title-box {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  padding: 1px 0;
}
.doc-title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.35em;
  text-indent: 0.35em;
  line-height: 1.35;
}
.doc-role {
  font-size: 11px;
  font-weight: 700;
  color: #333;
}

.parties {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  border: 1.5px solid #333;
  margin-bottom: 5px;
  flex: 0 0 auto;
}
.parties col.side { width: 16px; }
.parties col.lbl { width: 44px; }
.parties col.lbl-sm { width: 32px; }
.parties col.val { width: auto; }
.parties th,
.parties td {
  border: 1px solid #333;
  padding: 4px 6px;
  vertical-align: middle;
}
.parties .party-side {
  width: 16px;
  background: #f3f4f6;
  font-size: 9px;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  padding: 2px;
}
.parties .party-label {
  background: #f9fafb;
  font-size: 8.5px;
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
  padding: 2px;
}
.parties .party-value {
  font-size: 11px;
  font-weight: 600;
  text-align: left;
}
.parties .buyer-name-cell {
  text-align: left;
}
.parties .buyer-name { font-size: 14px; font-weight: 800; margin-right: 6px; }
.parties .buyer-honor { font-size: 11px; font-weight: 700; color: #374151; }
.parties .supplier-ceo-cell {
  position: relative;
  overflow: visible;
  padding-right: 46px;
}
.parties .supplier-ceo-name {
  display: inline-block;
  font-weight: 700;
}
.parties .company-seal {
  position: absolute;
  right: 4px;
  top: 50%;
  width: 42px;
  height: 42px;
  object-fit: contain;
  transform: translateY(-50%);
  pointer-events: none;
  mix-blend-mode: lighten;
}
.parties .total-amount-cell {
  white-space: nowrap;
}
.parties .currency { font-size: 14px; font-weight: 800; margin-right: 4px; }
.parties .won { font-size: 14px; font-weight: 800; margin-right: 4px; }
.parties .total-amount {
  font-size: 17px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.parties .amount-row th,
.parties .amount-row td {
  height: 32px;
}
.parties .muted { color: #9ca3af; }
.parties .date-row th,
.parties .date-row td {
  height: 26px;
}
.parties .date-in-box {
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.items-grow {
  flex: 0 1 auto;
  width: 100%;
  max-height: 100%;
  min-height: 0;
}
table.items {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  border: 1.5px solid #333;
}
table.items col.col-no { width: 6%; }
table.items col.col-code { width: 14%; }
table.items col.col-name { width: 36%; }
table.items col.col-num { width: 11%; }
table.items th,
table.items td {
  border: 1px solid #333;
  padding: 3.5px 5px;
  vertical-align: middle;
  overflow: hidden;
}
table.items thead th {
  background: #f3f4f6;
  font-size: 10px;
  font-weight: 800;
  text-align: center;
  height: 23px;
}
table.items tbody td {
  font-size: 11px;
  text-align: center;
}
table.items .c-name {
  text-align: left;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
table.items tbody tr.empty td {
  height: 23px;
  color: transparent;
}

table.items .c-no { font-variant-numeric: tabular-nums; }
table.items .c-num { font-variant-numeric: tabular-nums; }
table.items tfoot .summary-row th {
  background: #f3f4f6;
  font-size: 10px;
  font-weight: 800;
  text-align: center;
  white-space: nowrap;
  height: 25px;
}
table.items tfoot .summary-row td.c-num {
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
</style></head><body>
${list
  .map((entry, index) => {
    const pageBreak = index < list.length - 1 ? ' style="page-break-after: always"' : ''
    return `<div class="sheet"${pageBreak}>
${buildStatementCopyHtml(entry, 'supplier', sealSrc)}
<div class="cut-line">— 절취선 —</div>
${buildStatementCopyHtml(entry, 'buyer', sealSrc)}
</div>`
  })
  .join('\n')}
</body></html>`
}

function openStatementPrintWindow(html: string, title: string) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', title)
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
  document.body.appendChild(iframe)

  const frameWindow = iframe.contentWindow
  const frameDoc = iframe.contentDocument
  if (!frameWindow || !frameDoc) {
    iframe.remove()
    return false
  }

  frameDoc.open()
  frameDoc.write(html)
  frameDoc.close()

  const previousTitle = document.title
  document.title = title

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    document.title = previousTitle
    window.removeEventListener('afterprint', cleanup)
    try {
      frameWindow.removeEventListener('afterprint', cleanup)
    } catch {
      /* ignore */
    }
    iframe.remove()
  }

  window.addEventListener('afterprint', cleanup)
  try {
    frameWindow.addEventListener('afterprint', cleanup)
  } catch {
    /* ignore */
  }
  window.setTimeout(cleanup, 120_000)

  const triggerPrint = () => {
    const waitForImages = () => {
      const images = Array.from(frameDoc.images || [])
      if (!images.length) return Promise.resolve()
      return Promise.all(
        images.map(
          (image) =>
            new Promise<void>((resolve) => {
              if (image.complete) {
                resolve()
                return
              }
              image.addEventListener('load', () => resolve(), { once: true })
              image.addEventListener('error', () => resolve(), { once: true })
            }),
        ),
      )
    }

    void waitForImages().then(() => {
      try {
        frameDoc.title = ''
      } catch {
        /* ignore */
      }
      frameWindow.focus()
      frameWindow.print()
    })
  }

  if (frameDoc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 80)
  } else {
    iframe.addEventListener('load', () => window.setTimeout(triggerPrint, 80), { once: true })
  }

  return true
}

export function printDeliveryStatement(data: DeliveryStatementData) {
  return printDeliveryStatements([data])
}

/** 기간 내 출하 거래명세서를 한 번에 인쇄 */
export function printDeliveryStatements(list: DeliveryStatementData[]) {
  if (!list.length) return false
  const html = buildDeliveryStatementsHtml(list, resolveStatementSealSrc())
  if (!html) return false
  const fileTitle =
    list.length === 1
      ? `거래명세서_${list[0]!.orderNumber || list[0]!.docNo}`
      : `거래명세서_${list.length}건`
  return openStatementPrintWindow(html, fileTitle)
}
