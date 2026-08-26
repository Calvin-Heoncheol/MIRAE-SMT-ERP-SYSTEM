import { buildMaterialLabelsZpl } from '@/lib/materials/build-material-label-zpl'
import { getLabelPrintSettings } from '@/lib/materials/label-print-settings'
import { sendZplViaBrowserPrint } from '@/lib/materials/zebra-browser-print'

export type MaterialLabelPrintItem = {
  id: string
  materialName: string
  customer?: string
  package?: string
  specification?: string
  /** 내부 자재 LOT (MRL-…). 있으면 라벨에 표시 */
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
  /** false면 Browser Print(ZPL)를 건너뛰고 브라우저 인쇄만 사용 */
  preferBrowserPrint?: boolean
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
    name: string
    specLine: string
    lotNumber: string
  }[] = []

  for (const item of items) {
    const copies = Math.max(1, Math.floor(Number(item.copies) || 1))
    const id = item.id.trim()
    if (!id) continue

    const name = truncateText(item.materialName, 22)
    const specLine = truncateText(
      [item.specification || '', item.package || ''].map((v) => v.trim()).filter(Boolean).join(', '),
      32,
    )
    const lotNumber = truncateText(String(item.lotNumber || '').trim(), 28)

    for (let index = 0; index < copies; index += 1) {
      labels.push({ id, name, specLine, lotNumber })
    }
  }

  return labels
    .map(
      (label, index) => `
    <section class="label" data-index="${index}">
      <div class="label-head">
        ${label.name ? `<p class="label-name">${escapeHtml(label.name)}</p>` : ''}
        ${label.specLine ? `<p class="label-spec">${escapeHtml(label.specLine)}</p>` : ''}
      </div>
      <div class="label-barcode">
        <svg class="barcode barcode-pn" data-code="${escapeHtml(label.id)}"></svg>
        <p class="label-id">${escapeHtml(label.id)}</p>
        ${
          label.lotNumber
            ? `<p class="label-lot">LOT ${escapeHtml(label.lotNumber)}</p>`
            : ''
        }
      </div>
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
  const scale = Math.min(Math.max(Math.min(widthMm / 40, heightMm / 30), 0.4), 2)
  const namePt = Math.max(6, 7.2 * scale)
  const specPt = Math.max(5.5, 6.5 * scale)
  const idPt = Math.max(7, 8.5 * scale)
  const lotPt = Math.max(5.5, 6.2 * scale)
  const barcodeMm = Math.max(3.5, Math.min(heightMm * 0.28, 11 * scale))
  const barcodeBarWidth = Math.max(1.2, Number((1.55 * scale).toFixed(2)))

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
      padding: ${Math.max(0.5, 1 * scale)}mm ${Math.max(0.8, 1.4 * scale)}mm;
      border: 0.2mm dashed #cbd5e1;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .label-head {
      flex-shrink: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2mm;
      margin-bottom: 0.4mm;
      text-align: center;
    }
    .label-barcode {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 0;
    }
    .barcode-pn {
      width: 100%;
      height: ${barcodeMm}mm;
    }
    .label-id {
      font-family: ui-monospace, Consolas, monospace;
      font-weight: 800;
      line-height: 1.05;
      word-break: break-all;
      font-size: ${idPt}pt;
      letter-spacing: 0.02em;
      text-align: center;
      margin-top: 0.4mm;
      -webkit-font-smoothing: none;
      text-rendering: geometricPrecision;
    }
    .label-lot {
      font-family: ui-monospace, Consolas, monospace;
      font-weight: 700;
      line-height: 1.05;
      word-break: break-all;
      font-size: ${lotPt}pt;
      letter-spacing: 0.01em;
      text-align: center;
      margin-top: 0.25mm;
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
      font-size: ${namePt}pt;
      font-weight: 700;
      line-height: 1.1;
      color: #111;
    }
    .label-spec {
      font-size: ${specPt}pt;
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
      var barHeight = ${Math.round(barcodeMm * 3.78)};
      nodes.forEach(function (node) {
        var code = node.getAttribute('data-code') || '';
        if (!code || typeof JsBarcode === 'undefined') return;
        try {
          JsBarcode(node, code, {
            format: 'CODE128',
            width: ${barcodeBarWidth},
            height: barHeight,
            displayValue: false,
            margin: 0,
            marginLeft: 0,
            marginRight: 0,
          });
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
export function printMaterialLabelsHtml(
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

/**
 * Browser Print(ZPL) 우선, 실패 시 브라우저 인쇄로 폴백.
 * `preferBrowserPrint: false` 이면 항상 HTML 인쇄.
 */
export async function printMaterialLabels(
  items: MaterialLabelPrintItem[],
  options: PrintMaterialLabelsOptions = {},
): Promise<'zpl' | 'html'> {
  const printable = items.filter((item) => item.id.trim())
  if (!printable.length) {
    window.alert('출력할 자재코드가 없습니다.')
    return 'html'
  }

  const settings = getLabelPrintSettings()
  const widthMm = options.widthMm ?? settings.widthMm
  const heightMm = options.heightMm ?? settings.heightMm
  const preferBrowserPrint =
    options.preferBrowserPrint !== undefined
      ? options.preferBrowserPrint
      : settings.preferBrowserPrint

  if (preferBrowserPrint) {
    const zpl = buildMaterialLabelsZpl(printable, {
      widthMm,
      heightMm,
      dpi: settings.dpi,
    })
    if (zpl) {
      const result = await sendZplViaBrowserPrint(zpl)
      if (result.ok) return 'zpl'
      // 에이전트/프린터가 없으면 조용히 HTML 폴백. 전송 실패만 안내.
      if (result.reason === 'write') {
        const useHtml = window.confirm(
          `라벨 프린터 전송에 실패했습니다.\n${result.detail}\n\n브라우저 인쇄창으로 대신 출력할까요?`,
        )
        if (!useHtml) return 'html'
      }
    }
  }

  printMaterialLabelsHtml(printable, { ...options, widthMm, heightMm })
  return 'html'
}

/** 입고 수량 확정 후 해당 릴 라벨 1장 (ZPL 우선) */
export async function printInboundReelLabel(item: MaterialLabelPrintItem) {
  return printMaterialLabels([{ ...item, copies: 1 }], {
    autoPrint: true,
    title: '자재 바코드 라벨',
  })
}
