'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords, useAuthProfile } from '@/components/auth/auth-profile-provider'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { ProductCombobox } from '@/components/orders/product-combobox'
import { DipPcbBoardForm } from '@/components/quotes/dip-pcb-board-form'
import { PostProcessLinesEditor } from '@/components/quotes/post-process-lines-editor'
import { QuoteBreakdownPreview } from '@/components/quotes/quote-breakdown-preview'
import { QuoteCurrencyToggle } from '@/components/quotes/quote-currency-toggle'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { SmtPcbBoardForm } from '@/components/quotes/smt-pcb-board-form'
import { ErpButton } from '@/components/ui/erp-button'
import { PdfDownloadButton } from '@/components/ui/pdf-download-button'
import { useBusy } from '@/components/ui/busy-provider'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import {
  computeMetalMaskCostTotal,
  computeSampleCostTotal,
  getPostRate,
  METAL_MASK_COST_DOUBLE,
  METAL_MASK_COST_SINGLE,
  SAMPLE_COST_DOUBLE,
  SAMPLE_COST_SINGLE,
  SAMPLE_QTY_THRESHOLD,
  sampleCostForBoards,
} from '@/lib/quotes/constants'
import { calculateEstimate } from '@/lib/quotes/calculate-estimate'
import { buildQuoteRowPayload } from '@/lib/quotes/build-quote-payload'
import type { QuoteRowPayload } from '@/lib/quotes/build-quote-payload'
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
  resolveUnifiedPostProcessLineForms,
  sumPostProcessLineMinutes,
  type PostProcessLineForm,
} from '@/lib/quotes/post-process-lines'
import { createQuote, deleteQuotes, updateQuote } from '@/lib/quotes/repository'
import { exportQuotesToPdf } from '@/lib/quotes/export-quote-pdf'
import type {
  EstimateResult,
  QuoteDisplayCurrency,
  QuoteListItem,
  QuoteStatus,
  QuoteType,
} from '@/lib/quotes/types'
import { normalizeQuoteStatus, toEstimateInputFromDetail } from '@/lib/quotes/utils'
import { fetchSalesBusinessPartners } from '@/lib/partners/repository'
import {
  EMPTY_PAYMENT_TERM_SNAPSHOT,
  snapshotFromPartner,
} from '@/lib/partners/payment-term-snapshot'
import type { BusinessPartner } from '@/lib/partners/types'
import { resolvePartnerFromInput } from '@/lib/partners/utils'
import { fetchProducts } from '@/lib/products/repository'
import type { Product } from '@/lib/products/types'
import { formatProductOptionLabel } from '@/lib/products/utils'
import { ERP_DANGER_BUTTON_CLASS, ERP_FIELD_INPUT_CLASS } from '@/lib/ui/tokens'

type QuoteModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  quoteType: QuoteType
  quote?: QuoteListItem | null
  existingQuoteNumbers?: string[]
  onClose: () => void
  onSaved?: (message?: string) => void
  onDeleted?: (message?: string) => void
}

type FormState = {
  customer: string
  productName: string
  productId: string
  boardQty: string
  pcbBoardCount: string
  productionKind: '샘플' | '양산'
  postProcessLines: PostProcessLineForm[]
  materialCost: string
  metalMaskCost: string
  specialDiscount: string
  includeSmd: boolean
  includeDip: boolean
}

const INITIAL_FORM: FormState = {
  customer: '',
  productName: '',
  productId: '',
  boardQty: '1000',
  pcbBoardCount: '1',
  productionKind: '양산',
  postProcessLines: [emptyPostProcessLineForm()],
  materialCost: '0',
  metalMaskCost: '0',
  specialDiscount: '0',
  includeSmd: true,
  includeDip: true,
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
    Boolean(post.lines?.length) ||
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
        productId: quote.detailInfo.settings?.productId || '',
        boardQty: String(quote.boardQty || 1000),
        pcbBoardCount,
        productionKind:
          quote.detailInfo.settings?.productionKind === '샘플'
            ? ('샘플' as const)
            : ('양산' as const),
        postProcessLines: resolveUnifiedPostProcessLineForms(post),
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

  const postAssembly = sumPostProcessLineMinutes(form.postProcessLines)

  return calculateEstimate(
    {
      boardQty: form.boardQty,
      materialCost: form.materialCost,
      metalMaskCost: form.metalMaskCost,
      productionKind: form.productionKind,
      postAssembly,
      postTest: 0,
      postPacking: 0,
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
}: Omit<QuoteModalProps, 'open'>) {
  const canDelete = useCanDeleteRecords()
  const { profile } = useAuthProfile()
  const contactEmail = String(profile?.email || '').trim()
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
    setup: true,
    smt: false,
    dip: false,
    material: false,
    other: false,
  })
  const [salesPartners, setSalesPartners] = useState<BusinessPartner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])

  const busyUi = useBusy()
  const { notifyAuthOrFailure } = useWriteFailureToast()
  const busy = saving || deleting

  function requestClose() {
    onClose()
  }

  const isDomestic = quoteType === 'domestic'
  const title =
    mode === 'edit'
      ? `${isDomestic ? '국내용' : '해외용'} 견적서 수정`
      : `${isDomestic ? '국내용' : '해외용'} 견적서 작성`

  useEffect(() => {
    let cancelled = false
    setPartnersLoading(true)
    void Promise.all([fetchSalesBusinessPartners(), fetchProducts()]).then(
      ([partnersResult, productsResult]) => {
        if (cancelled) return
        setPartnersLoading(false)
        if (partnersResult.ok) setSalesPartners(partnersResult.partners)
        if (productsResult.ok) setProducts(productsResult.products)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [busy, onClose])

  useEffect(() => {
    const next = createInitialState(mode, quote)
    setForm(next.form)
    setSmtForms(next.smtForms)
    setDipForms(next.dipForms)
    setResult(
      computeEstimate(next.form, next.smtForms, next.dipForms, quoteType, {
        mode,
        quote,
        existingQuoteNumbers,
      }),
    )
    setSaveError(null)
    setOpenSections({
      setup: mode !== 'edit',
      smt: mode !== 'edit',
      dip: mode !== 'edit',
      material: mode !== 'edit',
      other: mode !== 'edit',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 대상 변경 시 폼 리셋
  }, [mode, quote?.quoteNumber, quoteType])

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

  const currentStatus: QuoteStatus = normalizeQuoteStatus(quote?.quoteStatus)

  async function commitQuoteSave(payload: QuoteRowPayload, message?: string) {
    setSaving(true)
    setSaveError(null)

    const saveResult = await busyUi.run(() =>
      mode === 'edit' && quote
        ? updateQuote(quote.quoteNumber, payload)
        : createQuote(payload, quoteType),
    )

    setSaving(false)

    if (!saveResult.ok) {
      if (!notifyAuthOrFailure(saveResult)) setSaveError(saveResult.detail)
      return
    }

    onSaved?.(message)
  }

  function buildSavePayload(quoteStatus: QuoteStatus) {
    const estimate =
      result ??
      computeEstimate(form, smtForms, dipForms, quoteType, {
        mode,
        quote,
        existingQuoteNumbers,
      })
    const { pcbBoards, dipBoards } = collectBoardModels()
    return buildQuoteRowPayload(form, pcbBoards, dipBoards, estimate, quoteType, quoteStatus)
  }

  async function handleSave() {
    if (!form.customer.trim() || !form.productName.trim()) {
      setSaveError('고객사와 제품명을 입력해 주세요.')
      return
    }
    await commitQuoteSave(
      buildSavePayload(currentStatus),
      mode === 'edit' ? '견적서가 수정되었습니다.' : '견적서가 저장되었습니다.',
    )
  }

  function buildExportQuoteSnapshot(): QuoteListItem | null {
    const estimate =
      result ??
      computeEstimate(form, smtForms, dipForms, quoteType, {
        mode,
        quote,
        existingQuoteNumbers,
      })
    const { pcbBoards, dipBoards } = collectBoardModels()
    const payload = buildQuoteRowPayload(form, pcbBoards, dipBoards, estimate, quoteType, currentStatus)
    const partner = resolvePartnerFromInput(salesPartners, payload.customer)

    return {
      quoteId: quote?.quoteId || estimate.estNo,
      quoteNumber: quote?.quoteNumber || estimate.estNo,
      quoteDate: payload.quote_date,
      quoteType,
      quoteStatus: currentStatus,
      customer: payload.customer,
      productName: payload.product_name,
      boardQty: payload.board_qty,
      totalAmount: payload.total_amount,
      detailInfo: payload.detail_info,
      paymentTerms:
        quote?.paymentTerms?.paymentTermType
          ? quote.paymentTerms
          : partner
            ? snapshotFromPartner(partner)
            : EMPTY_PAYMENT_TERM_SNAPSHOT,
      createdBy: quote?.createdBy ?? null,
      createdByName: quote?.createdByName || '',
      updatedBy: quote?.updatedBy ?? null,
      updatedByName: quote?.updatedByName || '',
      createdAt: quote?.createdAt || '',
    }
  }

  function handleDownloadPdf(language?: 'ko' | 'en') {
    const snapshot = buildExportQuoteSnapshot()
    if (!snapshot) return
    if (!snapshot.customer.trim() || !snapshot.productName.trim()) {
      setSaveError('PDF 전에 고객사와 제품명을 입력해 주세요.')
      return
    }
    exportQuotesToPdf([snapshot], {
      ...(language ? { language } : {}),
      ...(contactEmail ? { contactEmail } : {}),
    })
  }

  async function handleDelete() {
    if (!quote) return

    const confirmMessage = `${quote.quoteNumber} 견적서를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`
    if (!window.confirm(confirmMessage)) return

    setDeleting(true)
    setSaveError(null)

    const deleteResult = await busyUi.run(() => deleteQuotes([quote.quoteNumber]))
    setDeleting(false)

    if (!deleteResult.ok) {
      if (!notifyAuthOrFailure(deleteResult)) setSaveError(deleteResult.detail)
      return
    }

    onDeleted?.()
  }

  const previewCustomer = form.customer.trim() || '-'
  const previewIssueDate =
    mode === 'edit' && quote?.quoteDate ? quote.quoteDate : result?.date || ''
  const previewProduct = form.productName.trim() || '-'
  const previewForm = {
    postAssembly: String(sumPostProcessLineMinutes(form.postProcessLines)),
    postTest: '0',
    postPacking: '0',
    materialCost: form.materialCost,
    metalMaskCost: form.metalMaskCost,
    productionKind: form.productionKind,
    postProcessLines: form.postProcessLines,
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
    (Number(form.metalMaskCost) || 0) + computeSampleCostTotal(form.boardQty, smtForms)
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
                <PdfDownloadButton
                  onDownload={() => handleDownloadPdf()}
                  disabled={busy}
                  menuItems={
                    isDomestic
                      ? [
                          { label: '한글', onDownload: () => handleDownloadPdf('ko') },
                          { label: '영문', onDownload: () => handleDownloadPdf('en') },
                        ]
                      : undefined
                  }
                />
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={busy}
                    className={ERP_DANGER_BUTTON_CLASS}
                  >
                    {deleting ? '삭제 중...' : '삭제'}
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
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
                    <CustomerCombobox
                      value={form.customer}
                      partners={salesPartners}
                      placeholder="거래처명 검색"
                      ariaLabel="고객사"
                      inputClassName={ERP_FIELD_INPUT_CLASS}
                      autoFocus={mode === 'create'}
                      onValueChange={(value) => updateForm('customer', value)}
                      onPartnerSelect={(partner) => updateForm('customer', partner.name)}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {partnersLoading
                        ? '매출 거래처 목록을 불러오는 중…'
                        : salesPartners.length === 0
                          ? '등록된 매출 거래처가 없습니다. 기초등록 → 거래처등록에서 먼저 등록해 주세요.'
                          : '거래처등록의 매출·매입/매출 거래처를 검색해 선택하세요.'}
                    </p>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600">제품명</span>
                    <ProductCombobox
                      value={form.productName}
                      products={products}
                      customer={form.customer}
                      field="name"
                      placeholder="제품명 검색 (버전 포함 가능)"
                      ariaLabel="제품명"
                      inputClassName={ERP_FIELD_INPUT_CLASS}
                      onValueChange={(value) => {
                        setForm((current) => ({
                          ...current,
                          productName: value,
                          productId: '',
                        }))
                      }}
                      onProductSelect={(product) =>
                        setForm((current) => ({
                          ...current,
                          productName: formatProductOptionLabel(product),
                          productId: product.id,
                        }))
                      }
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      품목등록의 반제품·조립제품을 검색해 선택하거나, 직접 입력할 수 있습니다.
                    </p>
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    {sectionNumbers.dip}. {isDomestic ? '후공정' : 'DIP'}
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
                        후공정
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
                      <PostProcessLinesEditor
                        title="후공정"
                        ratePerMinute={getPostRate(quoteType)}
                        lines={form.postProcessLines}
                        quoteType={quoteType}
                        displayCurrency={displayCurrency}
                        onChange={(postProcessLines) => updateForm('postProcessLines', postProcessLines)}
                      />
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
                        SMD 합계 + 후공정 합계의 10% · 자동 반영
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
                    {computeSampleCostTotal(form.boardQty, smtForms) > 0 ? (
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium text-slate-600">샘플 비용</span>
                        <input
                          readOnly
                          value={String(sampleCostForBoards(smtForms))}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          일회성 · 생산수량 {SAMPLE_QTY_THRESHOLD.toLocaleString('ko-KR')}대 미만 시
                          단면 {SAMPLE_COST_SINGLE.toLocaleString('ko-KR')} / 양면·듀얼{' '}
                          {SAMPLE_COST_DOUBLE.toLocaleString('ko-KR')}
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
              <div className="flex gap-2">
                <ErpButton
                  className="min-w-0 flex-1"
                  onClick={() => void handleSave()}
                  disabled={busy}
                  loading={saving}
                >
                  {mode === 'edit' ? '견적서 수정 저장' : '견적서 저장'}
                </ErpButton>
              </div>
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
              contactEmail={contactEmail}
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
