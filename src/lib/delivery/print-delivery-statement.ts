import {
  APP_SHORT_NAME,
  COMPANY_ADDRESS_STATEMENT,
  COMPANY_BIZ_NO,
  COMPANY_CEO_NAME,
  COMPANY_TEL,
} from '@/lib/app-config'
import { parseItemVersionCode, stripTrailingVersionFromName } from '@/lib/items/version-code'
import { fetchOrderById } from '@/lib/orders/repository'
import type { OrderCurrency } from '@/lib/orders/types'
import { isBillingOnlyOrderItem, normalizeOrderCurrency } from '@/lib/orders/utils'
import {
  billingLineMatchesProductRow,
  buildDeliveryBillingOnlyLines,
  interleaveStatementShippedLinesWithBilling,
  isGenericBillingProductCode,
  resolveBillingQuantityFromShipped,
  resolveStatementDisplayProductCode,
} from '@/lib/delivery/utils'
import { findActiveBusinessPartnerByName } from '@/lib/partners/repository'
import type { DeliveryStatementData, DeliveryStatementLine } from './types'

/** 고전 양식: 표 여백용 빈 행 */
const MIN_ITEM_ROW_COUNT = 8

type StatementCopyRole = 'supplier' | 'buyer'

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

/** 금액을 한글 표기 (예: 3650000 → 삼백육십오만원 정) */
export function formatAmountInKorean(amount: number): string {
  const n = Math.max(0, Math.round(Number(amount) || 0))
  if (n === 0) return '영원 정'

  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const small = ['', '십', '백', '천']
  const big = ['', '만', '억', '조']

  const chunkToKorean = (chunk: number) => {
    if (chunk <= 0) return ''
    let result = ''
    const str = String(chunk).padStart(4, '0')
    for (let i = 0; i < 4; i += 1) {
      const d = Number(str[i])
      if (d === 0) continue
      const unit = small[3 - i]
      if (d === 1 && unit) result += unit
      else result += `${digits[d]}${unit}`
    }
    return result
  }

  const parts: string[] = []
  let rest = n
  let bigIndex = 0
  while (rest > 0 && bigIndex < big.length) {
    const chunk = rest % 10000
    if (chunk > 0) {
      parts.unshift(`${chunkToKorean(chunk)}${big[bigIndex]}`)
    }
    rest = Math.floor(rest / 10000)
    bigIndex += 1
  }

  return `${parts.join('')}원 정`
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
  }
}

function sumStatementTotals(items: DeliveryStatementLine[]) {
  let qty = 0
  let supply = 0
  for (const item of items) {
    qty += item.qty
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
    const name = escapeHtml(formatProductLabel(item.productName, item.productCode))
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

async function resolveCustomerContact(customerName: string) {
  const partner = await findActiveBusinessPartnerByName(customerName)
  return {
    address: String(partner?.address || '').trim(),
    phone: String(partner?.phone || '').trim(),
  }
}

function buildStatementCopyHtml(data: DeliveryStatementData, role: StatementCopyRole) {
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
      <td class="party-value">${escapeHtml(COMPANY_CEO_NAME)}</td>
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

export function buildDeliveryStatementHtml(data: DeliveryStatementData) {
  return buildDeliveryStatementsHtml([data])
}

/** 여러 출하건 거래명세서를 한 문서(페이지 나눔)로 합침 */
export function buildDeliveryStatementsHtml(list: DeliveryStatementData[]) {
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
${buildStatementCopyHtml(entry, 'supplier')}
<div class="cut-line">— 절취선 —</div>
${buildStatementCopyHtml(entry, 'buyer')}
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
    try {
      frameDoc.title = ''
    } catch {
      /* ignore */
    }
    frameWindow.focus()
    frameWindow.print()
  }

  if (frameDoc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 50)
  } else {
    iframe.addEventListener('load', () => window.setTimeout(triggerPrint, 50), { once: true })
  }

  return true
}

export function printDeliveryStatement(data: DeliveryStatementData) {
  return printDeliveryStatements([data])
}

/** 기간 내 출하 거래명세서를 한 번에 인쇄 */
export function printDeliveryStatements(list: DeliveryStatementData[]) {
  if (!list.length) return false
  const html = buildDeliveryStatementsHtml(list)
  if (!html) return false
  const fileTitle =
    list.length === 1
      ? `거래명세서_${list[0]!.orderNumber || list[0]!.docNo}`
      : `거래명세서_${list.length}건`
  return openStatementPrintWindow(html, fileTitle)
}

function isCollapsedProductLabel(name: string) {
  return /외\s*\d+\s*건/.test(String(name || '').trim())
}

function statementLinesFromOrderItems(
  order: NonNullable<Awaited<ReturnType<typeof fetchOrderById>>>,
  fallbackOrderNumber = '',
): DeliveryStatementLine[] {
  return order.items
    .filter((item) => !item.derivedFromLineId)
    .map((item) => {
      const qty = Math.max(0, Math.floor(Number(item.quantity) || 0))
      const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0))
      const supplyAmount =
        Math.max(0, Math.round(Number(item.orderAmount) || 0)) || Math.round(qty * unitPrice)
      return {
        orderNumber: order.orderNumber || fallbackOrderNumber,
        productCode: String(item.productCode || '').trim(),
        productName: String(item.productName || '').trim(),
        qty,
        unitPrice,
        supplyAmount,
      }
    })
    .filter((item) => item.qty > 0 || item.supplyAmount > 0)
}

type ShippedLineForBilling = {
  productCode: string
  productName: string
  qty: number
  productId?: string
}

type StatementShippedLineInput = {
  orderNumber: string
  productCode: string
  productName: string
  qty: number
  unitPrice?: number | null
  billingOnly?: boolean
  orderLineId?: string
}

type OrderRecord = NonNullable<Awaited<ReturnType<typeof fetchOrderById>>>

function isLastShippedLineForOrder<T extends { orderNumber: string }>(
  line: T,
  index: number,
  allLines: T[],
) {
  for (let i = index + 1; i < allLines.length; i += 1) {
    if (allLines[i]!.orderNumber === line.orderNumber) return false
  }
  return true
}

/** 출하 제품 행 바로 아래에 붙일 추가작업 명세 행 */
function billingStatementLinesForShippedProduct(input: {
  order: OrderRecord
  orderNumber: string
  shippedLine: ShippedLineForBilling
  shippedLinesForOrder: ShippedLineForBilling[]
  isLastShippedLineForOrder: boolean
  usedBillingLineIds: Set<string>
}): DeliveryStatementLine[] {
  const lines: DeliveryStatementLine[] = []
  const productRow = {
    orderNumber: input.orderNumber,
    productCode: input.shippedLine.productCode,
    productName: input.shippedLine.productName,
  }

  for (const item of input.order.items) {
    if (item.derivedFromLineId || !isBillingOnlyOrderItem(item)) continue
    const lineId = String(item.lineId || '').trim()
    if (!lineId || input.usedBillingLineIds.has(lineId)) continue

    const productCode = String(item.productCode || '').trim() || 'TEMP'
    const productName = String(item.productName || '').trim()
    if (!productName) continue

    if (
      !billingLineMatchesProductRow(
        { orderNumber: input.orderNumber, productCode, productName },
        productRow,
        { isLastProductRowForOrder: input.isLastShippedLineForOrder },
      )
    ) {
      continue
    }

    const qty = resolveBillingQuantityFromShipped({
      billingProductCode: productCode,
      billingProductName: productName,
      shippedLines: input.shippedLinesForOrder.map((line) => ({
        productCode: line.productCode,
        productName: line.productName,
        productId: line.productId,
        quantity: line.qty,
      })),
    })
    const resolvedQty =
      qty > 0
        ? qty
        : isGenericBillingProductCode(productCode)
          ? input.shippedLinesForOrder.reduce((sum, line) => sum + line.qty, 0)
          : input.shippedLine.qty
    if (resolvedQty <= 0) continue

    input.usedBillingLineIds.add(lineId)
    const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0))
    lines.push({
      orderNumber: input.order.orderNumber || input.orderNumber,
      productCode,
      productName,
      qty: resolvedQty,
      unitPrice,
      supplyAmount: Math.round(resolvedQty * unitPrice),
    })
  }

  return lines
}

/** @deprecated appendBillingOnlyLinesOnce 대신 billingStatementLinesForShippedProduct 사용 */
function billingOnlyStatementLinesFromOrder(
  order: NonNullable<Awaited<ReturnType<typeof fetchOrderById>>>,
  fallbackOrderNumber = '',
  shippedLines: ShippedLineForBilling[] = [],
): DeliveryStatementLine[] {
  return order.items
    .filter((item) => !item.derivedFromLineId && isBillingOnlyOrderItem(item))
    .map((item) => {
      const productCode = String(item.productCode || '').trim() || 'TEMP'
      const productName = String(item.productName || '').trim()
      const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0))
      const qty = shippedLines.length
        ? resolveBillingQuantityFromShipped({
            billingProductCode: productCode,
            billingProductName: productName,
            shippedLines: shippedLines.map((line) => ({
              productCode: line.productCode,
              productName: line.productName,
              quantity: line.qty,
            })),
          })
        : Math.max(0, Math.floor(Number(item.quantity) || 0))
      const supplyAmount = Math.round(qty * unitPrice)
      return {
        orderNumber: order.orderNumber || fallbackOrderNumber,
        productCode,
        productName,
        qty,
        unitPrice,
        supplyAmount,
      }
    })
    .filter((item) => item.productName && item.qty > 0)
}

function appendBillingOnlyLinesOnce(
  items: DeliveryStatementLine[],
  order: NonNullable<Awaited<ReturnType<typeof fetchOrderById>>> | null | undefined,
  orderNumber: string,
  appendedOrders: Set<string>,
  shippedLines: ShippedLineForBilling[] = [],
) {
  if (!order) return
  const key = order.orderNumber || orderNumber
  if (!key || appendedOrders.has(key)) return
  appendedOrders.add(key)
  items.push(...billingOnlyStatementLinesFromOrder(order, orderNumber, shippedLines))
}

/**
 * 거래명세서 품목 = 이번 출하 건에 포함된 품목만 (출하 수량·단가)
 */
function normalizeStatementShippedLines(lines: StatementShippedLineInput[]) {
  return (lines || [])
    .map((line) => ({
      orderNumber: String(line.orderNumber || '').trim(),
      productCode: String(line.productCode || '').trim(),
      productName: String(line.productName || '').trim(),
      qty: Math.max(0, Math.floor(Number(line.qty) || 0)),
      unitPrice:
        line.unitPrice != null ? Math.max(0, Math.round(Number(line.unitPrice) || 0)) : null,
      billingOnly: Boolean(line.billingOnly),
      orderLineId: String(line.orderLineId || '').trim(),
    }))
    .filter(
      (line) =>
        line.qty > 0 &&
        (line.productCode || line.productName) &&
        (line.billingOnly || line.orderNumber),
    )
}

export async function buildDeliveryStatementDataFromOrder(input: {
  docNo: string
  shipDate: string
  orderNumber: string
  customer?: string
  note?: string
  /** 이번 출하 품목 — 출하 수량 기준 */
  shippedLines: Array<{
    productCode: string
    productName: string
    qty: number
    /** 있으면 이 단가 사용, 없으면 발주서 라인 단가 */
    unitPrice?: number
  }>
}): Promise<
  | { ok: true; data: DeliveryStatementData }
  | { ok: false; detail: string }
> {
  const orderNumber = String(input.orderNumber || '').trim()
  if (!orderNumber) {
    return { ok: false, detail: '발주번호가 없습니다.' }
  }

  const shippedLines = (input.shippedLines || [])
    .map((line) => ({
      productCode: String(line.productCode || '').trim(),
      productName: String(line.productName || '').trim(),
      qty: Math.max(0, Math.floor(Number(line.qty) || 0)),
      unitPrice:
        line.unitPrice != null ? Math.max(0, Math.round(Number(line.unitPrice) || 0)) : null,
    }))
    .filter((line) => line.qty > 0 && (line.productCode || line.productName))

  if (!shippedLines.length) {
    return { ok: false, detail: '출하 품목이 없습니다.' }
  }

  const order = await fetchOrderById(orderNumber)
  if (!order) {
    return { ok: false, detail: `발주서(${orderNumber})를 찾을 수 없습니다.` }
  }

  const orderLines = order.items.filter((item) => !item.derivedFromLineId)

  function matchOrderLine(productCode: string, productName: string) {
    const code = productCode.trim().toLowerCase()
    const name = productName.trim().toLowerCase()
    if (code) {
      const byCode =
        orderLines.find(
          (item) =>
            !isBillingOnlyOrderItem(item) &&
            (String(item.productCode || '').trim().toLowerCase() === code ||
              String(item.productId || '').trim().toLowerCase() === code),
        ) ||
        orderLines.find(
          (item) =>
            String(item.productCode || '').trim().toLowerCase() === code ||
            String(item.productId || '').trim().toLowerCase() === code,
        )
      if (byCode) return byCode
    }
    if (name) {
      return (
        orderLines.find(
          (item) =>
            !isBillingOnlyOrderItem(item) &&
            String(item.productName || '').trim().toLowerCase() === name,
        ) ||
        orderLines.find((item) => String(item.productName || '').trim().toLowerCase() === name)
      )
    }
    return null
  }

  const items: DeliveryStatementLine[] = []
  const usedBillingLineIds = new Set<string>()
  const shippedForOrder = shippedLines.map((line) => {
    const matchedLine = matchOrderLine(line.productCode, line.productName)
    return {
      productCode: line.productCode,
      productName: line.productName,
      qty: line.qty,
      productId: String(matchedLine?.productId || '').trim() || undefined,
    }
  })

  shippedLines.forEach((line, index) => {
    const matched = matchOrderLine(line.productCode, line.productName)
    const unitPrice =
      line.unitPrice != null
        ? line.unitPrice
        : Math.max(0, Math.round(Number(matched?.unitPrice) || 0))
    const qty = line.qty
    items.push({
      orderNumber,
      productCode: resolveStatementDisplayProductCode({
        productCode: line.productCode,
        productId: matched?.productId,
        orderProductCode: matched?.productCode,
      }),
      productName: line.productName || String(matched?.productName || '').trim(),
      qty,
      unitPrice,
      supplyAmount: Math.round(qty * unitPrice),
    })
    items.push(
      ...billingStatementLinesForShippedProduct({
        order,
        orderNumber,
        shippedLine: {
          productCode: line.productCode,
          productName: line.productName,
          qty: line.qty,
          productId: String(matched?.productId || '').trim() || undefined,
        },
        shippedLinesForOrder: shippedForOrder,
        isLastShippedLineForOrder: isLastShippedLineForOrder(
          { orderNumber },
          index,
          shippedLines.map(() => ({ orderNumber })),
        ),
        usedBillingLineIds,
      }),
    )
  })

  if (!items.some((item) => item.productName || item.productCode)) {
    return { ok: false, detail: '출하 품목 정보를 찾을 수 없습니다.' }
  }

  const customer = String(input.customer || order.customer || '').trim()
  const contact = await resolveCustomerContact(customer)

  return {
    ok: true,
    data: {
      docNo: String(input.docNo || '').trim(),
      shipDate: String(input.shipDate || '').trim(),
      orderNumber: order.orderNumber,
      customer,
      customerAddress: contact.address,
      customerPhone: contact.phone,
      note: String(input.note || '').trim(),
      currency: normalizeOrderCurrency(order.currency),
      items,
    },
  }
}

/**
 * 혼합 출하(여러 주문·품목) 거래명세서 — docNo = shipment_id
 */
export async function buildDeliveryStatementDataFromShipment(input: {
  shipmentId: string
  shipDate: string
  customer: string
  note?: string
  shippedLines: StatementShippedLineInput[]
}): Promise<
  | { ok: true; data: DeliveryStatementData }
  | { ok: false; detail: string }
> {
  const shipmentId = String(input.shipmentId || '').trim()
  if (!shipmentId) {
    return { ok: false, detail: '명세서 번호가 없습니다.' }
  }

  const shippedLines = normalizeStatementShippedLines(input.shippedLines || [])

  if (!shippedLines.length) {
    return { ok: false, detail: '출하 품목이 없습니다.' }
  }

  const orderCache = new Map<string, Awaited<ReturnType<typeof fetchOrderById>>>()

  async function getOrder(orderNumber: string) {
    if (!orderNumber) return null
    if (orderCache.has(orderNumber)) return orderCache.get(orderNumber) ?? null
    const order = await fetchOrderById(orderNumber)
    orderCache.set(orderNumber, order)
    return order
  }

  function matchOrderProductLine(
    order: Awaited<ReturnType<typeof fetchOrderById>>,
    productCode: string,
    productName: string,
  ) {
    const orderLines = (order?.items || []).filter((item) => !item.derivedFromLineId)
    const code = productCode.trim().toLowerCase()
    const name = productName.trim().toLowerCase()
    return (
      (code
        ? orderLines.find(
            (item) =>
              !isBillingOnlyOrderItem(item) &&
              (String(item.productCode || '').trim().toLowerCase() === code ||
                String(item.productId || '').trim().toLowerCase() === code),
          )
        : null) ||
      (name
        ? orderLines.find(
            (item) =>
              !isBillingOnlyOrderItem(item) &&
              String(item.productName || '').trim().toLowerCase() === name,
          )
        : null) ||
      (code
        ? orderLines.find(
            (item) =>
              String(item.productCode || '').trim().toLowerCase() === code ||
              String(item.productId || '').trim().toLowerCase() === code,
          )
        : null) ||
      (name
        ? orderLines.find((item) => String(item.productName || '').trim().toLowerCase() === name)
        : null)
    )
  }

  let normalizedShippedLines = shippedLines
  const hasExplicitBilling = shippedLines.some((line) => line.billingOnly)

  if (!hasExplicitBilling) {
    const productOnly = shippedLines.filter((line) => !line.billingOnly)
    const orderIds = [...new Set(productOnly.map((line) => line.orderNumber).filter(Boolean))]
    const enrichedProducts = await Promise.all(
      productOnly.map(async (line) => {
        const order = await getOrder(line.orderNumber)
        const matched = matchOrderProductLine(order, line.productCode, line.productName)
        return {
          orderNumber: line.orderNumber,
          productCode: line.productCode,
          productName: line.productName,
          qty: line.qty,
          unitPrice: line.unitPrice,
          productId: String(matched?.productId || line.productCode).trim() || undefined,
          orderProductCode: String(matched?.productCode || '').trim() || undefined,
        }
      }),
    )
    const billingLines: ReturnType<typeof buildDeliveryBillingOnlyLines> = []
    for (const orderNumber of orderIds) {
      const order = await getOrder(orderNumber)
      if (order) billingLines.push(...buildDeliveryBillingOnlyLines([order]))
    }
    normalizedShippedLines = interleaveStatementShippedLinesWithBilling(
      enrichedProducts,
      billingLines,
    )
  }

  const items: DeliveryStatementLine[] = []
  const expandedOrders = new Set<string>()

  for (const line of normalizedShippedLines) {

    if (line.billingOnly) {
      const unitPrice = line.unitPrice ?? 0
      items.push({
        orderNumber: line.orderNumber,
        productCode: line.productCode,
        productName: line.productName,
        qty: line.qty,
        unitPrice,
        supplyAmount: Math.round(line.qty * unitPrice),
      })
      continue
    }

    const order = await getOrder(line.orderNumber)
    if (order && isCollapsedProductLabel(line.productName)) {
      if (!expandedOrders.has(order.orderNumber)) {
        items.push(...statementLinesFromOrderItems(order, line.orderNumber))
        expandedOrders.add(order.orderNumber)
      }
      continue
    }

    const matched = matchOrderProductLine(order, line.productCode, line.productName)

    const unitPrice =
      line.unitPrice != null
        ? line.unitPrice
        : Math.max(0, Math.round(Number(matched?.unitPrice) || 0))
    const qty = line.qty
    items.push({
      orderNumber: line.orderNumber || order?.orderNumber || '',
      productCode: resolveStatementDisplayProductCode({
        productCode: line.productCode,
        productId: matched?.productId,
        orderProductCode: matched?.productCode,
      }),
      productName: line.productName || String(matched?.productName || '').trim(),
      qty,
      unitPrice,
      supplyAmount: Math.round(qty * unitPrice),
    })
  }

  if (!items.some((item) => item.productName || item.productCode)) {
    return { ok: false, detail: '출하 품목 정보를 찾을 수 없습니다.' }
  }

  const uniqueOrders = [
    ...new Set(
      items
        .map((item) => String(item.orderNumber || '').trim())
        .filter((orderNumber): orderNumber is string => Boolean(orderNumber)),
    ),
  ]
  const customer = String(input.customer || '').trim()
  const contact = await resolveCustomerContact(customer)

  const currencies: OrderCurrency[] = []
  for (const orderNumber of uniqueOrders) {
    const order = await getOrder(orderNumber)
    if (order) currencies.push(normalizeOrderCurrency(order.currency))
  }
  const currency: OrderCurrency =
    currencies.length > 0 && currencies.every((value) => value === 'USD') ? 'USD' : 'KRW'

  return {
    ok: true,
    data: {
      docNo: shipmentId,
      shipDate: String(input.shipDate || '').trim(),
      orderNumber: uniqueOrders[0] || '',
      customer,
      customerAddress: contact.address,
      customerPhone: contact.phone,
      note: String(input.note || '').trim(),
      currency,
      items,
    },
  }
}

/** @deprecated 단일 품목용 — 발주서 기준 buildDeliveryStatementDataFromOrder 를 사용하세요 */
export function buildDeliveryStatementData(input: {
  row: {
    docNo: string
    shipDate: string
    orderNumber: string
    customer: string
    productName: string
    productCode: string
    qty: number
    note: string
  }
  unitPrice: number
  supplyAmount?: number
}): DeliveryStatementData {
  const qty = Math.max(0, Math.floor(Number(input.row.qty) || 0))
  const unitPrice = Math.max(0, Math.round(Number(input.unitPrice) || 0))
  const supplyAmount =
    input.supplyAmount != null
      ? Math.max(0, Math.round(Number(input.supplyAmount) || 0))
      : Math.round(qty * unitPrice)

  return {
    docNo: input.row.docNo,
    shipDate: input.row.shipDate,
    orderNumber: input.row.orderNumber,
    customer: input.row.customer,
    note: input.row.note,
    items: [
      {
        productCode: input.row.productCode,
        productName: input.row.productName,
        qty,
        unitPrice,
        supplyAmount,
      },
    ],
  }
}
