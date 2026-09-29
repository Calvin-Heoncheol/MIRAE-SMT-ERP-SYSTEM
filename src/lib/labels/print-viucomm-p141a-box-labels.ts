import { sendZplViaBrowserPrint } from '@/lib/materials/zebra-browser-print'
import {
  VIUCOMM_P141A_BOX_LABEL,
  buildViucommP141aBoxLabelsZpl,
  renderViucommP141aBoxLabelDataUrl,
} from './viucomm-p141a-box-label'

function printImagesHtml(serials: string[], copies: number) {
  const { widthMm, heightMm } = VIUCOMM_P141A_BOX_LABEL
  const images: string[] = []
  for (const serial of serials) {
    const src = renderViucommP141aBoxLabelDataUrl(serial)
    for (let i = 0; i < copies; i += 1) images.push(src)
  }

  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8" /><title>VIUCOMM 라벨</title>
<style>
  * { margin: 0; padding: 0; }
  img { display: block; width: ${widthMm}mm; height: ${heightMm}mm; image-rendering: pixelated; page-break-after: always; }
  img:last-child { page-break-after: auto; }
  @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
</style></head>
<body>${images.map((src) => `<img src="${src}" alt="" />`).join('')}</body></html>`

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

  const zpl = buildViucommP141aBoxLabelsZpl(list, copies)
  const result = await sendZplViaBrowserPrint(zpl)
  if (result.ok) return 'zpl'

  if (result.reason === 'write') {
    const useHtml = window.confirm(
      `라벨 프린터 전송에 실패했습니다.\n${result.detail}\n\n브라우저 인쇄창으로 대신 출력할까요?`,
    )
    if (!useHtml) return 'cancelled'
  }

  printImagesHtml(list, Math.max(1, Math.floor(copies) || 1))
  return 'html'
}
