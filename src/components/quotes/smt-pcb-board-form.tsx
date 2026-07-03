'use client'

import type { ReactNode } from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import {
  getSmtSetupRate,
  SMT_UNIT_BGA_BALL,
  SMT_UNIT_CHIP,
  SMT_UNIT_IC_PIN,
  SMT_UNIT_ODD,
  SMT_UNIT_SPECIAL,
} from '@/lib/quotes/constants'
import { formatQuoteMoneyUnit } from '@/lib/quotes/format'
import type { SmtBoardForm } from '@/lib/quotes/form-state'
import type { QuoteType } from '@/lib/quotes/types'

type SmtPcbBoardFormProps = {
  board: SmtBoardForm
  quoteType: QuoteType
  onChange: (board: SmtBoardForm) => void
  onPcbNameChange?: () => void
}

function UnitPreview({ krw, suffix = '', quoteType }: { krw: number; suffix?: string; quoteType: QuoteType }) {
  return (
    <span className="mt-1 block text-[11px] text-slate-400">
      {formatQuoteMoneyUnit(krw, quoteType)}
      {suffix}
    </span>
  )
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      {description ? <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  )
}

export function SmtPcbBoardForm({ board, quoteType, onChange, onPcbNameChange }: SmtPcbBoardFormProps) {
  const isDouble = board.smtSide === 'double'

  function patch(patch: Partial<SmtBoardForm>) {
    onChange({ ...board, ...patch })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <input
        value={board.pcbName}
        onChange={(event) => {
          patch({ pcbName: event.target.value })
          onPcbNameChange?.()
        }}
        placeholder="PCB 명칭"
        className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
      />

      <div className="space-y-3">
        <FormSection title="일반 부품 (부품 개수)" description="부품 1개 = 1 · CHIP, 이형, 특수/모듈 개수를 입력합니다.">
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs font-medium text-slate-600">
              CHIP
              <QuoteNumericInput
                min={0}
                value={board.chip}
                onChange={(chip) => patch({ chip })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
              <UnitPreview krw={SMT_UNIT_CHIP} suffix="/개" quoteType={quoteType} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              이형
              <QuoteNumericInput
                min={0}
                value={board.smtOdd}
                onChange={(smtOdd) => patch({ smtOdd })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
              <UnitPreview krw={SMT_UNIT_ODD} suffix="/개" quoteType={quoteType} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              특수/모듈
              <QuoteNumericInput
                min={0}
                value={board.smtSpecial}
                onChange={(smtSpecial) => patch({ smtSpecial })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
              <UnitPreview krw={SMT_UNIT_SPECIAL} suffix="/개" quoteType={quoteType} />
            </label>
          </div>
        </FormSection>

        <FormSection
          title="IC / BGA (핀·볼 총수)"
          description="부품 개수가 아닙니다. 보드에 실린 IC 핀 수·BGA 볼 수 합계를 입력합니다. 예: 6PIN IC 10개 → 60"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-600">
              IC PIN (핀 총수)
              <QuoteNumericInput
                min={0}
                value={board.icPin}
                onChange={(icPin) => patch({ icPin })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
              <UnitPreview krw={SMT_UNIT_IC_PIN} suffix="/PIN" quoteType={quoteType} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              BGA BALL (볼 총수)
              <QuoteNumericInput
                min={0}
                value={board.bga}
                onChange={(bga) => patch({ bga })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
              <UnitPreview krw={SMT_UNIT_BGA_BALL} suffix="/BALL" quoteType={quoteType} />
            </label>
          </div>
        </FormSection>
      </div>

      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={board.aoiEnabled}
            onChange={(event) => patch({ aoiEnabled: event.target.checked })}
          />
          AOI 및 외관검사 (단면 {formatQuoteMoneyUnit(100, quoteType)} · 양면{' '}
          {formatQuoteMoneyUnit(200, quoteType)})
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={board.pcbWashEnabled}
            onChange={(event) => patch({ pcbWashEnabled: event.target.checked })}
          />
          PCB 세척 ({formatQuoteMoneyUnit(100, quoteType)})
        </label>
      </div>

      <div className="mt-3">
        <p className="mb-2 text-xs font-medium text-slate-600">단면 / 양면</p>
        <div className="flex gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!isDouble}
              onChange={() => patch({ smtSide: 'single', smtBotCount: '0' })}
            />
            단면
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={isDouble}
              onChange={() => patch({ smtSide: 'double' })}
            />
            양면
          </label>
        </div>
      </div>

      <div className="mt-4 border-t border-dashed border-slate-200 pt-4">
        <p className="mb-2 text-xs font-semibold text-slate-600">SET-UP (부품 종수)</p>
        <label className="text-xs font-medium text-slate-600">
          총 종수
          <QuoteNumericInput
            min={0}
            value={board.smtTopCount}
            onChange={(smtTopCount) => patch({ smtTopCount, smtBotCount: '0' })}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
          />
          <UnitPreview
            krw={getSmtSetupRate(quoteType, isDouble ? 'double' : 'single')}
            suffix="/분"
            quoteType={quoteType}
          />
        </label>
      </div>
    </div>
  )
}
