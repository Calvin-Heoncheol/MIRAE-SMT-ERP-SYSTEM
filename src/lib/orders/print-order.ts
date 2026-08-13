import {
  APP_SHORT_NAME,
  COMPANY_ADDRESS_STATEMENT,
  COMPANY_BIZ_NO,
  COMPANY_CEO_NAME,
  COMPANY_QUOTE_EMAIL_DOMESTIC,
  COMPANY_TEL,
} from '@/lib/app-config'
import type { OrderListGroup } from '@/lib/orders/types'
import { formatOrderDate, formatOrderMoney } from '@/lib/orders/utils'

export type OrderPrintLine = {
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  orderAmount: number
  deliveryDate: string
}

export type OrderPrintData = {
  orderNumber: string
  sourceQuoteNumber?: string | null
  orderDate: string
  deliveryDate: string
  customer: string
  category: string
  items: OrderPrintLine[]
  note?: string
  customerPoNumber?: string
}

const ORDER_PRINT_LOGO_PATH = '/branding/logo.png'
/** 브랜드 틸 — 로고 악센트와 맞춤 */
const BRAND_TEAL = '#0f766e'
const BRAND_TEAL_SOFT = '#ecfdf5'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function formatNumber(value: number) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('ko-KR')
}

function resolvePrintLogoSrc() {
  if (typeof window === 'undefined') return ORDER_PRINT_LOGO_PATH
  return `${window.location.origin}${ORDER_PRINT_LOGO_PATH}`
}

function formatTel(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  return value
}

export function buildOrderHtml(data: OrderPrintData, logoSrc = ORDER_PRINT_LOGO_PATH) {
  const orderNumber = escapeHtml(data.orderNumber)
  const sourceQuote = String(data.sourceQuoteNumber || '').trim()
  const sourceQuoteHtml = sourceQuote
    ? `<div class="meta-chip">견적번호 <strong>${escapeHtml(sourceQuote)}</strong></div>`
    : ''
  const customerPo = String(data.customerPoNumber || '').trim()
  const customerPoHtml = customerPo
    ? `<div class="meta-chip">발주번호 <strong>${escapeHtml(customerPo)}</strong></div>`
    : ''
  const orderDate = escapeHtml(formatOrderDate(data.orderDate) || data.orderDate)
  const deliveryDate = escapeHtml(formatOrderDate(data.deliveryDate) || data.deliveryDate || '—')
  const customer = escapeHtml(data.customer.trim() || '—')
  const category = escapeHtml(data.category.trim() || '—')
  const noteRaw = String(data.note || '').trim()
  const note = escapeHtml(noteRaw)
  const logo = escapeHtml(logoSrc)
  const companyName = escapeHtml(APP_SHORT_NAME)

  const totalQuantity = data.items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0)
  const totalAmount = data.items.reduce((sum, item) => sum + Math.max(0, Number(item.orderAmount) || 0), 0)

  const rows = data.items
    .map((item, index) => {
      const name = escapeHtml(item.productName || '—')
      const code = escapeHtml(item.productCode || '—')
      const qty = formatNumber(item.quantity)
      const unitPrice = formatNumber(item.unitPrice)
      const amount = formatNumber(item.orderAmount)
      return `<tr>
        <td class="c-no">${index + 1}</td>
        <td class="mono">${code}</td>
        <td class="name">${name}</td>
        <td class="num">${qty}</td>
        <td class="num">₩${unitPrice}</td>
        <td class="num amt">₩${amount}</td>
      </tr>`
    })
    .join('')

  const notesHtml = noteRaw
    ? `<div class="notes"><div class="notes-label">비고</div><div class="notes-body">${note}</div></div>`
    : `<div class="notes notes-muted"><div class="notes-label">안내</div><div class="notes-body">납기 ${deliveryDate} · 품목 ${formatNumber(data.items.length)}종 · 수량 합계 ${formatNumber(totalQuantity)}</div></div>`

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>주문서 ${orderNumber}</title><style>
@page { size: A4 portrait; margin: 12mm; }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 0;
  color: #0f172a;
  background: #fff;
  font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  font-size: 10px;
  line-height: 1.45;
}
.sheet { padding: 0; background: #fff; }
.brand-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  margin-bottom: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #ffffff;
  color: #0f172a;
}
.brand-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.brand-logo {
  display: block;
  height: 46px;
  width: auto;
  max-width: 150px;
  object-fit: contain;
}
.brand-text { min-width: 0; }
.brand-text .name {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0f172a;
}
.brand-text .en {
  margin-top: 2px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: ${BRAND_TEAL};
}
.brand-text .contact {
  margin-top: 4px;
  font-size: 8.5px;
  color: #64748b;
  line-height: 1.35;
}
.doc-badge { text-align: right; flex-shrink: 0; }
.doc-badge .en {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: ${BRAND_TEAL};
}
.doc-badge h1 {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.28em;
  color: #0f172a;
}
.doc-badge .order-no {
  margin-top: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #334155;
}
.accent-line {
  height: 3px;
  margin: -8px 0 14px;
  border-radius: 999px;
  background: linear-gradient(90deg, ${BRAND_TEAL} 0%, #14b8a6 55%, #99f6e4 100%);
}
.party-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}
.party-box {
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
}
.party-box.supplier {
  border-color: #99f6e4;
  background: ${BRAND_TEAL_SOFT};
}
.party-box .label {
  margin-bottom: 5px;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #64748b;
  text-transform: uppercase;
}
.party-box .name {
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
}
.party-box .detail {
  margin-top: 4px;
  font-size: 9px;
  color: #475569;
  line-height: 1.4;
}
.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #f8fafc;
  font-size: 10px;
  color: #475569;
}
.meta-chip strong { color: #0f172a; font-weight: 800; }
table.items {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
table.items th,
table.items td {
  border: 1px solid #cbd5e1;
  padding: 7px 8px;
  vertical-align: middle;
}
table.items th {
  background: ${BRAND_TEAL};
  color: #ecfdf5;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-align: center;
}
table.items td.c-no { width: 32px; text-align: center; color: #64748b; }
table.items td.mono {
  width: 18%;
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 9px;
  color: #334155;
}
table.items td.name { word-break: break-word; font-weight: 600; color: #0f172a; }
table.items td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
table.items td.amt { font-weight: 800; color: #0f172a; }
.bottom-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 10px;
  margin-top: 12px;
  align-items: start;
}
.totals {
  padding: 12px 14px;
  border: 1px solid #99f6e4;
  border-radius: 6px;
  background: ${BRAND_TEAL_SOFT};
}
.totals .row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
  font-size: 11px;
}
.totals .row + .row { border-top: 1px dashed #99f6e4; }
.totals .label { color: #0f766e; font-weight: 700; }
.totals .value {
  font-weight: 900;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}
.totals .grand .value { font-size: 14px; color: ${BRAND_TEAL}; }
.sign {
  padding: 12px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  min-height: 88px;
}
.sign .label {
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #64748b;
  text-transform: uppercase;
}
.sign .body {
  margin-top: 10px;
  font-size: 10px;
  color: #475569;
  line-height: 1.5;
}
.sign .stamp {
  margin-top: 18px;
  text-align: right;
  font-size: 11px;
  font-weight: 800;
  color: #0f172a;
}
.notes {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
}
.notes-muted { background: #fff; }
.notes-label {
  margin-bottom: 4px;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #64748b;
  text-transform: uppercase;
}
.notes-body { color: #334155; white-space: pre-wrap; }
.footer {
  margin-top: 16px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 8px;
  color: #94a3b8;
}
</style></head><body><div class="sheet">
  <div class="brand-bar">
    <div class="brand-left">
      <img class="brand-logo" src="${logo}" alt="${companyName}" />
      <div class="brand-text">
        <div class="name">${companyName}</div>
        <div class="en">MIRAE SMT</div>
        <div class="contact">
          ${escapeHtml(COMPANY_ADDRESS_STATEMENT)}<br />
          Tel ${escapeHtml(formatTel(COMPANY_TEL))} · ${escapeHtml(COMPANY_QUOTE_EMAIL_DOMESTIC)}
        </div>
      </div>
    </div>
    <div class="doc-badge">
      <div class="en">PURCHASE ORDER</div>
      <h1>주문서</h1>
      <div class="order-no">${orderNumber}</div>
    </div>
  </div>
  <div class="accent-line" aria-hidden="true"></div>

  <div class="party-grid">
    <div class="party-box">
      <div class="label">발주처 · Customer</div>
      <div class="name">${customer}</div>
      <div class="detail">주문일자 ${orderDate} · 분류 ${category}</div>
    </div>
    <div class="party-box supplier">
      <div class="label">수주처 · Supplier</div>
      <div class="name">${companyName}</div>
      <div class="detail">
        사업자등록번호 ${escapeHtml(COMPANY_BIZ_NO)} · 대표자 ${escapeHtml(COMPANY_CEO_NAME)}
      </div>
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-chip">납기(최초) <strong>${deliveryDate}</strong></div>
    <div class="meta-chip">품목 <strong>${formatNumber(data.items.length)}종</strong></div>
    ${customerPoHtml}
    ${sourceQuoteHtml}
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>No</th>
        <th>제품코드</th>
        <th>제품명</th>
        <th>수량</th>
        <th>단가</th>
        <th>금액</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="bottom-grid">
    <div class="sign">
      <div class="label">확인 · Confirmation</div>
      <div class="body">위 주문 내용을 확인합니다.</div>
      <div class="stamp">${companyName}</div>
    </div>
    <div class="totals">
      <div class="row">
        <span class="label">수량 합계</span>
        <span class="value">${formatNumber(totalQuantity)}</span>
      </div>
      <div class="row grand">
        <span class="label">금액 합계</span>
        <span class="value">${escapeHtml(formatOrderMoney(totalAmount))}</span>
      </div>
    </div>
  </div>

  ${notesHtml}

  <div class="footer">
    <span>${companyName} · 정식 주문서</span>
    <span>${orderNumber}</span>
  </div>
</div></body></html>`
}

export function printOrder(data: OrderPrintData) {
  if (typeof document === 'undefined') return false

  const html = buildOrderHtml(data, resolvePrintLogoSrc())
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', '주문서 인쇄')
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

  const cleanup = () => iframe.remove()

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

  const triggerPrint = () => {
    void waitForImages().then(() => {
      frameWindow.focus()
      frameWindow.print()
      window.setTimeout(cleanup, 120_000)
    })
  }

  if (frameDoc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 80)
  } else {
    iframe.addEventListener('load', () => window.setTimeout(triggerPrint, 80), { once: true })
  }

  return true
}

export function buildOrderPrintData(order: OrderListGroup): OrderPrintData {
  return {
    orderNumber: order.orderNumber,
    sourceQuoteNumber: order.sourceQuoteId || null,
    orderDate: order.orderDate,
    deliveryDate: order.deliveryDate,
    customer: order.customer,
    category: order.category,
    note: order.note,
    customerPoNumber: order.customerPoNumber,
    items: order.items.map((item) => ({
      productCode: item.productCode,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      orderAmount: item.orderAmount,
      deliveryDate: item.deliveryDate || order.deliveryDate,
    })),
  }
}
