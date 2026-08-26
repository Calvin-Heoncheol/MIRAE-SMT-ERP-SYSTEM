'use client'

import JsBarcode from 'jsbarcode'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_LABEL_PRINT_SETTINGS,
  formatLabelPrintSize,
  getLabelPrintSettings,
  LABEL_PRINT_SETTINGS_CHANGED,
  type LabelPrintSettings,
} from '@/lib/materials/label-print-settings'

type MaterialLabelVisualPreviewProps = {
  code: string
  materialName?: string
  specification?: string
  package?: string
  /** 옆에 더 보여줄 코드 (작게) */
  nextCodes?: string[]
}

function useLabelPrintSettingsLive() {
  const [settings, setSettings] = useState<LabelPrintSettings>(DEFAULT_LABEL_PRINT_SETTINGS)

  useEffect(() => {
    const sync = () => setSettings(getLabelPrintSettings())
    sync()
    window.addEventListener(LABEL_PRINT_SETTINGS_CHANGED, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(LABEL_PRINT_SETTINGS_CHANGED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return settings
}

function LabelFace({
  code,
  materialName,
  specification,
  packageName,
  settings,
  maxCssWidth,
}: {
  code: string
  materialName: string
  specification: string
  packageName: string
  settings: LabelPrintSettings
  maxCssWidth: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { widthMm, heightMm } = settings
  const scale = Math.min(Math.max(Math.min(widthMm / 40, heightMm / 30), 0.4), 2)
  const specLine = [specification, packageName].filter(Boolean).join(', ')
  const hasHeader = Boolean(materialName || specLine)

  const preview = useMemo(() => {
    const pxPerMm = 3.6
    const rawW = widthMm * pxPerMm
    const rawH = heightMm * pxPerMm
    const fit = Math.min(1, maxCssWidth / rawW, 220 / rawH)
    return {
      width: rawW * fit,
      height: rawH * fit,
      padX: Math.max(4, 6 * scale * fit),
      padY: Math.max(4, 5 * scale * fit),
      namePx: Math.max(9, 10.5 * scale * fit),
      specPx: Math.max(8, 9 * scale * fit),
      idPx: Math.max(8, 10.5 * scale * fit),
      barH: Math.max(22, Math.min(rawH * fit * (hasHeader ? 0.26 : 0.32), 44 * fit)),
      barWidth: Math.max(1.05, 1.35 * scale),
    }
  }, [widthMm, heightMm, scale, maxCssWidth, hasHeader])

  useEffect(() => {
    const node = svgRef.current
    if (!node || !code.trim()) return
    try {
      JsBarcode(node, code.trim(), {
        format: 'CODE128',
        width: preview.barWidth,
        height: preview.barH,
        displayValue: false,
        margin: 0,
        background: 'transparent',
      })
    } catch {
      node.replaceChildren()
    }
  }, [code, preview.barH, preview.barWidth])

  return (
    <div
      className="flex flex-col items-center justify-center overflow-hidden border border-slate-300 bg-white shadow-sm"
      style={{
        width: preview.width,
        height: preview.height,
        padding: `${preview.padY}px ${preview.padX}px`,
      }}
    >
      {hasHeader ? (
        <div className="w-full shrink-0 text-center">
          {materialName ? (
            <p
              className="truncate font-bold text-slate-900"
              style={{ fontSize: preview.namePx, lineHeight: 1.15 }}
            >
              {materialName}
            </p>
          ) : null}
          {specLine ? (
            <p
              className="truncate text-slate-600"
              style={{ fontSize: preview.specPx, lineHeight: 1.15 }}
            >
              {specLine}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
        <svg ref={svgRef} className="max-h-full max-w-full" />
        <p
          className="mt-1 max-w-full truncate font-mono font-extrabold tracking-wide text-slate-900"
          style={{ fontSize: preview.idPx, lineHeight: 1.1 }}
        >
          {code.trim() || '—'}
        </p>
      </div>
    </div>
  )
}

/** 실제 출력에 가까운 라벨 미리보기 (용지 mm 반영) */
export function MaterialLabelVisualPreview({
  code,
  materialName = '',
  specification = '',
  package: packageName = '',
  nextCodes = [],
}: MaterialLabelVisualPreviewProps) {
  const settings = useLabelPrintSettingsLive()
  const trimmed = code.trim()
  const extras = nextCodes.filter((item) => item && item !== trimmed).slice(0, 2)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">라벨 미리보기</h2>
        <span className="text-xs tabular-nums text-slate-500">
          {formatLabelPrintSize(settings)} · {settings.dpi}dpi
        </span>
      </div>

      {!trimmed ? (
        <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-400">시작 코드를 입력하면 라벨 미리보기가 표시됩니다.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5">
          <LabelFace
            code={trimmed}
            materialName={materialName.trim()}
            specification={specification.trim()}
            packageName={packageName.trim()}
            settings={settings}
            maxCssWidth={320}
          />
          {extras.length > 0 ? (
            <div className="flex flex-wrap items-end justify-center gap-3">
              {extras.map((item) => (
                <div key={item} className="opacity-80">
                  <LabelFace
                    code={item}
                    materialName={materialName.trim()}
                    specification={specification.trim()}
                    packageName={packageName.trim()}
                    settings={settings}
                    maxCssWidth={140}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <p className="text-center text-xs text-slate-500">
            용지 설정(톱니)을 바꾸면 미리보기 비율도 같이 바뀝니다. 실제 ZPL 출력과 글자·여백은 약간 다를 수
            있습니다.
          </p>
        </div>
      )}
    </div>
  )
}
