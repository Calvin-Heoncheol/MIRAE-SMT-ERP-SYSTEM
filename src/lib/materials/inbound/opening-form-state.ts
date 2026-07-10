export type OpeningInboundItemForm = {
  materialId: string
  quantity: string
}

export function defaultOpeningInboundItemForm(): OpeningInboundItemForm {
  return { materialId: '', quantity: '' }
}

export function openingInboundItemsFromDetail(
  items: { materialId: string; quantity: number }[],
): OpeningInboundItemForm[] {
  if (!items.length) return [defaultOpeningInboundItemForm()]
  return items.map((item) => ({
    materialId: item.materialId,
    quantity: String(item.quantity),
  }))
}

/** Excel 등에서 복사한 품목코드·입고수량 (탭/쉼표/공백 구분) */
export function parseOpeningInboundPaste(text: string): OpeningInboundItemForm[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const rows: OpeningInboundItemForm[] = []

  for (const line of lines) {
    if (/^품목코드/i.test(line) || /^자재코드/i.test(line)) continue

    let cols: string[]
    if (line.includes('\t')) {
      cols = line.split('\t')
    } else if (line.includes(',')) {
      cols = line.split(',')
    } else {
      cols = line.split(/\s+/)
    }

    const materialId = (cols[0] || '').trim()
    const quantityRaw = (cols[1] || '').trim().replace(/[^\d.]/g, '')
    if (!materialId && !quantityRaw) continue

    rows.push({
      materialId,
      quantity: quantityRaw,
    })
  }

  return rows.length ? rows : [defaultOpeningInboundItemForm()]
}

export function openingToDirectInboundItems(items: OpeningInboundItemForm[]) {
  return items.map((item) => ({
    materialId: item.materialId.trim(),
    materialName: '',
    specification: '',
    mpn: '',
    quantityPerReel: item.quantity.trim() || '0',
    reelCount: '1',
    quantity: item.quantity.trim() || '0',
  }))
}
