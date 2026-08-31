'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { ExcelPasteSampleTable } from '@/components/ui/excel-paste-sample-table'
import {
  DIRECT_STOCK_PASTE_COLUMNS,
  directStockPastePlaceholder,
  directStockPasteSampleValues,
  parseDirectStockBulkPaste,
  resolveDirectStockPasteRows,
  type DirectStockResolvedLine,
} from '@/lib/materials/inventory/direct-stock-paste'
import { setMaterialDirectStockBatch } from '@/lib/materials/inventory/direct-stock'
import type { MaterialInventoryRow } from '@/lib/materials/inventory/types'
import { formatInventoryQuantity } from '@/lib/materials/inventory/utils'
import { formatMaterialDisplayCode } from '@/lib/materials/utils'
import {
  ERP_INFO_BOX_CLASS,
  ERP_INFO_BOX_TEXT_CLASS,
  ERP_INFO_BOX_TITLE_CLASS,
  ERP_PASTE_TEXTAREA_CLASS,
} from '@/lib/ui/tokens'

type DirectStockBulkModalProps = {
  open: boolean
  rows: MaterialInventoryRow[]
  onClose: () => void
  onSaved: (message?: string) => void
}

export function DirectStockBulkModal({
  open,
  rows,
  onClose,
  onSaved,
}: DirectStockBulkModalProps) {
  if (!open) return null
  return <DirectStockBulkModalContent rows={rows} onClose={onClose} onSaved={onSaved} />
}

function DirectStockBulkModalContent({
  rows,
  onClose,
  onSaved,
}: Omit<DirectStockBulkModalProps, 'open'>) {
  const canDelete = useCanDeleteRecords()
  const [pasteText, setPasteText] = useState('')
  const [previewLines, setPreviewLines] = useState<DirectStockResolvedLine[]>([])
  const [unresolved, setUnresolved] = useState<string[]>([])
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [saving, setSaving] = useState(false)

  const onHandByMaterialId = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rows) {
      map.set(row.id, row.onHandQuantity)
    }
    return map
  }, [rows])

  useEffect(() => {
    setPasteText('')
    setPreviewLines([])
    setUnresolved([])
    setError('')
    setHint('')
  }, [])

  function applyPaste() {
    setError('')
    const parsed = parseDirectStockBulkPaste(pasteText)
    const result = resolveDirectStockPasteRows(parsed, rows, onHandByMaterialId)
    if (!result.ok) {
      setPreviewLines([])
      setUnresolved(result.unresolved)
      setError(result.detail)
      setHint('')
      return
    }
    setPreviewLines(result.lines)
    setUnresolved(result.unresolved)
    setHint(`${result.lines.length}건 미리보기`)
    if (result.unresolved.length) {
      setHint(
        `${result.lines.length}건 적용 · ${result.unresolved.length}건 미등록 품목 제외`,
      )
    }
  }

  async function handleSave() {
    if (!canDelete) return
    if (!previewLines.length) {
      setError('먼저 붙여넣기 적용을 눌러 주세요.')
      return
    }

    setSaving(true)
    setError('')
    const result = await setMaterialDirectStockBatch(
      previewLines.map((line) => ({
        materialId: line.materialId,
        targetQuantity: line.targetQuantity,
      })),
    )
    setSaving(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }

    const parts = [`${result.count}건 반영`]
    if (result.increasedCount) parts.push(`입고 ${result.increasedCount}건`)
    if (result.decreasedCount) parts.push(`불출 ${result.decreasedCount}건`)
    if (result.unchangedCount) parts.push(`변경 없음 ${result.unchangedCount}건`)
    onSaved(parts.join(' · '))
  }

  function handleClose() {
    if (saving) return
    onClose()
  }

  return (
    <ErpModal
      open
      title="현재고 일괄 등록"
      description={
        canDelete
          ? '품목코드와 맞출 현재고를 붙여넣으세요. (증가=사급입고, 감소=조정불출)'
          : '현재고 조정은 관리자 이상만 할 수 있습니다.'
      }
      size="lg"
      onClose={handleClose}
      closeOnEscape={!saving}
      footer={
        <div className="flex w-full flex-col gap-2">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <ErpButton variant="secondary" disabled={saving} onClick={handleClose}>
              {canDelete ? '취소' : '닫기'}
            </ErpButton>
            {canDelete ? (
              <ErpButton
                disabled={saving || !previewLines.length}
                onClick={() => void handleSave()}
              >
                {saving ? '적용 중…' : `일괄 적용${previewLines.length ? ` (${previewLines.length}건)` : ''}`}
              </ErpButton>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {canDelete ? (
          <div className={ERP_INFO_BOX_CLASS}>
            <p className={ERP_INFO_BOX_TITLE_CLASS}>일괄 붙여넣기</p>
            <p className={ERP_INFO_BOX_TEXT_CLASS}>
              Excel에서 품목코드·현재고 열을 복사한 뒤 붙여넣으세요. 품목코드는 고객사 코드·내부
              MR 코드·MPN으로도 매칭됩니다.
            </p>

            <ExcelPasteSampleTable
              columns={DIRECT_STOCK_PASTE_COLUMNS}
              sampleRows={[directStockPasteSampleValues(), ['R1005-100K', '50']]}
            />

            <textarea
              value={pasteText}
              onChange={(event) => {
                setPasteText(event.target.value)
                setHint('')
                setError('')
              }}
              disabled={saving}
              rows={5}
              placeholder={directStockPastePlaceholder()}
              className={ERP_PASTE_TEXTAREA_CLASS}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ErpButton
                variant="secondary"
                disabled={saving || !pasteText.trim()}
                onClick={applyPaste}
              >
                붙여넣기 적용
              </ErpButton>
              {hint ? <p className="text-xs text-slate-600">{hint}</p> : null}
            </div>

            {unresolved.length ? (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                <p className="text-xs font-bold text-amber-900">
                  등록되지 않은 품목 {unresolved.length}건 (제외됨)
                </p>
                <p className="mt-1 font-mono text-xs text-amber-800">
                  {unresolved.slice(0, 12).join(', ')}
                  {unresolved.length > 12 ? ` 외 ${unresolved.length - 12}건` : ''}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {previewLines.length ? (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="erp-data-table erp-data-table--compact w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                    품목코드
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                    품목명
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                    현재고
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                    맞출 수량
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                    증감
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewLines.map((line) => {
                  const delta = line.targetQuantity - line.currentQuantity
                  const material = rows.find((row) => row.id === line.materialId)
                  return (
                    <tr key={line.materialId} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-blue-800">
                        {material ? formatMaterialDisplayCode(material) : line.materialId}
                      </td>
                      <td className="px-3 py-2 text-slate-800">{line.materialName || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {formatInventoryQuantity(line.currentQuantity)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {formatInventoryQuantity(line.targetQuantity)}
                      </td>
                      <td
                        className={[
                          'px-3 py-2 text-right tabular-nums font-medium',
                          delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-slate-400',
                        ].join(' ')}
                      >
                        {delta === 0
                          ? '—'
                          : delta > 0
                            ? `+${formatInventoryQuantity(delta)}`
                            : formatInventoryQuantity(delta)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </ErpModal>
  )
}
