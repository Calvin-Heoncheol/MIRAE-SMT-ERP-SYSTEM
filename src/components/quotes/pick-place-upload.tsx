'use client'

import { useRef, useState } from 'react'
import { PickPlaceReviewModal } from '@/components/quotes/pick-place-review-modal'
import { readSpreadsheetFileAsRows } from '@/lib/excel/read-spreadsheet'
import { parsePickPlaceRowsWithAiFallback } from '@/lib/quotes/parse-spreadsheet-with-ai'
import type { AltiumPickPlaceAnalysis } from '@/lib/quotes/parse-altium-pick-place'
import type { AltiumBomAnalysis } from '@/lib/quotes/parse-altium-bom'
import type { SmtBoardForm } from '@/lib/quotes/form-state'

type PickPlaceUploadProps = {
  boardIndex?: number
  smtForms: SmtBoardForm[]
  productName: string
  disabled?: boolean
  loadedAnalysis?: AltiumPickPlaceAnalysis | null
  bomAnalysis?: AltiumBomAnalysis | null
  onApply: (input: {
    smtForms: SmtBoardForm[]
    productName?: string
    analysis: AltiumPickPlaceAnalysis
  }) => void
}

export function PickPlaceUpload({
  boardIndex = 0,
  smtForms,
  productName,
  disabled = false,
  loadedAnalysis = null,
  bomAnalysis = null,
  onApply,
}: PickPlaceUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AltiumPickPlaceAnalysis | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)

  async function handleFile(file: File) {
    setLoading(true)
    setError(null)
    try {
      const rows = await readSpreadsheetFileAsRows(file, 'pickplace')
      const parsed = await parsePickPlaceRowsWithAiFallback(rows, file.name)
      if (!parsed.ok) {
        setError(parsed.detail)
        return
      }

      if (!smtForms[boardIndex]) {
        setError('적용할 PCB 보드가 없습니다.')
        return
      }

      setAnalysis(parsed.analysis)
      setReviewOpen(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : '파일을 읽는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50/40 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-sky-900">Pick&amp;Place 자동 분석</p>
            <p className="mt-0.5 text-[11px] text-sky-800/80">
              좌표 CSV·Excel(.xls/.xlsx) 업로드. BOM과 함께 올리면 분류 정확도가 올라갑니다.
            </p>
            {loadedAnalysis ? (
              <p className="mt-1 text-[11px] font-medium text-sky-700">
                등록됨: {loadedAnalysis.classifiedRows.filter((row) => row.category !== 'skip').length}건
                {bomAnalysis ? ' · BOM 교차분석 반영' : ''}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xls,.xlsx,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              disabled={disabled || loading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '분석 중…' : loadedAnalysis ? '좌표 다시 업로드' : '좌표 업로드'}
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>

      <PickPlaceReviewModal
        open={reviewOpen}
        analysis={analysis}
        bomAnalysis={bomAnalysis}
        boardIndex={boardIndex}
        smtForms={smtForms}
        productName={productName}
        onClose={() => setReviewOpen(false)}
        onApply={(input) => {
          onApply(input)
          setReviewOpen(false)
        }}
      />
    </>
  )
}
