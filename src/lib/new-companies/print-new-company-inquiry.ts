import { APP_SHORT_NAME } from '@/lib/app-config'
import {
  NEW_COMPANY_STATUS_LABELS,
  type NewCompanyInquiry,
  type NewCompanyStatus,
} from '@/lib/new-companies/types'

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

function formatCreatedAt(value: string) {
  const raw = String(value || '').trim()
  if (!raw) return '—'
  return escapeHtml(raw.slice(0, 10))
}

/** 화면 뱃지와 동일한 톤 (인쇄용 inline color) */
const STATUS_BADGE_STYLE: Record<NewCompanyStatus, string> = {
  received: 'background:#f1f5f9;color:#334155;border-color:#e2e8f0;',
  in_progress: 'background:#f0f9ff;color:#075985;border-color:#bae6fd;',
  converted: 'background:#ecfdf5;color:#065f46;border-color:#a7f3d0;',
  closed: 'background:#fff1f2;color:#be123c;border-color:#fecdd3;',
}

function statusBadgeHtml(status: NewCompanyStatus) {
  const label = NEW_COMPANY_STATUS_LABELS[status] || status
  const style = STATUS_BADGE_STYLE[status] || STATUS_BADGE_STYLE.received
  return `<span class="badge" style="${style}">${escapeHtml(label)}</span>`
}

export function buildNewCompanyInquiryListHtml(inquiries: NewCompanyInquiry[]) {
  const printedAt = new Date().toLocaleString('ko-KR', { hour12: false })
  const titleDate = new Date().toISOString().slice(0, 10)
  const count = inquiries.length

  const rows =
    inquiries.length === 0
      ? `<tr><td colspan="10" class="empty">표시할 문의업체가 없습니다.</td></tr>`
      : inquiries
          .map((inquiry, index) => {
            return `<tr>
        <td class="c-no">${index + 1}</td>
        <td class="c-date">${formatCreatedAt(inquiry.createdAt)}</td>
        <td>${dash(inquiry.companyName)}</td>
        <td>${dash(inquiry.region)}</td>
        <td>${dash(inquiry.contactName)}</td>
        <td>${dash(inquiry.email)}</td>
        <td class="c-phone">${dash(inquiry.phone)}</td>
        <td>${dash(inquiry.product)}</td>
        <td>${dash(inquiry.sourceChannel)}</td>
        <td class="c-status">${statusBadgeHtml(inquiry.status)}</td>
      </tr>`
          })
          .join('')

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"/>
<title>문의업체_목록_${escapeHtml(titleDate)}</title><style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #0f172a;
    font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
    font-size: 11px;
    line-height: 1.35;
  }
  h1 {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 700;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
    margin-bottom: 12px;
    color: #475569;
    font-size: 11px;
  }
  .meta strong { color: #0f172a; font-weight: 600; }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 5px 6px;
    vertical-align: middle;
    word-break: break-word;
  }
  th {
    background: #f1f5f9;
    font-weight: 700;
    text-align: center;
  }
  td.c-no, td.c-date, td.c-phone, td.c-status,
  th.c-no, th.c-date, th.c-phone {
    text-align: center;
    white-space: nowrap;
  }
  td.c-no { width: 28px; }
  td.empty {
    text-align: center;
    color: #94a3b8;
    padding: 24px 8px;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.4;
    white-space: nowrap;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    color: #64748b;
    font-size: 10px;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
  <h1>문의업체 목록</h1>
  <div class="meta">
    <div>건수 <strong>${count.toLocaleString('ko-KR')}</strong></div>
    <div>출력일시 <strong>${escapeHtml(printedAt)}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="c-no">No</th>
        <th class="c-date">등록일</th>
        <th>회사명</th>
        <th>지역</th>
        <th>담당자</th>
        <th>이메일</th>
        <th class="c-phone">연락처</th>
        <th>제품</th>
        <th>유입경로</th>
        <th>상태</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <span>${escapeHtml(APP_SHORT_NAME)} · 문의업체</span>
    <span>${count.toLocaleString('ko-KR')}건</span>
  </div>
</body></html>`
}

export function printNewCompanyInquiryList(inquiries: NewCompanyInquiry[]) {
  if (typeof document === 'undefined') return false

  const html = buildNewCompanyInquiryListHtml(inquiries)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', '문의업체 목록 인쇄')
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
