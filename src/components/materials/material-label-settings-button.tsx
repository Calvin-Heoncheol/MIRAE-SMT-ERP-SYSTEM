'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import {
  DEFAULT_LABEL_PRINT_SETTINGS,
  formatLabelPrintSize,
  getLabelPrintSettings,
  LABEL_PRINT_SIZE_PRESETS,
  setLabelPrintSettings,
  type LabelPrintDpi,
  type LabelPrintSettings,
} from '@/lib/materials/label-print-settings'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

type MaterialLabelSettingsButtonProps = {
  className?: string
}

const PREVIEW_SAMPLE = {
  name: '세라믹콘덴서',
  spec: '100nF 50V 0402',
  id: 'C0402-100N',
}

function GearIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 13a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H5a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H10a1.7 1.7 0 0 0 1-1.5V5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V10c0 .7.4 1.3 1 1.5H19a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}

/** 미리보기용 가짜 Code128 막대 */
function PreviewBarcode() {
  const bars = [1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 1, 2, 1, 2, 1, 3, 1, 1, 2]
  return (
    <div className="flex h-full w-full items-stretch justify-center gap-px overflow-hidden px-0.5" aria-hidden>
      {bars.map((width, index) => (
        <span
          key={index}
          className="bg-slate-900"
          style={{ width: `${width * 1.4}px`, flexShrink: 0 }}
        />
      ))}
    </div>
  )
}

function LabelPreview({ widthMm, heightMm }: { widthMm: number; heightMm: number }) {
  const scale = useMemo(() => {
    const maxW = 280
    const maxH = 200
    const pxW = Math.max(10, widthMm) * 3.2
    const pxH = Math.max(10, heightMm) * 3.2
    return Math.min(1, maxW / pxW, maxH / pxH)
  }, [widthMm, heightMm])

  const previewW = Math.max(10, widthMm) * 3.2 * scale
  const previewH = Math.max(10, heightMm) * 3.2 * scale
  const compact = heightMm < 22 || widthMm < 28
  const contentScale = Math.min(Math.max(Math.min(widthMm / 40, heightMm / 30), 0.4), 2)
  const barcodeBoxH = Math.max(16, Math.min(previewH * 0.42, 28 * contentScale))
  const nameSize = Math.max(7, 10 * contentScale)
  const specSize = Math.max(6, 8 * contentScale)
  const idSize = Math.max(7, 9 * contentScale)

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className={ERP_FIELD_LABEL_CLASS}>미리보기</p>
        <p className="text-xs tabular-nums text-slate-500">
          {widthMm}×{heightMm} mm · 예시
        </p>
      </div>
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4">
        <div
          className="flex flex-col overflow-hidden border border-slate-300 bg-white shadow-sm"
          style={{
            width: `${previewW}px`,
            height: `${previewH}px`,
            padding: compact ? '3px 4px' : `${Math.max(3, 5 * contentScale)}px ${Math.max(4, 6 * contentScale)}px`,
          }}
        >
          <div className="shrink-0 text-center">
            <p
              className="truncate font-bold text-slate-900"
              style={{ fontSize: nameSize, lineHeight: 1.15 }}
            >
              {PREVIEW_SAMPLE.name}
            </p>
            <p
              className="truncate text-slate-600"
              style={{ fontSize: specSize, lineHeight: 1.15 }}
            >
              {PREVIEW_SAMPLE.spec}
            </p>
          </div>

          <div
            className="mt-auto mb-auto flex shrink-0 flex-col items-center justify-center"
            style={{ height: barcodeBoxH }}
          >
            <PreviewBarcode />
            <p
              className="mt-0.5 font-mono font-bold text-slate-900"
              style={{ fontSize: idSize }}
            >
              {PREVIEW_SAMPLE.id}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        용지 크기를 바꾸면 미리보기·실제 출력의 글자·바코드 크기도 같이 바뀝니다. 저장 후 다시 인쇄해 주세요.
      </p>
    </div>
  )
}

function CancelButton({ disabled }: { disabled?: boolean }) {
  const requestClose = useErpModalRequestClose()
  return (
    <ErpButton variant="secondary" disabled={disabled} onClick={() => requestClose?.()}>
      취소
    </ErpButton>
  )
}

function MaterialLabelSettingsModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [form, setForm] = useState<LabelPrintSettings>(() => getLabelPrintSettings())

  useEffect(() => {
    if (!open) return
    setForm(getLabelPrintSettings())
  }, [open])

  function applyPreset(widthMm: number, heightMm: number) {
    setForm((current) => ({ ...current, widthMm, heightMm }))
  }

  function handleSave() {
    setLabelPrintSettings(form)
    onClose()
  }

  function handleReset() {
    setForm(DEFAULT_LABEL_PRINT_SETTINGS)
  }

  return (
    <ErpModal
      open={open}
      title="바코드 라벨 용지 설정"
      description="이 PC에만 저장됩니다. ZM400 실물 용지와 같은 크기로 맞춰 주세요."
      onClose={onClose}
      size="form"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <ErpButton variant="secondary" onClick={handleReset}>
            기본값
          </ErpButton>
          <div className="flex gap-2">
            <CancelButton />
            <ErpButton onClick={handleSave}>저장</ErpButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <LabelPreview widthMm={form.widthMm} heightMm={form.heightMm} />

        <div>
          <p className={ERP_FIELD_LABEL_CLASS}>빠른 선택</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {LABEL_PRINT_SIZE_PRESETS.map((preset) => {
              const active = form.widthMm === preset.widthMm && form.heightMm === preset.heightMm
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.widthMm, preset.heightMm)}
                  className={[
                    'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
                    active
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>가로 (mm)</span>
            <input
              type="number"
              min={10}
              max={200}
              step={0.5}
              value={form.widthMm}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  widthMm: Number(event.target.value) || current.widthMm,
                }))
              }
              className={ERP_FIELD_INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>세로 (mm)</span>
            <input
              type="number"
              min={10}
              max={200}
              step={0.5}
              value={form.heightMm}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  heightMm: Number(event.target.value) || current.heightMm,
                }))
              }
              className={ERP_FIELD_INPUT_CLASS}
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>프린터 DPI</span>
          <select
            value={form.dpi}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                dpi: Number(event.target.value) as LabelPrintDpi,
              }))
            }
            className={ERP_FIELD_INPUT_CLASS}
          >
            <option value={203}>203 dpi (ZM400 일반)</option>
            <option value={300}>300 dpi</option>
          </select>
        </label>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.preferBrowserPrint}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                preferBrowserPrint: event.target.checked,
              }))
            }
            className="mt-0.5 size-4 accent-slate-700"
          />
          <span>
            <span className="font-medium">Browser Print(ZPL) 우선 사용</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              끄면 항상 브라우저 인쇄창으로 출력합니다.
            </span>
          </span>
        </label>
      </div>
    </ErpModal>
  )
}

/** 바코드 라벨 용지 설정 아이콘 버튼 */
export function MaterialLabelSettingsButton({ className = '' }: MaterialLabelSettingsButtonProps) {
  const [open, setOpen] = useState(false)
  // SSR·첫 클라이언트 렌더는 기본값으로 맞추고, 마운트 후 localStorage 반영 (hydration mismatch 방지)
  const [summary, setSummary] = useState(() => formatLabelPrintSize(DEFAULT_LABEL_PRINT_SETTINGS))

  useEffect(() => {
    setSummary(formatLabelPrintSize(getLabelPrintSettings()))
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`라벨 용지 설정 (${summary})`}
        aria-label={`라벨 용지 설정, 현재 ${summary}`}
        className={[
          'inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50',
          className,
        ].join(' ')}
      >
        <GearIcon />
        <span className="tabular-nums text-slate-500">{summary}</span>
      </button>
      {open ? (
        <MaterialLabelSettingsModal
          open
          onClose={() => {
            setSummary(formatLabelPrintSize(getLabelPrintSettings()))
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
