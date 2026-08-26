'use client'

import { useMemo, useState } from 'react'
import { MaterialLabelVisualPreview } from '@/components/materials/labels/material-label-visual-preview'
import { MaterialLabelSettingsButton } from '@/components/materials/material-label-settings-button'
import { ErpButton } from '@/components/ui/erp-button'
import { PageShell } from '@/components/ui/page-shell'
import { useToast } from '@/components/ui/toast-provider'
import { printMaterialLabels } from '@/lib/materials/print-material-labels'
import {
  describeSequentialLabelRange,
  expandSequentialLabelCodes,
} from '@/lib/materials/sequential-label-codes'
import {
  ERP_FIELD_INPUT_CLASS,
  ERP_FIELD_LABEL_CLASS,
  ERP_INFO_BOX_CLASS,
  ERP_INFO_BOX_TEXT_CLASS,
  ERP_INFO_BOX_TITLE_CLASS,
} from '@/lib/ui/tokens'

const MAX_SEQUENCE = 500
const LIST_PREVIEW_LIMIT = 40

export function MaterialLabelsWorkspace() {
  const toast = useToast()
  const [startCode, setStartCode] = useState('')
  const [sequenceCount, setSequenceCount] = useState('1')
  const [copiesPerCode, setCopiesPerCode] = useState('1')
  const [materialName, setMaterialName] = useState('')
  const [specification, setSpecification] = useState('')
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const count = Math.max(0, Math.floor(Number(sequenceCount) || 0))
  const copies = Math.max(1, Math.floor(Number(copiesPerCode) || 1))

  const codes = useMemo(
    () => expandSequentialLabelCodes(startCode, Math.min(count, MAX_SEQUENCE)),
    [startCode, count],
  )

  const rangeLabel = useMemo(
    () => describeSequentialLabelRange(startCode, Math.min(count, MAX_SEQUENCE)),
    [startCode, count],
  )

  const totalLabels = codes.length * copies
  const listCodes = codes.slice(0, LIST_PREVIEW_LIMIT)
  const listHidden = Math.max(0, codes.length - listCodes.length)

  const previewCode = codes[0] || startCode.trim()
  const previewNext = codes.slice(1, 3)

  async function handlePrint() {
    setError(null)
    const trimmed = startCode.trim()
    if (!trimmed) {
      setError('시작 코드를 입력하세요.')
      return
    }
    if (count < 1) {
      setError('연속 매수는 1 이상이어야 합니다.')
      return
    }
    if (count > MAX_SEQUENCE) {
      setError(`연속 매수는 최대 ${MAX_SEQUENCE.toLocaleString('ko-KR')}장까지입니다.`)
      return
    }

    const expanded = expandSequentialLabelCodes(trimmed, count)
    if (!expanded.length) {
      setError(
        count === 1
          ? '출력할 코드를 확인하세요.'
          : '끝자리가 숫자인 코드만 연속 출력이 가능합니다. (예: WAA26881000)',
      )
      return
    }

    setPrinting(true)
    try {
      const mode = await printMaterialLabels(
        expanded.map((id) => ({
          id,
          materialName: materialName.trim(),
          specification: specification.trim(),
          copies,
        })),
        { title: '라벨 출력', autoPrint: true },
      )
      toast.success(
        '라벨 출력',
        mode === 'zpl'
          ? `프린터 전송 ${totalLabels.toLocaleString('ko-KR')}장`
          : `인쇄 준비 ${totalLabels.toLocaleString('ko-KR')}장`,
      )
    } finally {
      setPrinting(false)
    }
  }

  return (
    <PageShell className="overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-8">
        <div>
          <h1 className="text-lg font-bold text-slate-900">라벨 출력</h1>
          <p className="mt-1 text-sm text-slate-500">
            Zebra Browser Print(ZPL)로 출력합니다. 용지 설정에서 실물 라벨 크기·DPI를 맞춘 뒤
            출력하세요.
          </p>
        </div>

        <div className={ERP_INFO_BOX_CLASS}>
          <p className={ERP_INFO_BOX_TITLE_CLASS}>연속 출력 예시</p>
          <p className={ERP_INFO_BOX_TEXT_CLASS}>
            시작 코드 <span className="font-mono font-semibold text-slate-800">WAA26881000</span>,
            연속 매수 <span className="font-semibold text-slate-800">3</span> →{' '}
            <span className="font-mono text-slate-800">WAA26881000</span>,{' '}
            <span className="font-mono text-slate-800">WAA26881001</span>,{' '}
            <span className="font-mono text-slate-800">WAA26881002</span>
          </p>
          <p className={`${ERP_INFO_BOX_TEXT_CLASS} mt-1.5`}>
            흐리거나 크기가 안 맞으면 용지 설정(톱니)에서 라벨 mm·DPI를 실물과 동일하게 맞추세요.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className={ERP_FIELD_LABEL_CLASS}>시작 코드</span>
                <input
                  value={startCode}
                  onChange={(event) => setStartCode(event.target.value)}
                  className={`${ERP_FIELD_INPUT_CLASS} font-mono`}
                  placeholder="예: WAA26881000"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              <label className="block text-sm">
                <span className={ERP_FIELD_LABEL_CLASS}>연속 매수</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_SEQUENCE}
                  value={sequenceCount}
                  onChange={(event) => setSequenceCount(event.target.value)}
                  className={ERP_FIELD_INPUT_CLASS}
                />
              </label>

              <label className="block text-sm">
                <span className={ERP_FIELD_LABEL_CLASS}>코드당 매수</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={copiesPerCode}
                  onChange={(event) => setCopiesPerCode(event.target.value)}
                  className={ERP_FIELD_INPUT_CLASS}
                />
              </label>

              <label className="block text-sm sm:col-span-2">
                <span className={ERP_FIELD_LABEL_CLASS}>품명 (선택)</span>
                <input
                  value={materialName}
                  onChange={(event) => setMaterialName(event.target.value)}
                  className={ERP_FIELD_INPUT_CLASS}
                  placeholder="라벨 상단 표시"
                />
              </label>

              <label className="block text-sm sm:col-span-2">
                <span className={ERP_FIELD_LABEL_CLASS}>사양 (선택)</span>
                <input
                  value={specification}
                  onChange={(event) => setSpecification(event.target.value)}
                  className={ERP_FIELD_INPUT_CLASS}
                  placeholder="라벨 사양 줄"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <MaterialLabelSettingsButton />
              <ErpButton disabled={printing} loading={printing} onClick={() => void handlePrint()}>
                라벨 출력
              </ErpButton>
              {codes.length > 0 ? (
                <p className="text-sm text-slate-500">
                  {rangeLabel}
                  {copies > 1 ? ` · 코드당 ${copies.toLocaleString('ko-KR')}장` : ''}
                  {` · 총 ${totalLabels.toLocaleString('ko-KR')}장`}
                </p>
              ) : null}
            </div>

            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          </div>

          <MaterialLabelVisualPreview
            code={previewCode}
            materialName={materialName}
            specification={specification}
            nextCodes={previewNext}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">코드 목록</h2>
            <span className="text-xs tabular-nums text-slate-500">
              {codes.length > 0
                ? `${codes.length.toLocaleString('ko-KR')}종`
                : '시작 코드를 입력하세요'}
            </span>
          </div>
          {!codes.length ? (
            <p className="text-sm text-slate-400">연속 코드 목록이 여기에 표시됩니다.</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 font-mono text-sm text-slate-800">
              {listCodes.map((code) => (
                <li key={code} className="border-b border-slate-100/80 py-1.5 last:border-b-0">
                  {code}
                </li>
              ))}
              {listHidden > 0 ? (
                <li className="py-1.5 text-xs text-slate-500">
                  … 외 {listHidden.toLocaleString('ko-KR')}건
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  )
}
