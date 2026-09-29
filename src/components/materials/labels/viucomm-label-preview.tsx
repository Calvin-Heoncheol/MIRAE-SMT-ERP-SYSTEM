'use client'

import { useEffect, useRef } from 'react'
import {
  VIUCOMM_P141A_BOX_LABEL,
  renderViucommP141aBoxLabelDataUrl,
} from '@/lib/labels/viucomm-p141a-box-label'

type ViucommLabelPreviewProps = {
  serial: string
  nextSerials?: string[]
}

/** 인쇄 도트와 동일한 미리보기 (240×160 → 3배 확대) */
export function ViucommLabelPreview({ serial, nextSerials = [] }: ViucommLabelPreviewProps) {
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (imgRef.current) imgRef.current.src = renderViucommP141aBoxLabelDataUrl(serial)
  }, [serial])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">미리보기</h2>
        <span className="text-xs text-slate-500">
          {VIUCOMM_P141A_BOX_LABEL.widthMm}×{VIUCOMM_P141A_BOX_LABEL.heightMm}mm ·{' '}
          {VIUCOMM_P141A_BOX_LABEL.dpi}dpi
        </span>
      </div>
      <div className="flex justify-center rounded-lg bg-slate-100 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          alt="라벨 미리보기"
          width={720}
          height={480}
          className="h-auto w-full max-w-[480px] border border-slate-300 bg-white [image-rendering:pixelated]"
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        실제 인쇄 도트와 같은 이미지입니다. S/N·바코드만 바뀌고 나머지는 원본 CODESOFT 양식 그대로입니다.
      </p>
      {nextSerials.length ? (
        <p className="mt-1 font-mono text-xs text-slate-500">다음: {nextSerials.join(', ')} …</p>
      ) : null}
    </div>
  )
}
