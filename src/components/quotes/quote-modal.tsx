'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { DipPcbBoardForm } from '@/components/quotes/dip-pcb-board-form'
import { PostProcessLinesEditor } from '@/components/quotes/post-process-lines-editor'
import { QuoteBreakdownPreview } from '@/components/quotes/quote-breakdown-preview'
import { QuoteCurrencyToggle } from '@/components/quotes/quote-currency-toggle'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { SmtPcbBoardForm } from '@/components/quotes/smt-pcb-board-form'
import { ErpButton } from '@/components/ui/erp-button'
import {
  computeMetalMaskCostTotal,
  computeSampleCostTotal,
  getPostRate,
  METAL_MASK_COST_DOUBLE,
  METAL_MASK_COST_SINGLE,
  SAMPLE_COST,
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
import { buildOrderPayloadFromQuote } from '@/lib/orders/from-quote'
import { createOrder, findOrderNumberBySourceQuoteId } from '@/lib/orders/repository'
import { fetchSalesBusinessPartners } from '@/lib/partners/repository'
import { fetchProducts } from '@/lib/products/repository'

type QuoteModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  quoteType: QuoteType
  quote?: QuoteListItem | null
  existingQuoteNumbers?: string[]
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
  /** 주문서로 전환 성공 시 (주문번호) */
  onConvertedToOrder?: (orderNumber: string) => void
}

type FormState = {
  customer: string
  productName: string
  boardQty: string
  pcbBoardCount: string
  productionKind: '샘플' | '양산'
  assemblyLines: PostProcessLineForm[]
  testLines: PostProcessLineForm[]
  packingLines: PostProcessLineForm[]
  materialCost: string
  metalMaskCost: string
  specialDiscount: string
  includeSmd: boolean
  includeDip: boolean
}

const INITIAL_FORM: FormState = {
  customer: '',
  productName: '',
  boardQty: '1000',
  pcbBoardCount: '1',
  productionKind: '양산',
  assemblyLines: [emptyPostProcessLineForm()],
  testLines: [emptyPostProcessLineForm()],
  packingLines: [emptyPostProcessLineForm()],
  materialCost: '0',
  metalMaskCost: '0',
  specialDiscount: '0',
  includeSmd: true,
  includeDip: false,
}

type ProcessKind = 'smd' | 'dip' | 'smd_dip'

function processKindFromFlags(includeSmd: boolean, includeDip: boolean): ProcessKind {
  if (includeSmd && includeDip) return 'smd_dip'
  if (includeDip) return 'dip'
  return 'smd'
}

function flagsFromProcessKind(kind: ProcessKind): Pick<FormState, 'includeSmd' | 'includeDip'> {
  if (kind === 'dip') return { includeSmd: false, includeDip: true }
  if (kind === 'smd_dip') return { includeSmd: true, includeDip: true }
  return { includeSmd: true, includeDip: false }
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
        productionKind:
          quote.detailInfo.settings?.productionKind === '샘플'
            ? ('샘플' as const)
            : ('양산' as const),
        assemblyLines: resolvePostProcessLineForms(post.assemblyLines, post.postAssembly, '조립'),
        testLines: resolvePostProcessLineForms(post.testLines, post.postTest, '테스트'),
        packingLines: resolvePostProcessLineForms(post.packingLines, post.postPacking, '포장'),
        materialCost: String(input.materialCost || 0),
        metalMaskCost: String(
          input.metalMaskCost ??
            computeMetalMaskCostTotal(
              input.pcbBoards || smtForms.map(smtBoardFormToModel),
              flags.includeSmd,
            ),
        ),
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
  const pcbBoards = smtForms.map(smtBoardFormToModel)
  const dipBoards = dipForms.map((dip, index) =>
    dipBoardFormToModel({
      ...dip,
      pcbName: smtForms[index]?.pcbName.trim() || dip.pcbName,
    }),
  )

  const postAssembly = sumPostProcessLineMinutes(form.assemblyLines)
  const postTest = sumPostProcessLineMinutes(form.testLines)
  const postPacking = sumPostProcessLineMinutes(form.packingLines)

  return calculateEstimate(
    {
      boardQty: form.boardQty,
      materialCost: form.materialCost,
      metalMaskCost: form.metalMaskCost,
      productionKind: form.productionKind,
      postAssembly,
      postTest,
      postPacking,
      specialDiscount: form.specialDiscount,
      pcbBoardCount: pcbCount,
      pcbBoards,
      dipBoards,
      quoteType,
      existingQuoteNumber: options.mode === 'edit' ? options.quote?.quoteNumber : undefined,
      includeSmd: true,
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
  onConvertedToOrder,
}: Omit<QuoteModalProps, 'open'>) {
  const canDelete = useCanDeleteRecords()
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
  const [converting, setConverting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [displayCurrency, setDisplayCurrency] = useState<QuoteDisplayCurrency>('usd')
  const [dipTab, setDipTab] = useState<'solder' | 'post'>('solder')
  const [openSections, setOpenSections] = useState({
    setup: mode !== 'edit',
    smt: mode !== 'edit',
    dip: mode !== 'edit',
    material: mode !== 'edit',
    other: mode !== 'edit',
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

  // SMT 단면/양면·PCB 수에 따라 메탈마스크 비용 자동 반영
  useEffect(() => {
    const next = String(
      computeMetalMaskCostTotal(smtForms.map((board) => ({ smtSide: board.smtSide }))),
    )
    setForm((current) =>
      current.metalMaskCost === next ? current : { ...current, metalMaskCost: next },
    )
  }, [smtForms])

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

  function setBoardCount(nextCount: number) {
    const count = Number(clampPcbCount(String(nextCount)))
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

  function handleDownloadPdf(language?: 'ko' | 'en') {
    if (!quote) return
    exportQuotesToPdf([quote], language ? { language } : undefined)
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

  async function handleConvertToOrder() {
    if (!quote) return
    if (!result) {
      setSaveError('견적 금액을 계산한 뒤 전환해 주세요.')
      return
    }

    if (
      !window.confirm(
        `${quote.quoteNumber} 견적을 주문서로 전환할까요?\n현재 화면에 표시된 고객사·제품·수량·금액 기준으로 생성됩니다.`,
      )
    ) {
      return
    }

    setConverting(true)
    setSaveError(null)

    const existing = await findOrderNumberBySourceQuoteId(quote.quoteId)
    if (!existing.ok) {
      setConverting(false)
      setSaveError(existing.detail)
      return
    }
    if (existing.orderNumber) {
      const proceed = window.confirm(
        `이미 이 견적으로 만든 주문서(${existing.orderNumber})가 있습니다.\n추가로 생성할까요?`,
      )
      if (!proceed) {
        setConverting(false)
        return
      }
    }

    const [productsResult, partnersResult] = await Promise.all([
      fetchProducts(),
      fetchSalesBusinessPartners(),
    ])

    if (!productsResult.ok) {
      setConverting(false)
      setSaveError(productsResult.detail)
      return
    }
    if (!partnersResult.ok) {
      setConverting(false)
      setSaveError(partnersResult.detail)
      return
    }

    const built = buildOrderPayloadFromQuote(
      {
        quoteId: quote.quoteId,
        quoteNumber: quote.quoteNumber,
        customer: form.customer,
        productName: form.productName,
        boardQty: Number(form.boardQty) || result.qty || 0,
        totalAmount: result.values.grandTotal,
        category: form.productionKind,
      },
      productsResult.products,
      partnersResult.partners,
    )

    if (!built.ok) {
      setConverting(false)
      setSaveError(built.detail)
      return
    }

    const createResult = await createOrder(built.payload)
    setConverting(false)

    if (!createResult.ok) {
      setSaveError(createResult.detail)
      return
    }

    onConvertedToOrder?.(createResult.orderNumber)
  }

  const previewCustomer = form.customer.trim() || '-'
  const previewIssueDate =
    mode === 'edit' && quote?.quoteDate ? quote.quoteDate : result?.date || ''
  const previewProduct = form.productName.trim() || '-'
  const previewForm = {
    postAssembly: String(sumPostProcessLineMinutes(form.assemblyLines)),
    postTest: String(sumPostProcessLineMinutes(form.testLines)),
    postPacking: String(sumPostProcessLineMinutes(form.packingLines)),
    materialCost: form.materialCost,
    metalMaskCost: form.metalMaskCost,
    productionKind: form.productionKind,
    assemblyLines: form.assemblyLines,
    testLines: form.testLines,
    packingLines: form.packingLines,
  }
  const sectionNumbers = {
    setup: 1,
    smt: 2,
    dip: 3,
    material: 4,
    other: 5,
  }

  const qty = result?.qty || Number(form.boardQty) || 1
  const setupSectionTotal = result?.common.smtSetup || 0
  const smdSectionTotal = Math.max(0, (result?.values.smt || 0) - (result?.common.smtSetup || 0))
  const dipSectionTotal = (result?.values.dip || 0) + (result?.values.postProcess || 0)
  const materialSectionTotal =
    (Number(form.materialCost) || 0) * qty +
    (result?.common.materialManagement || 0) +
    (result?.common.auxiliaryMaterial || 0)
  const otherSectionTotal =
    (Number(form.metalMaskCost) || 0) + computeSampleCostTotal(form.productionKind)
  const auxiliaryMaterialPerUnit =
    qty > 0 ? (result?.common.auxiliaryMaterial || 0) / qty : 0
  const boardCount = Number(clampPcbCount(form.pcbBoardCount))

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
                  onClick={() => void handleConvertToOrder()}
                  disabled={converting || deleting || saving}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {converting ? '전환 중…' : '주문서로 전환'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf()}
                  className="inline-flex items-center rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-105"
                >
                  PDF
                </button>
                {isDomestic ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf('en')}
                    className="inline-flex items-center rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
                  >
                    영문 PDF
                  </button>
                ) : null}
                {canDelete ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting || converting}
                    className="inline-flex items-center rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting ? '삭제 중...' : '삭제'}
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              disabled={deleting || converting}
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
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600">생산 수량</span>
                    <QuoteNumericInput
                      min={1}
                      value={form.boardQty}
                      onChange={(boardQty) => updateForm('boardQty', boardQty)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600">구분</span>
                    <select
                      value={form.productionKind}
                      onChange={(event) =>
                        updateForm('productionKind', event.target.value as '샘플' | '양산')
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800"
                    >
                      <option value="양산">양산</option>
                      <option value="샘플">샘플</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600">공정</span>
                    <select
                      value={processKindFromFlags(form.includeSmd, form.includeDip)}
                      onChange={(event) => {
                        const kind = event.target.value as ProcessKind
                        const flags = flagsFromProcessKind(kind)
                        setForm((current) => ({ ...current, ...flags }))
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800"
                    >
                      <option value="smd">SMD</option>
                      <option value="dip">DIP</option>
                      <option value="smd_dip">SMD+DIP</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="mb-3 overflow-hidden rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => toggleSection('setup')}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50"
                >
                  <h3 className="min-w-0 flex-1 text-sm font-bold text-slate-900">
                    {sectionNumbers.setup}. SET-UP
                  </h3>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                    {formatAmount(setupSectionTotal)}
                  </span>
                  <span className="shrink-0 text-slate-400">{openSections.setup ? '▴' : '▾'}</span>
                </button>
                {openSections.setup ? (
                  <div className="space-y-3 border-t border-slate-100 px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-500">
                        PCB 보드 {boardCount}개
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBoardCount(boardCount - 1)}
                          disabled={boardCount <= 1}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          보드 삭제
                        </button>
                        <button
                          type="button"
                          onClick={() => setBoardCount(boardCount + 1)}
                          disabled={boardCount >= 20}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          보드 추가
                        </button>
                      </div>
                    </div>
                    {smtForms.map((board, index) => (
                      <SmtPcbBoardForm
                        key={`setup-${index}`}
                        board={board}
                        mode="setup"
                        boardIndex={index}
                        boardCount={smtForms.length}
                        quoteType={quoteType}
                        displayCurrency={displayCurrency}
                        onChange={(next) => updateSmtBoard(index, next)}
                      />
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="mb-3 overflow-hidden rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => toggleSection('smt')}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50"
                >
                  <h3 className="min-w-0 flex-1 text-sm font-bold text-slate-900">
                    {sectionNumbers.smt}. SMD
                  </h3>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                    {formatAmount(smdSectionTotal)}
                  </span>
                  <span className="shrink-0 text-slate-400">{openSections.smt ? '▴' : '▾'}</span>
                </button>
                {openSections.smt ? (
                  <div className="space-y-3 border-t border-slate-100 px-3.5 py-3">
                    {smtForms.map((board, index) => (
                      <SmtPcbBoardForm
                        key={`smd-${index}`}
                        board={board}
                        mode="smd"
                        boardIndex={index}
                        boardCount={smtForms.length}
                        quoteType={quoteType}
                        displayCurrency={displayCurrency}
                        onChange={(next) => updateSmtBoard(index, next)}
                      />
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="mb-3 overflow-hidden rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => toggleSection('dip')}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50"
                >
                  <h3 className="min-w-0 flex-1 text-sm font-bold text-slate-900">
                    {sectionNumbers.dip}. DIP
                  </h3>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                    {formatAmount(dipSectionTotal)}
                  </span>
                  <span className="shrink-0 text-slate-400">{openSections.dip ? '▴' : '▾'}</span>
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
                        {dipForms.map((board, index) => (
                          <DipPcbBoardForm
                            key={index}
                            board={board}
                            boardIndex={index}
                            boardCount={dipForms.length}
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

              <section className="mb-3 overflow-hidden rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => toggleSection('material')}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50"
                >
                  <h3 className="min-w-0 flex-1 text-sm font-bold text-slate-900">
                    {sectionNumbers.material}. 자재
                  </h3>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                    {formatAmount(materialSectionTotal)}
                  </span>
                  <span className="shrink-0 text-slate-400">{openSections.material ? '▴' : '▾'}</span>
                </button>
                {openSections.material ? (
                  <div className="space-y-3 border-t border-slate-100 px-3.5 py-3">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-600">원자재 비용(대당)</span>
                      <QuoteNumericInput
                        min={0}
                        value={form.materialCost}
                        onChange={(materialCost) => updateForm('materialCost', materialCost)}
                        placeholder="원자재 비용을 입력하세요"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-600">부자재 비용(대당)</span>
                      <input
                        readOnly
                        value={
                          Number.isFinite(auxiliaryMaterialPerUnit)
                            ? String(
                                Math.round(auxiliaryMaterialPerUnit * 100) / 100,
                              )
                            : '0'
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        SMD 합계 + DIP 합계의 5% · 자동 반영
                      </p>
                    </label>
                  </div>
                ) : null}
              </section>

              <section className="mb-1 overflow-hidden rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => toggleSection('other')}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50"
                >
                  <h3 className="min-w-0 flex-1 text-sm font-bold text-slate-900">
                    {sectionNumbers.other}. 기타
                  </h3>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                    {formatAmount(otherSectionTotal)}
                  </span>
                  <span className="shrink-0 text-slate-400">{openSections.other ? '▴' : '▾'}</span>
                </button>
                {openSections.other ? (
                  <div className="space-y-3 border-t border-slate-100 px-3.5 py-3">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-slate-600">
                        메탈마스크 비용 (일회성)
                      </span>
                      <QuoteNumericInput
                        min={0}
                        value={form.metalMaskCost}
                        onChange={(metalMaskCost) => updateForm('metalMaskCost', metalMaskCost)}
                        placeholder="일회성 메탈마스크 비용"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        일회성 · PCB 단면 {formatAmount(METAL_MASK_COST_SINGLE)} / 듀얼·양면{' '}
                        {formatAmount(METAL_MASK_COST_DOUBLE)} · SMT 보드 기준 자동 계산 (수정 가능)
                      </p>
                    </label>
                    {form.productionKind === '샘플' ? (
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium text-slate-600">샘플 비용</span>
                        <input
                          readOnly
                          value={String(SAMPLE_COST)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          일회성 · 구분 샘플 시 {formatAmount(SAMPLE_COST)} 고정
                        </p>
                      </label>
                    ) : null}
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
              productionKind={form.productionKind}
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
