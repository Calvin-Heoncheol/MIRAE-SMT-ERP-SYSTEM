import {
  APP_SHORT_NAME,
  COMPANY_ADDRESS_DOMESTIC,
  COMPANY_ADDRESS_DOMESTIC_EN,
  COMPANY_QUOTE_EMAIL_DOMESTIC,
} from '@/lib/app-config'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { MaterialPurchaseOrderCurrency } from '@/lib/materials/purchase-orders/types'
import {
  formatMaterialPurchaseOrderMoney,
  formatMaterialPurchaseOrderDate,
  formatMaterialPurchaseOrderAmountNumber,
  materialPurchaseOrderCurrencySymbol,
  normalizeMaterialPurchaseOrderAmount,
  normalizeMaterialPurchaseOrderUnitPrice,
} from '@/lib/materials/purchase-orders/utils'

export type MaterialPurchaseOrderPrintLanguage = 'ko' | 'en'

export type MaterialPurchaseOrderPrintLine = {
  materialCode: string
  materialName: string
  specification: string
  mpn: string
  quantity: number
  unitPrice: number
  orderAmount: number
}

export type MaterialPurchaseOrderPrintData = {
  orderNumber: string
  /** 연결된 고객 발주서 번호 (발주서 구매발주 시) */
  sourceOrderNumber?: string | null
  orderDate: string
  deliveryDate: string
  supplier: string
  currency: MaterialPurchaseOrderCurrency
  /** 출력 담당자 이메일 (로그인 사용자) */
  contactEmail?: string | null
  items: MaterialPurchaseOrderPrintLine[]
  note?: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function formatNumber(value: number, maxFractionDigits = 0) {
  const n = Number(value) || 0
  if (maxFractionDigits <= 0) {
    return Math.max(0, Math.round(n)).toLocaleString('ko-KR')
  }
  const factor = 10 ** maxFractionDigits
  const rounded = Math.round(Math.max(0, n) * factor) / factor
  return rounded.toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  })
}

function printText(language: MaterialPurchaseOrderPrintLanguage, ko: string, en: string) {
  return language === 'en' ? en : ko
}

export function buildMaterialPurchaseOrderHtml(
  data: MaterialPurchaseOrderPrintData,
  language: MaterialPurchaseOrderPrintLanguage = 'ko',
) {
  const t = (ko: string, en: string) => printText(language, ko, en)
  const orderNumber = escapeHtml(data.orderNumber)
  const sourceOrderNumber = String(data.sourceOrderNumber || '').trim()
  const sourceOrderHtml = sourceOrderNumber
    ? `<div class="source-no">${escapeHtml(t('발주번호', 'Sales Order'))} ${escapeHtml(sourceOrderNumber)}</div>`
    : ''
  const orderDate = escapeHtml(formatMaterialPurchaseOrderDate(data.orderDate) || data.orderDate)
  const deliveryDate = escapeHtml(
    formatMaterialPurchaseOrderDate(data.deliveryDate) || data.deliveryDate || '—',
  )
  const supplier = escapeHtml(data.supplier.trim() || '—')
  const currency = data.currency === 'USD' ? 'USD' : 'KRW'
  const moneySymbol = materialPurchaseOrderCurrencySymbol(currency)
  const issuedAt = todayYmdSeoul()
  const noteRaw = String(data.note || '').trim()
  const note = escapeHtml(noteRaw)
  const htmlLang = language === 'en' ? 'en' : 'ko'
  const docTitle = t('구매발주서', 'Purchase Order')
  const companyName = language === 'en' ? 'MiraeSMT' : APP_SHORT_NAME
  const companyAddress = language === 'en' ? COMPANY_ADDRESS_DOMESTIC_EN : COMPANY_ADDRESS_DOMESTIC
  const contactEmail =
    String(data.contactEmail || '').trim() || COMPANY_QUOTE_EMAIL_DOMESTIC

  const totalQuantity = data.items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0)
  const totalAmount = data.items.reduce((sum, item) => sum + Math.max(0, Number(item.orderAmount) || 0), 0)

  const rows = data.items
    .map((item, index) => {
      const name = escapeHtml(item.materialName || '—')
      const code = escapeHtml(item.materialCode || '—')
      const mpn = escapeHtml(item.mpn || '—')
      const qty = formatNumber(item.quantity)
      const unitPrice = formatNumber(item.unitPrice, 4)
      const amount = formatMaterialPurchaseOrderAmountNumber(item.orderAmount)
      return `<tr>
        <td class="c-no">${index + 1}</td>
        <td class="mono">${code}</td>
        <td>${name}</td>
        <td class="mono">${mpn}</td>
        <td class="num">${qty}</td>
        <td class="num">${moneySymbol}${unitPrice}</td>
        <td class="num amt">${moneySymbol}${amount}</td>
      </tr>`
    })
    .join('')

  const notesHtml = noteRaw
    ? `<div class="notes"><strong>${escapeHtml(t('비고', 'Note'))}</strong> ${note}</div>`
    : `<div class="notes"><strong>${escapeHtml(t('안내', 'Info'))}</strong> ${escapeHtml(t('납기일', 'Delivery'))} ${deliveryDate} · ${escapeHtml(t('품목', 'Items'))} ${formatNumber(data.items.length)}${escapeHtml(t('종', ''))} · ${escapeHtml(t('수량합계', 'Total Qty'))} ${formatNumber(totalQuantity)}</div>`

  return `<!DOCTYPE html><html lang="${htmlLang}"><head><meta charset="UTF-8">
<title>${escapeHtml(docTitle)} ${orderNumber}</title><style>
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
.sheet {
  padding: 2mm;
  background: #fff;
}
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
.doc-title h1 { margin: 2px 0 0; font-size: 18px; font-weight: 800; color: #334155; letter-spacing: ${language === 'en' ? '0.04em' : '0.28em'}; }
.doc-title .source-no { margin-top: 6px; font-size: 10px; font-weight: 700; color: #0f172a; }
.doc-title .no { margin-top: 2px; font-size: 10px; font-weight: 700; color: #475569; }
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
.items td.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 8px; }
.items td.amt { font-weight: 700; color: #1e293b; }
.totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 6px; }
.totals { width: 240px; border: 1.5px solid #64748b; border-radius: 4px; overflow: hidden; }
.totals .row { display: flex; justify-content: space-between; padding: 6px 9px; background: #f8fafc; font-size: 10px; font-weight: 700; color: #1e293b; }
.totals .row .val { font-variant-numeric: tabular-nums; }
.notes { padding: 6px 8px; border-left: 3px solid #64748b; background: #f8fafc; font-size: 8px; color: #475569; }
.notes strong { color: #334155; }
</style></head><body>
<div class="sheet">
  <div class="letterhead">
    <div class="issuer">
      <div class="brand">${escapeHtml(companyName)}</div>
      <div class="sub">${escapeHtml(companyAddress)}</div>
      <div class="sub">${escapeHtml(contactEmail)}</div>
    </div>
    <div class="doc-title">
      <div class="en">PURCHASE ORDER</div>
      <h1>${escapeHtml(docTitle)}</h1>
      ${sourceOrderHtml}
      <div class="no">${escapeHtml(t('구매발주번호', 'PO No.'))} ${orderNumber}</div>
    </div>
  </div>
  <div class="party-grid">
    <div class="party-box">
      <div class="label">${escapeHtml(t('발주처', 'Buyer'))}</div>
      <div class="name">${escapeHtml(companyName)}</div>
      <div class="meta">${escapeHtml(t('작성일', 'Issued'))} ${issuedAt}</div>
    </div>
    <div class="party-box party-box-buyer">
      <div class="label">${escapeHtml(t('공급사', 'Supplier'))}</div>
      <div class="name">${supplier}</div>
      <div class="meta">${escapeHtml(t('납기일', 'Delivery'))} ${deliveryDate}</div>
    </div>
  </div>
  <div class="meta-bar">
    <div class="cell"><strong>${escapeHtml(t('구매발주일', 'Order Date'))}</strong>${orderDate}</div>
    <div class="cell"><strong>${escapeHtml(t('납기일', 'Delivery'))}</strong>${deliveryDate}</div>
    <div class="cell"><strong>${escapeHtml(t('통화', 'Currency'))}</strong>${currency}</div>
    <div class="cell"><strong>${escapeHtml(t('수량합계', 'Total Qty'))}</strong>${formatNumber(totalQuantity)}</div>
  </div>
  <table class="items">
    <thead>
      <tr>
        <th class="c-no">No</th>
        <th>${escapeHtml(t('자재코드', 'Item Code'))}</th>
        <th>${escapeHtml(t('자재명', 'Item Name'))}</th>
        <th>MPN</th>
        <th class="num">${escapeHtml(t('수량', 'Qty'))}</th>
        <th class="num">${escapeHtml(t('단가', 'Unit Price'))}</th>
        <th class="num">${escapeHtml(t('금액', 'Amount'))}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="totals-wrap">
    <div class="totals">
      <div class="row"><span>${escapeHtml(t('구매발주금액 합계', 'Total Amount'))}</span><span class="val">${escapeHtml(formatMaterialPurchaseOrderMoney(totalAmount, currency))}</span></div>
    </div>
  </div>
  ${notesHtml}
</div>
</body></html>`
}

export function printMaterialPurchaseOrder(
  data: MaterialPurchaseOrderPrintData,
  options: { language?: MaterialPurchaseOrderPrintLanguage } = {},
) {
  if (!data.items.length) return false

  const language = options.language === 'en' ? 'en' : 'ko'
  const html = buildMaterialPurchaseOrderHtml(data, language)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', language === 'en' ? 'Purchase Order Print' : '발주서 인쇄')
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

export function buildMaterialPurchaseOrderPrintData(input: {
  orderNumber: string
  sourceOrderNumber?: string | null
  orderDate: string
  deliveryDate: string
  supplier: string
  currency?: MaterialPurchaseOrderCurrency
  contactEmail?: string | null
  items: Array<{
    materialCode?: string
    materialName?: string
    specification?: string
    mpn?: string
    quantity: number
    unitPrice: number
    orderAmount?: number
  }>
  note?: string
}): MaterialPurchaseOrderPrintData {
  return {
    orderNumber: input.orderNumber,
    sourceOrderNumber: input.sourceOrderNumber || null,
    orderDate: input.orderDate,
    deliveryDate: input.deliveryDate,
    supplier: input.supplier,
    currency: input.currency === 'USD' ? 'USD' : 'KRW',
    contactEmail: String(input.contactEmail || '').trim() || null,
    note: input.note,
    items: input.items.map((item) => {
      const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
      const unitPrice = normalizeMaterialPurchaseOrderUnitPrice(item.unitPrice)
      const orderAmount =
        item.orderAmount != null
          ? normalizeMaterialPurchaseOrderAmount(item.orderAmount)
          : normalizeMaterialPurchaseOrderAmount(quantity * unitPrice)
      return {
        materialCode: String(item.materialCode || '').trim(),
        materialName: String(item.materialName || '').trim(),
        specification: String(item.specification || '').trim(),
        mpn: String(item.mpn || '').trim(),
        quantity,
        unitPrice,
        orderAmount,
      }
    }),
  }
}
