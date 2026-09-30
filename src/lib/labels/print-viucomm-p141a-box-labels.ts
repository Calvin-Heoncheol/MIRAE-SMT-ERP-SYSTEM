import { getLabelPrintSettings } from '@/lib/materials/label-print-settings'
import { sendZplViaBrowserPrint } from '@/lib/materials/zebra-browser-print'
import {
  VIUCOMM_P141A_BOX_LABEL,
  buildViucommP141aBoxLabelsZpl,
  renderViucommP141aBoxLabelDataUrl,
  type ViucommPrintLayout,
} from './viucomm-p141a-box-label'

function printImagesHtml(serials: string[], copies: number, layout: ViucommPrintLayout) {
  const { widthMm: designWidthMm, heightMm: designHeightMm } = VIUCOMM_P141A_BOX_LABEL
  const pageWidthMm = Math.max(designWidthMm, layout.widthMm)
  const pageHeightMm = Math.max(designHeightMm, layout.heightMm)
  const left = (pageWidthMm - designWidthMm) / 2 + (layout.offsetXMm ?? 0)
  const top = Math.max(0, (pageHeightMm - designHeightMm) / 2 + (layout.offsetYMm ?? 0))

  const images: string[] = []
  for (const serial of serials) {
    const src = renderViucommP141aBoxLabelDataUrl(serial)
    for (let i = 0; i < copies; i += 1) images.push(src)
  }

  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8" /><title>VIUCOMM 라벨</title>
<style>
  * { margin: 0; padding: 0; }
  .page { position: relative; width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; overflow: hidden; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  img { position: absolute; left: ${left}mm; top: ${top}mm; width: ${designWidthMm}mm; height: ${designHeightMm}mm; image-rendering: pixelated; }
  @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
</style></head>
<body>${images.map((src) => `<div class="page"><img src="${src}" alt="" /></div>`).join('')}</body></html>`

  const iframe = document.createElement('iframe')
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
  window.setTimeout(() => iframe.remove(), 120_000)
  window.setTimeout(() => {
    frameWindow.focus()
    frameWindow.print()
  }, 400)
}

/** Browser Print(ZPL) 우선 — 에이전트가 없으면 동일 이미지로 브라우저 인쇄 */
export async function printViucommP141aBoxLabels(
  serials: string[],
  copies = 1,
): Promise<'zpl' | 'html' | 'cancelled'> {
  const list = serials.map((value) => value.trim()).filter(Boolean)
  if (!list.length) return 'cancelled'

  const settings = getLabelPrintSettings('viucomm-p141a-box')
  const layout: ViucommPrintLayout = {
    widthMm: settings.widthMm,
    heightMm: settings.heightMm,
    dpi: settings.dpi,
    offsetXMm: settings.offsetXMm ?? 0,
    offsetYMm: settings.offsetYMm ?? 0,
    darkness: settings.darkness,
    printSpeed: settings.printSpeed,
  }
  const copyCount = Math.max(1, Math.floor(copies) || 1)

  if (settings.preferBrowserPrint) {
    const zpl = buildViucommP141aBoxLabelsZpl(list, copyCount, layout)
    const result = await sendZplViaBrowserPrint(zpl)
    if (result.ok) return 'zpl'

    if (result.reason === 'write') {
      const useHtml = window.confirm(
        `라벨 프린터 전송에 실패했습니다.\n${result.detail}\n\n브라우저 인쇄창으로 대신 출력할까요?`,
      )
      if (!useHtml) return 'cancelled'
    }
  }

  printImagesHtml(list, copyCount, layout)
  return 'html'
}
