/** 숨은 iframe에 HTML을 쓰고 인쇄 창을 연다. PDF 저장 시 파일명은 documentTitle을 따른다. */
export function printHtmlDocument(html: string, documentTitle: string) {
  if (typeof document === 'undefined') return false

  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', documentTitle)
  Object.assign(iframe.style, {
    position: 'fixed',
    width: '0',
    height: '0',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  })
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  const printWindow = iframe.contentWindow
  if (!doc || !printWindow) {
    iframe.remove()
    return false
  }

  doc.open()
  doc.write(html)
  doc.close()

  const previousTitle = document.title
  document.title = documentTitle

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    document.title = previousTitle
    window.removeEventListener('afterprint', cleanup)
    iframe.remove()
  }
  window.addEventListener('afterprint', cleanup)
  printWindow.addEventListener('afterprint', cleanup)
  window.setTimeout(cleanup, 120_000)

  printWindow.focus()
  printWindow.print()
  return true
}
