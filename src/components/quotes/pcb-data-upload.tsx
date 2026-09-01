'use client'

import { useRef, useState } from 'react'
import { BomReviewModal } from '@/components/quotes/bom-review-modal'
import { PickPlaceReviewModal } from '@/components/quotes/pick-place-review-modal'
import { readBomSpreadsheetFile, readSpreadsheetFileAsRows } from '@/lib/excel/read-spreadsheet'
import { enrichPickPlaceWithBom } from '@/lib/quotes/cross-reference-bom-pick-place'
import { parseBomRowsWithAiFallback, parsePickPlaceRowsWithAiFallback } from '@/lib/quotes/parse-spreadsheet-with-ai'
import type { AltiumBomAnalysis } from '@/lib/quotes/parse-altium-bom'
import type { AltiumPickPlaceAnalysis } from '@/lib/quotes/parse-altium-pick-place'
import type { DipBoardForm, SmtBoardForm } from '@/lib/quotes/form-state'

type PcbDataUploadProps = {
  boardIndex?: number
  smtForms: SmtBoardForm[]
  dipForms: DipBoardForm[]
  productName: string
  disabled?: boolean
  /** AI 견적 등: 좌표·BOM 둘 다 필수 */
  requireBoth?: boolean
  /** 좌표 검토 적용 시 BOM도 함께 반영하고 별도 BOM 검토 모달 생략 */
  applyBomWithPickPlace?: boolean
  appliedPickPlace?: AltiumPickPlaceAnalysis | null
  appliedBom?: AltiumBomAnalysis | null
  onApplyPickPlace: (input: {
    smtForms: SmtBoardForm[]
    dipForms?: DipBoardForm[]
    productName?: string
    analysis: AltiumPickPlaceAnalysis
  }) => void
  onApplyBom: (input: {
    analysis: AltiumBomAnalysis
    dipForms?: DipBoardForm[]
  }) => void
}

type PendingFile = {
  file: File
  label: string
}

function FileChip({ label, fileName, onClear }: { label: string; fileName: string; onClear: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]">
      <span className="shrink-0 font-semibold text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-slate-800" title={fileName}>
        {fileName}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 text-slate-400 hover:text-slate-700"
        aria-label={`${label} 파일 제거`}
      >
        ×
      </button>
    </div>
  )
}

export function PcbDataUpload({
  boardIndex = 0,
  smtForms,
  dipForms,
  productName,
  disabled = false,
  requireBoth = false,
  applyBomWithPickPlace = false,
  appliedPickPlace = null,
  appliedBom = null,
  onApplyPickPlace,
  onApplyBom,
}: PcbDataUploadProps) {
  const pickPlaceInputRef = useRef<HTMLInputElement>(null)
  const bomInputRef = useRef<HTMLInputElement>(null)

  const [pickPlacePending, setPickPlacePending] = useState<PendingFile | null>(null)
  const [bomPending, setBomPending] = useState<PendingFile | null>(null)
  const [parsedPickPlace, setParsedPickPlace] = useState<AltiumPickPlaceAnalysis | null>(null)
  const [parsedBom, setParsedBom] = useState<AltiumBomAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickPlaceReviewOpen, setPickPlaceReviewOpen] = useState(false)
  const [bomReviewOpen, setBomReviewOpen] = useState(false)

  const hasBothPending = Boolean(pickPlacePending && bomPending)
  const hasPending = requireBoth ? hasBothPending : Boolean(pickPlacePending || bomPending)
  const hasParsed = Boolean(parsedPickPlace && (!requireBoth || parsedBom))

  function resetParsed() {
    setParsedPickPlace(null)
    setParsedBom(null)
    setPickPlaceReviewOpen(false)
    setBomReviewOpen(false)
  }

  function handlePickPlaceSelect(file: File) {
    setPickPlacePending({ file, label: '좌표' })
    setError(null)
    resetParsed()
  }

  function handleBomSelect(file: File) {
    setBomPending({ file, label: 'BOM' })
    setError(null)
    resetParsed()
  }

  async function analyzeAndReview() {
    if (!parsedPickPlace || (requireBoth && !parsedBom)) {
      if (requireBoth && (!pickPlacePending || !bomPending)) {
        setError('좌표 파일과 BOM 파일을 모두 선택해 주세요.')
        return
      }
      if (!requireBoth && !hasPending) {
        setError('좌표 또는 BOM 파일을 먼저 선택해 주세요.')
        return
      }
      setLoading(true)
      setError(null)
      resetParsed()
      try {
        let nextPickPlace: AltiumPickPlaceAnalysis | null = null
        let nextBom: AltiumBomAnalysis | null = null

        if (pickPlacePending) {
          const rows = await readSpreadsheetFileAsRows(pickPlacePending.file, 'pickplace')
          const parsed = await parsePickPlaceRowsWithAiFallback(rows, pickPlacePending.file.name)
          if (!parsed.ok) throw new Error(`좌표 파일: ${parsed.detail}`)
          if (!smtForms[boardIndex]) throw new Error('적용할 PCB 보드가 없습니다.')
          nextPickPlace = parsed.analysis
        } else if (requireBoth) {
          throw new Error('좌표 파일을 선택해 주세요.')
        }

        if (bomPending) {
          const { rows, struckRows } = await readBomSpreadsheetFile(bomPending.file)
          const parsed = await parseBomRowsWithAiFallback(rows, bomPending.file.name, { struckRows })
          if (!parsed.ok) throw new Error(`BOM 파일: ${parsed.detail}`)
          nextBom = parsed.analysis
        } else if (requireBoth) {
          throw new Error('BOM 파일을 선택해 주세요.')
        }

        if (nextPickPlace && nextBom) {
          nextPickPlace = enrichPickPlaceWithBom(nextPickPlace, nextBom)
        }

        setParsedPickPlace(nextPickPlace)
        setParsedBom(nextBom)

        if (nextPickPlace) setPickPlaceReviewOpen(true)
        else if (nextBom && !requireBoth) setBomReviewOpen(true)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '파일 분석 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (parsedPickPlace) setPickPlaceReviewOpen(true)
    else if (parsedBom && !requireBoth) setBomReviewOpen(true)
  }

  const pickPlaceForBomReview = parsedPickPlace || appliedPickPlace
  const bomForPickPlaceReview = parsedBom ?? appliedBom

  return (
    <>
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-3">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-900">PCB 데이터 분석</p>
            <p className="mt-0.5 text-[11px] text-slate-600">
              {requireBoth
                ? '좌표 파일과 BOM 파일을 모두 업로드해야 분석할 수 있습니다. BOM의 MPN·Package로 분류 정확도가 올라갑니다.'
                : '좌표·BOM을 함께 올리면 BOM Package·Value로 분류 정확도가 올라갑니다. API 키가 있으면 AI가 컬럼 매핑을 먼저 시도합니다.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={pickPlaceInputRef}
              type="file"
              accept=".csv,.xls,.xlsx,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              disabled={disabled || loading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handlePickPlaceSelect(file)
                event.target.value = ''
              }}
            />
            <input
              ref={bomInputRef}
              type="file"
              accept=".csv,.xls,.xlsx,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              disabled={disabled || loading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handleBomSelect(file)
                event.target.value = ''
              }}
            />
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => pickPlaceInputRef.current?.click()}
              className={[
                'rounded-md border px-3 py-1.5 text-xs font-semibold',
                pickPlacePending
                  ? 'border-sky-400 bg-sky-50 text-sky-900'
                  : 'border-sky-300 bg-white text-sky-800 hover:bg-sky-50',
              ].join(' ')}
            >
              좌표 파일 {pickPlacePending ? '✓' : '선택'}
            </button>
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => bomInputRef.current?.click()}
              className={[
                'rounded-md border px-3 py-1.5 text-xs font-semibold',
                bomPending
                  ? 'border-violet-400 bg-violet-50 text-violet-900'
                  : 'border-violet-300 bg-white text-violet-800 hover:bg-violet-50',
              ].join(' ')}
            >
              BOM 파일 {bomPending ? '✓' : '선택'}
            </button>
            <button
              type="button"
              disabled={disabled || loading || (!hasPending && !hasParsed)}
              onClick={() => void analyzeAndReview()}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '분석 중…' : hasParsed ? '분석 결과 보기' : '분석 시작'}
            </button>
          </div>

          {(pickPlacePending || bomPending) && (
            <div className="flex flex-wrap gap-2">
              {pickPlacePending ? (
                <FileChip
                  label="좌표"
                  fileName={pickPlacePending.file.name}
                  onClear={() => {
                    setPickPlacePending(null)
                    resetParsed()
                  }}
                />
              ) : requireBoth ? (
                <span className="text-[11px] text-amber-700">좌표 파일 미선택</span>
              ) : null}
              {bomPending ? (
                <FileChip
                  label="BOM"
                  fileName={bomPending.file.name}
                  onClear={() => {
                    setBomPending(null)
                    resetParsed()
                  }}
                />
              ) : requireBoth ? (
                <span className="text-[11px] text-amber-700">BOM 파일 미선택</span>
              ) : null}
            </div>
          )}

          {(appliedPickPlace || appliedBom || hasParsed) && (
            <p className="text-[11px] text-slate-600">
              {hasParsed && parsedPickPlace
                ? `분석됨 · 좌표 ${parsedPickPlace.classifiedRows.filter((row) => row.category !== 'skip').length}건`
                : appliedPickPlace
                  ? `적용됨 · 좌표 ${appliedPickPlace.classifiedRows.filter((row) => row.category !== 'skip').length}건`
                  : null}
              {(hasParsed && parsedBom) || appliedBom
                ? `${hasParsed && parsedPickPlace || appliedPickPlace ? ' · ' : ''}BOM ${(hasParsed && parsedBom ? parsedBom : appliedBom)!.summary.lineCount}라인`
                : null}
            </p>
          )}

          {error ? <p className="text-xs text-red-600 whitespace-pre-wrap">{error}</p> : null}
        </div>
      </div>

      <PickPlaceReviewModal
        open={pickPlaceReviewOpen}
        analysis={parsedPickPlace}
        bomAnalysis={bomForPickPlaceReview}
        boardIndex={boardIndex}
        smtForms={smtForms}
        dipForms={dipForms}
        productName={productName}
        onClose={() => setPickPlaceReviewOpen(false)}
        onApply={(input) => {
          onApplyPickPlace(input)
          if (applyBomWithPickPlace && parsedBom) {
            onApplyBom({ analysis: parsedBom, dipForms: input.dipForms })
          }
          setPickPlaceReviewOpen(false)
          if (parsedBom && !applyBomWithPickPlace) {
            setBomReviewOpen(true)
          }
        }}
      />

      <BomReviewModal
        open={bomReviewOpen}
        analysis={parsedBom}
        pickPlaceAnalysis={pickPlaceForBomReview}
        boardIndex={boardIndex}
        dipForms={dipForms}
        onClose={() => setBomReviewOpen(false)}
        onApply={(input) => {
          onApplyBom(input)
          setBomReviewOpen(false)
        }}
      />
    </>
  )
}
