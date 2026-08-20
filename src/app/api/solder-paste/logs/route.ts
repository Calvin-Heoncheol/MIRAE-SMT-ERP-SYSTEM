import { NextResponse, type NextRequest } from 'next/server'
import {
  getSolderPasteIngestKey,
  isValidSolderPasteIngestKey,
  normalizeSolderPasteSourceName,
} from '@/lib/materials/solder-cream/ingest-config'
import { ingestSolderCreamLogFile } from '@/lib/materials/solder-cream/repository'

function readIngestKey(request: NextRequest) {
  return (
    request.headers.get('x-solder-paste-key')?.trim() ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    ''
  )
}

export async function POST(request: NextRequest) {
  if (!getSolderPasteIngestKey()) {
    return NextResponse.json(
      { ok: false, detail: 'SOLDER_PASTE_INGEST_KEY 가 서버에 설정되지 않았습니다.' },
      { status: 503 },
    )
  }

  const providedKey = readIngestKey(request)
  if (!isValidSolderPasteIngestKey(providedKey)) {
    return NextResponse.json({ ok: false, detail: '인증 키가 올바르지 않습니다.' }, { status: 401 })
  }

  let body: { text?: string; sourceName?: string; sourcePath?: string }
  try {
    body = (await request.json()) as { text?: string; sourceName?: string; sourcePath?: string }
  } catch {
    return NextResponse.json({ ok: false, detail: 'JSON 본문을 읽지 못했습니다.' }, { status: 400 })
  }

  const text = body.text?.trim() || ''
  if (!text) {
    return NextResponse.json({ ok: false, detail: 'text 가 비어 있습니다.' }, { status: 400 })
  }

  const sourceName =
    normalizeSolderPasteSourceName({
      sourceName: body.sourceName,
      sourcePath: body.sourcePath,
    }) || 'equipment.txt'

  const result = await ingestSolderCreamLogFile({
    sourceName,
    text,
    note: body.sourcePath ? `agent:${body.sourcePath}` : 'agent',
    replaceSameSource: true,
  })

  if (!result.ok) {
    const status = result.reason === 'validation' ? 400 : 500
    return NextResponse.json({ ok: false, detail: result.detail, reason: result.reason }, { status })
  }

  if (result.skipped) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      sourceName,
      rowCount: 0,
      detail: result.detail,
    })
  }

  return NextResponse.json({
    ok: true,
    skipped: false,
    sourceName,
    importId: result.importId,
    rowCount: result.rowCount,
  })
}
