'use client'

import { useMemo, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { setMaterialDirectStockBatch } from '@/lib/materials/inventory/direct-stock'
import {
  DIRECT_STOCK_PASTE_COLUMNS,
  directStockPastePlaceholder,
  directStockPasteSampleValues,
  parseDirectStockBulkPaste,
  resolveDirectStockPasteRows,
  type DirectStockResolvedLine,
} from '@/lib/materials/inventory/direct-stock-paste'
import { formatInventoryQuantity } from '@/lib/materials/inventory/utils'
import type { MaterialInventoryRow } from '@/lib/materials/inventory/types'

type DirectStockModalProps = {
  open: boolean
  rows: MaterialInventoryRow[]
  onClose: () => void
  onSaved: () => void
}

export function DirectStockModal({ open, rows, onClose, onSaved }: DirectStockModalProps) {
  const [pasteText, setPasteText] = useState('')
  const [lines, setLines] = useState<DirectStockResolvedLine[]>([])
  const [pasteHint, setPasteHint] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onHandByMaterialId = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rows) map.set(row.id, row.onHandQuantity)
    return map
  }, [rows])

  function applyPaste() {
    setError('')
    const parsed = parseDirectStockBulkPaste(pasteText)
    const resolved = resolveDirectStockPasteRows(parsed, rows, onHandByMaterialId)

    if (!resolved.ok) {
      setLines([])
      setPasteHint(null)
      setError(resolved.detail)
      return
    }

    setLines(resolved.lines)
    setPasteHint(
      resolved.unresolved.length
        ? `${resolved.lines.length}건 적용 준비 · 미일치 ${resolved.unresolved.length}건 제외`
        : `${resolved.lines.length}건 적용 준비`,
    )
  }

  async function handleSave() {
    if (!lines.length) {
      setError('엑셀 내용을 붙여넣은 뒤 「붙여넣기 적용」을 눌러 주세요.')
      return
    }

    setSaving(true)
    setError('')
    const result = await setMaterialDirectStockBatch(
      lines.map((line) => ({
        materialId: line.materialId,
        targetQuantity: line.targetQuantity,
      })),
    )
    setSaving(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }

    onSaved()
  }

  function handleClose() {
    if (saving) return
    onClose()
  }

  return (
    <ErpModal
      open={open}
      title="직접재고"
      description="엑셀에서 품목코드·수량을 붙여넣으면 현재고를 그 수량으로 맞춥니다."
      size="lg"
      onClose={handleClose}
      closeOnEscape={!saving}
      footer={
        <div className="flex w-full flex-col gap-2">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <ErpButton variant="secondary" disabled={saving} onClick={handleClose}>
              취소
            </ErpButton>
            <ErpButton disabled={saving || !lines.length} onClick={() => void handleSave()}>
              {saving ? '적용 중…' : lines.length ? `${lines.length}건 적용` : '적용'}
            </ErpButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-3">
          <p className="text-sm font-medium text-blue-900">일괄 붙여넣기</p>
          <p className="mt-1 text-xs text-blue-800">
            Excel에서 아래 열 순서대로 복사한 뒤, 이 칸에 붙여넣으세요. 품목코드 또는 바코드로
            매칭됩니다.
          </p>

          <div className="mt-2 overflow-x-auto rounded border border-emerald-700/30 bg-white shadow-sm">
            <table className="w-max min-w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-8 border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-semibold text-slate-500" />
                  {DIRECT_STOCK_PASTE_COLUMNS.map((column, index) => (
                    <th
                      key={`col-${column.key}`}
                      className="border border-slate-300 bg-slate-100 px-2 py-1 text-center font-semibold text-slate-500"
                    >
                      {String.fromCharCode(65 + index)}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-semibold text-slate-500">
                    1
                  </th>
                  {DIRECT_STOCK_PASTE_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      className="whitespace-nowrap border border-slate-300 bg-[#e2efda] px-2.5 py-1.5 text-left font-semibold text-slate-800"
                    >
                      {column.label}
                      {column.required ? <span className="ml-0.5 text-red-500">*</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-semibold text-slate-500">
                    2
                  </th>
                  {directStockPasteSampleValues().map((value, index) => (
                    <td
                      key={`${DIRECT_STOCK_PASTE_COLUMNS[index]?.key ?? index}-sample`}
                      className="whitespace-nowrap border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700"
                    >
                      {value || '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <textarea
            value={pasteText}
            onChange={(event) => {
              setPasteText(event.target.value)
              setPasteHint(null)
              setError('')
            }}
            disabled={saving}
            rows={6}
            placeholder={directStockPastePlaceholder()}
            className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ErpButton
              variant="secondary"
              disabled={saving || !pasteText.trim()}
              onClick={applyPaste}
            >
              붙여넣기 적용
            </ErpButton>
            {pasteHint ? <p className="text-xs text-slate-600">{pasteHint}</p> : null}
          </div>
        </div>

        {lines.length ? (
          <div className="max-h-[320px] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">품목코드</th>
                  <th className="px-3 py-2 text-left font-semibold">품목명</th>
                  <th className="px-3 py-2 text-right font-semibold">현재고</th>
                  <th className="px-3 py-2 text-right font-semibold">목표수량</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.materialId} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-mono text-xs">{line.materialId}</td>
                    <td className="truncate px-3 py-1.5 text-slate-600">{line.materialName || '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                      {formatInventoryQuantity(line.currentQuantity)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-900">
                      {formatInventoryQuantity(line.targetQuantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </ErpModal>
  )
}
