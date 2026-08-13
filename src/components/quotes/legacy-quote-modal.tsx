'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { ProductCombobox } from '@/components/orders/product-combobox'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { ExcelPasteSampleTable } from '@/components/ui/excel-paste-sample-table'
import { useBusy } from '@/components/ui/busy-provider'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import {
  buildLegacyQuotePayload,
  defaultLegacyQuoteForm,
  LEGACY_QUOTE_COST_FIELDS,
  legacyQuoteFormFromQuote,
  legacyQuoteUnitPrice,
  type LegacyQuoteCostKey,
  type LegacyQuoteFormState,
} from '@/lib/quotes/legacy-quote'
import {
  LEGACY_QUOTE_BULK_COLUMNS,
  legacyQuoteBulkPastePlaceholder,
  legacyQuoteBulkPasteSampleValues,
  parseLegacyQuoteBulkPaste,
} from '@/lib/quotes/legacy-quote-bulk'
import { createQuote, deleteQuotes, updateQuote } from '@/lib/quotes/repository'
import { fetchProducts } from '@/lib/products/repository'
import type { Product } from '@/lib/products/types'
import { formatProductOptionLabel, resolveProductInput } from '@/lib/products/utils'
import { fetchSalesBusinessPartners } from '@/lib/partners/repository'
import type { BusinessPartner } from '@/lib/partners/types'
import { resolvePartnerFromInput } from '@/lib/partners/utils'
import type { QuoteListItem, QuoteStatus } from '@/lib/quotes/types'
import { normalizeQuoteStatus } from '@/lib/quotes/utils'
import { formatQuoteKrw } from '@/lib/quotes/format'
import {
  ERP_FIELD_INPUT_CLASS,
  ERP_FIELD_LABEL_CLASS,
  ERP_SECONDARY_BUTTON_CLASS,
} from '@/lib/ui/tokens'

type LegacyQuoteModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  quote?: QuoteListItem | null
  onClose: () => void
  onSaved?: (message?: string) => void
  onDeleted?: (message?: string) => void
}

type CreateTab = 'single' | 'bulk'

function CancelButton({ disabled }: { disabled?: boolean }) {
  const requestClose = useErpModalRequestClose()
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => requestClose?.()}
      className={ERP_SECONDARY_BUTTON_CLASS}
    >
      취소
    </button>
  )
}

function resolveLegacyRowProductId(
  products: Product[],
  customer: string,
  productName: string,
) {
  const resolved = resolveProductInput(products, customer, '', productName)
  if (resolved.status === 'resolved') return resolved.product.id
  return ''
}

export function LegacyQuoteModal({
  open,
  mode,
  quote = null,
  onClose,
  onSaved,
  onDeleted,
}: LegacyQuoteModalProps) {
  const busyUi = useBusy()
  const canDelete = useCanDeleteRecords()
  const { notifyAuthOrFailure } = useWriteFailureToast()

  const [createTab, setCreateTab] = useState<CreateTab>('single')
  const [form, setForm] = useState<LegacyQuoteFormState>(defaultLegacyQuoteForm)
  const [bulkText, setBulkText] = useState('')
  const [bulkPreview, setBulkPreview] = useState<LegacyQuoteFormState[]>([])
  const [partners, setPartners] = useState<BusinessPartner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCreateTab('single')
    setForm(mode === 'edit' && quote ? legacyQuoteFormFromQuote(quote) : defaultLegacyQuoteForm())
    setBulkText('')
    setBulkPreview([])
    setError(null)
    setSaving(false)
    setDeleting(false)

    let cancelled = false
    setPartnersLoading(true)
    void Promise.all([fetchSalesBusinessPartners(), fetchProducts()]).then(
      ([partnersResult, productsResult]) => {
        if (cancelled) return
        setPartnersLoading(false)
        setPartners(partnersResult.ok ? partnersResult.partners : [])
        setProducts(productsResult.ok ? productsResult.products : [])
      },
    )
    return () => {
      cancelled = true
    }
  }, [open, mode, quote])

  const unitPrice = useMemo(() => legacyQuoteUnitPrice(form), [form])
  const busy = saving || deleting
  const showTabs = mode === 'create'

  function updateForm<K extends keyof LegacyQuoteFormState>(key: K, value: LegacyQuoteFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateCost(key: LegacyQuoteCostKey, value: string) {
    updateForm(key, value)
  }

  function applyBulkPaste() {
    const parsed = parseLegacyQuoteBulkPaste(bulkText)
    if (!parsed.ok) {
      setBulkPreview([])
      setError(parsed.detail)
      return
    }
    setError(null)
    setBulkPreview(parsed.rows)
  }

  function enrichRow(row: LegacyQuoteFormState): LegacyQuoteFormState {
    const partner = resolvePartnerFromInput(partners, row.customer)
    const customer = partner?.name || row.customer.trim()
    const productId = resolveLegacyRowProductId(products, customer, row.productName)
    return {
      ...row,
      customer,
      productId,
    }
  }

  const currentStatus: QuoteStatus = normalizeQuoteStatus(quote?.quoteStatus)

  async function saveSingle(quoteStatus: QuoteStatus, message: string) {
    if (!form.customer.trim() || !form.productName.trim()) {
      setError('고객사와 제품명을 입력해 주세요.')
      return
    }
    if (!form.quoteDate.trim()) {
      setError('견적일을 입력해 주세요.')
      return
    }

    setSaving(true)
    setError(null)
    const payload = buildLegacyQuotePayload(enrichRow(form), quoteStatus)
    const result = await busyUi.run(() =>
      mode === 'edit' && quote
        ? updateQuote(quote.quoteNumber, payload)
        : createQuote(payload, 'domestic'),
    )
    setSaving(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setError(result.detail)
      return
    }

    onSaved?.(message)
  }

  async function handleSaveSingle() {
    await saveSingle(
      currentStatus,
      mode === 'edit' ? '과거 견적서가 수정되었습니다.' : '과거 견적서가 등록되었습니다.',
    )
  }

  async function handleSaveBulk() {
    if (!bulkPreview.length) {
      setError('먼저 붙여넣기 내용을 적용해 주세요.')
      return
    }

    setSaving(true)
    setError(null)

    let saved = 0
    const failures: string[] = []

    for (let index = 0; index < bulkPreview.length; index += 1) {
      const row = enrichRow(bulkPreview[index]!)
      const payload = buildLegacyQuotePayload(row)
      const result = await createQuote(payload, 'domestic')
      if (!result.ok) {
        failures.push(`${index + 1}행: ${result.detail}`)
        if (result.reason === 'auth') {
          notifyAuthOrFailure(result)
          break
        }
        continue
      }
      saved += 1
    }

    setSaving(false)

    if (saved > 0 && failures.length === 0) {
      onSaved?.(`과거 견적서 ${saved}건을 등록했습니다.`)
      return
    }

    if (saved > 0) {
      setError(
        `${saved}건 등록 · ${failures.length}건 실패\n${failures.slice(0, 5).join('\n')}`,
      )
      onSaved?.(`과거 견적서 ${saved}건을 등록했습니다. (일부 실패)`)
      return
    }

    setError(failures.slice(0, 8).join('\n') || '일괄 등록에 실패했습니다.')
  }

  async function handleDelete() {
    if (!quote || !canDelete) return
    if (!window.confirm(`과거 견적서 ${quote.quoteNumber} 를 삭제할까요?`)) return

    setDeleting(true)
    setError(null)
    const result = await busyUi.run(() => deleteQuotes([quote.quoteNumber]))
    setDeleting(false)

    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setError(result.detail)
      return
    }

    onDeleted?.('과거 견적서가 삭제되었습니다.')
  }

  function handlePrimarySave() {
    if (showTabs && createTab === 'bulk') {
      void handleSaveBulk()
      return
    }
    void handleSaveSingle()
  }

  return (
    <ErpModal
      open={open}
      title={mode === 'edit' ? '과거 견적서 수정' : '과거 견적서 등록'}
      description="세부 공정 없이 SMD·후공정·자재·기타 대당 비용만 입력합니다."
      size={showTabs && createTab === 'bulk' ? 'lg' : 'md'}
      onClose={() => {
        if (busy) return
        onClose()
      }}
      closeOnEscape={!busy}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {mode === 'edit' && canDelete ? (
              <ErpButton variant="danger" onClick={() => void handleDelete()} disabled={busy}>
                삭제
              </ErpButton>
            ) : null}
          </div>
          <div className="flex gap-2">
            <CancelButton disabled={busy} />
            <ErpButton onClick={handlePrimarySave} disabled={busy}>
              {saving
                ? '저장 중…'
                : showTabs && createTab === 'bulk'
                  ? bulkPreview.length
                    ? `${bulkPreview.length}건 일괄 등록`
                    : '일괄 등록'
                  : '저장'}
            </ErpButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {showTabs ? (
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => {
                setCreateTab('single')
                setError(null)
              }}
              className={[
                'flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition',
                createTab === 'single'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              단건 등록
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateTab('bulk')
                setError(null)
              }}
              className={[
                'flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition',
                createTab === 'bulk'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              일괄 등록
            </button>
          </div>
        ) : null}

        {showTabs && createTab === 'bulk' ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-3">
              <p className="text-sm font-medium text-blue-900">일괄 붙여넣기</p>
              <p className="mt-1 text-xs text-blue-800">
                Excel에서 아래 열 순서대로 복사한 뒤, 이 칸에 붙여넣으세요.
              </p>
              <ExcelPasteSampleTable
                columns={LEGACY_QUOTE_BULK_COLUMNS}
                sampleRows={legacyQuoteBulkPasteSampleValues()}
              />
              <textarea
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                placeholder={legacyQuoteBulkPastePlaceholder()}
                rows={6}
                className={`${ERP_FIELD_INPUT_CLASS} mt-2 min-h-[120px] font-mono text-xs`}
              />
            </div>

            <div className="flex justify-end">
              <ErpButton
                variant="secondary"
                onClick={applyBulkPaste}
                disabled={busy || !bulkText.trim()}
              >
                미리보기 적용
              </ErpButton>
            </div>

            {bulkPreview.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="max-h-56 overflow-auto">
                  <table className="min-w-full border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        {LEGACY_QUOTE_BULK_COLUMNS.map((column) => (
                          <th
                            key={column.key}
                            className="whitespace-nowrap px-2 py-1.5 text-left font-semibold text-slate-500"
                          >
                            {column.label}
                          </th>
                        ))}
                        <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-slate-500">
                          대당
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.map((row, index) => (
                        <tr key={`${row.customer}-${row.productName}-${index}`} className="border-t border-slate-100">
                          <td className="whitespace-nowrap px-2 py-1.5 text-slate-700">{row.quoteDate}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-slate-700">
                            {row.productionKind}
                          </td>
                          <td className="px-2 py-1.5 text-slate-700">{row.customer}</td>
                          <td className="px-2 py-1.5 text-slate-700">{row.productName}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-700">
                            {Number(row.smd).toLocaleString('ko-KR')}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-700">
                            {Number(row.post).toLocaleString('ko-KR')}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-700">
                            {Number(row.material).toLocaleString('ko-KR')}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-700">
                            {Number(row.other).toLocaleString('ko-KR')}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums text-slate-900">
                            {legacyQuoteUnitPrice(row).toLocaleString('ko-KR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
                  {bulkPreview.length}건 미리보기 · 저장 시 순차 등록됩니다.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className={ERP_FIELD_LABEL_CLASS}>견적일</span>
                <input
                  type="date"
                  value={form.quoteDate}
                  onChange={(event) => updateForm('quoteDate', event.target.value)}
                  className={ERP_FIELD_INPUT_CLASS}
                />
              </label>
              <label className="block text-sm">
                <span className={ERP_FIELD_LABEL_CLASS}>구분</span>
                <select
                  value={form.productionKind}
                  onChange={(event) =>
                    updateForm('productionKind', event.target.value === '샘플' ? '샘플' : '양산')
                  }
                  className={ERP_FIELD_INPUT_CLASS}
                >
                  <option value="양산">양산</option>
                  <option value="샘플">샘플</option>
                </select>
              </label>
            </div>

            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>고객사</span>
              <CustomerCombobox
                value={form.customer}
                partners={partners}
                placeholder={partnersLoading ? '거래처 불러오는 중…' : '거래처명 검색'}
                ariaLabel="고객사"
                inputClassName={ERP_FIELD_INPUT_CLASS}
                onValueChange={(value) => updateForm('customer', value)}
                onPartnerSelect={(partner) => updateForm('customer', partner.name)}
              />
            </label>

            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>제품명</span>
              <ProductCombobox
                value={form.productName}
                products={products}
                customer={form.customer}
                field="name"
                placeholder="제품명 검색"
                ariaLabel="제품명"
                inputClassName={ERP_FIELD_INPUT_CLASS}
                onValueChange={(value) => {
                  setForm((current) => ({
                    ...current,
                    productName: value,
                    productId: '',
                  }))
                }}
                onProductSelect={(product) => {
                  setForm((current) => ({
                    ...current,
                    productName: formatProductOptionLabel(product),
                    productId: product.id,
                  }))
                }}
              />
            </label>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">대당 비용</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {LEGACY_QUOTE_COST_FIELDS.map((field) => (
                  <label key={field.key} className="block text-sm">
                    <span className={ERP_FIELD_LABEL_CLASS}>
                      {field.label}
                      <span className="ml-1 text-xs font-normal text-slate-400">({field.hint})</span>
                    </span>
                    <QuoteNumericInput
                      min={0}
                      value={form[field.key]}
                      onChange={(value) => updateCost(field.key, value)}
                      className={ERP_FIELD_INPUT_CLASS}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-[11px] font-medium text-slate-500">대당 단가</p>
                <p className="text-base font-bold text-slate-900">{formatQuoteKrw(unitPrice)}</p>
              </div>
            </div>
          </div>
        )}

        {error ? (
          <p className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </ErpModal>
  )
}
