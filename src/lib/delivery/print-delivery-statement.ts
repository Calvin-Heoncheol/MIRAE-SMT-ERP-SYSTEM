import { APP_SHORT_NAME } from '@/lib/app-config'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { DeliveryStatementData } from './types'

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

function buildStatementCopyHtml(data: DeliveryStatementData, copyLabel: string) {
  const shipDate = escapeHtml(data.shipDate)
  const orderNo = escapeHtml(data.orderNumber)
  const customer = escapeHtml(data.customer)
  const productName = escapeHtml(data.productName)
  const productCode = escapeHtml(data.productCode)
  const qty = Math.max(0, Math.floor(Number(data.qty) || 0))
  const unitPrice = Math.max(0, Math.round(Number(data.unitPrice) || 0))
  const supply = Math.max(0, Math.round(Number(data.supplyAmount) || qty * unitPrice))
  const noteRaw = data.note.trim()
  const note = escapeHtml(noteRaw)
  const issuedAt = todayYmdSeoul()
  const docNo = escapeHtml(data.docNo)
  const copy = escapeHtml(copyLabel)

  const notesHtml = noteRaw
    ? `<div class="notes"><strong>비고</strong> ${note}</div>`
    : `<div class="notes"><strong>안내</strong> 출하일 ${shipDate} · 수량 ${formatNumber(qty)}대</div>`

  return `<section class="statement-copy">
  <div class="copy-badge">${copy}</div>
  <div class="letterhead">
    <div class="issuer">
      <div class="brand">${escapeHtml(APP_SHORT_NAME)}</div>
      <div class="sub">완제품 출하</div>
    </div>
    <div class="doc-title">
      <div class="en">TRANSACTION STATEMENT</div>
      <h1>거래명세서</h1>
      <div class="no">문서번호 ${docNo}</div>
    </div>
  </div>
  <div class="party-grid">
    <div class="party-box">
      <div class="label">공급자</div>
      <div class="name">${escapeHtml(APP_SHORT_NAME)}</div>
      <div class="meta">출하일 ${shipDate} · 작성일 ${issuedAt}</div>
    </div>
    <div class="party-box party-box-buyer">
      <div class="label">공급받는자</div>
      <div class="name">${customer}</div>
      <div class="meta">주문서번호 ${orderNo}</div>
    </div>
  </div>
  <div class="meta-bar">
    <div class="cell"><strong>출하일</strong>${shipDate}</div>
    <div class="cell"><strong>주문서번호</strong>${orderNo}</div>
    <div class="cell"><strong>품목코드</strong>${productCode}</div>
    <div class="cell"><strong>출하수량</strong>${formatNumber(qty)} 대</div>
  </div>
  <table class="items">
    <thead>
      <tr>
        <th class="c-no">No</th>
        <th>품명</th>
        <th class="num">수량</th>
        <th class="num">단가</th>
        <th class="num">공급가액</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="c-no">1</td>
        <td>${productName}</td>
        <td class="num">${formatNumber(qty)}</td>
        <td class="num">₩${formatNumber(unitPrice)}</td>
        <td class="num amt">₩${formatNumber(supply)}</td>
      </tr>
    </tbody>
  </table>
  <div class="totals-wrap">
    <div class="totals">
      <div class="row"><span>공급가액 합계</span><span class="val">₩${formatNumber(supply)}</span></div>
    </div>
  </div>
  ${notesHtml}
</section>`
}

export function buildDeliveryStatementHtml(data: DeliveryStatementData) {
  const orderNo = escapeHtml(data.orderNumber)

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>거래명세서 ${orderNo}</title><style>
@page { size: A4 portrait; margin: 8mm; }
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
.sheet {
  display: flex;
  flex-direction: column;
  min-height: 277mm;
  gap: 0;
}
.statement-copy {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  padding: 7mm 8mm 6mm;
  border: 1px solid #94a3b8;
  background: #fff;
}
.copy-badge {
  position: absolute;
  top: 6mm;
  right: 8mm;
  padding: 2px 8px;
  border: 1px solid #64748b;
  border-radius: 4px;
  background: #f1f5f9;
  color: #334155;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.cut-line {
  flex: 0 0 auto;
  margin: 0;
  padding: 2mm 0;
  border-top: 1px dashed #64748b;
  border-bottom: 1px dashed #64748b;
  background: #f8fafc;
  color: #64748b;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-align: center;
}
.letterhead {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1.5px solid #cbd5e1;
}
.issuer .brand { font-size: 15px; font-weight: 800; color: #1e293b; }
.issuer .sub { margin-top: 2px; font-size: 9px; color: #64748b; }
.doc-title { padding-right: 52px; text-align: right; }
.doc-title .en { font-size: 8px; font-weight: 700; color: #64748b; letter-spacing: 0.1em; }
.doc-title h1 { margin: 2px 0 0; font-size: 17px; font-weight: 800; color: #334155; letter-spacing: 0.28em; }
.doc-title .no { margin-top: 4px; font-size: 10px; font-weight: 700; color: #475569; }
.party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
.party-box { padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc; }
.party-box-buyer { background: #fff; }
.party-box .label { margin-bottom: 4px; font-size: 8px; font-weight: 700; color: #64748b; letter-spacing: 0.06em; }
.party-box .name { font-size: 12px; font-weight: 700; color: #0f172a; }
.party-box .meta { margin-top: 4px; font-size: 9px; color: #475569; }
.meta-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px; }
.meta-bar .cell { padding: 6px 7px; border: 1px solid #e2e8f0; border-radius: 3px; background: #fff; font-size: 9px; }
.meta-bar .cell strong { display: block; margin-bottom: 2px; color: #64748b; font-size: 8px; }
.items { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9px; }
.items th { padding: 6px 5px; border: 1px solid #94a3b8; background: #475569; color: #fff; font-weight: 600; text-align: left; }
.items th.num, .items td.num { text-align: right; }
.items td { padding: 6px 5px; border: 1px solid #e2e8f0; vertical-align: top; }
.items td.c-no, .items th.c-no { width: 28px; text-align: center; }
.items td.amt { font-weight: 700; color: #1e293b; }
.totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 6px; }
.totals { width: 220px; border: 1.5px solid #64748b; border-radius: 4px; overflow: hidden; }
.totals .row { display: flex; justify-content: space-between; padding: 6px 9px; background: #f8fafc; font-size: 10px; font-weight: 700; color: #1e293b; }
.totals .row .val { font-variant-numeric: tabular-nums; }
.notes { padding: 6px 8px; border-left: 3px solid #64748b; background: #f8fafc; font-size: 8px; color: #475569; }
.notes strong { color: #334155; }
</style></head><body>
<div class="sheet">
${buildStatementCopyHtml(data, '고객용')}
<div class="cut-line">— 절취선 —</div>
${buildStatementCopyHtml(data, '내부용')}
</div>
</body></html>`
}

export function printDeliveryStatement(data: DeliveryStatementData) {
  const html = buildDeliveryStatementHtml(data)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', '거래명세서 인쇄')
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

export function buildDeliveryStatementData(input: {
  row: Pick<
    DeliveryStatementData,
    'docNo' | 'shipDate' | 'orderNumber' | 'customer' | 'productName' | 'productCode' | 'qty' | 'note'
  >
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
    ...input.row,
    qty,
    unitPrice,
    supplyAmount,
  }
}
