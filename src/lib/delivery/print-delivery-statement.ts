import {
  APP_SHORT_NAME,
  COMPANY_ADDRESS_STATEMENT,
  COMPANY_BIZ_NO,
  COMPANY_CEO_NAME,
  COMPANY_TEL,
} from '@/lib/app-config'
import { fetchOrderById } from '@/lib/orders/repository'
import type { DeliveryStatementData, DeliveryStatementLine } from './types'

/** 1장에 고객용·내부용 2부 → 빈 행은 적게 */
const MIN_ITEM_ROW_COUNT = 5

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

/** YYYY-MM-DD → YYYY/MM/DD */
function formatSlashDate(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  return `${m[1]}/${m[2]}/${m[3]}`
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

function buildItemRows(items: DeliveryStatementLine[]) {
  const rows: string[] = items.map((item) => {
    const code = escapeHtml(item.productCode || '')
    const name = escapeHtml(item.productName || '')
    return `<tr>
      <td class="code">${code}</td>
      <td class="name">${name}</td>
      <td class="num">${formatNumber(item.qty)}</td>
      <td class="num">₩${formatNumber(item.unitPrice)}</td>
      <td class="num amt">₩${formatNumber(item.supplyAmount)}</td>
    </tr>`
  })

  const padTo = Math.max(MIN_ITEM_ROW_COUNT, items.length)
  for (let i = items.length; i < padTo; i += 1) {
    rows.push(
      `<tr class="empty">
        <td class="code">&nbsp;</td>
        <td class="name">&nbsp;</td>
        <td class="num">&nbsp;</td>
        <td class="num">&nbsp;</td>
        <td class="num">&nbsp;</td>
      </tr>`,
    )
  }

  return rows.join('')
}

function buildStatementCopyHtml(data: DeliveryStatementData) {
  const shipDateSlash = formatSlashDate(data.shipDate)
  const customer = escapeHtml(data.customer.trim() || '—')
  const items = (data.items || []).map(normalizeStatementLine)
  const { qty, supply } = sumStatementTotals(items)
  const vat = 0
  const total = supply + vat
  const koreanAmount = escapeHtml(formatAmountInKorean(total))
  const shipNo = escapeHtml(data.docNo.trim() || '—')
  const noteRaw = data.note.trim()

  return `<section class="statement-copy">
  <div class="header-row">
    <div class="title-block">
      <p class="doc-en">TRANSACTION STATEMENT</p>
      <h1 class="doc-title">거래명세서</h1>
      <p class="doc-date">${escapeHtml(shipDateSlash)}</p>
      <p class="doc-buyer"><span class="buyer-name">${customer}</span><span class="buyer-honor">귀하</span></p>
    </div>
    <div class="supplier-block">
      <div class="supplier-label">공급자</div>
      <div class="supplier-grid">
        <div class="sg-label">출하번호</div>
        <div class="sg-value mono">${shipNo}</div>
        <div class="sg-label">TEL</div>
        <div class="sg-value mono">${escapeHtml(COMPANY_TEL)}</div>
        <div class="sg-label">사업자번호</div>
        <div class="sg-value mono">${escapeHtml(COMPANY_BIZ_NO)}</div>
        <div class="sg-label">성명</div>
        <div class="sg-value">${escapeHtml(COMPANY_CEO_NAME)}</div>
        <div class="sg-label">상호</div>
        <div class="sg-value">${escapeHtml(APP_SHORT_NAME)}</div>
        <div class="sg-label">주소</div>
        <div class="sg-value addr">${escapeHtml(COMPANY_ADDRESS_STATEMENT)}</div>
      </div>
    </div>
  </div>

  <div class="amount-bar">
    <span class="amount-label">금액</span>
    <span class="amount-korean">${koreanAmount}</span>
    <span class="amount-num">₩${formatNumber(total)}</span>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="code">품목코드</th>
        <th class="name">품목명 [규격]</th>
        <th class="num">수량</th>
        <th class="num">단가</th>
        <th class="num">공급가액</th>
      </tr>
    </thead>
    <tbody>
      ${buildItemRows(items)}
    </tbody>
  </table>

  <div class="footer-bar">
    <div class="ft-cell"><span class="ft-label">수량</span><span class="ft-val">${formatNumber(qty)}</span></div>
    <div class="ft-cell"><span class="ft-label">공급가액</span><span class="ft-val">₩${formatNumber(supply)}</span></div>
    <div class="ft-cell"><span class="ft-label">VAT</span><span class="ft-val">₩${formatNumber(vat)}</span></div>
    <div class="ft-cell ft-total"><span class="ft-label">합계</span><span class="ft-val">₩${formatNumber(total)}</span></div>
    <div class="ft-cell ft-sign"><span class="ft-label">인수</span><span class="sign-box">인</span></div>
  </div>
  ${
    noteRaw
      ? `<div class="notes"><strong>비고</strong> ${escapeHtml(noteRaw)}</div>`
      : ''
  }
</section>`
}

export function buildDeliveryStatementHtml(data: DeliveryStatementData) {
  const orderNo = escapeHtml(data.orderNumber)

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>거래명세서 ${orderNo}</title><style>
@page { size: A4 portrait; margin: 8mm; }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { box-sizing: border-box; }
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
  padding: 6mm 7mm 5mm;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
}
.cut-line {
  flex: 0 0 auto;
  margin: 0;
  padding: 2mm 0;
  border-top: 1px dashed #94a3b8;
  border-bottom: 1px dashed #94a3b8;
  background: #f8fafc;
  color: #64748b;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-align: center;
}

.header-row {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.35fr);
  gap: 8px;
  margin-bottom: 7px;
}
.title-block {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
  color: #fff;
  text-align: center;
  min-height: 88px;
}
.doc-en {
  margin: 0;
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #94a3b8;
}
.doc-title {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.28em;
  text-indent: 0.28em;
  color: #fff;
}
.doc-date {
  margin: 6px 0 0;
  font-size: 11px;
  font-weight: 600;
  color: #93c5fd;
  letter-spacing: 0.04em;
}
.doc-buyer {
  margin: 8px 0 0;
  font-size: 12px;
  font-weight: 700;
  color: #e2e8f0;
}
.buyer-honor {
  margin-left: 6px;
  color: #94a3b8;
  letter-spacing: 0.12em;
}

.supplier-block {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  min-height: 88px;
}
.supplier-label {
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  letter-spacing: 0.35em;
  font-size: 11px;
  font-weight: 800;
  color: #e2e8f0;
  background: #475569;
}
.supplier-grid {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 48px minmax(0, 1.1fr);
  grid-auto-rows: 1fr;
}
.sg-label {
  display: flex;
  align-items: center;
  padding: 3px 6px;
  font-size: 8px;
  font-weight: 700;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
}
.sg-value {
  display: flex;
  align-items: center;
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 600;
  color: #0f172a;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  min-width: 0;
}
.supplier-grid > :nth-child(4n) { border-right: none; }
.supplier-grid > :nth-last-child(-n+4) { border-bottom: none; }
.sg-value.mono { font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.sg-value.addr { font-size: 9px; font-weight: 500; color: #334155; line-height: 1.3; }

.amount-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 7px;
  padding: 7px 12px;
  border: 1px solid #93c5fd;
  border-radius: 6px;
  background: linear-gradient(to right, #eff6ff, #fff);
}
.amount-label {
  flex: 0 0 auto;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: #1e3a8a;
}
.amount-korean {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  font-weight: 800;
  color: #1d4ed8;
  letter-spacing: 0.04em;
}
.amount-num {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 800;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}

.items {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 7px;
  font-size: 9px;
  border: 1px solid #94a3b8;
  border-radius: 4px;
  overflow: hidden;
}
.items th {
  padding: 5px 6px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #e2e8f0;
  font-weight: 600;
  text-align: center;
}
.items td {
  padding: 5px 6px;
  border: 1px solid #e2e8f0;
  vertical-align: middle;
  height: 22px;
}
.items td.code { width: 18%; word-break: break-all; color: #475569; font-variant-numeric: tabular-nums; }
.items th.code { width: 18%; }
.items td.name, .items th.name { width: 42%; }
.items td.name { text-align: left; color: #0f172a; font-weight: 600; }
.items td.num, .items th.num { width: 13.333%; }
.items td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #334155;
}
.items td.amt { font-weight: 700; color: #0f172a; }
.items tbody tr.empty td { background: #fafbfc; }

.footer-bar {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr 1.2fr 0.85fr;
  gap: 0;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  overflow: hidden;
  background: #f8fafc;
}
.ft-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px;
  border-right: 1px solid #e2e8f0;
}
.ft-cell:last-child { border-right: none; }
.ft-label {
  font-size: 8px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.ft-val {
  font-size: 10px;
  font-weight: 700;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}
.ft-total {
  background: #f1f5f9;
}
.ft-total .ft-val { color: #1d4ed8; }
.ft-sign { justify-content: space-between; }
.sign-box {
  display: inline-block;
  min-width: 36px;
  padding: 1px 4px 1px 14px;
  border-bottom: 1.5px solid #64748b;
  text-align: right;
  font-size: 10px;
  font-weight: 700;
  color: #475569;
}
.notes {
  margin-top: 6px;
  padding: 5px 8px;
  border-left: 3px solid #64748b;
  background: #f8fafc;
  font-size: 8px;
  color: #475569;
}
.notes strong { color: #334155; margin-right: 4px; }
</style></head><body>
<div class="sheet">
${buildStatementCopyHtml(data)}
<div class="cut-line">— 절취선 —</div>
${buildStatementCopyHtml(data)}
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
    window.setTimeout(triggerPrint, 50)
  } else {
    iframe.onload = () => window.setTimeout(triggerPrint, 50)
  }

  return true
}

/**
 * 거래명세서 품목 = 해당 주문서의 사용자 입력 라인 전체
 * (임시 품목 포함, BOM 전개 파생 라인 제외, 주문 수량·단가·금액)
 */
export async function buildDeliveryStatementDataFromOrder(input: {
  docNo: string
  shipDate: string
  orderNumber: string
  customer?: string
  note?: string
}): Promise<
  | { ok: true; data: DeliveryStatementData }
  | { ok: false; detail: string }
> {
  const orderNumber = String(input.orderNumber || '').trim()
  if (!orderNumber) {
    return { ok: false, detail: '주문번호가 없습니다.' }
  }

  const order = await fetchOrderById(orderNumber)
  if (!order) {
    return { ok: false, detail: `주문서(${orderNumber})를 찾을 수 없습니다.` }
  }

  const items: DeliveryStatementLine[] = order.items
    .filter((item) => !item.derivedFromLineId)
    .map((item) => {
      const qty = Math.max(0, Math.floor(Number(item.quantity) || 0))
      const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0))
      const supplyAmount =
        item.orderAmount > 0
          ? Math.max(0, Math.round(Number(item.orderAmount) || 0))
          : Math.round(qty * unitPrice)
      return {
        productCode: String(item.productCode || '').trim(),
        productName: String(item.productName || '').trim(),
        qty,
        unitPrice,
        supplyAmount,
      }
    })
    .filter((item) => item.productName || item.productCode || item.qty > 0 || item.supplyAmount > 0)

  if (!items.length) {
    return { ok: false, detail: '주문서에 출력할 품목이 없습니다.' }
  }

  return {
    ok: true,
    data: {
      docNo: String(input.docNo || '').trim(),
      shipDate: String(input.shipDate || '').trim(),
      orderNumber: order.orderNumber,
      customer: String(input.customer || order.customer || '').trim(),
      note: String(input.note || '').trim(),
      items,
    },
  }
}

/** @deprecated 단일 품목용 — 주문서 기준 buildDeliveryStatementDataFromOrder 를 사용하세요 */
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
