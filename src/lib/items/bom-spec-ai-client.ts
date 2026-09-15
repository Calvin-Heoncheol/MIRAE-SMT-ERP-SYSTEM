import { callQuoteAiJsonPrompt } from '@/lib/quotes/spreadsheet-ai-client'
import type { ItemMaterialType } from '@/lib/items/types'
import type { BomSpecAiRowInput, BomSpecAiSplit } from '@/lib/items/bom-spec-ai-types'

function normalizeText(value: unknown, max = 200) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function normalizeMaterialType(value: unknown): ItemMaterialType | undefined {
  if (typeof value !== 'string') return undefined
  const upper = value.trim().toUpperCase()
  if (upper === 'SMD' || upper === 'SMT') return 'SMD'
  if (upper === 'DIP' || upper === 'TH' || upper === 'THT') return 'DIP'
  return undefined
}

function parseSplitItem(item: unknown, fallbackCode?: string): BomSpecAiSplit | null {
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  const code =
    normalizeText(record.code, 80) ||
    normalizeText(record.itemCode, 80) ||
    (fallbackCode ? fallbackCode.trim() : '')
  if (!code) return null

  const specification = normalizeText(record.specification, 240)
  const pkg = normalizeText(record.package, 80)
  const mpn = normalizeText(record.mpn, 120)
  if (!specification && !pkg && !mpn) return null

  return {
    code,
    specification,
    package: pkg,
    mpn,
    materialType: normalizeMaterialType(record.materialType),
    reason: normalizeText(record.reason, 120) || 'AI 사양 분리',
  }
}

function buildPrompt(rows: BomSpecAiRowInput[]) {
  const schema = `{
  "rows": [
    {
      "code": "403124470601",
      "specification": "47pF, F, 50V, C0G",
      "package": "0402",
      "mpn": "GJM1551C1H470FB01",
      "materialType": "SMD",
      "reason": "짧은 한국어 사유"
    }
  ]
}`

  const lines = rows.map((row) =>
    [
      `code=${row.code}`,
      `name=${row.name || '-'}`,
      `specification=${row.specification || '-'}`,
      `package=${row.package || '-'}`,
      `mpn=${row.mpn || '-'}`,
      `materialType=${row.materialType || '-'}`,
    ].join(' | '),
  )

  return [
    'Split electronics BOM material fields for a Korean SMT ERP item master.',
    'Input often packs type, value, tolerance, voltage, dielectric, package, MPN, manufacturer into specification.',
    'Example input specification: C,47pF,F,50V,C0G,0402,GJM1551C1H470FB01,Murata',
    'Example output: specification=47pF, F, 50V, C0G | package=0402 | mpn=GJM1551C1H470FB01 | materialType=SMD',
    'Rules:',
    '- Keep electrical/value info in specification (value, tolerance, voltage, dielectric, etc.).',
    '- Put footprint size (0402, 0603, SOP8, QFN32, …) in package.',
    '- Put manufacturer part number in mpn. Do not invent MPN.',
    '- Manufacturer name may be appended to specification as ", Murata" if useful; do not invent.',
    '- If package or mpn already provided, keep them unless clearly wrong and you can correct from specification.',
    '- materialType: SMD or DIP only when clear; otherwise omit.',
    '- Use the exact code from input.',
    '- Write reason in Korean.',
    '- Return ONLY valid JSON with a "rows" array. One object per input row.',
    'Schema:',
    schema,
    'Rows:',
    ...lines,
  ].join('\n')
}

export async function inferBomSpecSplitsWithAi(rows: BomSpecAiRowInput[]): Promise<BomSpecAiSplit[]> {
  if (!rows.length) return []

  const raw = await callQuoteAiJsonPrompt(
    buildPrompt(rows),
    'You split packed BOM specification strings into ERP item fields.',
  )

  const record = raw as { rows?: unknown }
  if (!Array.isArray(record.rows)) {
    throw new Error('AI 응답 형식이 올바르지 않습니다.')
  }

  const byCode = new Map<string, BomSpecAiSplit>()
  for (const [index, item] of record.rows.entries()) {
    const parsed = parseSplitItem(item, rows[index]?.code)
    if (!parsed) continue
    byCode.set(parsed.code.toLowerCase(), parsed)
  }

  return rows
    .map((row) => byCode.get(row.code.toLowerCase()) ?? null)
    .filter((item): item is BomSpecAiSplit => Boolean(item))
}
