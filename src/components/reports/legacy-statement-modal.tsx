'use client'

import { useEffect, useMemo, useState } from 'react'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { ExcelPasteSampleTable } from '@/components/ui/excel-paste-sample-table'
import { fetchSalesBusinessPartners } from '@/lib/partners/repository'
import type { BusinessPartner } from '@/lib/partners/types'
import { resolvePartnerFromInput } from '@/lib/partners/utils'
import {
  createLegacyStatement,
  type LegacyStatementLineInput,
} from '@/lib/reports/legacy-statement'
import {
  STATEMENT_PASTE_COLUMNS,
  parseStatementPasteText,
  statementPastePlaceholder,
  statementPasteSampleValues,
} from '@/lib/reports/statement-paste'
import { todayYmdSeoul } from '@/lib/orders/utils'
import {
  ERP_FIELD_INPUT_CLASS,
  ERP_FIELD_LABEL_CLASS,
  ERP_ROW_ADD_BUTTON_CLASS,
  ERP_SECONDARY_BUTTON_CLASS,
} from '@/lib/ui/tokens'

type LegacyStatementModalProps = {
  open: boolean
  onClose: () => void
  onSaved?: (message?: string) => void
  defaultShipDate?: string
}

type LineDraft = LegacyStatementLineInput & { key: string }

function emptyLine(): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productCode: '',
    productName: '',
    quantity: 1,
    unitPrice: 0,
  }
}

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

export function LegacyStatementModal({
  open,
  onClose,
  onSaved,
  defaultShipDate,
}: LegacyStatementModalProps) {
  const [partners, setPartners] = useState<BusinessPartner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(false)
  const [customer, setCustomer] = useState('')
  const [shipDate, setShipDate] = useState(defaultShipDate || todayYmdSeoul())
  const [orderNumber, setOrderNumber] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()])
  const [pasteText, setPasteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCustomer('')
    setShipDate(defaultShipDate || todayYmdSeoul())
    setOrderNumber('')
    setNote('')
    setLines([emptyLine()])
    setPasteText('')
    setError(null)
    setSaving(false)

    let cancelled = false
    setPartnersLoading(true)
    void fetchSalesBusinessPartners().then((result) => {
      if (cancelled) return
      setPartnersLoading(false)
      if (result.ok) setPartners(result.partners)
      else setPartners([])
    })
    return () => {
      cancelled = true
    }
  }, [open, defaultShipDate])

  const totals = useMemo(() => {
    let qty = 0
    let amount = 0
    for (const line of lines) {
      const quantity = Math.max(0, Math.floor(Number(line.quantity) || 0))
      const unitPrice = Math.max(0, Math.round(Number(line.unitPrice) || 0))
      qty += quantity
      amount += quantity * unitPrice
    }
    return { qty, amount }
  }, [lines])

  function updateLine(key: string, patch: Partial<LegacyStatementLineInput>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)))
  }

  function applyPaste() {
    const parsed = parseStatementPasteText(pasteText)
    if (!parsed.ok) {
      setError(parsed.detail)
      return
    }
    setError(null)
    setLines(
      parsed.lines.map((line) => ({
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productCode: line.productCode,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    )
  }

  async function handleSave() {
    const resolved = resolvePartnerFromInput(partners, customer)
    const customerName = resolved?.name || customer.trim()
    if (!customerName) {
      setError('고객사를 선택해 주세요.')
      return
    }
    if (!resolved && partners.length > 0) {
      setError('거래처등록에 있는 매출 고객사를 선택해 주세요.')
      return
    }
    if (!shipDate.trim()) {
      setError('출하일을 입력해 주세요.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(shipDate.trim())) {
      setError('출하일이 올바르지 않습니다.')
      return
    }

    setSaving(true)
    setError(null)

    const result = await createLegacyStatement({
      customer: customerName,
      shipDate: shipDate.trim(),
      note,
      orderNumber: orderNumber.trim() || undefined,
      lines: lines.map(({ productCode, productName, quantity, unitPrice }) => ({
        productCode,
        productName,
        quantity,
        unitPrice,
      })),
    })

    setSaving(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }

    onSaved?.(
      `과거 거래명세서를 등록했습니다. (${result.shipmentId || result.orderNumber})`,
    )
    onClose()
  }

  const canSave = Boolean(customer.trim() && shipDate.trim()) && !saving
  const inputClass = `${ERP_FIELD_INPUT_CLASS} !bg-white`

  return (
    <ErpModal
      open={open}
      onClose={onClose}
      title="과거 거래명세서 등록"
      description="품목등록·생산 없이 당시 명세 기준으로 등록합니다. 거래명세서 집계·인쇄에만 반영됩니다."
      size="lg"
      closeOnEscape={!saving}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <CancelButton disabled={saving} />
          <ErpButton onClick={() => void handleSave()} disabled={!canSave} loading={saving}>
            등록
          </ErpButton>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>
              고객사 <span className="text-rose-600">*</span>
            </span>
            <CustomerCombobox
              value={customer}
              partners={partners}
              placeholder="거래처명 검색"
              inputClassName={inputClass}
              ariaLabel="고객사 (필수)"
              onValueChange={setCustomer}
              onPartnerSelect={(partner) => setCustomer(partner.name)}
            />
            <p className="mt-1 text-xs text-slate-500">
              {partnersLoading
                ? '거래처 목록을 불러오는 중…'
                : '거래처등록의 매출 거래처만 선택할 수 있습니다.'}
            </p>
          </label>
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>
              출하일 <span className="text-rose-600">*</span>
            </span>
            <input
              type="date"
              required
              value={shipDate}
              onChange={(event) => setShipDate(event.target.value)}
              aria-required="true"
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>발주번호 (선택)</span>
            <input
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              placeholder="고객사 PO/NO (선택)"
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>비고 (선택)</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="과거 거래명세서"
              className={inputClass}
            />
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">품목</h3>
            <button
              type="button"
              className={ERP_ROW_ADD_BUTTON_CLASS}
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
              disabled={saving}
            >
              + 행 추가
            </button>
          </div>

          <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-3">
            <p className="text-sm font-medium text-blue-900">일괄 붙여넣기</p>
            <p className="mt-1 text-xs text-blue-800">
              Excel에서 한 행(품목코드 · 품목명 · 수량 · 단가 · 금액)을 복사해 붙여넣으세요. 탭이
              공백으로 바뀌어도 인식됩니다.
            </p>
            <ExcelPasteSampleTable
              columns={STATEMENT_PASTE_COLUMNS}
              sampleRows={statementPasteSampleValues()}
            />
            <textarea
              value={pasteText}
              disabled={saving}
              onChange={(event) => setPasteText(event.target.value)}
              rows={4}
              placeholder={statementPastePlaceholder()}
              className={`${inputClass} mt-2 min-h-[6rem] font-mono text-xs leading-5`}
            />
            <div className="mt-2 flex justify-end">
              <ErpButton
                variant="secondary"
                disabled={saving || !pasteText.trim()}
                onClick={applyPaste}
              >
                붙여넣기 적용
              </ErpButton>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[720px] w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">품목코드</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">품목명</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">수량</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">단가</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">금액</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const quantity = Math.max(0, Math.floor(Number(line.quantity) || 0))
                  const unitPrice = Math.max(0, Math.round(Number(line.unitPrice) || 0))
                  const amount = quantity * unitPrice
                  return (
                    <tr key={line.key} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <input
                          value={line.productCode}
                          onChange={(event) => updateLine(line.key, { productCode: event.target.value })}
                          placeholder="코드"
                          className={inputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={line.productName}
                          onChange={(event) => updateLine(line.key, { productName: event.target.value })}
                          placeholder="품목명"
                          className={inputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.key, { quantity: Math.floor(Number(event.target.value) || 0) })
                          }
                          className={`${inputClass} text-right tabular-nums`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min={0}
                          value={line.unitPrice}
                          onChange={(event) =>
                            updateLine(line.key, { unitPrice: Math.round(Number(event.target.value) || 0) })
                          }
                          className={`${inputClass} text-right tabular-nums`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums text-slate-900">
                        {amount.toLocaleString('ko-KR')}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          disabled={saving || lines.length <= 1}
                          onClick={() => removeLine(line.key)}
                          className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-right text-sm font-semibold tabular-nums text-slate-800">
            합계 {totals.qty.toLocaleString('ko-KR')} · {totals.amount.toLocaleString('ko-KR')} 원
          </p>
        </div>
      </div>
    </ErpModal>
  )
}
