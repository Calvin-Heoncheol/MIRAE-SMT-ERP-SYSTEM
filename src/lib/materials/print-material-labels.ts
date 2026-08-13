export type MaterialLabelPrintItem = {
  id: string
  materialName: string
  mpn: string
  /** 라벨 매수 (기본 1) */
  copies?: number
}

export type PrintMaterialLabelsOptions = {
  title?: string
  /** 라벨 한 장 크기 (mm) — 기본 40×30 */
  widthMm?: number
  heightMm?: number
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
  const labels: { id: string; name: string; mpn: string }[] = []

  for (const item of items) {
    const copies = Math.max(1, Math.floor(Number(item.copies) || 1))
    const id = item.id.trim()
    if (!id) continue

    const name = truncateText(item.materialName, 22)
    const mpn = truncateText(item.mpn, 28)

    for (let index = 0; index < copies; index += 1) {
      labels.push({ id, name, mpn })
    }
  }

  return labels
    .map(
      (label, index) => `
    <section class="label" data-index="${index}">
      <svg class="barcode" data-code="${escapeHtml(label.id)}"></svg>
      <p class="label-id">${escapeHtml(label.id)}</p>
      ${label.name ? `<p class="label-name">${escapeHtml(label.name)}</p>` : ''}
      ${label.mpn ? `<p class="label-mpn">${escapeHtml(label.mpn)}</p>` : ''}
    </section>`,
    )
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
      padding: 1.5mm 2mm 1mm;
      border: 0.2mm dashed #cbd5e1;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .barcode {
      width: 100%;
      height: 11mm;
    }
    .label-id {
      font-family: ui-monospace, Consolas, monospace;
      font-size: 9pt;
      font-weight: 700;
      line-height: 1.1;
      text-align: center;
      word-break: break-all;
    }
    .label-name {
      width: 100%;
      font-size: 6.5pt;
      line-height: 1.15;
      text-align: center;
      color: #334155;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .label-mpn {
      width: 100%;
      font-family: ui-monospace, Consolas, monospace;
      font-size: 5.5pt;
      line-height: 1.1;
      text-align: center;
      color: #64748b;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
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
            width: 1.4,
            height: 36,
            displayValue: false,
            margin: 0,
          });
        } catch (error) {
          console.error(error);
        }
      });
      window.setTimeout(function () {
        if (window.opener) window.focus();
      }, 300);
    })();
  <\/script>
</body>
</html>`
}

/** 자재 ID 바코드 라벨을 새 창에서 미리보기 후 인쇄한다. */
export function printMaterialLabels(
  items: MaterialLabelPrintItem[],
  options: PrintMaterialLabelsOptions = {},
) {
  const labelsHtml = buildLabelHtml(items)
  if (!labelsHtml) {
    window.alert('출력할 자재코드가 없습니다.')
    return
  }

  const labelCount = labelsHtml.split('class="label"').length - 1
  const html = buildPrintHtml(labelsHtml, options, labelCount)
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=720,height=720')

  if (!printWindow) {
    window.alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요.')
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
