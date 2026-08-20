'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import {
  parseSolderCreamLogText,
  solderCreamLogPlaceholder,
  solderCreamEquipmentLogSampleText,
} from '@/lib/materials/solder-cream/parse-log-file'
import { importSolderCreamLogFile } from '@/lib/materials/solder-cream/repository'
import type { SolderCreamLogImportRow } from '@/lib/materials/solder-cream/types'
import {
  formatSolderCreamDateTime,
  SOLDER_CREAM_EQUIPMENT_LABELS,
  SOLDER_CREAM_EVENT_LABELS,
} from '@/lib/materials/solder-cream/utils'
import {
  ERP_INFO_BOX_CLASS,
  ERP_INFO_BOX_TEXT_CLASS,
  ERP_INFO_BOX_TITLE_CLASS,
  ERP_PASTE_TEXTAREA_CLASS,
} from '@/lib/ui/tokens'

type SolderCreamLogImportModalProps = {
  open: boolean
  onClose: () => void
  onImported: (message?: string) => void
}

export function SolderCreamLogImportModal({
  open,
  onClose,
  onImported,
}: SolderCreamLogImportModalProps) {
  if (!open) return null
  return <SolderCreamLogImportModalContent onClose={onClose} onImported={onImported} />
}

function SolderCreamLogImportModalContent({
  onClose,
  onImported,
}: Omit<SolderCreamLogImportModalProps, 'open'>) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sourceName, setSourceName] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [previewRows, setPreviewRows] = useState<SolderCreamLogImportRow[]>([])
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    setSourceName('')
    setPasteText('')
    setPreviewRows([])
    setError('')
    setHint('')
  }, [])

  const previewSummary = useMemo(() => {
    if (!previewRows.length) return ''
    const lots = new Set(previewRows.map((row) => row.lotNumber))
    return `${previewRows.length}행 · LOT ${lots.size}개`
  }, [previewRows])

  function applyPreview(text: string, name?: string) {
    setError('')
    const parsed = parseSolderCreamLogText(text)
    if (!parsed.ok) {
      setPreviewRows([])
      setError(parsed.detail)
      setHint('')
      return
    }
    setPreviewRows(parsed.rows)
    setHint(`${parsed.rows.length}건 미리보기`)
    if (name) setSourceName(name)
  }

  function handleApplyPaste() {
    applyPreview(pasteText, sourceName || 'paste.txt')
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setPasteText(text)
    applyPreview(text, file.name)
    event.target.value = ''
  }

  async function handleImport() {
    if (!previewRows.length) {
      setError('먼저 파일을 선택하거나 붙여넣기 적용을 눌러 주세요.')
      return
    }

    setImporting(true)
    setError('')
    const result = await importSolderCreamLogFile({
      sourceName: sourceName || 'paste.txt',
      text: pasteText,
    })
    setImporting(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }

    onImported(`${result.rowCount}건 가져오기 완료`)
  }

  function handleClose() {
    if (importing) return
    onClose()
  }

  return (
    <ErpModal
      open
      title="솔더페이스트 가져오기"
      description="설비에서 내보낸 TXT(19.txt 형식) 또는 CSV를 가져와 LOT별 사용 가능 여부를 계산합니다."
      size="lg"
      onClose={handleClose}
      closeOnEscape={!importing}
      footer={
        <div className="flex w-full flex-col gap-2">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <ErpButton variant="secondary" disabled={importing} onClick={handleClose}>
              취소
            </ErpButton>
            <ErpButton
              disabled={importing || !previewRows.length}
              onClick={() => void handleImport()}
            >
              {importing
                ? '가져오는 중…'
                : `가져오기${previewRows.length ? ` (${previewRows.length}건)` : ''}`}
            </ErpButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className={ERP_INFO_BOX_CLASS}>
          <p className={ERP_INFO_BOX_TITLE_CLASS}>파일 또는 붙여넣기</p>
          <p className={ERP_INFO_BOX_TEXT_CLASS}>
            설비 일일 로그 TXT(예: 19.txt)를 선택하거나 붙여넣으세요. 각 줄은{' '}
            <code className="rounded bg-white px-1">2026-08-19 07:11:45.066 교반 완료</code>{' '}
            형식이며, 입고·냉장출고·교반·출고 이벤트만 자동 추출합니다. Excel CSV도 지원합니다.
          </p>

          <pre className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white p-2 font-mono text-[11px] leading-relaxed text-slate-700">
            {solderCreamEquipmentLogSampleText()}
          </pre>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain"
              className="hidden"
              onChange={(event) => void handleFileChange(event)}
            />
            <ErpButton
              variant="secondary"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              파일 선택
            </ErpButton>
            {sourceName ? (
              <span className="text-xs text-slate-600">선택: {sourceName}</span>
            ) : null}
          </div>

          <textarea
            value={pasteText}
            onChange={(event) => {
              setPasteText(event.target.value)
              setHint('')
              setError('')
            }}
            disabled={importing}
            rows={5}
            placeholder={solderCreamLogPlaceholder()}
            className={`${ERP_PASTE_TEXTAREA_CLASS} mt-3`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ErpButton
              variant="secondary"
              disabled={importing || !pasteText.trim()}
              onClick={handleApplyPaste}
            >
              붙여넣기 적용
            </ErpButton>
            {hint ? <p className="text-xs text-slate-600">{hint}</p> : null}
            {previewSummary ? (
              <p className="text-xs font-medium text-emerald-700">{previewSummary}</p>
            ) : null}
          </div>
        </div>

        {previewRows.length ? (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                    기록시각
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                    설비
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">LOT</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                    이벤트
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                    온도
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                    교반초
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 12).map((row) => (
                  <tr key={`${row.sourceRow}-${row.lotNumber}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {formatSolderCreamDateTime(row.recordedAt)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {SOLDER_CREAM_EQUIPMENT_LABELS[row.equipmentType]}
                      {row.equipmentId ? ` · ${row.equipmentId}` : ''}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-blue-800">
                      {row.lotNumber}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {SOLDER_CREAM_EVENT_LABELS[row.eventType]}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-600">
                      {row.temperature ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-600">
                      {row.mixSeconds ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewRows.length > 12 ? (
              <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                외 {previewRows.length - 12}행…
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </ErpModal>
  )
}
