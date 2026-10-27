'use client'

import { useRef, useState } from 'react'
import {
  BOM_SPREADSHEET_COLUMNS,
  formatBomLineDescription,
  parseBomLineDescription,
  rematchBomFormLine,
  type BomSpreadsheetColumnKey,
} from '@/lib/bom/bulk-paste'
import { resolveBomLineAlternates } from '@/lib/bom/alternates'
import { bomDesignatorQtyIssue } from '@/lib/bom/designator-check'
import type { BomFormLine } from '@/lib/bom/form-state'
import { BOM_PROCESS_LABELS, normalizeBomProcess } from '@/lib/bom/types'
import type { Item } from '@/lib/items/types'

type BomLinesSpreadsheetProps = {
  lines: BomFormLine[]
  childItems: Item[]
  disabled?: boolean
  onPatchLine: (key: string, patch: Partial<BomFormLine>) => void
  onRemoveLine: (key: string) => void
  onAddLine?: () => void
  onPasteBlock: (text: string) => void
  onColumnPaste: (
    startRowIndex: number,
    columnKey: BomSpreadsheetColumnKey,
    text: string,
  ) => void
}

const cellClass =
  'box-border h-9 w-full border-0 bg-transparent px-2 text-sm text-slate-900 outline-none focus:bg-sky-50 disabled:bg-transparent'

function isBlankLine(line: BomFormLine) {
  return !(
    line.childProductId.trim() ||
    line.sourcePartCode.trim() ||
    line.sourceMpn.trim() ||
    line.sourceName.trim() ||
    line.sourceSpec.trim() ||
    line.designators.trim() ||
    line.sourceAlternates.trim() ||
    (line.quantityPer.trim() && line.quantityPer.trim() !== '1' && line.quantityPer.trim() !== '')
  )
}

function cellValue(line: BomFormLine, key: BomSpreadsheetColumnKey) {
  switch (key) {
    case 'sourcePartCode':
      return line.sourcePartCode
    case 'process':
      return line.process ? BOM_PROCESS_LABELS[line.process] : ''
    case 'sourceDescription':
      return formatBomLineDescription(line)
    case 'quantityPer':
      return line.quantityPer
    case 'designators':
      return line.designators
    case 'sourceAlternates':
      return line.sourceAlternates
  }
}

export function BomLinesSpreadsheet({
  lines,
  childItems,
  disabled = false,
  onPatchLine,
  onRemoveLine,
  onAddLine,
  onPasteBlock,
  onColumnPaste,
}: BomLinesSpreadsheetProps) {
  const tableRef = useRef<HTMLTableElement>(null)
  const [processDraftByKey, setProcessDraftByKey] = useState<Record<string, string>>({})
  /** 품목명/규격 칸 — 입력 중에는 원문 유지, 확정(blur·Enter) 시 품목명·규격·MPN 으로 나눔 */
  const [descriptionDraftByKey, setDescriptionDraftByKey] = useState<Record<string, string>>({})

  function focusCell(rowIndex: number, columnIndex: number) {
    const root = tableRef.current
    if (!root) return
    const cell = root.querySelector<HTMLElement>(
      `[data-bom-cell="${rowIndex}:${columnIndex}"]`,
    )
    cell?.focus()
  }

  function commitProcess(line: BomFormLine, raw: string) {
    const process = normalizeBomProcess(raw)
    onPatchLine(line.key, { process })
    setProcessDraftByKey((current) => {
      if (!(line.key in current)) return current
      const next = { ...current }
      delete next[line.key]
      return next
    })
  }

  function commitDescription(line: BomFormLine, raw: string) {
    setDescriptionDraftByKey((current) => {
      if (!(line.key in current)) return current
      const next = { ...current }
      delete next[line.key]
      return next
    })
    if (raw === formatBomLineDescription(line)) return
    const next = rematchBomFormLine({ ...line, ...parseBomLineDescription(raw) }, childItems)
    onPatchLine(line.key, {
      childProductId: next.childProductId,
      sourcePartCode: next.sourcePartCode,
      sourceName: next.sourceName,
      sourceMpn: next.sourceMpn,
      sourceSpec: next.sourceSpec,
    })
  }

  function cellDisplayValue(line: BomFormLine, columnKey: BomSpreadsheetColumnKey) {
    if (columnKey === 'process') return processDraftByKey[line.key] ?? cellValue(line, 'process')
    if (columnKey === 'sourceDescription') {
      return descriptionDraftByKey[line.key] ?? cellValue(line, 'sourceDescription')
    }
    return cellValue(line, columnKey)
  }

  function handleFieldChange(
    line: BomFormLine,
    columnKey: BomSpreadsheetColumnKey,
    value: string,
  ) {
    if (columnKey === 'sourceDescription') {
      setDescriptionDraftByKey((current) => ({ ...current, [line.key]: value }))
      return
    }

    if (columnKey === 'process') {
      setProcessDraftByKey((current) => ({ ...current, [line.key]: value }))
      const normalized = normalizeBomProcess(value)
      if (normalized || !value.trim()) {
        onPatchLine(line.key, { process: normalized })
      }
      return
    }

    const patch: Partial<BomFormLine> = { [columnKey]: value }

    if (columnKey === 'sourcePartCode') {
      const next = rematchBomFormLine({ ...line, ...patch }, childItems)
      onPatchLine(line.key, {
        ...patch,
        childProductId: next.childProductId,
        sourcePartCode: next.sourcePartCode,
        sourceName: next.sourceName,
        sourceMpn: next.sourceMpn,
        sourceSpec: next.sourceSpec,
      })
      return
    }

    onPatchLine(line.key, patch)
  }

  function handleCellPaste(
    rowIndex: number,
    columnKey: BomSpreadsheetColumnKey,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) {
    const text = event.clipboardData.getData('text')
    if (!text.trim()) return

    if (text.includes('\t')) {
      event.preventDefault()
      onPasteBlock(text)
      return
    }

    if (text.includes('\n')) {
      event.preventDefault()
      onColumnPaste(rowIndex, columnKey, text)
      return
    }

    // 단일 셀 붙여넣기 — 공정은 SMD/DIP로 정규화
    if (columnKey === 'process') {
      event.preventDefault()
      const line = lines[rowIndex]
      if (line) commitProcess(line, text)
    }
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number,
    columnKey: BomSpreadsheetColumnKey,
  ) {
    if (event.key === 'Enter') {
      event.preventDefault()
      const line = lines[rowIndex]
      if (line && columnKey === 'process') {
        const draft = processDraftByKey[line.key]
        commitProcess(line, draft ?? cellValue(line, 'process'))
      }
      if (line && columnKey === 'sourceDescription') {
        const draft = descriptionDraftByKey[line.key]
        if (draft !== undefined) commitDescription(line, draft)
      }
      if (rowIndex >= lines.length - 1) {
        onAddLine?.()
        window.requestAnimationFrame(() => focusCell(rowIndex + 1, columnIndex))
      } else {
        focusCell(rowIndex + 1, columnIndex)
      }
      return
    }

    if (event.key === 'ArrowDown' && !event.altKey) {
      event.preventDefault()
      if (rowIndex >= lines.length - 1) onAddLine?.()
      window.requestAnimationFrame(() => focusCell(Math.min(rowIndex + 1, lines.length), columnIndex))
      return
    }

    if (event.key === 'ArrowUp' && !event.altKey) {
      event.preventDefault()
      focusCell(Math.max(0, rowIndex - 1), columnIndex)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-300 bg-white shadow-sm">
      <table
        ref={tableRef}
        className="w-full min-w-[980px] border-collapse text-sm"
      >
        <thead className="sticky top-0 z-[1]">
          <tr className="bg-slate-100 text-slate-700">
            <th className="w-12 border-b border-r border-slate-300 px-2 py-2 text-center text-xs font-semibold">
              #
            </th>
            {BOM_SPREADSHEET_COLUMNS.map((column) => (
              <th
                key={column.key}
                className={[
                  'border-b border-r border-slate-300 px-2 py-2 text-xs font-semibold last:border-r-0',
                  column.widthClass,
                  column.align === 'right'
                    ? 'text-right'
                    : column.align === 'center'
                      ? 'text-center'
                      : 'text-left',
                ].join(' ')}
              >
                {column.label}
              </th>
            ))}
            <th className="w-10 border-b border-slate-300 px-1 py-2" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const unmatched =
              !line.childProductId.trim() &&
              !isBlankLine(line) &&
              Boolean(line.sourcePartCode.trim() || line.sourceMpn.trim())
            const qtyIssue = bomDesignatorQtyIssue(line)
            const qtyIssueTitle = qtyIssue
              ? `Designator ${qtyIssue.designatorCount}개 ≠ Qty ${qtyIssue.quantity}`
              : undefined
            const unresolvedAlternates = line.sourceAlternates.trim()
              ? resolveBomLineAlternates(line.childProductId, line.sourceAlternates, childItems)
                  .unresolvedTokens
              : []
            const cellTitle = (key: BomSpreadsheetColumnKey) =>
              qtyIssue && (key === 'quantityPer' || key === 'designators')
                ? qtyIssueTitle
                : key === 'sourceAlternates' && unresolvedAlternates.length
                  ? `미등록 대체코드: ${unresolvedAlternates.join(', ')}`
                  : undefined

            return (
              <tr
                key={line.key}
                className={unmatched ? 'bg-amber-50/80' : 'bg-white odd:bg-slate-50/40'}
              >
                <td className="border-b border-r border-slate-200 px-2 text-center text-xs tabular-nums text-slate-400">
                  {index + 1}
                </td>
                {BOM_SPREADSHEET_COLUMNS.map((column, columnIndex) => (
                  <td
                    key={column.key}
                    className={`border-b border-r border-slate-200 p-0 ${column.widthClass} ${
                      qtyIssue && (column.key === 'quantityPer' || column.key === 'designators')
                        ? 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-400'
                        : (unmatched &&
                              (column.key === 'sourcePartCode' ||
                                column.key === 'sourceDescription')) ||
                            (column.key === 'sourceAlternates' && unresolvedAlternates.length)
                          ? 'bg-amber-50'
                          : ''
                    }`}
                    title={cellTitle(column.key)}
                  >
                    <input
                      data-bom-cell={`${index}:${columnIndex}`}
                      type={column.key === 'quantityPer' ? 'number' : 'text'}
                      min={column.key === 'quantityPer' ? 0 : undefined}
                      step={column.key === 'quantityPer' ? 'any' : undefined}
                      value={cellDisplayValue(line, column.key)}
                      disabled={disabled}
                      placeholder={column.key === 'process' ? 'SMD/DIP' : undefined}
                      title={
                        column.key === 'sourceDescription'
                          ? '품목명 / 규격 / MPN 순서로 " / " 구분 입력 (구분 없이 넣으면 AI 분류로 나눔)'
                          : undefined
                      }
                      onChange={(event) =>
                        handleFieldChange(line, column.key, event.target.value)
                      }
                      onBlur={() => {
                        if (column.key === 'process') {
                          const draft = processDraftByKey[line.key]
                          if (draft !== undefined) commitProcess(line, draft)
                        }
                        if (column.key === 'sourceDescription') {
                          const draft = descriptionDraftByKey[line.key]
                          if (draft !== undefined) commitDescription(line, draft)
                        }
                      }}
                      onPaste={(event) => handleCellPaste(index, column.key, event)}
                      onKeyDown={(event) =>
                        handleKeyDown(event, index, columnIndex, column.key)
                      }
                      className={[
                        cellClass,
                        column.mono ? 'font-mono text-[13px]' : '',
                        column.align === 'right' ? 'text-right tabular-nums' : '',
                        column.align === 'center' ? 'text-center uppercase' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label={`${index + 1}행 ${column.label}`}
                    />
                  </td>
                ))}
                <td className="border-b border-slate-200 p-0 text-center">
                  <button
                    type="button"
                    onClick={() => onRemoveLine(line.key)}
                    disabled={disabled}
                    className="flex h-9 w-full items-center justify-center text-slate-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    aria-label={`${index + 1}행 삭제`}
                  >
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
