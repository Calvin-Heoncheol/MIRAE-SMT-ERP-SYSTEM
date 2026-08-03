import { APP_SHORT_NAME } from '@/lib/app-config'
import {
  getApprovalCategoryLabel,
  getApprovalDetailColumns,
  usesAmountBasisSelector,
  type ApprovalCategory,
  type ApprovalDetailColumn,
} from '@/lib/approvals/categories'
import {
  computeApprovalGrandTotal,
  computeApprovalSupplyAmount,
  computeApprovalVatAmount,
  type ApprovalFormState,
} from '@/lib/approvals/form-state'
import { formatApprovalMoney } from '@/lib/approvals/utils'
import type { ApprovalDetailItem } from '@/lib/approvals/types'

export type ApprovalPrintInput = {
  category: ApprovalCategory
  form: ApprovalFormState
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function dash(value: string) {
  const trimmed = value.trim()
  return trimmed ? escapeHtml(trimmed) : '—'
}

function formatDetailCell(item: ApprovalDetailItem, column: ApprovalDetailColumn) {
  const raw = String(item[column.key] ?? '').trim()
  if (!raw) return '—'
  if (column.computed || column.key === 'amount' || column.key === 'unitPrice') {
    const numeric = Number(raw.replace(/,/g, ''))
    if (!Number.isNaN(numeric) && numeric !== 0) {
      return escapeHtml(formatApprovalMoney(numeric))
    }
  }
  return escapeHtml(raw)
}

function amountBasisLabel(basis: ApprovalFormState['amountBasis']) {
  if (basis === 'total') return '공급대가 기준'
  if (basis === 'exempt') return '면세'
  return '공급가액 기준'
}

function paymentTypeLabel(type: ApprovalFormState['paymentType']) {
  if (type === 'immediate') return '즉시 결제'
  if (type === 'recurring') return '정기 결제'
  return '—'
}

function buildSignoffHtml(form: ApprovalFormState) {
  const heads = form.signoffs
    .map((item) => `<th>${escapeHtml(item.label)}</th>`)
    .join('')
  const cells = form.signoffs
    .map((item) => {
      if (item.status === 'approved') {
        const when = String(item.approvedAt || '').trim()
        const dateOnly = when ? when.slice(0, 10) : '승인'
        return `<td class="signed"><span class="mark">✓</span><span class="when">${escapeHtml(dateOnly)}</span></td>`
      }
      return `<td class="pending"></td>`
    })
    .join('')

  return `<div class="signoff">
  <div class="signoff-label">결재</div>
  <table>
    <thead><tr>${heads}</tr></thead>
    <tbody><tr>${cells}</tr></tbody>
  </table>
</div>`
}

export function buildApprovalHtml(input: ApprovalPrintInput) {
  const { category, form } = input
  const docNumber = form.docNumber.trim() || '—'
  const categoryLabel = getApprovalCategoryLabel(category)
  const columns = getApprovalDetailColumns(category)
  const amountBasis = form.amountBasis || 'supply'
  const supplyAmount = computeApprovalSupplyAmount(form, category)
  const vatAmount = computeApprovalVatAmount(supplyAmount, category, form)
  const grandTotal = computeApprovalGrandTotal(form, category)
  const showAmountBasis = usesAmountBasisSelector(category)

  const rows = form.detailItems
    .map((item, index) => {
      const cells = columns
        .map((column) => {
          const align =
            column.key === 'amount' ||
            column.key === 'unitPrice' ||
            column.key === 'qty'
              ? 'num'
              : ''
          return `<td class="${align}">${formatDetailCell(item, column)}</td>`
        })
        .join('')
      return `<tr>
        <td class="c-no">${index + 1}</td>
        ${cells}
      </tr>`
    })
    .join('')

  const columnHeads = columns
    .map((column) => {
      const align =
        column.key === 'amount' || column.key === 'unitPrice' || column.key === 'qty'
          ? 'num'
          : ''
      return `<th class="${align}">${escapeHtml(column.label)}</th>`
    })
    .join('')

  const supplyLabel = category === 'duty-tax' ? '관세 합계' : '공급가액 합계'
  const vatLabel =
    category === 'duty-tax'
      ? '부가세 합계'
      : `부가세 (${amountBasis === 'exempt' ? '0%' : '10%'})`
  const grandLabel =
    category === 'duty-tax'
      ? '합계금액 (관세+부가세)'
      : amountBasis === 'exempt'
        ? '공급대가 (면세)'
        : '공급대가 (VAT 포함)'

  const subject = form.subject.trim() || '—'
  const intro = form.introBody.trim()
  const paymentMethod = form.paymentMethod.trim()
  const processingDate = form.processingDate.trim()

  const paymentDetailHtml =
    form.paymentType === 'immediate' && paymentMethod
      ? `<div class="payment-detail">${escapeHtml(paymentMethod).replaceAll('\n', '<br/>')}</div>`
      : ''

  const introHtml = intro
    ? `<div class="body-box">${escapeHtml(intro).replaceAll('\n', '<br/>')}</div>`
    : `<div class="body-box muted">본문 없음</div>`

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>품의서 ${escapeHtml(docNumber)}</title><style>
@page { size: A4 portrait; margin: 12mm 11mm; }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0;
  padding: 0;
  color: #1e293b;
  background: #fff;
  font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  font-size: 12px;
  line-height: 1.5;
}
.sheet { padding: 1mm; background: #fff; }
.letterhead {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 2px solid #cbd5e1;
}
.doc-title { text-align: left; }
.doc-title .en { font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.12em; }
.doc-title h1 {
  margin: 4px 0 0;
  font-size: 28px;
  font-weight: 800;
  color: #334155;
  letter-spacing: 0.35em;
}
.doc-title .no { margin-top: 6px; font-size: 13px; font-weight: 700; color: #475569; }
.doc-title .cat { margin-top: 3px; font-size: 12px; font-weight: 600; color: #64748b; }
.signoff {
  display: flex;
  align-items: stretch;
  border: 1.5px solid #94a3b8;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
  flex-shrink: 0;
}
.signoff-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.25em;
  color: #475569;
  background: #f1f5f9;
  border-right: 1px solid #cbd5e1;
}
.signoff table { border-collapse: collapse; }
.signoff th {
  min-width: 64px;
  padding: 6px 8px;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  text-align: center;
}
.signoff th:last-child { border-right: none; }
.signoff td {
  height: 58px;
  padding: 6px;
  border-top: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  text-align: center;
  vertical-align: middle;
}
.signoff td:last-child { border-right: none; }
.signoff td.signed .mark {
  display: block;
  font-size: 18px;
  font-weight: 800;
  color: #1d4ed8;
  line-height: 1;
}
.signoff td.signed .when {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  color: #64748b;
}
.meta-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.meta-bar .cell {
  padding: 9px 11px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
}
.meta-bar .cell strong {
  display: block;
  margin-bottom: 3px;
  color: #64748b;
  font-size: 11px;
  letter-spacing: 0.04em;
}
.meta-bar .cell span { font-weight: 700; color: #0f172a; font-size: 13px; }
.subject-box {
  margin-bottom: 12px;
  padding: 11px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #f8fafc;
}
.subject-box .label {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.08em;
}
.subject-box .value { font-size: 16px; font-weight: 800; color: #0f172a; }
.section-title {
  margin: 14px 0 7px;
  font-size: 12px;
  font-weight: 800;
  color: #475569;
  letter-spacing: 0.12em;
}
.body-box {
  padding: 11px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  color: #334155;
  white-space: pre-wrap;
  min-height: 64px;
  line-height: 1.55;
}
.body-box.muted { color: #94a3b8; }
.divider {
  margin: 16px 0 12px;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.45em;
  color: #94a3b8;
}
.basis {
  margin-bottom: 7px;
  font-size: 12px;
  color: #64748b;
}
.basis strong { color: #334155; }
table.items { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
table.items th, table.items td {
  border: 1px solid #cbd5e1;
  padding: 8px 9px;
  vertical-align: middle;
}
table.items th {
  background: #f1f5f9;
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  text-align: center;
}
table.items td { font-size: 12px; color: #0f172a; }
table.items td.c-no { width: 34px; text-align: center; color: #64748b; }
table.items td.num, table.items th.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.totals {
  display: flex;
  justify-content: flex-end;
  gap: 20px;
  margin-top: 2px;
  margin-bottom: 8px;
  padding: 10px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #f8fafc;
  font-size: 13px;
  color: #475569;
}
.totals strong { color: #0f172a; font-variant-numeric: tabular-nums; font-size: 13px; }
.grand {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
  padding: 12px 16px;
  border: 1.5px solid #64748b;
  border-radius: 4px;
  background: #fff;
}
.grand .label { font-size: 14px; font-weight: 800; color: #334155; }
.grand .value {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}
.payment-box {
  padding: 11px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #fff;
}
.payment-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 22px;
  font-size: 13px;
  color: #475569;
}
.payment-meta strong { color: #0f172a; }
.payment-detail {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
  font-size: 12px;
  color: #334155;
  white-space: pre-wrap;
  line-height: 1.5;
}
.footer {
  margin-top: 18px;
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #94a3b8;
}
</style></head><body><div class="sheet">
  <div class="letterhead">
    <div class="doc-title">
      <div class="en">APPROVAL REQUEST</div>
      <h1>품의서</h1>
      <div class="no">문서번호 ${escapeHtml(docNumber)}</div>
      <div class="cat">${escapeHtml(categoryLabel)}</div>
    </div>
    ${buildSignoffHtml(form)}
  </div>

  <div class="meta-bar">
    <div class="cell"><strong>카테고리</strong><span>${escapeHtml(categoryLabel)}</span></div>
    <div class="cell"><strong>작성일자</strong><span>${dash(form.writtenDate)}</span></div>
    <div class="cell"><strong>작성부서</strong><span>${dash(form.department)}</span></div>
    <div class="cell"><strong>작성자</strong><span>${dash(form.author)}</span></div>
  </div>

  <div class="subject-box">
    <div class="label">제목</div>
    <div class="value">${escapeHtml(subject)}</div>
  </div>

  <div class="section-title">본문</div>
  ${introHtml}

  <div class="divider">— 다 음 —</div>

  <div class="section-title">1. 상세 내역</div>
  ${
    showAmountBasis
      ? `<div class="basis">금액 기준 <strong>${escapeHtml(amountBasisLabel(amountBasis))}</strong></div>`
      : ''
  }
  <table class="items">
    <thead>
      <tr>
        <th>No</th>
        ${columnHeads}
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="${columns.length + 1}" style="text-align:center;color:#94a3b8;">내역 없음</td></tr>`}</tbody>
  </table>

  <div class="totals">
    <div>${escapeHtml(supplyLabel)} <strong>${escapeHtml(formatApprovalMoney(supplyAmount))}</strong></div>
    <div>${escapeHtml(vatLabel)} <strong>${escapeHtml(formatApprovalMoney(vatAmount))}</strong></div>
  </div>
  <div class="grand">
    <span class="label">${escapeHtml(grandLabel)}</span>
    <span class="value">${escapeHtml(formatApprovalMoney(grandTotal))}</span>
  </div>

  <div class="section-title">2. 결제 방법</div>
  <div class="payment-box">
    <div class="payment-meta">
      <div>결제구분 <strong>${escapeHtml(paymentTypeLabel(form.paymentType))}</strong></div>
      <div>처리일자 <strong>${dash(processingDate)}</strong></div>
    </div>
    ${paymentDetailHtml}
  </div>

  <div class="footer">
    <span>${escapeHtml(APP_SHORT_NAME)} 품의서</span>
    <span>${escapeHtml(docNumber)}</span>
  </div>
</div></body></html>`
}

export function printApproval(input: ApprovalPrintInput) {
  if (typeof document === 'undefined') return false

  const html = buildApprovalHtml(input)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', '품의서 인쇄')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
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
