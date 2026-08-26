'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MaterialLabelSettingsButton } from '@/components/materials/material-label-settings-button'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { useToast } from '@/components/ui/toast-provider'
import { printMaterialLabels } from '@/lib/materials/print-material-labels'
import {
  issueProductionUnitLabels,
  suggestNextBarcodeStart,
} from '@/lib/production-input/label-repository'
import {
  buildSequentialBarcodes,
  describeProductionLabelRange,
  suggestNextCustomBarcodeStart,
} from '@/lib/production-input/production-label-code'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

export type ProductionLabelOrderOption = {
  key: string
  productLabel: string
  /** 품목코드 */
  productCode: string
  /** 발주서번호(PO) */
  orderLabel: string
  labelBaseCode: string
  remaining: number
  assemblyGroupId: string
  team: string
  planId?: string | null
}

type ProductionLabelPrintModalProps = {
  open: boolean
  onClose: () => void
  saving?: boolean
  /** 고정 건 출력 (주문 선택 UI 없음) — DB 발급용 메타가 있으면 공용 저장 */
  labelBaseCode?: string
  productLabel?: string
  orderLabel?: string
  remaining?: number
  assemblyGroupId?: string
  team?: string
  planId?: string | null
  /** 있으면 모달 안에서 주문 선택 후 출력 */
  orderOptions?: ProductionLabelOrderOption[]
}

export function ProductionLabelPrintModal({
  open,
  onClose,
  saving = false,
  labelBaseCode: fixedBaseCode = '',
  productLabel: fixedProductLabel = '',
  orderLabel: fixedOrderLabel = '',
  remaining: fixedRemaining = 0,
  assemblyGroupId: fixedAssemblyGroupId = '',
  team: fixedTeam = '',
  planId: fixedPlanId = null,
  orderOptions,
}: ProductionLabelPrintModalProps) {
  const toast = useToast()
  const [selectedKey, setSelectedKey] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [startBarcode, setStartBarcode] = useState('')
  const [copies, setCopies] = useState('1')
  const [printing, setPrinting] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  const usePicker = orderOptions != null
  const selectedOption =
    usePicker && orderOptions
      ? (orderOptions.find((item) => item.key === selectedKey) ?? null)
      : null

  const labelBaseCode = usePicker ? (selectedOption?.labelBaseCode ?? '') : fixedBaseCode
  const productLabel = usePicker ? (selectedOption?.productLabel ?? '') : fixedProductLabel
  const orderLabel = usePicker ? (selectedOption?.orderLabel ?? '') : fixedOrderLabel
  const remaining = usePicker ? (selectedOption?.remaining ?? 0) : fixedRemaining
  const assemblyGroupId = usePicker
    ? (selectedOption?.assemblyGroupId ?? '')
    : fixedAssemblyGroupId
  const team = usePicker ? (selectedOption?.team ?? '') : fixedTeam
  const planId = usePicker ? (selectedOption?.planId ?? null) : fixedPlanId

  const filteredOptions = useMemo(() => {
    if (!orderOptions) return [] as ProductionLabelOrderOption[]
    const q = orderSearch.trim().toLowerCase()
    if (!q) return orderOptions
    return orderOptions.filter((item) => {
      const hay = `${item.productLabel} ${item.productCode} ${item.orderLabel}`.toLowerCase()
      return hay.includes(q)
    })
  }, [orderOptions, orderSearch])

  const copyCount = Math.max(1, Math.floor(Number(copies) || 1))
  const previewCodes = useMemo(
    () => buildSequentialBarcodes(startBarcode, copyCount),
    [startBarcode, copyCount],
  )
  const previewRange = describeProductionLabelRange(previewCodes)
  const needsTrailingDigits = Boolean(startBarcode.trim()) && copyCount > 1 && previewCodes.length < 1
  const canIssueDb = Boolean(assemblyGroupId && team)
  const canPrint = Boolean(labelBaseCode) && (usePicker ? canIssueDb : true)

  useEffect(() => {
    if (!open) return
    setOrderSearch('')
    if (usePicker) {
      setSelectedKey('')
      setStartBarcode('')
      setCopies('1')
      return
    }
    setCopies(String(Math.max(1, fixedRemaining > 0 ? fixedRemaining : 1)))
    setStartBarcode('')
    if (fixedAssemblyGroupId && fixedTeam) {
      void suggestNextBarcodeStart(fixedAssemblyGroupId, fixedTeam).then((result) => {
        if (result.ok && result.start) setStartBarcode(result.start)
      })
    }
    const timer = window.setTimeout(() => barcodeInputRef.current?.focus(), 120)
    return () => window.clearTimeout(timer)
  }, [open, usePicker, fixedBaseCode, fixedRemaining, fixedAssemblyGroupId, fixedTeam])

  useEffect(() => {
    if (!open || !usePicker || !selectedOption) return
    setCopies(String(Math.max(1, selectedOption.remaining > 0 ? selectedOption.remaining : 1)))
    setStartBarcode('')
    void suggestNextBarcodeStart(selectedOption.assemblyGroupId, selectedOption.team).then(
      (result) => {
        if (result.ok && result.start) setStartBarcode(result.start)
      },
    )
    const timer = window.setTimeout(() => barcodeInputRef.current?.focus(), 80)
    return () => window.clearTimeout(timer)
  }, [
    open,
    usePicker,
    selectedOption?.key,
    selectedOption?.assemblyGroupId,
    selectedOption?.team,
    selectedOption?.remaining,
  ])

  async function handlePrint() {
    if (!canPrint) {
      toast.error('라벨 출력', '출력할 주문을 선택하세요.')
      return
    }
    const codes = previewCodes
    if (!startBarcode.trim()) {
      toast.error('라벨 출력', '시작 바코드를 입력하세요. 예: M67530001')
      barcodeInputRef.current?.focus()
      return
    }
    if (needsTrailingDigits) {
      toast.error('라벨 출력', '여러 장 출력하려면 끝자리가 숫자인 바코드를 입력하세요. 예: M67530001')
      barcodeInputRef.current?.focus()
      return
    }
    if (!codes.length) {
      toast.error('라벨 출력', '출력할 바코드가 없습니다.')
      return
    }

    setPrinting(true)
    try {
      if (canIssueDb) {
        const issued = await issueProductionUnitLabels({
          barcodes: codes,
          assemblyGroupId,
          team,
          planId,
          jobBaseCode: labelBaseCode,
        })
        if (!issued.ok) {
          toast.error('라벨 출력', issued.detail)
          return
        }
      }

      await printMaterialLabels(
        codes.map((id) => ({
          id,
          materialName: productLabel,
          specification: orderLabel,
          copies: 1,
        })),
        { title: '생산 바코드 라벨', autoPrint: true },
      )

      const nextStart = suggestNextCustomBarcodeStart(codes)
      setStartBarcode(nextStart)
      toast.success(
        '라벨 출력',
        `${codes.length.toLocaleString('ko-KR')}장 · ${previewRange}`,
      )
    } finally {
      setPrinting(false)
    }
  }

  const busy = printing || saving
  const description = canPrint
    ? `${productLabel} · ${orderLabel}`
    : usePicker
      ? '주문을 선택한 뒤 바코드를 출력하세요'
      : ''

  return (
    <ErpModal
      open={open}
      title="생산 라벨 출력"
      description={description}
      size={usePicker ? 'md' : 'form'}
      onClose={onClose}
      closeOnEscape={!busy}
      headerActions={<MaterialLabelSettingsButton />}
    >
      <div className="space-y-4">
        {usePicker ? (
          <div className="space-y-2">
            <span className={ERP_FIELD_LABEL_CLASS}>주문 선택</span>
            <input
              type="search"
              value={orderSearch}
              disabled={busy}
              onChange={(event) => setOrderSearch(event.target.value)}
              placeholder="제품·PO 검색"
              className={ERP_FIELD_INPUT_CLASS}
            />
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1 text-sm">
              {filteredOptions.length === 0 ? (
                <li className="px-2 py-4 text-center text-slate-500">주문이 없습니다.</li>
              ) : (
                filteredOptions.map((item) => {
                  const selected = item.key === selectedKey
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setSelectedKey(item.key)}
                        className={[
                          'flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition',
                          selected
                            ? 'bg-emerald-50 ring-1 ring-emerald-300'
                            : 'hover:bg-slate-50',
                        ].join(' ')}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-3">
                          <span
                            className="w-28 shrink-0 truncate font-medium text-slate-800"
                            title={item.orderLabel}
                          >
                            {item.orderLabel || '—'}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-800">
                              {item.productLabel}
                            </span>
                            <span className="block truncate text-slate-500">
                              {item.productCode || '—'}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums font-medium text-slate-600">
                          잔량 {item.remaining.toLocaleString('ko-KR')}
                        </span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        ) : null}

        <p className="text-sm text-slate-600">
          시작 바코드를 직접 입력하면 매수만큼{' '}
          <span className="font-semibold text-slate-800">연속 번호</span>로 출력합니다.
          예: M67530001 → M67530002 … (다른 PC에서도 스캔 가능)
        </p>

        <div className="flex flex-wrap items-end gap-2 text-sm">
          {usePicker ? (
            <div className="w-28 shrink-0">
              <span className={ERP_FIELD_LABEL_CLASS}>발주서번호</span>
              <div
                className={[
                  ERP_FIELD_INPUT_CLASS,
                  'flex min-h-[2.75rem] items-center truncate bg-slate-50 font-medium text-slate-800',
                  !canPrint ? 'text-slate-400' : '',
                ].join(' ')}
                title={canPrint ? orderLabel : undefined}
              >
                {canPrint && orderLabel ? orderLabel : '—'}
              </div>
            </div>
          ) : null}
          <div className="min-w-[10rem] max-w-xs flex-1">
            <span className={ERP_FIELD_LABEL_CLASS}>선택 품목</span>
            <div
              className={[
                ERP_FIELD_INPUT_CLASS,
                'flex min-h-[2.75rem] items-center truncate bg-slate-50 font-medium text-slate-800',
                !canPrint ? 'text-slate-400' : '',
              ].join(' ')}
              title={canPrint ? productLabel : undefined}
            >
              {canPrint && productLabel ? productLabel : '주문을 선택하세요'}
            </div>
          </div>
          <label className="block min-w-[10rem] flex-1">
            <span className={ERP_FIELD_LABEL_CLASS}>시작 바코드</span>
            <input
              ref={barcodeInputRef}
              type="text"
              value={startBarcode}
              disabled={busy || !canPrint}
              onChange={(event) => setStartBarcode(event.target.value.toUpperCase())}
              placeholder="예: M67530001"
              autoComplete="off"
              spellCheck={false}
              className={`${ERP_FIELD_INPUT_CLASS} font-mono`}
            />
          </label>
          <label className="block">
            <span className={ERP_FIELD_LABEL_CLASS}>매수</span>
            <input
              type="text"
              inputMode="numeric"
              value={copies}
              disabled={busy || !canPrint}
              onChange={(event) => setCopies(event.target.value.replace(/[^\d]/g, ''))}
              className={`${ERP_FIELD_INPUT_CLASS} w-24 text-right tabular-nums`}
            />
          </label>
          <ErpButton
            type="button"
            disabled={busy || !canPrint}
            onClick={() => void handlePrint()}
          >
            {printing ? '출력 중…' : '라벨 출력'}
          </ErpButton>
        </div>

        <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          <p className="font-medium text-slate-700">출력 예정</p>
          <p className="mt-1 break-all font-mono text-slate-500">
            {!canPrint
              ? '주문을 선택하세요'
              : needsTrailingDigits
                ? '여러 장은 끝자리 숫자가 필요합니다'
                : previewRange || '—'}
          </p>
        </div>
      </div>
    </ErpModal>
  )
}
