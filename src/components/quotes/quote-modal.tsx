'use client'

import { useEffect, useState } from 'react'
import { DipPcbBoardForm } from '@/components/quotes/dip-pcb-board-form'
import { QuoteBreakdownPreview } from '@/components/quotes/quote-breakdown-preview'
import { QuoteCurrencyToggle } from '@/components/quotes/quote-currency-toggle'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { SmtPcbBoardForm } from '@/components/quotes/smt-pcb-board-form'
import {
  POST_RATE,
  SMT_PLACEMENT_MIN_SCORE,
  getSmtPlacementMinFee,
} from '@/lib/quotes/constants'
import { calculateEstimate } from '@/lib/quotes/calculate-estimate'
import { buildQuoteRowPayload } from '@/lib/quotes/build-quote-payload'
import { formatQuoteMoneyByDisplay } from '@/lib/quotes/format'
import {
  defaultDipBoardForm,
  defaultSmtBoardForm,
  dipBoardFormToModel,
  dipBoardToForm,
  resizeBoardForms,
  smtBoardFormToModel,
  smtBoardToForm,
  type DipBoardForm,
  type SmtBoardForm,
} from '@/lib/quotes/form-state'
import { createQuote, deleteQuotes, updateQuote } from '@/lib/quotes/repository'
import { exportQuotesToPdf } from '@/lib/quotes/export-quote-pdf'
import type { EstimateResult, QuoteDisplayCurrency, QuoteListItem, QuoteType } from '@/lib/quotes/types'
import { toEstimateInputFromDetail } from '@/lib/quotes/utils'

type QuoteModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  quoteType: QuoteType
  quote?: QuoteListItem | null
  existingQuoteNumbers?: string[]
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

type FormState = {
  customer: string
  productName: string
  boardQty: string
  pcbBoardCount: string
  postAssembly: string
  postTest: string
  postPacking: string
  materialCost: string
  specialDiscount: string
}

const INITIAL_FORM: FormState = {
  customer: '',
  productName: '',
  boardQty: '1000',
  pcbBoardCount: '1',
  postAssembly: '0',
  postTest: '0',
  postPacking: '0',
  materialCost: '0',
  specialDiscount: '0',
}

function clampPcbCount(value: string) {
  const parsed = Math.floor(Number(value) || 1)
  return String(Math.min(20, Math.max(1, parsed)))
}

function syncDipNamesFromSmt(smtForms: SmtBoardForm[], dipForms: DipBoardForm[]) {
  return dipForms.map((dip, index) => ({
    ...dip,
    pcbName: smtForms[index]?.pcbName.trim() || dip.pcbName || `PCB ${index + 1}`,
  }))
}

function createInitialState(mode: 'create' | 'edit', quote?: QuoteListItem | null) {
  if (mode === 'edit' && quote) {
    const input = toEstimateInputFromDetail(quote)
    const pcbBoardCount = String(input.pcbBoardCount || input.pcbBoards?.length || 1)
    const smtForms = input.pcbBoards?.length
      ? input.pcbBoards.map(smtBoardToForm)
      : [defaultSmtBoardForm(0)]
    const dipForms = syncDipNamesFromSmt(
      smtForms,
      input.dipBoards?.length ? input.dipBoards.map(dipBoardToForm) : [defaultDipBoardForm(0)],
    )

    return {
      form: {
        customer: quote.customer,
        productName: quote.productName,
        boardQty: String(quote.boardQty || 1000),
        pcbBoardCount,
        postAssembly: String(input.postAssembly || 0),
        postTest: String(input.postTest || 0),
        postPacking: String(input.postPacking || 0),
        materialCost: String(input.materialCost || 0),
        specialDiscount: String(input.specialDiscount || 0),
      },
      smtForms,
      dipForms,
    }
  }

  const count = Number(INITIAL_FORM.pcbBoardCount)
  const smtForms = resizeBoardForms([], count, defaultSmtBoardForm)
  const dipForms = syncDipNamesFromSmt(smtForms, resizeBoardForms([], count, defaultDipBoardForm))

  return {
    form: INITIAL_FORM,
    smtForms,
    dipForms,
  }
}

function computeEstimate(
  form: FormState,
  smtForms: SmtBoardForm[],
  dipForms: DipBoardForm[],
  quoteType: QuoteType,
  options: {
    mode: 'create' | 'edit'
    quote?: QuoteListItem | null
    existingQuoteNumbers?: string[]
  },
): EstimateResult {
  const pcbCount = Number(clampPcbCount(form.pcbBoardCount))
  const pcbBoards = smtForms.map(smtBoardFormToModel)
  const dipBoards = dipForms.map((dip, index) =>
    dipBoardFormToModel({
      ...dip,
      pcbName: smtForms[index]?.pcbName.trim() || dip.pcbName,
    }),
  )

  return calculateEstimate(
    {
      boardQty: form.boardQty,
      materialCost: form.materialCost,
      postAssembly: form.postAssembly,
      postTest: form.postTest,
      postPacking: form.postPacking,
      specialDiscount: form.specialDiscount,
      pcbBoardCount: pcbCount,
      pcbBoards,
      dipBoards,
      quoteType,
      existingQuoteNumber: options.mode === 'edit' ? options.quote?.quoteNumber : undefined,
    },
    { existingQuoteNumbers: options.existingQuoteNumbers },
  )
}

function QuoteModalContent({
  mode,
  quoteType,
  quote,
  existingQuoteNumbers = [],
  onClose,
  onSaved,
  onDeleted,
}: Omit<QuoteModalProps, 'open'>) {
  const initial = createInitialState(mode, quote)
  const [form, setForm] = useState<FormState>(initial.form)
  const [smtForms, setSmtForms] = useState(initial.smtForms)
  const [dipForms, setDipForms] = useState(initial.dipForms)
  const [result, setResult] = useState<EstimateResult | null>(() =>
    mode === 'edit' && quote
      ? computeEstimate(initial.form, initial.smtForms, initial.dipForms, quoteType, {
          mode,
          quote,
          existingQuoteNumbers,
        })
      : null,
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [displayCurrency, setDisplayCurrency] = useState<QuoteDisplayCurrency>('usd')

  const isDomestic = quoteType === 'domestic'
  const typeBadge = isDomestic ? '국내용 견적서' : '해외용 견적서'

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  useEffect(() => {
    if (mode !== 'edit' || !quote) return

    const timer = window.setTimeout(() => {
      setResult(
        computeEstimate(form, smtForms, dipForms, quoteType, {
          mode,
          quote,
          existingQuoteNumbers,
        }),
      )
    }, 300)

    return () => window.clearTimeout(timer)
  }, [mode, quote?.quoteNumber, form, smtForms, dipForms, quoteType])

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handlePcbCountBlur() {
    const count = Number(clampPcbCount(form.pcbBoardCount))
    updateForm('pcbBoardCount', String(count))

    const nextSmt = resizeBoardForms(smtForms, count, defaultSmtBoardForm)
    const nextDip = syncDipNamesFromSmt(
      nextSmt,
      resizeBoardForms(dipForms, count, defaultDipBoardForm),
    )
    setSmtForms(nextSmt)
    setDipForms(nextDip)
  }

  function updateSmtBoard(index: number, board: SmtBoardForm) {
    setSmtForms((current) => current.map((item, itemIndex) => (itemIndex === index ? board : item)))
    setDipForms((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, pcbName: board.pcbName.trim() || item.pcbName } : item,
      ),
    )
  }

  function updateDipBoard(index: number, board: DipBoardForm) {
    setDipForms((current) => current.map((item, itemIndex) => (itemIndex === index ? board : item)))
  }

  function collectBoardModels() {
    const pcbBoards = smtForms.map(smtBoardFormToModel)
    const dipBoards = dipForms.map((dip, index) =>
      dipBoardFormToModel({
        ...dip,
        pcbName: smtForms[index]?.pcbName.trim() || dip.pcbName,
      }),
    )
    return { pcbBoards, dipBoards }
  }

  function runCalculate() {
    const estimate = computeEstimate(form, smtForms, dipForms, quoteType, {
      mode,
      quote,
      existingQuoteNumbers,
    })
    setResult(estimate)
    return estimate
  }

  function handleCalculate() {
    setSaveError(null)
    runCalculate()
  }

  async function handleSave() {
    if (!form.customer.trim() || !form.productName.trim()) {
      setSaveError('고객사와 제품명을 입력해 주세요.')
      return
    }

    const estimate = result ?? runCalculate()
    if (!estimate) {
      setSaveError('견적서를 먼저 생성해 주세요.')
      return
    }

    const { pcbBoards, dipBoards } = collectBoardModels()
    const payload = buildQuoteRowPayload(form, pcbBoards, dipBoards, estimate, quoteType)

    setSaving(true)
    setSaveError(null)

    const saveResult =
      mode === 'edit' && quote
        ? await updateQuote(quote.quoteNumber, payload)
        : await createQuote(payload, quoteType)

    setSaving(false)

    if (!saveResult.ok) {
      setSaveError(saveResult.detail)
      return
    }

    onSaved?.()
  }

  function handleDownloadPdf() {
    if (!quote) return
    exportQuotesToPdf([quote])
  }

  async function handleDelete() {
    if (!quote) return

    const confirmMessage = `${quote.quoteNumber} 견적서를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`
    if (!window.confirm(confirmMessage)) return

    setDeleting(true)
    setSaveError(null)

    const deleteResult = await deleteQuotes([quote.quoteNumber])
    setDeleting(false)

    if (!deleteResult.ok) {
      setSaveError(deleteResult.detail)
      return
    }

    onDeleted?.()
  }

  const previewCustomer = form.customer.trim() || '-'
  const previewIssueDate =
    mode === 'edit' && quote?.quoteDate ? quote.quoteDate : result?.date || ''
  const previewProduct = form.productName.trim() || '-'
  const previewForm = {
    postAssembly: form.postAssembly,
    postTest: form.postTest,
    postPacking: form.postPacking,
    materialCost: form.materialCost,
  }

  function formatAmount(krw: number) {
    return formatQuoteMoneyByDisplay(krw, quoteType, displayCurrency)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-[min(1600px,98vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {mode === 'edit' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              {isDomestic ? '국내용 ' : '해외용 '}견적서 수정
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={deleting}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-2xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-2xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="닫기"
          >
            ×
          </button>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="overflow-y-auto border-slate-200 p-4 lg:border-r">
            <div className="mb-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {typeBadge}
            </div>

            <section className="mb-3 rounded-xl border border-slate-200 p-3.5">
              <h3 className="mb-3 text-sm font-bold text-slate-900">기본 정보</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">고객사</span>
                  <input
                    value={form.customer}
                    onChange={(event) => updateForm('customer', event.target.value)}
                    placeholder="고객사명을 입력하세요"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">제품명</span>
                  <input
                    value={form.productName}
                    onChange={(event) => updateForm('productName', event.target.value)}
                    placeholder="제품명을 입력하세요 (버전 포함 가능)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">생산 수량(QTY)</span>
                  <QuoteNumericInput
                    min={1}
                    value={form.boardQty}
                    onChange={(boardQty) => updateForm('boardQty', boardQty)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">PCB 보드</span>
                  <QuoteNumericInput
                    min={1}
                    max={20}
                    value={form.pcbBoardCount}
                    onChange={(pcbBoardCount) => updateForm('pcbBoardCount', pcbBoardCount)}
                    onBlur={handlePcbCountBlur}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
              </div>
            </section>

            <section className="mb-3 rounded-xl border border-slate-200 p-3.5">
              <h3 className="mb-1 text-sm font-bold text-slate-900">1. SMT</h3>
              <p className="mb-3 text-xs text-slate-500">
                PCB 보드 수만큼 PCB별 실장·SET-UP 입력 · 일반 부품은 <strong>부품 개수</strong>, IC/BGA는{' '}
                <strong>핀·볼 수</strong> · {SMT_PLACEMENT_MIN_SCORE}점 이하 PCB는 최소 실장비{' '}
                {formatAmount(getSmtPlacementMinFee(quoteType))}
              </p>
              <div className="space-y-3">
                {smtForms.map((board, index) => (
                  <SmtPcbBoardForm
                    key={index}
                    board={board}
                    quoteType={quoteType}
                    displayCurrency={displayCurrency}
                    onChange={(next) => updateSmtBoard(index, next)}
                  />
                ))}
              </div>
            </section>

            <section className="mb-3 rounded-xl border border-slate-200 p-3.5">
              <h3 className="mb-1 text-sm font-bold text-slate-900">2. 납땜 (개수)</h3>
              <p className="mb-3 text-xs text-slate-500">
                PCB 보드 수만큼 PCB별 수납땜·WAVE 개수 입력 (PCB 명칭은 SMT와 동기화)
              </p>
              <div className="space-y-3">
                {dipForms.map((board, index) => (
                  <DipPcbBoardForm
                    key={index}
                    board={board}
                    quoteType={quoteType}
                    displayCurrency={displayCurrency}
                    onChange={(next) => updateDipBoard(index, next)}
                  />
                ))}
              </div>
            </section>

            <section className="mb-3 rounded-xl border border-slate-200 p-3.5">
              <h3 className="mb-3 text-sm font-bold text-slate-900">3. 후공정 (분)</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ['postAssembly', '조립', POST_RATE],
                  ['postTest', '테스트', POST_RATE],
                  ['postPacking', '포장', POST_RATE],
                ].map(([key, label, unit]) => (
                  <label key={key} className="text-xs font-medium text-slate-600">
                    {label}
                    <QuoteNumericInput
                      min={0}
                      value={form[key as keyof FormState]}
                      onChange={(value) => updateForm(key as keyof FormState, value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                    />
                    <span className="mt-1 block text-[11px] text-slate-400">
                      {formatAmount(unit as number)}/분
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="mb-3 rounded-xl border border-slate-200 p-3.5">
              <h3 className="mb-3 text-sm font-bold text-slate-900">4. 자재</h3>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">원자재 원가(대당)</span>
                <QuoteNumericInput
                  min={0}
                  value={form.materialCost}
                  onChange={(materialCost) => updateForm('materialCost', materialCost)}
                  placeholder="원자재 원가를 입력하세요"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </section>

            <div className="flex flex-col gap-2">
              <div className={mode === 'edit' ? 'flex gap-2' : 'flex gap-3'}>
                {mode === 'create' ? (
                  <button
                    type="button"
                    onClick={handleCalculate}
                    disabled={saving}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    견적서 생성
                  </button>
                ) : null}
                {!isDomestic ? (
                  <QuoteCurrencyToggle value={displayCurrency} onChange={setDisplayCurrency} />
                ) : null}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? '저장 중...' : mode === 'edit' ? '견적서 수정 저장' : '견적서 저장'}
                </button>
              </div>
              {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-y-auto bg-slate-50/70 p-3 lg:p-4">
            <QuoteBreakdownPreview
              quoteType={quoteType}
              result={result}
              form={previewForm}
              displayCurrency={displayCurrency}
              customer={previewCustomer}
              productName={previewProduct}
              issueDate={previewIssueDate}
              loading={mode === 'edit' && !result}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function QuoteModal({ open, ...props }: QuoteModalProps) {
  if (!open) return null
  return <QuoteModalContent {...props} />
}
