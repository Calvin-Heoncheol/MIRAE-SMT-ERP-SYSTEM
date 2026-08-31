import type { SpreadsheetAiFileKind } from '@/lib/quotes/spreadsheet-ai-types'
import { buildSpreadsheetPreviewText } from '@/lib/quotes/spreadsheet-ai-resolve'

export function isSpreadsheetAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY)
}

export function extractQuoteAiJsonObject(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

function buildPrompt(fileKind: SpreadsheetAiFileKind, fileName: string, previewRows: string[][]) {
  const preview = buildSpreadsheetPreviewText(previewRows, 12)
  const pickPlaceSchema = `{
  "headerRowIndex": 0,
  "columns": {
    "designator": "exact header cell text",
    "x": "exact header cell text",
    "y": "exact header cell text",
    "layer": "header text or null",
    "package": "header text or null",
    "value": "header text or null",
    "rotation": "header text or null",
    "description": "header text or null"
  }
}`

  const bomSchema = `{
  "headerRowIndex": 0,
  "columns": {
    "designator": "exact header cell text",
    "comment": "header text or null",
    "footprint": "header text or null",
    "description": "header text or null",
    "quantity": "header text or null",
    "mpn": "header text or null",
    "manufacturer": "header text or null",
    "supplier": "header text or null",
    "supplierPart": "header text or null"
  }
}`

  return [
    `You map spreadsheet columns for electronics manufacturing files.`,
    `File kind: ${fileKind}`,
    `File name: ${fileName}`,
    `Return ONLY valid JSON, no markdown commentary.`,
    fileKind === 'pickplace'
      ? `Required columns: designator (Ref/REFDES), x coordinate, y coordinate. Also map layer/side (TOP/BOT, e.g. SYM_MIRROR, Layer, Side), package/footprint, and value when present. layer is important — do not omit it when a side/mirror column exists.`
      : `Required: designator column with reference designators (e.g. C63, C64 or R1-R5), often comma-separated in one cell, one BOM row per part line. Also map footprint/package (e.g. C_2012, TH), value/spec, description, mpn, quantity.`,
    `Use the exact header cell text from the preview row.`,
    `headerRowIndex is 0-based row index of the header line in the preview.`,
    `Schema:`,
    fileKind === 'pickplace' ? pickPlaceSchema : bomSchema,
    `Preview rows (index<TAB>cells):`,
    preview,
  ].join('\n')
}

async function callOpenAi(prompt: string, systemMessage: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.')

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`OpenAI API 오류 (${response.status}): ${detail.slice(0, 200)}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI 응답이 비어 있습니다.')
  return content
}

async function callGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.')

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      }),
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Gemini API 오류 (${response.status}): ${detail.slice(0, 200)}`)
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) throw new Error('Gemini 응답이 비어 있습니다.')
  return content
}

export async function callQuoteAiJsonPrompt(
  prompt: string,
  systemMessage = 'You assist with PCB manufacturing quote data.',
) {
  if (!isSpreadsheetAiConfigured()) {
    throw new Error('AI API 키가 설정되지 않았습니다. (OPENAI_API_KEY 또는 GEMINI_API_KEY)')
  }

  const provider = process.env.SPREADSHEET_COLUMN_AI_PROVIDER?.trim().toLowerCase()

  let content: string
  const geminiPrompt = `${systemMessage}\n\n${prompt}`
  if (provider === 'gemini') {
    content = await callGemini(geminiPrompt)
  } else if (provider === 'openai') {
    content = await callOpenAi(prompt, systemMessage)
  } else if (process.env.GEMINI_API_KEY) {
    content = await callGemini(geminiPrompt)
  } else {
    content = await callOpenAi(prompt, systemMessage)
  }

  const parsed = extractQuoteAiJsonObject(content)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI 응답에서 JSON을 파싱하지 못했습니다.')
  }

  return parsed
}

export async function inferSpreadsheetColumnsWithAi(input: {
  fileKind: SpreadsheetAiFileKind
  fileName: string
  previewRows: string[][]
}) {
  const prompt = buildPrompt(input.fileKind, input.fileName, input.previewRows)
  return callQuoteAiJsonPrompt(
    prompt,
    'You extract spreadsheet column mappings for PCB pick-and-place and BOM files.',
  )
}
