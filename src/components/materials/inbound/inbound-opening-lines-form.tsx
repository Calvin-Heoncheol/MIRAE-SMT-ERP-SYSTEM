'use client'

import { useRef, type Dispatch, type SetStateAction } from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import {
  defaultOpeningInboundItemForm,
  parseOpeningInboundPaste,
  type OpeningInboundItemForm,
} from '@/lib/materials/inbound/opening-form-state'

type InboundOpeningLinesFormProps = {
  items: OpeningInboundItemForm[]
  onChange: Dispatch<SetStateAction<OpeningInboundItemForm[]>>
}

export function InboundOpeningLinesForm({ items, onChange }: InboundOpeningLinesFormProps) {
  const pasteRef = useRef<HTMLTextAreaElement>(null)

  const inputClassName =
    'w-full min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

  function patchItem(index: number, patch: Partial<OpeningInboundItemForm>) {
    onChange((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function addRow() {
    onChange((current) => [...current, defaultOpeningInboundItemForm()])
  }

  function removeRow(index: number) {
    onChange((current) => {
      if (current.length <= 1) return [defaultOpeningInboundItemForm()]
      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  function applyPasteText(text: string) {
    const parsed = parseOpeningInboundPaste(text)
    if (!parsed.length) return
    onChange(parsed)
  }

  function handleBulkPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData('text')
    if (!text.trim()) return
    event.preventDefault()
    applyPasteText(text)
    if (pasteRef.current) pasteRef.current.value = ''
  }

  function handleTablePaste(event: React.ClipboardEvent<HTMLTableElement>) {
    const text = event.clipboardData.getData('text')
    if (!text.includes('\n') && !text.includes('\t')) return
    event.preventDefault()
    applyPasteText(text)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-3">
        <p className="text-sm font-medium text-blue-900">일괄 붙여넣기</p>
        <p className="mt-1 text-xs text-blue-800">
          Excel에서 품목코드·입고수량 2열을 복사해 아래에 붙여넣으면 표에 채워집니다. (탭 또는 줄바꿈 구분)
        </p>
        <textarea
          ref={pasteRef}
          rows={3}
          onPaste={handleBulkPaste}
          placeholder={'품목코드\t입고수량\nMR-001\t1000\nMR-002\t500'}
          className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[420px] w-full border-collapse text-sm" onPaste={handleTablePaste}>
          <thead className="bg-slate-50">
            <tr>
              <th className="min-w-[200px] px-3 py-2 text-left text-sm font-semibold text-slate-600">
                품목코드
              </th>
              <th className="min-w-[120px] px-3 py-2 text-right text-sm font-semibold text-slate-600">
                입고수량
              </th>
              <th className="w-16 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-t border-slate-100">
                <td className="px-3 py-2 align-top">
                  <input
                    value={item.materialId}
                    onChange={(event) => patchItem(index, { materialId: event.target.value })}
                    placeholder="품목코드"
                    className={`${inputClassName} font-mono`}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <QuoteNumericInput
                    min={0}
                    value={item.quantity}
                    onChange={(quantity) => patchItem(index, { quantity })}
                    className={`${inputClassName} text-right font-medium`}
                  />
                </td>
                <td className="px-3 py-2 text-center align-top">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:bg-slate-50"
      >
        + 행 추가
      </button>
    </div>
  )
}
