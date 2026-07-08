type PrintDocumentOptions = {
  title: string
}

function waitForImages(root: ParentNode) {
  const images = Array.from(root.querySelectorAll('img'))
  if (!images.length) return Promise.resolve()

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        }),
    ),
  ).then(() => undefined)
}

function waitForStylesheets(doc: Document) {
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
  if (!links.length) return Promise.resolve()

  return Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          if (!(link instanceof HTMLLinkElement)) {
            resolve()
            return
          }
          if (link.sheet) {
            resolve()
            return
          }
          link.onload = () => resolve()
          link.onerror = () => resolve()
          window.setTimeout(() => resolve(), 800)
        }),
    ),
  ).then(() => undefined)
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

function prepareCloneForPrint(clone: HTMLElement) {
  // 인쇄에서 빈 내역 행 제거 (편집용 빈 행 / "선택"만 있는 행)
  clone.querySelectorAll('[data-expense-line-empty="true"]').forEach((row) => {
    row.remove()
  })

  // select는 인쇄 미리보기에서 값이 깨지기 쉬워 텍스트로 치환
  clone.querySelectorAll('select').forEach((node) => {
    if (!(node instanceof HTMLSelectElement)) return
    const selected =
      node.selectedOptions[0] ??
      Array.from(node.options).find((option) => option.value === node.value) ??
      null
    const value = node.value.trim()
    const label = selected?.textContent?.trim() ?? value
    const span = document.createElement('span')
    span.className = 'block px-1 py-1 text-sm text-slate-800'
    span.textContent = value ? label : '\u00A0'
    node.replaceWith(span)
  })

  // 체크/라디오는 실제 선택만 표시되도록 텍스트 보강
  clone.querySelectorAll('input[type="radio"]').forEach((node) => {
    if (!(node instanceof HTMLInputElement)) return
    if (!node.checked) {
      const label = node.closest('label')
      if (label) label.style.opacity = '0.35'
    }
  })
}

function collectStylesheetHrefs() {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((node) => (node instanceof HTMLLinkElement ? node.href : ''))
    .filter(Boolean)
}

function collectInlineStyles() {
  return Array.from(document.querySelectorAll('style'))
    .map((node) => node.textContent ?? '')
    .join('\n')
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

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '794px'
  iframe.style.height = '1123px'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  document.body.appendChild(iframe)

  const frameWindow = iframe.contentWindow
  const frameDocument = frameWindow?.document
  if (!frameWindow || !frameDocument) {
    iframe.remove()
    window.alert('인쇄창을 만들지 못했습니다.')
    return false
  }

  const stylesheetLinks = collectStylesheetHrefs()
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join('\n')

  frameDocument.open()
  frameDocument.write(`<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${options.title.replace(/</g, '&lt;')}</title>
    ${stylesheetLinks}
    <style>
      ${collectInlineStyles()}
      @page {
        size: A4 portrait;
        margin: 14mm 12mm 12mm 12mm;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #0f172a;
      }
      body {
        padding: 0;
      }
      #document-print-root {
        width: 100%;
        margin: 0;
        padding: 0;
        border: none !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        background: #fff !important;
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
      #document-print-root .document-meta-grid {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 1rem !important;
      }
      #document-print-root .approval-signoff-panel table {
        table-layout: fixed !important;
      }
      #document-print-root .rounded-lg.border.border-slate-200.bg-slate-50,
      #document-print-root .min-h-\\[38px\\].rounded-lg.border,
      #document-print-root .min-h-\\[72px\\].rounded-lg.border {
        border: none !important;
        background: transparent !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        min-height: 0 !important;
      }
      .no-print,
      .print\\:hidden {
        display: none !important;
      }
      .overflow-x-auto {
        overflow: visible !important;
      }
      table {
        width: 100% !important;
        min-width: 0 !important;
        table-layout: fixed;
      }
      input:not([type='checkbox']):not([type='radio']),
      select,
      textarea {
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        outline: none !important;
        appearance: none;
        -webkit-appearance: none;
      }
      img {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    </style>
  </head>
  <body>
    ${clone.outerHTML}
  </body>
</html>`)
  frameDocument.close()

  await waitForStylesheets(frameDocument)
  await waitForImages(frameDocument)

  const cleanup = () => {
    iframe.remove()
    frameWindow.removeEventListener('afterprint', cleanup)
  }

  frameWindow.addEventListener('afterprint', cleanup)

  window.setTimeout(() => {
    try {
      frameWindow.focus()
      frameWindow.print()
    } catch {
      cleanup()
    }
  }, 150)

  window.setTimeout(cleanup, 60_000)
  return true
}
