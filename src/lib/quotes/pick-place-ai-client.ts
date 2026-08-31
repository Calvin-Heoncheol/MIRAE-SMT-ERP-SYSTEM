import type { PickPlaceComponentCategory } from '@/lib/quotes/parse-altium-pick-place'
import { callQuoteAiJsonPrompt } from '@/lib/quotes/spreadsheet-ai-client'
import type { PickPlaceAiClassification, PickPlaceAiRowInput } from '@/lib/quotes/pick-place-ai-types'

const VALID_CATEGORIES = new Set<PickPlaceComponentCategory>([
  'chip',
  'ic',
  'bga',
  'odd',
  'special',
  'skip',
])

function normalizeCategory(value: unknown): PickPlaceComponentCategory | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!VALID_CATEGORIES.has(normalized as PickPlaceComponentCategory)) return null
  return normalized as PickPlaceComponentCategory
}

function normalizePositiveInt(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
  }
  return undefined
}

function normalizeReason(value: unknown) {
  if (typeof value !== 'string') return 'AI 분류 제안'
  const trimmed = value.trim()
  return trimmed || 'AI 분류 제안'
}

function parseClassificationItem(
  item: unknown,
  fallbackDesignator?: string,
): PickPlaceAiClassification | null {
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  const designator =
    typeof record.designator === 'string' && record.designator.trim()
      ? record.designator.trim()
      : fallbackDesignator
  if (!designator) return null

  const category = normalizeCategory(record.category)
  if (!category) return null

  return {
    designator,
    category,
    icPinCount: category === 'ic' ? normalizePositiveInt(record.icPinCount) : undefined,
    bgaBallCount: category === 'bga' ? normalizePositiveInt(record.bgaBallCount) : undefined,
    reason: normalizeReason(record.reason),
  }
}

function buildRowsPrompt(rows: PickPlaceAiRowInput[]) {
  const schema = `{
  "rows": [
    {
      "designator": "U1",
      "category": "chip|ic|bga|odd|special|skip",
      "icPinCount": 64,
      "bgaBallCount": null,
      "reason": "short Korean reason"
    }
  ]
}`

  const lines = rows.map((row) =>
    [
      `designator=${row.designator}`,
      `side=${row.side}`,
      `package=${row.package || '-'}`,
      `value=${row.value || '-'}`,
      `description=${row.description || '-'}`,
      `currentCategory=${row.currentCategory}`,
      `currentDetail=${row.currentDetail || '-'}`,
    ].join(' | '),
  )

  return [
    'Classify SMT pick-and-place components for a Korean PCB assembly quote.',
    'Categories:',
    '- chip: R/C/L and other small passives',
    '- ic: IC packages (provide icPinCount when known)',
    '- bga: BGA packages (provide bgaBallCount when known)',
    '- odd: odd-form SMT parts',
    '- special: connectors, modules, switches, crystals, antennas',
    '- skip: test points, fiducials, mounting holes, mechanical-only',
    'Return ONLY valid JSON with a "rows" array. One object per input row.',
    'Use the exact designator from input.',
    'Write reason in Korean.',
    'Schema:',
    schema,
    'Rows:',
    ...lines,
  ].join('\n')
}

export async function inferPickPlaceClassificationsWithAi(
  rows: PickPlaceAiRowInput[],
): Promise<PickPlaceAiClassification[]> {
  if (!rows.length) return []

  const raw = await callQuoteAiJsonPrompt(
    buildRowsPrompt(rows),
    'You classify PCB SMT components for assembly quoting.',
  )

  const record = raw as { rows?: unknown }
  if (!Array.isArray(record.rows)) {
    throw new Error('AI 응답 형식이 올바르지 않습니다.')
  }

  const byDesignator = new Map<string, PickPlaceAiClassification>()
  for (const [index, item] of record.rows.entries()) {
    const parsed = parseClassificationItem(item, rows[index]?.designator)
    if (!parsed) continue
    byDesignator.set(parsed.designator.toUpperCase(), parsed)
  }

  return rows
    .map((row) => byDesignator.get(row.designator.toUpperCase()) ?? null)
    .filter((item): item is PickPlaceAiClassification => Boolean(item))
}
