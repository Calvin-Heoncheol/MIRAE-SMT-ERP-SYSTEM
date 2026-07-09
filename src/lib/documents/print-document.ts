type PrintDocumentOptions = {
  title: string
}

const EMBEDDED_PRINT_STYLES = `
@page { size: A4 portrait; margin: 14mm 12mm 12mm 12mm; }
html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; }
.no-print, .print\\:hidden { display: none !important; }
#document-print-root {
  display: block !important;
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 8px !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: #fff !important;
  overflow: visible !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
#document-print-root .approval-document-section {
  border: 1px solid #94a3b8 !important;
  border-radius: 8px !important;
  padding: 10px !important;
  break-inside: avoid;
  page-break-inside: avoid;
}
#document-print-root .approval-document-section--breakable {
  break-inside: auto;
  page-break-inside: auto;
}
#document-print-root .document-form-header > div {
  display: flex !important;
  flex-direction: row !important;
  align-items: flex-start !important;
  justify-content: space-between !important;
  gap: 1.5rem !important;
}
#document-print-root .document-form-header .document-signoff-slot {
  width: 300px !important;
  max-width: 42% !important;
  flex-shrink: 0 !important;
}
#document-print-root .approval-meta-grid {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 2px 10px !important;
}
#document-print-root .approval-meta-grid .approval-meta-field,
#document-print-root .approval-meta-grid .approval-meta-field > label {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 6px !important;
  font-size: 11px !important;
  line-height: 1.25 !important;
}
#document-print-root .approval-meta-grid .approval-meta-field > span:first-child,
#document-print-root .approval-meta-grid .approval-meta-field > label > span:first-child {
  margin-bottom: 0 !important;
  width: 3.6rem !important;
  flex-shrink: 0 !important;
  font-size: 10px !important;
  white-space: nowrap !important;
}
#document-print-root .approval-meta-grid .approval-meta-field input,
#document-print-root .approval-meta-grid .approval-meta-field select,
#document-print-root .approval-meta-grid .approval-meta-field .approval-meta-print-value,
#document-print-root .approval-meta-grid .approval-meta-field .rounded-lg {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  font-size: 11px !important;
  line-height: 1.25 !important;
}
#document-print-root .document-meta-grid {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 1rem !important;
}
#document-print-root .document-form-header { padding-top: 2mm !important; }
#document-print-root .document-brand-footer {
  margin-top: 8mm !important;
  page-break-inside: avoid;
  break-inside: avoid;
}
#document-print-root .overflow-x-auto { overflow: visible !important; }
#document-print-root .approval-detail-table {
  min-width: 0 !important;
  width: 100% !important;
  table-layout: fixed !important;
  font-size: 10px !important;
}
#document-print-root .approval-detail-table th,
#document-print-root .approval-detail-table td {
  padding: 3px 4px !important;
  vertical-align: middle !important;
  word-break: keep-all !important;
  overflow-wrap: normal !important;
}
#document-print-root .approval-detail-table th { white-space: nowrap !important; }
#document-print-root .approval-detail-table .approval-detail-cell-value {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px !important;
  line-height: 1.3 !important;
  padding: 0 !important;
  background: transparent !important;
}
#document-print-root .approval-inline-field input,
#document-print-root .approval-inline-field .rounded-lg {
  border: none !important;
  background: transparent !important;
  min-height: 0 !important;
  padding: 0 !important;
}
#document-print-root table {
  width: 100% !important;
  min-width: 0 !important;
  table-layout: fixed;
}
#document-print-root input:not([type='checkbox']):not([type='radio']),
#document-print-root select,
#document-print-root textarea {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  outline: none !important;
  padding: 0 !important;
  appearance: none;
  -webkit-appearance: none;
  color: #0f172a !important;
}
#document-print-root img {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
`

function waitForImages(root: ParentNode, maxMs = 200) {
  const images = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete)
  if (!images.length) return Promise.resolve()

  return Promise.race([
    Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
          }),
      ),
    ),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, maxMs)
    }),
  ])
}

function syncFormControlValues(source: HTMLElement, clone: HTMLElement) {
  const sourceInputs = source.querySelectorAll('input, textarea, select')
  const cloneInputs = clone.querySelectorAll('input, textarea, select')

  sourceInputs.forEach((sourceNode, index) => {
    const cloneNode = cloneInputs[index]
    if (!(sourceNode instanceof HTMLElement) || !(cloneNode instanceof HTMLElement)) return

    if (sourceNode instanceof HTMLInputElement && cloneNode instanceof HTMLInputElement) {
      if (sourceNode.type === 'checkbox' || sourceNode.type === 'radio') {
        cloneNode.checked = sourceNode.checked
        if (sourceNode.checked) cloneNode.setAttribute('checked', 'checked')
        else cloneNode.removeAttribute('checked')
      } else {
        cloneNode.value = sourceNode.value
        cloneNode.setAttribute('value', sourceNode.value)
      }
      return
    }

    if (sourceNode instanceof HTMLTextAreaElement && cloneNode instanceof HTMLTextAreaElement) {
      cloneNode.value = sourceNode.value
      cloneNode.textContent = sourceNode.value
      return
    }

    if (sourceNode instanceof HTMLSelectElement && cloneNode instanceof HTMLSelectElement) {
      cloneNode.value = sourceNode.value
      Array.from(cloneNode.options).forEach((option) => {
        if (option.value === sourceNode.value) {
          option.selected = true
          option.setAttribute('selected', 'selected')
        } else {
          option.selected = false
          option.removeAttribute('selected')
        }
      })
    }
  })
}

function prepareApprovalDetailTableForPrint(clone: HTMLElement) {
  clone.querySelectorAll('.approval-detail-table').forEach((table) => {
    if (!(table instanceof HTMLTableElement)) return

    table.querySelectorAll('col.no-print, th.no-print, td.no-print').forEach((node) => node.remove())

    table.querySelectorAll('input').forEach((node) => {
      if (!(node instanceof HTMLInputElement)) return
      const span = document.createElement('span')
      span.className = 'approval-detail-cell-value'
      span.textContent = node.value.trim() || '-'
      node.replaceWith(span)
    })
  })
}

function prepareCloneForPrint(clone: HTMLElement) {
  clone.querySelectorAll('[data-expense-line-empty="true"]').forEach((row) => {
    row.remove()
  })

  clone.querySelectorAll('select').forEach((node) => {
    if (!(node instanceof HTMLSelectElement)) return
    const selected =
      node.selectedOptions[0] ??
      Array.from(node.options).find((option) => option.value === node.value) ??
      null
    const value = node.value.trim()
    const label = selected?.textContent?.trim() ?? value
    const span = document.createElement('span')
    const inMetaGrid = Boolean(node.closest('.approval-meta-grid'))
    span.className = inMetaGrid
      ? 'approval-meta-print-value'
      : 'block px-1 py-1 text-sm text-slate-800'
    span.textContent = value ? label : '\u00A0'
    node.replaceWith(span)
  })

  clone.querySelectorAll('input[type="radio"]').forEach((node) => {
    if (!(node instanceof HTMLInputElement)) return
    if (!node.checked) {
      const label = node.closest('label')
      if (label) label.style.opacity = '0.35'
    }
  })

  prepareApprovalDetailTableForPrint(clone)
}

function collectStylesheetHrefs() {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((node) => (node instanceof HTMLLinkElement ? node.href : ''))
    .filter(Boolean)
}

function buildPrintHtml(clone: HTMLElement, title: string) {
  const stylesheetLinks = collectStylesheetHrefs()
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${title.replace(/</g, '&lt;')}</title>
    ${stylesheetLinks}
    <style>${EMBEDDED_PRINT_STYLES}</style>
  </head>
  <body>
    ${clone.outerHTML}
  </body>
</html>`
}

function printInDedicatedWindow(clone: HTMLElement, title: string) {
  const printWindow = window.open('about:blank', '_blank')
  if (!printWindow) return false

  const doc = printWindow.document
  doc.open()
  doc.write(buildPrintHtml(clone, title))
  doc.close()

  const cleanup = () => {
    printWindow.close()
    printWindow.removeEventListener('afterprint', cleanup)
  }

  const triggerPrint = () => {
    printWindow.focus()
    printWindow.print()
  }

  printWindow.addEventListener('afterprint', cleanup)
  window.setTimeout(cleanup, 120_000)

  if (doc.readyState === 'complete') {
    triggerPrint()
  } else {
    printWindow.addEventListener('load', triggerPrint, { once: true })
  }

  return true
}

function ensurePrintHost() {
  let host = document.getElementById('document-print-host')
  if (!host) {
    host = document.createElement('div')
    host.id = 'document-print-host'
    host.setAttribute('aria-hidden', 'true')
    document.body.appendChild(host)
  }
  return host
}

function printInMainDocument(clone: HTMLElement, title: string) {
  const previousTitle = document.title
  document.title = title

  const host = ensurePrintHost()
  host.replaceChildren(clone)
  document.body.classList.add('document-printing')

  const cleanup = () => {
    document.body.classList.remove('document-printing')
    host.replaceChildren()
    document.title = previousTitle
    window.removeEventListener('afterprint', cleanup)
  }

  window.addEventListener('afterprint', cleanup)
  window.setTimeout(cleanup, 120_000)

  window.focus()
  window.print()
}

export async function printDocumentById(rootId: string, options: PrintDocumentOptions) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false

  const source = document.getElementById(rootId)
  if (!source) {
    window.alert('인쇄할 문서를 찾지 못했습니다.')
    return false
  }

  const clone = source.cloneNode(true) as HTMLElement
  clone.id = 'document-print-root'
  syncFormControlValues(source, clone)
  prepareCloneForPrint(clone)
  await waitForImages(clone)

  try {
    if (printInDedicatedWindow(clone, options.title)) {
      return true
    }

    printInMainDocument(clone, options.title)
    return true
  } catch {
    window.alert('인쇄창을 열지 못했습니다. 브라우저 팝업 차단을 확인해 주세요.')
    return false
  }
}
