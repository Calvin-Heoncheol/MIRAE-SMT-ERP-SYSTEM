import { APP_SHORT_NAME, COMPANY_ADDRESS_DOMESTIC, COMPANY_QUOTE_EMAIL_DOMESTIC } from '@/lib/app-config'
import type { OrderListGroup } from '@/lib/orders/types'
import { formatOrderDate, formatOrderMoney } from '@/lib/orders/utils'

export type OrderPrintLine = {
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  orderAmount: number
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
}

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

export function buildOrderHtml(data: OrderPrintData) {
  const orderNumber = escapeHtml(data.orderNumber)
  const sourceQuote = String(data.sourceQuoteNumber || '').trim()
  const sourceQuoteHtml = sourceQuote
    ? `<div class="source-no">견적번호 ${escapeHtml(sourceQuote)}</div>`
    : ''
  const orderDate = escapeHtml(formatOrderDate(data.orderDate) || data.orderDate)
  const deliveryDate = escapeHtml(formatOrderDate(data.deliveryDate) || data.deliveryDate || '—')
  const customer = escapeHtml(data.customer.trim() || '—')
  const category = escapeHtml(data.category.trim() || '—')
  const noteRaw = String(data.note || '').trim()
  const note = escapeHtml(noteRaw)

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
        <td>${name}</td>
        <td class="num">${qty}</td>
        <td class="num">₩${unitPrice}</td>
        <td class="num amt">₩${amount}</td>
      </tr>`
    })
    .join('')

  const notesHtml = noteRaw
    ? `<div class="notes"><strong>비고</strong> ${note}</div>`
    : `<div class="notes"><strong>안내</strong> 납기일 ${deliveryDate} · 품목 ${formatNumber(data.items.length)}종 · 수량합계 ${formatNumber(totalQuantity)}</div>`

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>주문서 ${orderNumber}</title><style>
@page { size: A4 portrait; margin: 10mm; }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0;
  padding: 0;
  color: #1e293b;
  background: #fff;
  font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  font-size: 10px;
  line-height: 1.4;
}
.sheet { padding: 2mm; background: #fff; }
.letterhead {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1.5px solid #cbd5e1;
}
.issuer .brand { font-size: 15px; font-weight: 800; color: #1e293b; }
.issuer .sub { margin-top: 2px; font-size: 9px; color: #64748b; }
.doc-title { text-align: right; }
.doc-title .en { font-size: 8px; font-weight: 700; color: #64748b; letter-spacing: 0.1em; }
.doc-title h1 { margin: 2px 0 0; font-size: 18px; font-weight: 800; color: #334155; letter-spacing: 0.28em; }
.doc-title .source-no { margin-top: 6px; font-size: 10px; font-weight: 700; color: #0f172a; }
.doc-title .no { margin-top: 2px; font-size: 10px; font-weight: 700; color: #475569; }
.party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
.party-box { padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc; }
.party-box-buyer { background: #fff; }
.party-box .label { margin-bottom: 4px; font-size: 8px; font-weight: 700; color: #64748b; letter-spacing: 0.06em; }
.party-box .name { font-size: 12px; font-weight: 700; color: #0f172a; }
.meta { display: flex; flex-wrap: wrap; gap: 10px 16px; margin-bottom: 8px; font-size: 10px; color: #475569; }
.meta strong { color: #0f172a; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: middle; }
th { background: #f1f5f9; font-size: 9px; font-weight: 700; color: #475569; text-align: center; }
td.c-no { width: 28px; text-align: center; color: #64748b; }
td.mono { font-family: ui-monospace, monospace; font-size: 9px; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
td.amt { font-weight: 700; }
.totals {
  display: flex;
  justify-content: flex-end;
  gap: 18px;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #f8fafc;
  font-size: 11px;
}
.totals .label { color: #64748b; font-weight: 600; }
.totals .value { font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
.notes { margin-top: 10px; padding: 8px 10px; border: 1px dashed #cbd5e1; border-radius: 4px; color: #475569; }
.footer {
  margin-top: 14px;
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  color: #94a3b8;
}
</style></head><body><div class="sheet">
  <div class="letterhead">
    <div class="issuer">
      <div class="brand">${escapeHtml(APP_SHORT_NAME)}</div>
      <div class="sub">${escapeHtml(COMPANY_ADDRESS_DOMESTIC)}</div>
      <div class="sub">${escapeHtml(COMPANY_QUOTE_EMAIL_DOMESTIC)}</div>
    </div>
    <div class="doc-title">
      <div class="en">SALES ORDER</div>
      <h1>주문서</h1>
      ${sourceQuoteHtml}
      <div class="no">주문번호 ${orderNumber}</div>
    </div>
  </div>

  <div class="party-grid">
    <div class="party-box party-box-buyer">
      <div class="label">발주처 (Customer)</div>
      <div class="name">${customer}</div>
    </div>
    <div class="party-box">
      <div class="label">수주처 (Supplier)</div>
      <div class="name">${escapeHtml(APP_SHORT_NAME)}</div>
    </div>
  </div>

  <div class="meta">
    <div>주문일 <strong>${orderDate}</strong></div>
    <div>납기일 <strong>${deliveryDate}</strong></div>
    <div>구분 <strong>${category}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>No</th>
        <th>품목코드</th>
        <th>품명</th>
        <th>수량</th>
        <th>단가</th>
        <th>금액</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span class="label">수량 합계</span> <span class="value">${formatNumber(totalQuantity)}</span></div>
    <div><span class="label">금액 합계</span> <span class="value">${escapeHtml(formatOrderMoney(totalAmount))}</span></div>
  </div>

  ${notesHtml}

  <div class="footer">
    <span>${escapeHtml(APP_SHORT_NAME)} 주문서</span>
    <span>${orderNumber}</span>
  </div>
</div></body></html>`
}

export function printOrder(data: OrderPrintData) {
  if (typeof document === 'undefined') return false

  const html = buildOrderHtml(data)
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

  const triggerPrint = () => {
    frameWindow.focus()
    frameWindow.print()
    window.setTimeout(cleanup, 120_000)
  }

  if (frameDoc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 300)
  } else {
    iframe.addEventListener('load', () => window.setTimeout(triggerPrint, 300), { once: true })
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
    items: order.items.map((item) => ({
      productCode: item.productCode,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      orderAmount: item.orderAmount,
    })),
  }
}
