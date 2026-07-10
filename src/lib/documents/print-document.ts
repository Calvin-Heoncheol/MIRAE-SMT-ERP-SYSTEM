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
  padding: 14px 20px !important;
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
  align-items: center !important;
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
  line-height: 1.25 !important;
}
#document-print-root .approval-meta-grid .approval-meta-field > span:first-child,
#document-print-root .approval-meta-grid .approval-meta-field > label > span:first-child {
  margin-bottom: 0 !important;
  width: 3.6rem !important;
  flex-shrink: 0 !important;
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
  line-height: 1.25 !important;
}
#document-print-root .document-meta-grid:not(.approval-meta-grid) {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 1rem !important;
}
#document-print-root .document-form-header { padding: 5mm 4mm !important; }
#document-print-root .document-form-header__title {
  padding-top: 2mm !important;
  padding-bottom: 2mm !important;
}
#document-print-root .document-brand-footer {
  margin-top: 10mm !important;
  page-break-inside: avoid;
  break-inside: avoid;
}
#document-print-root .document-brand-logo-frame {
  height: 72px !important;
  overflow: hidden !important;
}
#document-print-root .document-brand-logo,
#document-print-root .document-brand-footer img {
  height: 72px !important;
  width: auto !important;
  max-width: 240px !important;
  object-fit: contain !important;
  transform: none !important;
}
#document-print-root .overflow-x-auto { overflow: visible !important; }
#document-print-root .approval-detail-table {
  min-width: 0 !important;
  width: 100% !important;
  table-layout: fixed !important;
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
#document-print-root .approval-signoff-panel {
  display: flex !important;
  overflow: hidden !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 8px !important;
  background: #fff !important;
}
#document-print-root .approval-signoff-panel > div:first-child {
  display: flex !important;
  width: 32px !important;
  flex-shrink: 0 !important;
  align-items: center !important;
  justify-content: center !important;
  border-right: 1px solid #e2e8f0 !important;
  background: #f8fafc !important;
}
#document-print-root .approval-signoff-panel table {
  border-collapse: collapse !important;
}
#document-print-root .approval-signoff-panel th {
  border: none !important;
  border-right: 1px solid #e2e8f0 !important;
  background: #f8fafc !important;
  padding: 4px 2px !important;
  font-weight: 600 !important;
  text-align: center !important;
  white-space: nowrap !important;
}
#document-print-root .approval-signoff-panel td {
  border: none !important;
  border-right: 1px solid #e2e8f0 !important;
  border-top: 1px solid #e2e8f0 !important;
  height: 48px !important;
  padding: 4px 2px !important;
  text-align: center !important;
  vertical-align: middle !important;
}
#document-print-root .approval-signoff-panel th:last-child,
#document-print-root .approval-signoff-panel td:last-child {
  border-right: none !important;
}
#document-print-root .document-print-table {
  border-collapse: collapse !important;
  width: 100% !important;
  min-width: 0 !important;
  table-layout: fixed !important;
}
#document-print-root .document-print-table th,
#document-print-root .document-print-table td {
  border: 1px solid #94a3b8 !important;
  padding: 4px 6px !important;
  vertical-align: middle !important;
}
#document-print-root .document-print-table th {
  background: #f8fafc !important;
  font-weight: 600 !important;
  text-align: center !important;
  white-space: nowrap !important;
}
#document-print-root .expense-report-amount-row {
  border: 1px solid #94a3b8 !important;
  margin-top: 1rem !important;
}
#document-print-root .expense-report-amount-inner {
  display: flex !important;
  align-items: flex-end !important;
  gap: 0.5rem !important;
  padding: 1rem 1.25rem !important;
}
#document-print-root .expense-report-amount-label {
  font-size: 12px !important;
  font-weight: 600 !important;
}
#document-print-root .expense-report-amount-korean,
#document-print-root .expense-report-amount-number {
  font-size: 14px !important;
  font-weight: 600 !important;
}
#document-print-root .expense-report-amount-korean,
#document-print-root .expense-report-amount-number-wrap {
  border-bottom: 1px solid #64748b !important;
  padding-bottom: 0.25rem !important;
}
#document-print-root input[type='date']::-webkit-calendar-picker-indicator {
  display: none !important;
}
#document-print-root .document-print-cell-value {
  display: block;
  line-height: 1.35 !important;
  padding: 0 !important;
  color: #0f172a !important;
}
#document-print-root .approval-totals-row {
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: baseline !important;
  justify-content: flex-end !important;
  gap: 4px 16px !important;
}
#document-print-root .approval-inline-field {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
}
#document-print-root .document-print-text-value {
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
  min-height: 0 !important;
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

function createPrintValueSpan(value: string, className = 'document-print-cell-value') {
  const span = document.createElement('span')
  span.className = className
  span.textContent = value.trim() || '\u00A0'
  return span
}

function replaceInputWithPrintValue(node: HTMLInputElement) {
  const alignRight = node.className.includes('text-right')
  const span = createPrintValueSpan(node.value)
  if (alignRight) span.style.textAlign = 'right'
  node.replaceWith(span)
}

function getOptionLabelText(label: HTMLLabelElement) {
  const clone = label.cloneNode(true) as HTMLLabelElement
  clone.querySelectorAll('input, button, select, textarea').forEach((node) => node.remove())
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function createPrintCheckboxOption(checked: boolean, text: string) {
  const wrap = document.createElement('span')
  wrap.className = 'document-print-option inline-flex items-center gap-2 text-sm text-slate-700'

  const box = document.createElement('span')
  box.className = [
    'document-print-check-box inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold leading-none',
    checked ? 'is-checked border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white',
  ].join(' ')
  box.textContent = checked ? '✓' : ''

  const textSpan = document.createElement('span')
  textSpan.textContent = text

  wrap.append(box, textSpan)
  return wrap
}

function createPrintRadioOption(checked: boolean, text: string) {
  const wrap = document.createElement('span')
  wrap.className = 'document-print-option inline-flex items-center gap-2 text-sm text-slate-800'

  const dot = document.createElement('span')
  dot.className = [
    'document-print-radio-dot inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]',
    checked ? 'is-checked border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white',
  ].join(' ')
  dot.textContent = checked ? '●' : ''

  const textSpan = document.createElement('span')
  textSpan.textContent = text

  wrap.append(dot, textSpan)
  return wrap
}

function prepareRadioGroupsForPrint(clone: HTMLElement) {
  clone.querySelectorAll('input[type="radio"]').forEach((node) => {
    if (!(node instanceof HTMLInputElement)) return
    const label = node.closest('label')
    if (!label) return

    const text = getOptionLabelText(label)
    label.replaceWith(createPrintRadioOption(node.checked, text))
  })
}

function prepareCheckboxGroupsForPrint(clone: HTMLElement) {
  clone.querySelectorAll('input[type="checkbox"]').forEach((node) => {
    if (!(node instanceof HTMLInputElement)) return
    const label = node.closest('label')
    if (!label) return

    const text = getOptionLabelText(label)
    label.replaceWith(createPrintCheckboxOption(node.checked, text))
  })
}

function replaceTextareaWithPrintValue(node: HTMLTextAreaElement) {
  const div = document.createElement('div')
  div.className = 'document-print-body document-print-text-value whitespace-pre-wrap text-sm text-slate-800'
  div.textContent = node.value.trim() || '-'
  node.replaceWith(div)
}

function prepareCloneForPrint(clone: HTMLElement) {
  clone.querySelectorAll('.no-print').forEach((node) => {
    node.remove()
  })

  clone.querySelectorAll('*').forEach((node) => {
    if (node instanceof HTMLElement && node.classList.contains('print:hidden')) {
      node.remove()
    }
  })

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
    const inMetaGrid = Boolean(node.closest('.approval-meta-grid'))
    const span = createPrintValueSpan(
      value ? label : '',
      inMetaGrid ? 'approval-meta-print-value' : 'document-print-cell-value',
    )
    node.replaceWith(span)
  })

  clone.querySelectorAll('input[type="date"]').forEach((node) => {
    if (!(node instanceof HTMLInputElement)) return
    replaceInputWithPrintValue(node)
  })

  clone.querySelectorAll('textarea').forEach((node) => {
    if (!(node instanceof HTMLTextAreaElement)) return
    replaceTextareaWithPrintValue(node)
  })

  prepareCheckboxGroupsForPrint(clone)
  prepareRadioGroupsForPrint(clone)
  prepareApprovalDetailTableForPrint(clone)
}

function collectDocumentHeadMarkup() {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((node) => (node instanceof HTMLLinkElement ? node.outerHTML : ''))
    .filter(Boolean)
    .join('\n')

  const inlineStyles = Array.from(document.querySelectorAll('style'))
    .map((node) => node.outerHTML)
    .join('\n')

  return { links, inlineStyles }
}

function waitForPrintWindowStyles(doc: Document, maxMs = 800) {
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).filter(
    (node): node is HTMLLinkElement => node instanceof HTMLLinkElement,
  )

  if (!links.length) return Promise.resolve()

  return Promise.race([
    Promise.all(
      links.map(
        (link) =>
          new Promise<void>((resolve) => {
            if (link.sheet) {
              resolve()
              return
            }
            link.addEventListener('load', () => resolve(), { once: true })
            link.addEventListener('error', () => resolve(), { once: true })
          }),
      ),
    ),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, maxMs)
    }),
  ])
}

function buildPrintHtml(clone: HTMLElement, title: string) {
  const { links, inlineStyles } = collectDocumentHeadMarkup()

  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${title.replace(/</g, '&lt;')}</title>
    ${links}
    ${inlineStyles}
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
    void waitForPrintWindowStyles(doc).then(() => {
      printWindow.focus()
      printWindow.print()
    })
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
    printInMainDocument(clone, options.title)
    return true
  } catch {
    window.alert('인쇄창을 열지 못했습니다. 다시 시도해 주세요.')
    return false
  }
}
