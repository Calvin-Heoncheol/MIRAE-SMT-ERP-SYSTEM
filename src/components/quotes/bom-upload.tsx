'use client'

import { useRef, useState } from 'react'
import { BomReviewModal } from '@/components/quotes/bom-review-modal'
import { readBomSpreadsheetFile } from '@/lib/excel/read-spreadsheet'
import { parseBomRowsWithAiFallback } from '@/lib/quotes/parse-spreadsheet-with-ai'
import type { AltiumBomAnalysis } from '@/lib/quotes/parse-altium-bom'
import type { AltiumPickPlaceAnalysis } from '@/lib/quotes/parse-altium-pick-place'
import type { DipBoardForm } from '@/lib/quotes/form-state'

type BomUploadProps = {
  boardIndex?: number
  dipForms: DipBoardForm[]
  pickPlaceAnalysis?: AltiumPickPlaceAnalysis | null
  disabled?: boolean
  loadedAnalysis?: AltiumBomAnalysis | null
  onApply: (input: {
    analysis: AltiumBomAnalysis
    dipForms?: DipBoardForm[]
  }) => void
}

export function BomUpload({
  boardIndex = 0,
  dipForms,
  pickPlaceAnalysis = null,
  disabled = false,
  loadedAnalysis = null,
  onApply,
}: BomUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AltiumBomAnalysis | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)

  const resolvedPickPlace =
    pickPlaceAnalysis && 'classifiedRows' in pickPlaceAnalysis ? pickPlaceAnalysis : null

  async function handleFile(file: File) {
    setLoading(true)
    setError(null)
    try {
      const { rows, struckRows } = await readBomSpreadsheetFile(file)
      const parsed = await parseBomRowsWithAiFallback(rows, file.name, { struckRows })
      if (!parsed.ok) {
        setError(parsed.detail)
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
      <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-violet-900">BOM 자동 분석</p>
            <p className="mt-0.5 text-[11px] text-violet-800/80">
              BOM CSV·Excel 업로드. 좌표 파일과 함께 올리면 교차 분석·수삽(DIP) 제안을 합니다.
            </p>
            {loadedAnalysis ? (
              <p className="mt-1 text-[11px] font-medium text-violet-700">
                등록됨: {loadedAnalysis.summary.lineCount}라인 ·{' '}
                {loadedAnalysis.summary.designatorCount}개 부품위치
                {resolvedPickPlace ? ' · 좌표와 교차분석 가능' : ''}
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
              className="rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '분석 중…' : loadedAnalysis ? 'BOM 다시 업로드' : 'BOM 업로드'}
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>

      <BomReviewModal
        open={reviewOpen}
        analysis={analysis}
        pickPlaceAnalysis={resolvedPickPlace}
        boardIndex={boardIndex}
        dipForms={dipForms}
        onClose={() => setReviewOpen(false)}
        onApply={(input) => {
          onApply(input)
          setReviewOpen(false)
        }}
      />
    </>
  )
}
