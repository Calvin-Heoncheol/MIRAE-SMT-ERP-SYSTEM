import { APP_SHORT_NAME, COMPANY_ADDRESS_STATEMENT, COMPANY_NAME_DOMESTIC_EN } from '@/lib/app-config'
import { escapeHtml } from '@/lib/print/escape-html'

export type InspectionJudgement = 'pass' | 'fail'

export type InspectionItem = {
  title: string
  titleEn: string
  specification: string
  method: string
  judgement: InspectionJudgement
  remark: string
}

export type InspectionCertificate = {
  customer: string
  issueDate: string
  manager: string
  docNo: string
  productName: string
  partNumber: string
  shipmentQty: number
  inspectionQty: number
  items: InspectionItem[]
  notes: string
  inspector: string
  qaManager: string
}

export const DEFAULT_INSPECTION_NOTES = `상기 제품은 당사(${APP_SHORT_NAME})의 품질 규정에 따라 SMT 실장 및 조립 공정 검사를 철저히 완료하였음을 증명합니다.`

export function defaultInspectionItems(): InspectionItem[] {
  return [
    {
      title: '외관 및 실장 상태',
      titleEn: 'Appearance & Placement',
      specification: '부품 오배치, 크랙, 파손, 변색 및 이물질 부착 없을 것',
      method: 'AOI / Visual',
      judgement: 'pass',
      remark: '',
    },
    {
      title: '솔더 페이스트 및 인쇄 패턴',
      titleEn: 'Solder Paste Printing',
      specification: '도포 상태 균일, 쇼트(브릿지) 및 부족 현상 없을 것',
      method: 'SPI',
      judgement: 'pass',
      remark: '',
    },
    {
      title: '솔더링 (납땜) 상태',
      titleEn: 'Soldering',
      specification: '적정 필렛 형성, 냉납·과다·과소 납땜 없을 것',
      method: 'AOI',
      judgement: 'pass',
      remark: '',
    },
    {
      title: '극성 및 방향성 확인',
      titleEn: 'Polarity & Orientation',
      specification: '다이오드, IC 등 실장 방향(1번 핀 등)이 회로도와 일치할 것',
      method: 'AOI',
      judgement: 'pass',
      remark: '',
    },
    {
      title: '부품 사양 및 파번 대조',
      titleEn: 'Part Number Verification',
      specification: '실장된 부품의 파번(Part No.) 및 마킹 값이 BOM과 일치할 것',
      method: 'Visual',
      judgement: 'pass',
      remark: '',
    },
    {
      title: '기판 물리적 상태',
      titleEn: 'PCB Physical Condition',
      specification: '기판 스크래치, 휨(Warpage), 패턴 손상 및 불량이 없을 것',
      method: 'Visual',
      judgement: 'pass',
      remark: '',
    },
  ]
}

/** 출하번호(또는 작성일자) 기준 문서번호 — 화면에서 수정 가능 */
export function buildInspectionDocNo(shipmentId: string, issueDate: string) {
  const base = String(shipmentId || '').trim() || String(issueDate || '').replace(/-/g, '')
  return base ? `MS-QC-${base}` : 'MS-QC-'
}

export function isInspectionCertificatePassed(certificate: InspectionCertificate) {
  return certificate.items.every((item) => item.judgement === 'pass')
}

function formatCertificateDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim())
  if (!match) return '20&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;.'
  return `${match[1]}. ${match[2]}. ${match[3]}.`
}

function formatQty(value: number) {
  return Number.isFinite(value) && value > 0 ? value.toLocaleString('ko-KR') : '&nbsp;'
}

function textOrBlank(value: string) {
  const text = String(value || '').trim()
  return text ? escapeHtml(text) : '&nbsp;'
}

function judgementHtml(judgement: InspectionJudgement) {
  const box = (checked: boolean) => (checked ? '■' : '□')
  return `<div class="judge${judgement === 'fail' ? ' judge-fail' : ''}">
      <span>${box(judgement === 'pass')} 합격</span>
      <span>${box(judgement === 'fail')} 불합격</span>
    </div>`
}

export function buildInspectionCertificateHtml(certificate: InspectionCertificate) {
  const itemRows = certificate.items
    .map(
      (item, index) => `<tr>
        <td class="c-center">${index + 1}</td>
        <td class="c-item">${escapeHtml(item.title)}<span class="sub">${escapeHtml(item.titleEn)}</span></td>
        <td>${escapeHtml(item.specification)}${item.method ? ` <span class="method">(${escapeHtml(item.method)})</span>` : ''}</td>
        <td class="c-center">${judgementHtml(item.judgement)}</td>
        <td>${textOrBlank(item.remark)}</td>
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      font-size: 11.5px;
      line-height: 1.45;
    }
    .title { text-align: center; margin-bottom: 18px; }
    .title h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5em; }
    .title p { margin: 4px 0 0; font-size: 13px; font-weight: 700; letter-spacing: 0.2em; color: #334155; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #334155; padding: 7px 8px; vertical-align: middle; }
    th { background: #f1f5f9; font-weight: 700; text-align: center; white-space: nowrap; }
    th .sub, td .sub { display: block; font-size: 9.5px; font-weight: 500; color: #64748b; }
    .info th { width: 15%; }
    .info td { width: 35%; }
    .section { margin: 18px 0 6px; font-size: 13px; font-weight: 800; }
    .c-center { text-align: center; }
    .c-qty { text-align: right; font-weight: 700; }
    .items th:nth-child(1) { width: 6%; }
    .items th:nth-child(2) { width: 24%; }
    .items th:nth-child(4) { width: 14%; }
    .items th:nth-child(5) { width: 14%; }
    .c-item { font-weight: 700; }
    .method { color: #475569; font-size: 10.5px; }
    .judge { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: fit-content; margin: 0 auto; }
    .judge-fail span:last-child { color: #b91c1c; font-weight: 700; }
    .notes { margin-top: 18px; border: 1px solid #334155; padding: 12px; min-height: 64px; }
    .notes b { display: block; margin-bottom: 4px; }
    .sign { margin-top: 24px; }
    .sign td { height: 64px; vertical-align: bottom; text-align: right; color: #475569; }
    .sign th { width: 50%; }
  </style>
</head>
<body>
  <div class="title">
    <h1>출하검사성적서</h1>
    <p>INSPECTION CERTIFICATE</p>
  </div>

  <table class="info">
    <tr>
      <th>공급자<span class="sub">Supplier</span></th>
      <td>${escapeHtml(APP_SHORT_NAME)} (${escapeHtml(COMPANY_NAME_DOMESTIC_EN)})</td>
      <th>고객사<span class="sub">Client</span></th>
      <td>${textOrBlank(certificate.customer)}</td>
    </tr>
    <tr>
      <th>주소<span class="sub">Address</span></th>
      <td>${escapeHtml(COMPANY_ADDRESS_STATEMENT)}</td>
      <th>작성일자<span class="sub">Date</span></th>
      <td>${formatCertificateDate(certificate.issueDate)}</td>
    </tr>
    <tr>
      <th>담당자<span class="sub">Manager</span></th>
      <td>${textOrBlank(certificate.manager)}</td>
      <th>문서번호<span class="sub">Doc No.</span></th>
      <td>${textOrBlank(certificate.docNo)}</td>
    </tr>
  </table>

  <table class="info" style="margin-top:10px;">
    <tr>
      <th>품명<span class="sub">Product Name</span></th>
      <th>품번<span class="sub">Part Number</span></th>
      <th>출하 수량<span class="sub">Shipment Qty</span></th>
      <th>검사 수량<span class="sub">Insp. Qty</span></th>
    </tr>
    <tr>
      <td class="c-center">${textOrBlank(certificate.productName)}</td>
      <td class="c-center">${textOrBlank(certificate.partNumber)}</td>
      <td class="c-qty">${formatQty(certificate.shipmentQty)} PCS</td>
      <td class="c-qty">${formatQty(certificate.inspectionQty)} PCS</td>
    </tr>
  </table>

  <p class="section">■ SMT 및 조립 검사 항목 (Inspection Items)</p>
  <table class="items">
    <thead>
      <tr>
        <th>No.</th>
        <th>검사 항목<span class="sub">Inspection Item</span></th>
        <th>판정 기준<span class="sub">Specification</span></th>
        <th>판정<span class="sub">Result</span></th>
        <th>비고<span class="sub">Remarks</span></th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="notes">
    <b>특기사항 (Notes)</b>
    ${textOrBlank(certificate.notes).replace(/\n/g, '<br>')}
  </div>

  <table class="sign">
    <tr>
      <th>품질 검사자<span class="sub">Inspector</span></th>
      <th>품질 책임자<span class="sub">QA Manager</span></th>
    </tr>
    <tr>
      <td>${certificate.inspector.trim() ? `${escapeHtml(certificate.inspector.trim())}&nbsp;&nbsp;` : ''}(서명 또는 인)</td>
      <td>${certificate.qaManager.trim() ? `${escapeHtml(certificate.qaManager.trim())}&nbsp;&nbsp;` : ''}(서명 또는 인)</td>
    </tr>
  </table>
</body>
</html>`
}

export function buildInspectionCertificateFileTitle(certificate: InspectionCertificate) {
  const parts = ['출하검사성적서', certificate.customer, certificate.productName, certificate.issueDate]
    .map((part) => String(part || '').replace(/[\\/:*?"<>|]/g, '_').trim())
    .filter(Boolean)
  return parts.join('_').slice(0, 150)
}
