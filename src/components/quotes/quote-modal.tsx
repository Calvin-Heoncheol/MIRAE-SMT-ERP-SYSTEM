'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCanDeleteRecords, useAuthProfile } from '@/components/auth/auth-profile-provider'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { ProductCombobox } from '@/components/orders/product-combobox'
import { DipPcbBoardForm } from '@/components/quotes/dip-pcb-board-form'
import { PostProcessLinesEditor } from '@/components/quotes/post-process-lines-editor'
import { QuoteBreakdownPreview } from '@/components/quotes/quote-breakdown-preview'
import { QuoteCurrencyToggle } from '@/components/quotes/quote-currency-toggle'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { QuoteSetupInputPanel } from '@/components/quotes/quote-setup-input-panel'
import { SmtPcbBoardForm } from '@/components/quotes/smt-pcb-board-form'
import type { AiQuoteDraft } from '@/lib/quotes/ai-quote-draft'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { PdfDownloadButton } from '@/components/ui/pdf-download-button'
import { useBusy } from '@/components/ui/busy-provider'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import {
  computeSampleCostTotal,
  DEFAULT_QUOTE_RATES,
  defaultMetalMaskSide,
  getPostRate,
  normalizeQuoteRates,
  resolveQuoteDetailRates,
  setActiveQuoteRates,
} from '@/lib/quotes/constants'
import { diffQuoteRates } from '@/lib/quotes/rate-fields'
import type { CurrentQuoteRates } from '@/lib/quotes/rate-repository'
import { buildQuoteRowPayload } from '@/lib/quotes/build-quote-payload'
import type { QuoteRowPayload } from '@/lib/quotes/build-quote-payload'
import { formatQuoteMoneyByDisplay, formatQuotePreviewSummary } from '@/lib/quotes/format'
import {
  defaultDipBoardForm,
  defaultSmtBoardForm,
  dipBoardFormToModel,
  resizeBoardForms,
  smtBoardFormToModel,
  type DipBoardForm,
  type SmtBoardForm,
} from '@/lib/quotes/form-state'
import {
  defaultPostProcessBufferPercent,
  sumPostProcessBilledMinutes,
  type PostProcessCategory,
} from '@/lib/quotes/post-process-lines'
import { createQuote, deleteQuotes, updateQuote } from '@/lib/quotes/repository'
import { exportQuotesToPdf } from '@/lib/quotes/export-quote-pdf'
import { fetchProcessBillingCodesByItemId } from '@/lib/items/repository'
import type {
  EstimateResult,
  QuoteDisplayCurrency,
  QuoteListItem,
  QuoteStatus,
  QuoteType,
} from '@/lib/quotes/types'
import { normalizeQuoteStatus } from '@/lib/quotes/utils'
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
import { buildOrderPayloadFromQuote } from '@/lib/orders/from-quote'
import { createOrder } from '@/lib/orders/repository'
import { ERP_ERROR_TEXT_CLASS, ERP_FIELD_INPUT_CLASS } from '@/lib/ui/tokens'
import {
  applyAiQuoteDraft,
  clampPcbCount,
  computeEstimate,
  createInitialState,
  fillProductFromList,
  syncDipNamesFromSmt,
  type FormState,
} from '@/lib/quotes/quote-modal-state'

type QuoteModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  quoteType: QuoteType
  quote?: QuoteListItem | null
  /** 기존 견적 내용으로 새 견적 작성 */
  copyFrom?: QuoteListItem | null
  initialDraft?: AiQuoteDraft
  /** 신규·복사 작성에 적용할 현재 단가표 */
  currentRates?: CurrentQuoteRates
  onClose: () => void
  onSaved?: (message?: string) => void
  onDeleted?: (message?: string) => void
  /** 수정 모드에서 이 견적으로 새 작성 */
  onCopyRequest?: (quote: QuoteListItem) => void
}

const POST_PROCESS_EDITORS: Record<
  PostProcessCategory,
  { title: string; field: 'assemblyLines' | 'downloadLines' | 'testLines' | 'packingLines' }
> = {
  assembly: { title: '조립', field: 'assemblyLines' },
  download: { title: '다운로드', field: 'downloadLines' },
  test: { title: '테스트', field: 'testLines' },
  packing: { title: '포장', field: 'packingLines' },
}

function QuoteModalContent({
  mode,
  quoteType,
  quote,
  copyFrom,
  initialDraft,
  currentRates,
  onClose,
  onSaved,
  onDeleted,
  onCopyRequest,
}: Omit<QuoteModalProps, 'open'>) {
  const canDelete = useCanDeleteRecords()
  const confirm = useErpConfirm()
  const { profile } = useAuthProfile()
  const contactEmail = String(profile?.email || '').trim()
  const latestRates = useMemo(
    () => normalizeQuoteRates(currentRates?.rates ?? DEFAULT_QUOTE_RATES),
    [currentRates?.rates],
  )
  const savedRates = useMemo(
    () => (mode === 'edit' && quote ? resolveQuoteDetailRates(quote.detailInfo) : null),
    [mode, quote],
  )
  const [applyLatestRates, setApplyLatestRates] = useState(false)
  const quoteRates = savedRates && !applyLatestRates ? savedRates : latestRates
  const quoteRatesVersionId =
    savedRates && !applyLatestRates
      ? quote?.detailInfo.settings?.ratesVersionId
      : currentRates?.versionId ?? undefined
  const savedRateChanges = useMemo(
    () => (savedRates ? diffQuoteRates(savedRates, latestRates) : []),
    [savedRates, latestRates],
  )
  // 하위 입력 폼·미리보기가 getPostRate 등으로 이 견적의 단가표를 읽도록 렌더마다 적용
  setActiveQuoteRates(quoteRates)
  useEffect(() => () => setActiveQuoteRates(null), [])

  // 모달은 대상(견적·복사·초안)마다 key 로 새로 마운트되므로 초기값은 마운트 시 한 번만 계산
  const [seeded] = useState(() => {
    const initial = createInitialState(mode, quote, copyFrom)
    return mode === 'create' && initialDraft ? applyAiQuoteDraft(initial, initialDraft) : initial
  })
  const [form, setForm] = useState<FormState>(seeded.form)
  const [smtForms, setSmtForms] = useState(seeded.smtForms)
  const [dipForms, setDipForms] = useState(seeded.dipForms)
  const [result, setResult] = useState<EstimateResult | null>(() =>
    computeEstimate(seeded.form, seeded.smtForms, seeded.dipForms, quoteType, {
      mode,
      quote,
      rates: quoteRates,
    }),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [displayCurrency, setDisplayCurrency] = useState<QuoteDisplayCurrency>('krw')
  const [openSections, setOpenSections] = useState({
    smt: true,
    dip: mode !== 'edit',
    material: mode !== 'edit',
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
      : copyFrom
        ? `${isDomestic ? '국내용' : '해외용'} 견적서 복사 작성`
        : `${isDomestic ? '국내용' : '해외용'} 견적서 작성`

  useEffect(() => {
    let cancelled = false
    void Promise.all([fetchSalesBusinessPartners(), fetchProducts()]).then(
      ([partnersResult, productsResult]) => {
        if (cancelled) return
        setPartnersLoading(false)
        if (partnersResult.ok) setSalesPartners(partnersResult.partners)
        if (productsResult.ok) {
          setProducts(productsResult.products)
          if (productsResult.products.length) {
            setForm((current) => fillProductFromList(current, productsResult.products))
          }
        }
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

  // 생성·수정 공통: 입력 변경 시 미리보기 자동 갱신
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setResult(
        computeEstimate(form, smtForms, dipForms, quoteType, {
          mode,
          quote,
          rates: quoteRates,
        }),
      )
    }, 250)

    return () => window.clearTimeout(timer)
  }, [mode, quote?.quoteNumber, form, smtForms, dipForms, quoteType, quote, quoteRates])

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

  function buildRatedQuoteRowPayload(quoteStatus: QuoteStatus) {
    const estimate = computeEstimate(form, smtForms, dipForms, quoteType, {
      mode,
      quote,
      rates: quoteRates,
    })
    const { pcbBoards, dipBoards } = collectBoardModels()
    const payload = buildQuoteRowPayload(
      { ...form, rates: quoteRates, ratesVersionId: quoteRatesVersionId },
      pcbBoards,
      dipBoards,
      estimate,
      quoteType,
      quoteStatus,
    )
    return { estimate, payload }
  }

  function buildSavePayload(quoteStatus: QuoteStatus) {
    return buildRatedQuoteRowPayload(quoteStatus).payload
  }

  async function handleSave() {
    const productLabel = form.productName.trim() || form.productCode.trim()
    if (!form.customer.trim() || !productLabel) {
      setSaveError('고객사와 제품코드 또는 제품명을 입력해 주세요.')
      return
    }
    const payload = buildSavePayload(currentStatus)
    if (!payload.product_name.trim()) {
      payload.product_name = productLabel
    }
    await commitQuoteSave(
      payload,
      mode === 'edit' ? '견적서가 수정되었습니다.' : '견적서가 저장되었습니다.',
    )
  }

  function buildExportQuoteSnapshot(): QuoteListItem | null {
    const { estimate, payload } = buildRatedQuoteRowPayload(currentStatus)
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

  async function handleDownloadPdf() {
    const snapshot = buildExportQuoteSnapshot()
    if (!snapshot) return
    if (!snapshot.customer.trim() || !snapshot.productName.trim()) {
      setSaveError('PDF 전에 고객사와 제품코드 또는 제품명을 입력해 주세요.')
      return
    }
    const language = resolvePartnerFromInput(salesPartners, snapshot.customer)?.documentLanguage
    const processBillingCodesByItemId = snapshot.detailInfo.settings?.productId
      ? await fetchProcessBillingCodesByItemId()
      : undefined
    exportQuotesToPdf([snapshot], {
      ...(language ? { language } : {}),
      ...(contactEmail ? { contactEmail } : {}),
      displayCurrency,
      ...(processBillingCodesByItemId ? { processBillingCodesByItemId } : {}),
    })
  }

  async function handleCreateOrderFromQuote() {
    const snapshot = buildExportQuoteSnapshot()
    if (!snapshot) return
    if (!snapshot.customer.trim() || !snapshot.productName.trim()) {
      setSaveError('발주 등록 전에 고객사와 제품코드 또는 제품명을 입력해 주세요.')
      return
    }
    if (!(snapshot.boardQty > 0)) {
      setSaveError('발주 등록 전에 수량이 있어야 합니다.')
      return
    }

    if (
      !(await confirm({
        title: '발주서 등록',
        message: `견적 ${snapshot.quoteNumber}의 공정·단가로 발주서를 등록할까요?`,
        confirmLabel: '발주 등록',
      }))
    ) {
      return
    }

    setSaveError(null)
    const built = buildOrderPayloadFromQuote({ quote: snapshot }, products, salesPartners)
    if (!built.ok) {
      setSaveError(built.detail)
      return
    }

    const resultOrder = await busyUi.run(() => createOrder(built.payload))
    if (!resultOrder.ok) {
      if (!notifyAuthOrFailure(resultOrder)) setSaveError(resultOrder.detail)
      return
    }

    onSaved?.(`발주서 ${resultOrder.orderId}가 등록되었습니다.`)
  }

  async function handleDelete() {
    if (!quote) return

    if (
      !(await confirm({
        title: '견적서 삭제',
        message: `${quote.quoteNumber} 견적서를 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }

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
  const previewIssueDate = form.quoteDate.trim() || result?.date || ''
  const previewProduct = form.productName.trim() || '-'
  const previewForm = {
    postAssembly: String(
      sumPostProcessBilledMinutes(
        form.assemblyLines,
        form.boardQty,
        form.postProcessBufferPercent,
      ),
    ),
    postDownload: String(
      sumPostProcessBilledMinutes(
        form.downloadLines,
        form.boardQty,
        form.postProcessBufferPercent,
      ),
    ),
    postTest: String(
      sumPostProcessBilledMinutes(form.testLines, form.boardQty, form.postProcessBufferPercent),
    ),
    postPacking: String(
      sumPostProcessBilledMinutes(form.packingLines, form.boardQty, form.postProcessBufferPercent),
    ),
    materialCost: form.materialCost,
    metalMaskCost: result?.common.subMaterial ?? 0,
    productionKind: form.productionKind,
    includeVat: form.includeVat,
    includeMaterialCosts: form.includeMaterialCosts,
    includeMetalMask: form.includeMetalMask,
    timeBufferPercent: form.postProcessBufferPercent,
    postProcessOrder: form.postProcessOrder,
    assemblyLines: form.assemblyLines,
    downloadLines: form.downloadLines,
    testLines: form.testLines,
    packingLines: form.packingLines,
  }
  const sectionNumbers = {
    smt: 1,
    dip: 2,
    material: 3,
  }

  const qty = result?.qty || Number(form.boardQty) || 1
  const orderLevelTotal = result?.common.orderLevelTotal || 0
  const setupSectionTotal = result?.common.smtSetup || 0
  const metalMaskTotal = result?.common.subMaterial || 0
  const sampleSectionTotal = result?.common.sampleCost || 0
  const smdPlacementTotal = result?.common.smtPlacementTotal || 0
  const smdLaborTotal = (result?.common.smtLaborPerUnit || 0) * qty
  const smdInspectionTotal = (result?.common.smtInspectionPerUnit || 0) * qty
  const smdSectionTotal = smdPlacementTotal
  const dipSectionTotal =
    (result?.values.dip || 0) +
    (result?.values.postProcess || 0)
  const materialSectionTotal =
    (Number(form.materialCost) || 0) * qty + (result?.common.materialManagement || 0)
  const samplePreview = computeSampleCostTotal(
    form.boardQty,
    smtForms.map(smtBoardFormToModel),
    form.productionKind,
  )
  const boardCount = Number(clampPcbCount(form.pcbBoardCount))

  const liveSummary = result
    ? formatQuotePreviewSummary(
        result.values.grandTotal,
        result.qty || 1,
        quoteType,
        displayCurrency,
        result.values.metalMask,
        form.includeVat,
      )
    : null
  const liveVatSuffix = isDomestic && form.includeVat ? ' (VAT 포함)' : ''

  function formatAmount(krw: number) {
    return formatQuoteMoneyByDisplay(krw, quoteType, displayCurrency)
  }

  return (
    <ErpModal
      open
      size="wide"
      title={title}
      description="입력값이 바뀌면 오른쪽 미리보기가 자동으로 갱신됩니다"
      onClose={requestClose}
      closeOnEscape={!busy}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      headerActions={
        <>
          {!isDomestic ? (
            <QuoteCurrencyToggle value={displayCurrency} onChange={setDisplayCurrency} />
          ) : null}
          {mode === 'edit' ? (
            <>
              <ErpButton
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void handleCreateOrderFromQuote()}
              >
                발주 등록
              </ErpButton>
              <PdfDownloadButton
                onDownload={() => void handleDownloadPdf()}
                disabled={busy}
              />
            </>
          ) : null}
        </>
      }
    >
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-slate-200 lg:border-r">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {savedRates && savedRateChanges.length ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                  <span>
                    {applyLatestRates
                      ? '현재 단가를 적용해 다시 계산 중입니다. 저장하면 이 단가로 바뀝니다.'
                      : `저장 당시 단가로 계산 중입니다. 현재 단가와 ${savedRateChanges.length}개 항목이 다릅니다.`}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setApplyLatestRates((value) => !value)}
                    className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-100"
                    title={savedRateChanges.map((change) => `${change.label} ${change.from}→${change.to}`).join('\n')}
                  >
                    {applyLatestRates ? '저장 당시 단가로 되돌리기' : '현재 단가 적용'}
                  </button>
                </div>
              ) : null}
              <section className="mb-3 rounded-xl border border-slate-200 p-3.5">
                <h3 className="mb-3 text-sm font-bold text-slate-900">기본 정보</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600">견적일</span>
                    <input
                      type="date"
                      value={form.quoteDate}
                      onChange={(event) => updateForm('quoteDate', event.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block font-medium text-slate-600">고객사</span>
                    <CustomerCombobox
                      value={form.customer}
                      partners={salesPartners}
                      placeholder="거래처명 검색"
                      ariaLabel="고객사"
                      inputClassName={ERP_FIELD_INPUT_CLASS}
                      autoFocus={mode === 'create'}
                      onValueChange={(value) => {
                        const partner = resolvePartnerFromInput(salesPartners, value)
                        setForm((current) => ({
                          ...current,
                          customer: value,
                          ...(partner ? { includeVat: partner.includeVat } : {}),
                        }))
                      }}
                      onPartnerSelect={(partner) =>
                        setForm((current) => ({
                          ...current,
                          customer: partner.name,
                          includeVat: partner.includeVat,
                        }))
                      }
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {partnersLoading
                        ? '거래처 목록을 불러오는 중…'
                        : salesPartners.length === 0
                          ? '등록된 거래처가 없습니다. 기초등록 → 거래처등록에서 먼저 등록해 주세요.'
                          : '거래처등록의 거래처를 검색해 선택하세요.'}
                    </p>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600">제품코드</span>
                    <ProductCombobox
                      value={form.productCode}
                      products={products}
                      customer={form.customer}
                      field="code"
                      placeholder="코드 검색 또는 직접 입력"
                      ariaLabel="제품코드"
                      inputClassName={ERP_FIELD_INPUT_CLASS}
                      onValueChange={(value) => {
                        setForm((current) => ({
                          ...current,
                          productCode: value,
                          productId: '',
                        }))
                      }}
                      onProductSelect={(product) =>
                        setForm((current) => ({
                          ...current,
                          productCode: product.productCode,
                          productName: formatProductOptionLabel(product),
                          productId: product.id,
                        }))
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600">제품명</span>
                    <ProductCombobox
                      value={form.productName}
                      products={products}
                      customer={form.customer}
                      field="name"
                      placeholder="제품명 검색 또는 직접 입력"
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
                          productCode: product.productCode,
                          productName: formatProductOptionLabel(product),
                          productId: product.id,
                        }))
                      }
                    />
                  </label>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  품목등록에서 검색해 선택하거나, 미등록 제품도 코드·이름을 직접 입력해 견적할 수 있습니다.
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-600">생산 수량</span>
                    <QuoteNumericInput
                      min={1}
                      value={form.boardQty}
                      onChange={(boardQty) =>
                        setForm((current) => ({
                          ...current,
                          boardQty,
                          postProcessBufferPercent: String(
                            defaultPostProcessBufferPercent(boardQty),
                          ),
                        }))
                      }
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
                  onClick={() => toggleSection('smt')}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50"
                >
                  <h3 className="min-w-0 flex-1 text-sm font-bold text-slate-900">
                    {sectionNumbers.smt}. SMD
                  </h3>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                    {formatAmount(orderLevelTotal + smdSectionTotal)}
                  </span>
                  <span className="shrink-0 text-slate-400">{openSections.smt ? '▴' : '▾'}</span>
                </button>
                {openSections.smt ? (
                  <div className="space-y-4 border-t border-slate-100 px-3.5 py-3">
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

                    <QuoteSetupInputPanel
                      result={result}
                      form={previewForm}
                      quoteType={quoteType}
                      displayCurrency={displayCurrency}
                      smtForms={smtForms}
                      qty={qty}
                      setupSectionTotal={setupSectionTotal}
                      metalMaskTotal={metalMaskTotal}
                      sampleSectionTotal={sampleSectionTotal}
                      samplePreview={samplePreview}
                      orderLevelTotal={orderLevelTotal}
                      onSmtBoardChange={updateSmtBoard}
                      onIncludeMetalMaskChange={(checked) =>
                        updateForm('includeMetalMask', checked)
                      }
                      metalMaskSide={form.metalMaskSide ?? defaultMetalMaskSide(smtForms)}
                      onMetalMaskSideChange={(side) => updateForm('metalMaskSide', side)}
                      formatAmount={formatAmount}
                    />

                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3 bg-slate-50 px-3 py-2.5">
                        <h4 className="min-w-0 flex-1 text-xs font-bold tracking-wide text-slate-700">
                          실장·검사 (대당 × {qty.toLocaleString('ko-KR')}대)
                        </h4>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] font-medium text-slate-500">대당</p>
                          <p className="text-sm font-semibold tabular-nums text-slate-800">
                            {formatAmount(qty > 0 ? smdPlacementTotal / qty : 0)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] font-medium text-slate-500">합계</p>
                          <p className="text-sm font-semibold tabular-nums text-slate-800">
                            {formatAmount(smdPlacementTotal)}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-xs">
                          <span className="font-medium text-slate-700">실장</span>
                          <span className="font-semibold tabular-nums text-slate-900">
                            {formatAmount(smdLaborTotal)}
                          </span>
                        </div>
                        {smdInspectionTotal > 0 ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-xs">
                            <span className="font-medium text-slate-700">
                              AOI
                              <span className="ml-1 font-normal text-slate-500">
                                (대당 {formatAmount(result?.common.smtInspectionPerUnit || 0)})
                              </span>
                            </span>
                            <span className="font-semibold tabular-nums text-slate-900">
                              {formatAmount(smdInspectionTotal)}
                            </span>
                          </div>
                        ) : null}
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
                    </div>
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
                  <div className="space-y-4 border-t border-slate-100 px-3.5 py-3">
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <div className="bg-slate-50 px-3 py-2.5">
                        <h4 className="text-xs font-bold tracking-wide text-slate-700">납땜</h4>
                      </div>
                      <div className="space-y-3 border-t border-slate-100 px-3 py-3">
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
                    </div>

                    <div className="space-y-3">
                      {form.postProcessOrder.map((category, index) => {
                        const config = POST_PROCESS_EDITORS[category]
                        return (
                          <PostProcessLinesEditor
                            key={category}
                            title={config.title}
                            ratePerMinute={getPostRate(quoteType)}
                            lines={form[config.field]}
                            boardQty={form.boardQty}
                            bufferPercent={form.postProcessBufferPercent}
                            quoteType={quoteType}
                            displayCurrency={displayCurrency}
                            showBufferControl={index === 0}
                            onBufferPercentChange={(postProcessBufferPercent) =>
                              updateForm('postProcessBufferPercent', postProcessBufferPercent)
                            }
                            onChange={(lines) => updateForm(config.field, lines)}
                          />
                        )
                      })}
                    </div>
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
                  </div>
                ) : null}
              </section>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="mb-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">
                    대당 단가{liveVatSuffix}
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {liveSummary?.unitFormatted ?? '-'}
                  </p>
                  {liveSummary?.oneTimeFormatted ? (
                    <p className="truncate text-[11px] text-slate-500">
                      + 메탈마스크 {liveSummary.oneTimeFormatted} (일회성)
                    </p>
                  ) : null}
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[11px] font-medium text-slate-500">
                    최종 합계{liveVatSuffix}
                  </p>
                  <p className="truncate text-base font-bold text-slate-900">
                    {liveSummary?.totalFormatted ?? '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                {mode === 'edit' && canDelete ? (
                  <ErpButton
                    variant="danger"
                    onClick={() => void handleDelete()}
                    disabled={busy}
                    loading={deleting}
                  >
                    삭제
                  </ErpButton>
                ) : (
                  <span />
                )}
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  {mode === 'edit' && quote && onCopyRequest ? (
                    <ErpButton
                      variant="secondary"
                      onClick={() => onCopyRequest(quote)}
                      disabled={busy}
                    >
                      복사하여 새로 작성
                    </ErpButton>
                  ) : null}
                  <ErpButton
                    className="min-w-0 flex-1"
                    onClick={() => void handleSave()}
                    disabled={busy}
                    loading={saving}
                  >
                    {mode === 'edit' ? '견적서 수정 저장' : '견적서 저장'}
                  </ErpButton>
                </div>
              </div>
              {saveError ? <p className={`mt-2 ${ERP_ERROR_TEXT_CLASS}`}>{saveError}</p> : null}
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
              includeVat={form.includeVat}
              contactEmail={contactEmail}
              loading={!result}
            />
          </div>
        </div>
    </ErpModal>
  )
}

export function QuoteModal({ open, ...props }: QuoteModalProps) {
  if (!open) return null
  return <QuoteModalContent {...props} />
}
