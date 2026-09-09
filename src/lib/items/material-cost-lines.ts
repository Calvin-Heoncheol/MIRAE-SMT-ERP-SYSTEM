export type MaterialCostLine = {
  label: string
  unitPrice: number
}

export function normalizeMaterialCostLines(value: unknown): MaterialCostLine[] {
  if (!Array.isArray(value)) return []
  const lines: MaterialCostLine[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const label = String(row.label ?? row.name ?? '').trim()
    const unitPrice = Math.max(0, Math.round(Number(row.unitPrice ?? row.unit_price) || 0))
    if (!label && unitPrice <= 0) continue
    lines.push({ label, unitPrice })
  }
  return lines
}

export function sumMaterialCostLines(lines: MaterialCostLine[]) {
  return lines.reduce((sum, line) => sum + Math.max(0, Math.round(Number(line.unitPrice) || 0)), 0)
}

/** 발주·명세 분할이 필요한지 (세부 행 2개 이상) */
export function shouldSplitMaterialCostLines(lines: MaterialCostLine[]) {
  return normalizeMaterialCostLines(lines).length >= 2
}

export function materialCostLinesToJson(lines: MaterialCostLine[]) {
  return normalizeMaterialCostLines(lines).map((line) => ({
    label: line.label,
    unitPrice: Math.max(0, Math.round(Number(line.unitPrice) || 0)),
  }))
}

export function emptyMaterialCostLine(): MaterialCostLine {
  return { label: '', unitPrice: 0 }
}
