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
    return { activePickPlace, bomLines, unpopulated, dipCount }
  }, [pickPlaceAnalysis, bomAnalysis])

  const canContinue = Boolean(pickPlaceAnalysis || bomAnalysis)

  function handleContinue() {
    if (!canContinue) return

    let resolvedPickPlace = pickPlaceAnalysis
    if (resolvedPickPlace && bomAnalysis) {
      resolvedPickPlace = enrichPickPlaceWithBom(resolvedPickPlace, bomAnalysis)
    }

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
      description="좌표·BOM을 분석한 뒤 견적서 편집 화면으로 이어집니다. 고객사·수량 등은 다음 단계에서 입력합니다."
      onClose={onClose}
      zIndexClassName="z-[55]"
      contentClassName="px-5 py-4"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {canContinue
              ? '분석 결과를 견적서에 반영한 뒤 고객사·수량을 입력하세요.'
              : '좌표 또는 BOM 파일을 업로드해 주세요.'}
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
          수동 견적(해외용·국내용·과거 견적서)과 별도로, PCB 데이터 자동 분석에 맞춘 진입 경로입니다.
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

        {canContinue ? (
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-semibold text-slate-900">좌표 SMD</p>
              <p className="mt-0.5 tabular-nums">
                {pickPlaceAnalysis ? `${summary.activePickPlace}건` : '미업로드'}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">후공정 납땜</p>
              <p className="mt-0.5 tabular-nums">
                {summary.dipCount > 0 ? `${summary.dipCount}건` : pickPlaceAnalysis ? '0건' : '미업로드'}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">BOM</p>
              <p className="mt-0.5 tabular-nums">
                {bomAnalysis ? `${summary.bomLines}라인` : '미업로드'}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">미실장</p>
              <p className="mt-0.5 tabular-nums">
                {summary.unpopulated > 0 ? `${summary.unpopulated}건 자동 제외` : '—'}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </ErpModal>
  )
}
