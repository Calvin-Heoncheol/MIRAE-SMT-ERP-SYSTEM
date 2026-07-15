'use client'

import { useEffect, useState } from 'react'
import { DipPcbBoardForm } from '@/components/quotes/dip-pcb-board-form'
import { PostProcessLinesEditor } from '@/components/quotes/post-process-lines-editor'
import { QuoteBreakdownPreview } from '@/components/quotes/quote-breakdown-preview'
import { QuoteCurrencyToggle } from '@/components/quotes/quote-currency-toggle'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { SmtPcbBoardForm } from '@/components/quotes/smt-pcb-board-form'
import { ErpButton } from '@/components/ui/erp-button'
import {
  SMT_PLACEMENT_MIN_SCORE,
  getPostRate,
  getSmtPlacementMinFee,
} from '@/lib/quotes/constants'
import { calculateEstimate } from '@/lib/quotes/calculate-estimate'
import { buildQuoteRowPayload } from '@/lib/quotes/build-quote-payload'
import { formatQuoteMoneyByDisplay, formatQuotePreviewSummary } from '@/lib/quotes/format'
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
import {
  emptyPostProcessLineForm,
  resolvePostProcessLineForms,
  sumPostProcessLineMinutes,
  type PostProcessLineForm,
} from '@/lib/quotes/post-process-lines'
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
  assemblyLines: PostProcessLineForm[]
  testLines: PostProcessLineForm[]
  packingLines: PostProcessLineForm[]
  materialCost: string
  specialDiscount: string
  includeSmd: boolean
  includeDip: boolean
}

const INITIAL_FORM: FormState = {
  customer: '',
  productName: '',
  boardQty: '1000',
  pcbBoardCount: '1',
  assemblyLines: [emptyPostProcessLineForm()],
  testLines: [emptyPostProcessLineForm()],
  packingLines: [emptyPostProcessLineForm()],
  materialCost: '0',
  specialDiscount: '0',
  includeSmd: false,
  includeDip: false,
}

function inferIncludeFlags(quote: QuoteListItem): { includeSmd: boolean; includeDip: boolean } {
  const settings = quote.detailInfo.settings || {}
  if (typeof settings.includeSmd === 'boolean' || typeof settings.includeDip === 'boolean') {
    return {
      includeSmd: Boolean(settings.includeSmd),
      includeDip: Boolean(settings.includeDip),
    }
  }

  const amounts = quote.detailInfo.amounts
  const post = quote.detailInfo.inputs?.postProcess || {}
  const hasSmd =
    (amounts?.smt || 0) > 0 ||
    Boolean(quote.detailInfo.inputs?.smt?.pcbBoards?.some((board) => board.chip || board.icPin || board.bga))
  const hasPostLines =
    Boolean(post.assemblyLines?.length) ||
    Boolean(post.testLines?.length) ||
    Boolean(post.packingLines?.length)
  const hasDip =
    (amounts?.dip || 0) > 0 ||
    (amounts?.assembly || 0) > 0 ||
    (post.postAssembly || 0) > 0 ||
    (post.postTest || 0) > 0 ||
    (post.postPacking || 0) > 0 ||
    hasPostLines ||
    Boolean(
      quote.detailInfo.inputs?.dip?.dipBoards?.some(
        (board) =>
          board.dipGeneral ||
          board.dipConnector ||
          board.dipWire ||
          board.waveGeneral ||
          board.waveConnector ||
          board.waveWire,
      ),
    )

  // 기존 견적(플래그 없음)은 섹션을 열어 두어 편집 가능
  return {
    includeSmd: hasSmd || !hasDip,
    includeDip: hasDip || !hasSmd,
  }
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
    const flags = inferIncludeFlags(quote)
    const pcbBoardCount = String(input.pcbBoardCount || input.pcbBoards?.length || 1)
    const smtForms = input.pcbBoards?.length
      ? input.pcbBoards.map(smtBoardToForm)
      : [defaultSmtBoardForm(0)]
    const dipForms = syncDipNamesFromSmt(
      smtForms,
      input.dipBoards?.length ? input.dipBoards.map(dipBoardToForm) : [defaultDipBoardForm(0)],
    )
    const post = quote.detailInfo.inputs?.postProcess || {}

    return {
      form: {
        customer: quote.customer,
        productName: quote.productName,
        boardQty: String(quote.boardQty || 1000),
        pcbBoardCount,
        assemblyLines: resolvePostProcessLineForms(post.assemblyLines, post.postAssembly, '조립'),
        testLines: resolvePostProcessLineForms(post.testLines, post.postTest, '테스트'),
        packingLines: resolvePostProcessLineForms(post.packingLines, post.postPacking, '포장'),
        materialCost: String(input.materialCost || 0),
        specialDiscount: String(input.specialDiscount || 0),
        includeSmd: flags.includeSmd,
        includeDip: flags.includeDip,
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
  const pcbBoards = form.includeSmd
    ? smtForms.map(smtBoardFormToModel)
    : Array.from({ length: pcbCount }, (_, index) => smtBoardFormToModel(defaultSmtBoardForm(index)))
  const dipBoards = form.includeDip
    ? dipForms.map((dip, index) =>
        dipBoardFormToModel({
          ...dip,
          pcbName: smtForms[index]?.pcbName.trim() || dip.pcbName,
        }),
      )
    : Array.from({ length: pcbCount }, (_, index) =>
        dipBoardFormToModel({
          ...defaultDipBoardForm(index),
          pcbName: smtForms[index]?.pcbName.trim() || `PCB ${index + 1}`,
        }),
      )

  const postAssembly = form.includeDip ? sumPostProcessLineMinutes(form.assemblyLines) : 0
  const postTest = form.includeDip ? sumPostProcessLineMinutes(form.testLines) : 0
  const postPacking = form.includeDip ? sumPostProcessLineMinutes(form.packingLines) : 0

  return calculateEstimate(
    {
      boardQty: form.boardQty,
      materialCost: form.materialCost,
      postAssembly,
      postTest,
      postPacking,
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
    computeEstimate(initial.form, initial.smtForms, initial.dipForms, quoteType, {
      mode,
      quote,
      existingQuoteNumbers,
    }),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [displayCurrency, setDisplayCurrency] = useState<QuoteDisplayCurrency>('usd')
  const [dipTab, setDipTab] = useState<'solder' | 'post'>('solder')
  const [openSections, setOpenSections] = useState({
    smt: true,
    dip: true,
    material: true,
  })

  const isDomestic = quoteType === 'domestic'
  const title =
    mode === 'edit'
      ? `${isDomestic ? '국내용' : '해외용'} 견적서 수정`
      : `${isDomestic ? '국내용' : '해외용'} 견적서 작성`

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

  // 생성·수정 공통: 입력 변경 시 미리보기 자동 갱신
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setResult(
        computeEstimate(form, smtForms, dipForms, quoteType, {
          mode,
          quote,
          existingQuoteNumbers,
        }),
      )
    }, 250)

    return () => window.clearTimeout(timer)
  }, [mode, quote?.quoteNumber, form, smtForms, dipForms, quoteType, existingQuoteNumbers, quote])

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

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }))
  }

  async function handleSave() {
    if (!form.customer.trim() || !form.productName.trim()) {
      setSaveError('고객사와 제품명을 입력해 주세요.')
      return
    }

    const estimate =
      result ??
      computeEstimate(form, smtForms, dipForms, quoteType, {
        mode,
        quote,
        existingQuoteNumbers,
      })

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
    postAssembly: form.includeDip ? String(sumPostProcessLineMinutes(form.assemblyLines)) : '0',
    postTest: form.includeDip ? String(sumPostProcessLineMinutes(form.testLines)) : '0',
    postPacking: form.includeDip ? String(sumPostProcessLineMinutes(form.packingLines)) : '0',
    materialCost: form.materialCost,
    assemblyLines: form.includeDip ? form.assemblyLines : [],
    testLines: form.includeDip ? form.testLines : [],
    packingLines: form.includeDip ? form.packingLines : [],
  }
  const smtSectionNo = form.includeSmd ? 1 : 0
  const dipSectionNo = form.includeDip ? (form.includeSmd ? 2 : 1) : 0
  const materialSectionNo = 1 + Number(form.includeSmd) + Number(form.includeDip)
  const postMinutesTotal = form.includeDip
    ? sumPostProcessLineMinutes(form.assemblyLines) +
      sumPostProcessLineMinutes(form.testLines) +
      sumPostProcessLineMinutes(form.packingLines)
    : 0

  const liveSummary = result
    ? formatQuotePreviewSummary(
        result.values.grandTotal,
        result.qty || 1,
        quoteType,
        displayCurrency,
      )
    : null

  function formatAmount(krw: number) {
    return formatQuoteMoneyByDisplay(krw, quoteType, displayCurrency)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[94dvh] w-full max-w-[min(1680px,98vw)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              입력값이 바뀌면 오른쪽 미리보기가 자동으로 갱신됩니다
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isDomestic ? (
              <QuoteCurrencyToggle value={displayCurrency} onChange={setDisplayCurrency} />
            ) : null}
            {mode === 'edit' ? (
              <>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? '삭제 중...' : '삭제'}
                </button>
              </>
            ) : null}
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

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-slate-200 lg:border-r">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
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

                <div className="mt-3">
                  <span className="mb-1.5 block text-sm font-medium text-slate-600">공정 카테고리</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !form.includeSmd
                        updateForm('includeSmd', next)
                        if (next) setOpenSections((current) => ({ ...current, smt: true }))
                      }}
                      className={
                        form.includeSmd
                          ? 'rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white'
                          : 'rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50'
                      }
                    >
                      SMD
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !form.includeDip
                        updateForm('includeDip', next)
                        if (next) setOpenSections((current) => ({ ...current, dip: true }))
                      }}
                      className={
                        form.includeDip
                          ? 'rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white'
                          : 'rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50'
                      }
                    >
                      DIP
                    </button>
                  </div>
                </div>
              </section>

              {form.includeSmd ? (
                <section className="mb-3 overflow-hidden rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleSection('smt')}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-slate-50"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{smtSectionNo}. SMT</h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        PCB {smtForms.length}개 · 최소 실장비{' '}
                        {formatAmount(getSmtPlacementMinFee(quoteType))}
                      </p>
                    </div>
                    <span className="text-slate-400">{openSections.smt ? '▴' : '▾'}</span>
                  </button>
                  {openSections.smt ? (
                    <div className="border-t border-slate-100 px-3.5 py-3">
                      <p className="mb-3 text-xs text-slate-500">
                        일반 부품은 <strong>부품 개수</strong>, IC/BGA는 <strong>핀·볼 수</strong> ·{' '}
                        {SMT_PLACEMENT_MIN_SCORE}점 이하 PCB는 최소 실장비 적용
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
                    </div>
                  ) : null}
                </section>
              ) : null}

              {form.includeDip ? (
                <section className="mb-3 overflow-hidden rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleSection('dip')}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-slate-50"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{dipSectionNo}. DIP</h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        납땜 {dipForms.length}보드 · 조립·테스트·포장 합계 {postMinutesTotal}분
                      </p>
                    </div>
                    <span className="text-slate-400">{openSections.dip ? '▴' : '▾'}</span>
                  </button>
                  {openSections.dip ? (
                    <div className="border-t border-slate-100 px-3.5 py-3">
                      <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setDipTab('solder')}
                          className={
                            dipTab === 'solder'
                              ? 'flex-1 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm'
                              : 'flex-1 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600'
                          }
                        >
                          납땜
                        </button>
                        <button
                          type="button"
                          onClick={() => setDipTab('post')}
                          className={
                            dipTab === 'post'
                              ? 'flex-1 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm'
                              : 'flex-1 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600'
                          }
                        >
                          조립 · 테스트 · 포장
                        </button>
                      </div>

                      {dipTab === 'solder' ? (
                        <div className="space-y-3">
                          <p className="text-xs text-slate-500">
                            PCB 명칭은 SMT와 동기화됩니다
                          </p>
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
                      ) : (
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                          <PostProcessLinesEditor
                            title="조립"
                            ratePerMinute={getPostRate(quoteType)}
                            lines={form.assemblyLines}
                            quoteType={quoteType}
                            displayCurrency={displayCurrency}
                            onChange={(assemblyLines) => updateForm('assemblyLines', assemblyLines)}
                          />
                          <PostProcessLinesEditor
                            title="테스트"
                            ratePerMinute={getPostRate(quoteType)}
                            lines={form.testLines}
                            quoteType={quoteType}
                            displayCurrency={displayCurrency}
                            onChange={(testLines) => updateForm('testLines', testLines)}
                          />
                          <PostProcessLinesEditor
                            title="포장"
                            ratePerMinute={getPostRate(quoteType)}
                            lines={form.packingLines}
                            quoteType={quoteType}
                            displayCurrency={displayCurrency}
                            onChange={(packingLines) => updateForm('packingLines', packingLines)}
                          />
                        </div>
                      )}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section className="mb-1 overflow-hidden rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => toggleSection('material')}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{materialSectionNo}. 자재</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      원자재 원가 {formatAmount(Number(form.materialCost) || 0)} /대
                    </p>
                  </div>
                  <span className="text-slate-400">{openSections.material ? '▴' : '▾'}</span>
                </button>
                {openSections.material ? (
                  <div className="border-t border-slate-100 px-3.5 py-3">
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
                  </div>
                ) : null}
              </section>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="mb-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">대당 단가</p>
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {liveSummary?.unitFormatted ?? '-'}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[11px] font-medium text-slate-500">최종 합계</p>
                  <p className="truncate text-base font-bold text-slate-900">
                    {liveSummary?.totalFormatted ?? '-'}
                  </p>
                </div>
              </div>
              <ErpButton
                className="w-full"
                onClick={handleSave}
                disabled={saving || deleting}
              >
                {saving ? '저장 중...' : mode === 'edit' ? '견적서 수정 저장' : '견적서 저장'}
              </ErpButton>
              {saveError ? <p className="mt-2 text-sm text-red-600">{saveError}</p> : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden bg-slate-50/70 p-3 lg:p-4">
            <QuoteBreakdownPreview
              quoteType={quoteType}
              result={result}
              form={previewForm}
              displayCurrency={displayCurrency}
              customer={previewCustomer}
              productName={previewProduct}
              issueDate={previewIssueDate}
              loading={!result}
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
