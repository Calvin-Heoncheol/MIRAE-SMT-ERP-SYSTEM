'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { fetchSalesBusinessPartners } from '@/lib/partners/repository'
import type { BusinessPartner } from '@/lib/partners/types'
import type { SalesReportShipmentRow } from '@/lib/reports/sales-report'
import { deleteStatementLine, updateStatementLine } from '@/lib/reports/statement-edit'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS, ERP_SECONDARY_BUTTON_CLASS } from '@/lib/ui/tokens'

type SalesStatementEditModalProps = {
  open: boolean
  row: SalesReportShipmentRow | null
  onClose: () => void
  onSaved?: (message?: string) => void
}

function formatMoneyInput(value: number) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('ko-KR')
}

function parseMoneyInput(value: string) {
  return Math.max(0, Math.round(Number(String(value).replace(/[^\d]/g, '')) || 0))
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

export function SalesStatementEditModal({
  open,
  row,
  onClose,
  onSaved,
}: SalesStatementEditModalProps) {
  const canDelete = useCanDeleteRecords()
  const isLegacy = row?.source === 'legacy'
  const [partners, setPartners] = useState<BusinessPartner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(false)
  const [recordDate, setRecordDate] = useState('')
  const [customer, setCustomer] = useState('')
  const [productCode, setProductCode] = useState('')
  const [productName, setProductName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('0')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !row) return
    setRecordDate(row.recordDate.slice(0, 10))
    setCustomer(row.customer)
    setProductCode(row.productCode)
    setProductName(row.productName)
    setQuantity(String(row.quantity))
    setUnitPrice(formatMoneyInput(row.unitPrice))
    setError(null)
    setSaving(false)
    setDeleting(false)
  }, [open, row])

  useEffect(() => {
    if (!open || !isLegacy) return
    let cancelled = false
    setPartnersLoading(true)
    void fetchSalesBusinessPartners().then((result) => {
      if (cancelled) return
      setPartnersLoading(false)
      if (result.ok) setPartners(result.partners)
    })
    return () => {
      cancelled = true
    }
  }, [open, isLegacy])

  const qtyNumber = Math.max(0, Math.floor(Number(quantity) || 0))
  const unitPriceNumber = parseMoneyInput(unitPrice)
  const amount = qtyNumber * unitPriceNumber

  const description = useMemo(() => {
    if (!row) return undefined
    if (isLegacy) {
      return '과거 명세서입니다. 같은 발주ID의 출하일·고객사가 함께 변경됩니다.'
    }
      return '출하일·수량을 수정합니다. 단가는 주문서 품목 단가라서 같은 품목의 다른 출하에도 반영됩니다.'
  }, [isLegacy, row])

  async function handleSave() {
    if (!row) return
    if (qtyNumber < 1) {
      setError('수량은 1 이상이어야 합니다.')
      return
    }
    if (isLegacy && !customer.trim()) {
      setError('고객사를 입력해 주세요.')
      return
    }
    if (isLegacy && !productName.trim()) {
      setError('품목명을 입력해 주세요.')
      return
    }

    setSaving(true)
    setError(null)

    const result = await updateStatementLine({
      source: row.source,
      deliveryId: row.deliveryId,
      orderNumber: row.orderNumber,
      orderLineId: row.orderLineId,
      recordDate,
      customer,
      productCode,
      productName,
      quantity: qtyNumber,
      unitPrice: unitPriceNumber,
    })

    setSaving(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }

    onSaved?.('거래명세서 내역을 수정했습니다.')
    onClose()
  }

  async function handleDelete() {
    if (!row) return
    const label = isLegacy ? row.productName || row.orderNumber : row.deliveryId
    if (!window.confirm(`${label}\n이 내역을 삭제하시겠습니까?`)) return

    setDeleting(true)
    setError(null)

    const result = await deleteStatementLine({
      source: row.source,
      deliveryId: row.deliveryId,
      orderNumber: row.orderNumber,
      orderLineId: row.orderLineId,
      productCode: row.productCode,
    })

    setDeleting(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }

    onSaved?.('거래명세서 내역을 삭제했습니다.')
    onClose()
  }

  return (
    <ErpModal
      open={open && Boolean(row)}
      title="거래명세서 내역 수정"
      description={description}
      size="md"
      onClose={onClose}
      closeOnEscape={!saving && !deleting}
      footer={
        <>
          {canDelete ? (
            <ErpButton
              variant="danger"
              className="mr-auto"
              disabled={saving || deleting}
              loading={deleting}
              onClick={() => void handleDelete()}
            >
              삭제
            </ErpButton>
          ) : null}
          <CancelButton disabled={saving || deleting} />
          <ErpButton
            disabled={saving || deleting}
            loading={saving}
            onClick={() => void handleSave()}
          >
            저장
          </ErpButton>
        </>
      }
    >
      {row ? (
        <div className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>출하일</span>
              <input
                type="date"
                value={recordDate}
                onChange={(event) => setRecordDate(event.target.value)}
                className={ERP_FIELD_INPUT_CLASS}
              />
            </label>
            <div className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>{isLegacy ? '발주ID' : '출하번호'}</span>
              <div className={`${ERP_FIELD_INPUT_CLASS} bg-slate-50 font-mono text-xs`}>
                {isLegacy ? row.orderNumber || '—' : row.shipmentId || row.deliveryId || '—'}
              </div>
            </div>

            {isLegacy ? (
              <label className="block text-sm sm:col-span-2">
                <span className={ERP_FIELD_LABEL_CLASS}>
                  고객사 <span className="text-rose-600">*</span>
                </span>
                <CustomerCombobox
                  value={customer}
                  partners={partners}
                  placeholder="거래처명 검색"
                  inputClassName={ERP_FIELD_INPUT_CLASS}
                  onValueChange={setCustomer}
                  onPartnerSelect={(partner) => setCustomer(partner.name)}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {partnersLoading ? '거래처 목록을 불러오는 중…' : '매출 거래처만 선택할 수 있습니다.'}
                </p>
              </label>
            ) : (
              <div className="block text-sm sm:col-span-2">
                <span className={ERP_FIELD_LABEL_CLASS}>고객사 / 주문서</span>
                <div className={`${ERP_FIELD_INPUT_CLASS} bg-slate-50`}>
                  <span className="font-semibold text-slate-900">{row.customer || '—'}</span>
                  {row.orderNumber ? (
                    <span className="ml-2 font-mono text-xs text-slate-500">{row.orderNumber}</span>
                  ) : null}
                </div>
              </div>
            )}

            {isLegacy ? (
              <>
                <label className="block text-sm">
                  <span className={ERP_FIELD_LABEL_CLASS}>품목코드</span>
                  <input
                    value={productCode}
                    onChange={(event) => setProductCode(event.target.value)}
                    className={`${ERP_FIELD_INPUT_CLASS} font-mono`}
                  />
                </label>
                <label className="block text-sm">
                  <span className={ERP_FIELD_LABEL_CLASS}>
                    품목명 <span className="text-rose-600">*</span>
                  </span>
                  <input
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    className={ERP_FIELD_INPUT_CLASS}
                  />
                </label>
              </>
            ) : (
              <div className="block text-sm sm:col-span-2">
                <span className={ERP_FIELD_LABEL_CLASS}>품목</span>
                <div className={`${ERP_FIELD_INPUT_CLASS} bg-slate-50`}>
                  <p className="font-medium text-slate-900">{row.productName || '—'}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">{row.productCode || '—'}</p>
                </div>
              </div>
            )}

            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>수량</span>
              <input
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className={`${ERP_FIELD_INPUT_CLASS} tabular-nums`}
              />
            </label>
            <label className="block text-sm">
              <span className={ERP_FIELD_LABEL_CLASS}>단가</span>
              <input
                type="text"
                inputMode="numeric"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value.replace(/[^\d,]/g, ''))}
                onBlur={() => setUnitPrice(formatMoneyInput(parseMoneyInput(unitPrice)))}
                className={`${ERP_FIELD_INPUT_CLASS} tabular-nums`}
              />
            </label>
            <div className="block text-sm sm:col-span-2">
              <span className={ERP_FIELD_LABEL_CLASS}>금액</span>
              <div className={`${ERP_FIELD_INPUT_CLASS} bg-slate-50 text-base font-bold tabular-nums`}>
                ₩{formatMoneyInput(amount)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ErpModal>
  )
}
