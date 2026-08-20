export type MaterialLabelPrintItem = {
  id: string
  materialName: string
  customer?: string
  package?: string
  specification?: string
  /** 내부 자재 LOT (MRL-…). 있으면 품목코드 아래에 LOT 바코드를 넣는다 */
  lotNumber?: string
  /** 라벨 매수 (기본 1) */
  copies?: number
}

export type PrintMaterialLabelsOptions = {
  title?: string
  /** 라벨 한 장 크기 (mm) — 기본 40×30 */
  widthMm?: number
  heightMm?: number
  /** true면 창을 연 뒤 인쇄 대화상자를 바로 연다 */
  autoPrint?: boolean
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1)}…`
}

function buildLabelHtml(items: MaterialLabelPrintItem[]) {
  const labels: {
    id: string
    lotNumber: string
    lotLabel: string
    customer: string
    name: string
    spec: string
    pkg: string
  }[] = []

  for (const item of items) {
    const copies = Math.max(1, Math.floor(Number(item.copies) || 1))
    const id = item.id.trim()
    if (!id) continue

    const customer = truncateText(item.customer || '', 18)
    const name = truncateText(item.materialName, 22)
    const spec = truncateText(item.specification || '', 24)
    const pkg = truncateText(item.package || '', 18)
    const lotNumber = item.lotNumber?.trim() || ''
    const lotLabel = truncateText(lotNumber, 28)

    for (let index = 0; index < copies; index += 1) {
      labels.push({ id, lotNumber, lotLabel, customer, name, spec, pkg })
    }
  }

  return labels
    .map((label, index) => {
      const lotBlock = label.lotNumber
        ? `
      <div class="label-lot-wrap">
        <div class="lot-qr" data-code="${escapeHtml(label.lotNumber)}"></div>
        <p class="label-lot">${escapeHtml(label.lotLabel)}</p>
      </div>`
        : ''
      return `
    <section class="label" data-index="${index}">
      <div class="label-head">
        ${label.name ? `<p class="label-name">${escapeHtml(label.name)}</p>` : ''}
        ${label.spec ? `<p class="label-spec">${escapeHtml(label.spec)}</p>` : ''}
      </div>
      <div class="label-barcode">
        <svg class="barcode barcode-pn" data-code="${escapeHtml(label.id)}"></svg>
        <p class="label-id">${escapeHtml(label.id)}</p>
      </div>
      ${lotBlock}
    </section>`
    })
    .join('')
}

function buildPrintHtml(
  labelsHtml: string,
  options: PrintMaterialLabelsOptions,
  labelCount: number,
) {
  const widthMm = options.widthMm ?? 40
  const heightMm = options.heightMm ?? 30
  const title = escapeHtml(options.title ?? '자재 바코드 라벨')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      color: #111;
      background: #f8fafc;
    }
    .no-print {
      padding: 12px 16px;
      background: #1e293b;
      color: #f8fafc;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .no-print button {
      border: none;
      border-radius: 8px;
      background: #fff;
      color: #1e293b;
      font-weight: 700;
      font-size: 13px;
      padding: 8px 14px;
      cursor: pointer;
    }
    .labels {
      padding: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .label {
      width: ${widthMm}mm;
      height: ${heightMm}mm;
      padding: 1mm 1.6mm 0.8mm;
      border: 0.2mm dashed #cbd5e1;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .label-head {
      flex-shrink: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.2mm;
      margin-bottom: 0.4mm;
    }
    .label-barcode {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }
    .barcode-pn {
      width: 100%;
      height: 9.2mm;
    }
    .label-lot-wrap {
      width: 100%;
      margin-top: auto;
      padding-top: 0.5mm;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 1.2mm;
    }
    .lot-qr {
      width: 8.8mm;
      height: 8.8mm;
      flex-shrink: 0;
    }
    .lot-qr svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .label-id,
    .label-lot {
      font-family: ui-monospace, Consolas, monospace;
      font-weight: 700;
      line-height: 1.05;
      word-break: break-all;
    }
    .label-id {
      font-size: 7pt;
      text-align: center;
    }
    .label-lot {
      min-width: 0;
      flex: 1;
      font-size: 6pt;
      text-align: left;
      color: #0f172a;
    }
    .label-name,
    .label-spec {
      width: 100%;
      text-align: center;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .label-name {
      font-size: 6.5pt;
      font-weight: 700;
      line-height: 1.1;
      color: #111;
    }
    .label-spec {
      font-size: 5.5pt;
      line-height: 1.1;
      color: #334155;
    }
    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
      .labels {
        padding: 0;
        gap: 0;
        display: block;
      }
      .label {
        border: none;
        margin: 0;
        page-break-after: always;
      }
      .label:last-child {
        page-break-after: auto;
      }
      @page {
        size: ${widthMm}mm ${heightMm}mm;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <span>총 ${labelCount.toLocaleString('ko-KR')}장 · 라벨 ${widthMm}×${heightMm}mm</span>
    <span>프린터에서 라벨 용지 크기를 맞춘 뒤 인쇄하세요.</span>
    <button type="button" onclick="window.print()">인쇄</button>
  </div>
  <div class="labels">
    ${labelsHtml}
  </div>
  <script>
    (function () {
      var nodes = document.querySelectorAll('.barcode');
      nodes.forEach(function (node) {
        var code = node.getAttribute('data-code') || '';
        if (!code || typeof JsBarcode === 'undefined') return;
        try {
          JsBarcode(node, code, {
            format: 'CODE128',
            width: 1.35,
            height: 40,
            displayValue: false,
            margin: 0,
          });
        } catch (error) {
          console.error(error);
        }
      });
      var lots = document.querySelectorAll('.lot-qr');
      lots.forEach(function (node) {
        var code = node.getAttribute('data-code') || '';
        if (!code || typeof qrcode === 'undefined') return;
        try {
          var qr = qrcode(0, 'M');
          qr.addData(code);
          qr.make();
          node.innerHTML = qr.createSvgTag(2, 0);
        } catch (error) {
          console.error(error);
        }
      });
      window.setTimeout(function () {
        window.focus();
      }, 50);
    })();
  <\/script>
</body>
</html>`
}

/** 품목코드 바코드 라벨을 iframe으로 인쇄한다. (팝업 불필요) */
export function printMaterialLabels(
  items: MaterialLabelPrintItem[],
  options: PrintMaterialLabelsOptions = {},
) {
  if (typeof document === 'undefined') return

  const labelsHtml = buildLabelHtml(items)
  if (!labelsHtml) {
    window.alert('출력할 자재코드가 없습니다.')
    return
  }

  const labelCount = labelsHtml.split('class="label"').length - 1
  const html = buildPrintHtml(labelsHtml, options, labelCount)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', options.title ?? '자재 바코드 라벨')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
  document.body.appendChild(iframe)

  const frameWindow = iframe.contentWindow
  const frameDoc = iframe.contentDocument
  if (!frameWindow || !frameDoc) {
    iframe.remove()
    window.alert('라벨 인쇄를 시작하지 못했습니다. 다시 시도해 주세요.')
    return
  }

  frameDoc.open()
  frameDoc.write(html)
  frameDoc.close()

  const cleanup = () => iframe.remove()
  window.setTimeout(cleanup, 120_000)

  const triggerPrint = () => {
    frameWindow.focus()
    frameWindow.print()
  }

  if (frameDoc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 600)
  } else {
    iframe.addEventListener('load', () => window.setTimeout(triggerPrint, 600), { once: true })
  }
}

/** 입고 스캔 직후 해당 릴 라벨 1장 */
export function printInboundReelLabel(item: MaterialLabelPrintItem) {
  printMaterialLabels([{ ...item, copies: 1 }], {
    autoPrint: true,
    title: '자재 바코드 라벨',
  })
}
