'use client'

import { useEffect, useMemo, useState } from 'react'
import { PcbDataUpload } from '@/components/quotes/pcb-data-upload'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import type { AiQuoteDraft } from '@/lib/quotes/ai-quote-draft'
import { enrichPickPlaceWithBom } from '@/lib/quotes/cross-reference-bom-pick-place'
import {
  defaultDipBoardForm,
  defaultSmtBoardForm,
  resizeBoardForms,
  type DipBoardForm,
  type SmtBoardForm,
} from '@/lib/quotes/form-state'
import type { AltiumBomAnalysis } from '@/lib/quotes/parse-altium-bom'
import type { AltiumPickPlaceAnalysis } from '@/lib/quotes/parse-altium-pick-place'
import { isPickPlaceAnalysisReadyForQuote } from '@/lib/quotes/pick-place-review-reasons'
import type { QuoteType } from '@/lib/quotes/types'

type AiQuoteModalProps = {
  open: boolean
  onClose: () => void
  onContinue: (draft: AiQuoteDraft) => void
}

function syncDipNamesFromSmt(smtForms: SmtBoardForm[], dipForms: DipBoardForm[]) {
  return dipForms.map((dip, index) => ({
    ...dip,
    pcbName: smtForms[index]?.pcbName.trim() || dip.pcbName || `PCB ${index + 1}`,
  }))
}

export function AiQuoteModal({ open, onClose, onContinue }: AiQuoteModalProps) {
  const requestClose = useErpModalRequestClose()
  const [quoteType, setQuoteType] = useState<QuoteType>('domestic')
  const [smtForms, setSmtForms] = useState<SmtBoardForm[]>(() =>
    resizeBoardForms([], 1, defaultSmtBoardForm),
  )
  const [dipForms, setDipForms] = useState<DipBoardForm[]>(() =>
    syncDipNamesFromSmt(
      resizeBoardForms([], 1, defaultSmtBoardForm),
      resizeBoardForms([], 1, defaultDipBoardForm),
    ),
  )
  const [productName, setProductName] = useState('')
  const [pickPlaceAnalysis, setPickPlaceAnalysis] = useState<AltiumPickPlaceAnalysis | null>(null)
  const [bomAnalysis, setBomAnalysis] = useState<AltiumBomAnalysis | null>(null)

  useEffect(() => {
    if (!open) return
    setQuoteType('domestic')
    const nextSmt = resizeBoardForms([], 1, defaultSmtBoardForm)
    setSmtForms(nextSmt)
    setDipForms(syncDipNamesFromSmt(nextSmt, resizeBoardForms([], 1, defaultDipBoardForm)))
    setProductName('')
    setPickPlaceAnalysis(null)
    setBomAnalysis(null)
  }, [open])

  const summary = useMemo(() => {
    const activePickPlace = pickPlaceAnalysis
      ? pickPlaceAnalysis.classifiedRows.filter((row) => row.category !== 'skip').length
      : 0
    const bomLines = bomAnalysis?.summary.lineCount ?? 0
    const unpopulated = bomAnalysis?.summary.excludedDesignatorCount ?? 0
    const dipTotals = pickPlaceAnalysis?.summary.dipTotals
    const dipCount = dipTotals
      ? dipTotals.dipGeneral +
        dipTotals.dipConnector +
        dipTotals.dipWire +
        dipTotals.waveGeneral +
        dipTotals.waveConnector +
        dipTotals.waveWire
      : 0
    const reviewPending = pickPlaceAnalysis
      ? pickPlaceAnalysis.classifiedRows.filter((row) => row.confidence === 'ambiguous' && row.category !== 'skip').length
      : 0
    return { activePickPlace, bomLines, unpopulated, dipCount, reviewPending }
  }, [pickPlaceAnalysis, bomAnalysis])

  const analysisReady =
    Boolean(pickPlaceAnalysis && bomAnalysis) &&
    isPickPlaceAnalysisReadyForQuote(pickPlaceAnalysis?.classifiedRows ?? [])

  const canContinue = analysisReady

  function handleContinue() {
    if (!canContinue || !pickPlaceAnalysis || !bomAnalysis) return

    const resolvedPickPlace = enrichPickPlaceWithBom(pickPlaceAnalysis, bomAnalysis)

    onContinue({
      quoteType,
      productName: productName.trim(),
      smtForms,
      dipForms,
      pickPlaceAnalysis: resolvedPickPlace,
      bomAnalysis,
    })
  }

  if (!open) return null

  return (
    <ErpModal
      open
      size="wide"
      title="AI 견적"
      description="좌표·BOM을 함께 분석한 뒤 검토를 완료하면 견적서 편집 화면으로 이어집니다."
      onClose={onClose}
      zIndexClassName="z-[55]"
      contentClassName="px-5 py-4"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {!pickPlaceAnalysis || !bomAnalysis
              ? '좌표·BOM 파일을 모두 업로드하고 분석·검토를 완료해 주세요.'
              : !analysisReady
                ? `검토 필요 ${summary.reviewPending}건 — 분석 결과에서 분류를 완료해 주세요.`
                : '분석·검토가 완료되었습니다. 견적서 편집으로 계속하세요.'}
          </p>
          <div className="flex gap-2">
            <ErpButton variant="secondary" onClick={() => requestClose?.() ?? onClose()}>
              취소
            </ErpButton>
            <ErpButton onClick={handleContinue} disabled={!canContinue}>
              견적서 편집으로 계속
            </ErpButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2.5 text-xs text-violet-900">
          AI 견적은 <strong>좌표 파일 + BOM 파일</strong>이 모두 필요합니다. 업로드 후 검토를 마쳐야 다음 단계로 진행할 수 있습니다.
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setQuoteType('domestic')}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-semibold ring-1 ring-inset',
              quoteType === 'domestic'
                ? 'bg-slate-800 text-white ring-slate-800'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            국내용 견적서
          </button>
          <button
            type="button"
            onClick={() => setQuoteType('export')}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-semibold ring-1 ring-inset',
              quoteType === 'export'
                ? 'bg-slate-800 text-white ring-slate-800'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            해외용 견적서
          </button>
        </div>

        <PcbDataUpload
          requireBoth
          applyBomWithPickPlace
          smtForms={smtForms}
          dipForms={dipForms}
          productName={productName}
          appliedPickPlace={pickPlaceAnalysis}
          appliedBom={bomAnalysis}
          onApplyPickPlace={(input) => {
            const resolvedAnalysis =
              bomAnalysis && input.analysis
                ? enrichPickPlaceWithBom(input.analysis, bomAnalysis)
                : input.analysis
            setPickPlaceAnalysis(resolvedAnalysis)
            setSmtForms(input.smtForms)
            if (input.dipForms) {
              setDipForms(input.dipForms)
            } else {
              setDipForms((current) =>
                current.map((item, index) => ({
                  ...item,
                  pcbName: input.smtForms[index]?.pcbName.trim() || item.pcbName,
                })),
              )
            }
            if (input.productName?.trim()) {
              setProductName(input.productName.trim())
            }
          }}
          onApplyBom={(input) => {
            setBomAnalysis(input.analysis)
            if (pickPlaceAnalysis) {
              setPickPlaceAnalysis(enrichPickPlaceWithBom(pickPlaceAnalysis, input.analysis))
            }
            if (input.dipForms) {
              setDipForms(input.dipForms)
            }
          }}
        />

        {pickPlaceAnalysis && bomAnalysis ? (
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-semibold text-slate-900">좌표 SMD</p>
              <p className="mt-0.5 tabular-nums">{summary.activePickPlace}건</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">후공정 납땜</p>
              <p className="mt-0.5 tabular-nums">{summary.dipCount > 0 ? `${summary.dipCount}건` : '0건'}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">BOM</p>
              <p className="mt-0.5 tabular-nums">{summary.bomLines}라인</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">검토</p>
              <p className={`mt-0.5 tabular-nums ${analysisReady ? 'text-emerald-700' : 'text-amber-700'}`}>
                {analysisReady ? '완료' : `필요 ${summary.reviewPending}건`}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </ErpModal>
  )
}
