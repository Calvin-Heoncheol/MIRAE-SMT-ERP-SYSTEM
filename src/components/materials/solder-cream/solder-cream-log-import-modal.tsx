'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { parseSolderCreamLogText } from '@/lib/materials/solder-cream/parse-log-file'
import {
  fetchRecentSolderCreamLogImports,
  importSolderCreamLogFile,
} from '@/lib/materials/solder-cream/repository'
import type {
  SolderCreamLogImport,
  SolderCreamLogImportRow,
} from '@/lib/materials/solder-cream/types'
import {
  formatSolderCreamDateTime,
  isMissingSolderCreamLogTable,
  SOLDER_CREAM_EQUIPMENT_LABELS,
  SOLDER_CREAM_EVENT_LABELS,
} from '@/lib/materials/solder-cream/utils'
import {
  ERP_INFO_BOX_CLASS,
  ERP_INFO_BOX_TEXT_CLASS,
  ERP_INFO_BOX_TITLE_CLASS,
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
  const [fileText, setFileText] = useState('')
  const [previewRows, setPreviewRows] = useState<SolderCreamLogImportRow[]>([])
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [importing, setImporting] = useState(false)
  const [recentImports, setRecentImports] = useState<SolderCreamLogImport[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState('')

  async function loadRecentImports() {
    setRecentLoading(true)
    setRecentError('')
    const result = await fetchRecentSolderCreamLogImports(10)
    setRecentLoading(false)
    if (!result.ok) {
      if (isMissingSolderCreamLogTable(result.detail)) {
        setRecentImports([])
        setRecentError('')
        return
      }
      setRecentImports([])
      setRecentError(result.detail)
      return
    }
    setRecentImports(result.imports)
  }

  useEffect(() => {
    setSourceName('')
    setFileText('')
    setPreviewRows([])
    setError('')
    setHint('')
    void loadRecentImports()
  }, [])

  const previewSummary = useMemo(() => {
    if (!previewRows.length) return ''
    const lots = new Set(previewRows.map((row) => row.lotNumber))
    return `${previewRows.length}행 · LOT ${lots.size}개`
  }, [previewRows])

  function applyPreview(text: string, name: string) {
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
    setSourceName(name)
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setFileText(text)
    applyPreview(text, file.name)
    event.target.value = ''
  }

  async function handleImport() {
    if (!previewRows.length || !fileText.trim()) {
      setError('먼저 로그 파일을 선택해 주세요.')
      return
    }

    setImporting(true)
    setError('')
    const result = await importSolderCreamLogFile({
      sourceName: sourceName || 'equipment.txt',
      text: fileText,
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
      title="Log 가져오기"
      description="일 종료 후 설비 로그 TXT(예: D:\Log\2026\8\20.txt)을 가져와 현황·이력을 갱신합니다."
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
          <p className={ERP_INFO_BOX_TITLE_CLASS}>로그 파일</p>
          <p className={ERP_INFO_BOX_TEXT_CLASS}>
            설비 일일 로그 TXT를 선택하세요. 입고 완료·자재 출고만 추출합니다.
          </p>

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
            {hint ? <p className="text-xs text-slate-600">{hint}</p> : null}
            {previewSummary ? (
              <p className="text-xs font-medium text-emerald-700">{previewSummary}</p>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-600">최근 불러온 로그</p>
            <span className="text-[11px] text-slate-400">최대 10건</span>
          </div>
          {recentLoading ? (
            <p className="px-3 py-4 text-xs text-slate-500">불러오는 중…</p>
          ) : recentError ? (
            <p className="px-3 py-4 text-xs text-rose-600">{recentError}</p>
          ) : !recentImports.length ? (
            <p className="px-3 py-4 text-xs text-slate-500">아직 가져온 로그가 없습니다.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="bg-white">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                    파일명
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                    가져온 시각
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                    건수
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentImports.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs font-medium text-slate-800">
                      {item.sourceName}
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums text-slate-600">
                      {formatSolderCreamDateTime(item.importedAt)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">
                      {item.rowCount.toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
