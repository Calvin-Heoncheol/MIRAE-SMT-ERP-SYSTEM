'use client'

import type { ReactNode } from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import {
  getAoiUnit,
  getSmtSetupBaseMinutes,
  getSmtSetupMinutesPerPart,
  getSmtSetupRate,
  getSmtUnitRates,
  PCB_WASH_UNIT,
  SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART,
} from '@/lib/quotes/constants'
import { computeSmtSetupBillingMinutes, getSmtSetupPartCount } from '@/lib/quotes/calculate-estimate'
import { formatQuoteMoneyByDisplay, formatQuoteSetupMinutes } from '@/lib/quotes/format'
import type { SmtBoardForm } from '@/lib/quotes/form-state'
import type { QuoteDisplayCurrency, QuoteType } from '@/lib/quotes/types'

type SmtPcbBoardFormProps = {
  board: SmtBoardForm
  quoteType: QuoteType
  displayCurrency?: QuoteDisplayCurrency
  onChange: (board: SmtBoardForm) => void
  onPcbNameChange?: () => void
}

function UnitPreview({
  krw,
  suffix = '',
  quoteType,
  displayCurrency = 'usd',
}: {
  krw: number
  suffix?: string
  quoteType: QuoteType
  displayCurrency?: QuoteDisplayCurrency
}) {
  return (
    <span className="mt-1 block text-[11px] text-slate-400">
      {formatQuoteMoneyByDisplay(krw, quoteType, displayCurrency)}
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

export function SmtPcbBoardForm({
  board,
  quoteType,
  displayCurrency = 'usd',
  onChange,
  onPcbNameChange,
}: SmtPcbBoardFormProps) {
  const isDouble = board.smtSide === 'double'
  const setupRate = getSmtSetupRate(quoteType)
  const smtRates = getSmtUnitRates(quoteType)
  const partCount = getSmtSetupPartCount({
    smtSide: board.smtSide,
    smtTopCount: Number(board.smtTopCount) || 0,
    smtBotCount: Number(board.smtBotCount) || 0,
  })
  const setupBaseMinutes = getSmtSetupBaseMinutes(isDouble ? 'double' : 'single', quoteType)
  const setupMinutesPerPart = getSmtSetupMinutesPerPart(quoteType)
  const setupMinutes =
    partCount > 0
      ? computeSmtSetupBillingMinutes(partCount, isDouble ? 'double' : 'single', quoteType)
      : 0

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
              <UnitPreview krw={smtRates.chip} suffix="/개" quoteType={quoteType} displayCurrency={displayCurrency} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              이형
              <QuoteNumericInput
                min={0}
                value={board.smtOdd}
                onChange={(smtOdd) => patch({ smtOdd })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
              <UnitPreview krw={smtRates.odd} suffix="/개" quoteType={quoteType} displayCurrency={displayCurrency} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              특수/모듈
              <QuoteNumericInput
                min={0}
                value={board.smtSpecial}
                onChange={(smtSpecial) => patch({ smtSpecial })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
              <UnitPreview krw={smtRates.special} suffix="/개" quoteType={quoteType} displayCurrency={displayCurrency} />
            </label>
          </div>
        </FormSection>

        <FormSection
          title="IC / BGA (핀·볼 수)"
          description="부품 개수가 아닙니다. 보드에 실린 IC 핀 수·BGA 볼 수 합계를 입력합니다. 예: 6PIN IC 10개 → 60"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-600">
              IC PIN (핀 수)
              <QuoteNumericInput
                min={0}
                value={board.icPin}
                onChange={(icPin) => patch({ icPin })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
              <UnitPreview krw={smtRates.icPin} suffix="/PIN" quoteType={quoteType} displayCurrency={displayCurrency} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              BGA BALL (볼 수)
              <QuoteNumericInput
                min={0}
                value={board.bga}
                onChange={(bga) => patch({ bga })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
              <UnitPreview krw={smtRates.bgaBall} suffix="/BALL" quoteType={quoteType} displayCurrency={displayCurrency} />
            </label>
          </div>
        </FormSection>
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

      <div className="mt-3">
        <p className="mb-2 text-xs font-medium text-slate-600">
          {quoteType === 'domestic' ? '검사 / 세척' : 'Inspection'}
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={board.aoiEnabled}
              onChange={(event) => patch({ aoiEnabled: event.target.checked })}
            />
            <span>
              AOI
              <span className="ml-1 text-[11px] text-slate-400">
                ({formatQuoteMoneyByDisplay(getAoiUnit(isDouble ? 'double' : 'single'), quoteType, displayCurrency)}
                {isDouble ? (quoteType === 'domestic' ? ' · 양면 2배' : ' · double ×2') : ''}/PCB)
              </span>
            </span>
          </label>
          {quoteType === 'domestic' ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={board.pcbWashEnabled}
                onChange={(event) => patch({ pcbWashEnabled: event.target.checked })}
              />
              <span>
                세척
                <span className="ml-1 text-[11px] text-slate-400">
                  ({formatQuoteMoneyByDisplay(PCB_WASH_UNIT, quoteType, displayCurrency)}/PCB)
                </span>
              </span>
            </label>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-dashed border-slate-200 pt-4">
        <p className="mb-1 text-xs font-semibold text-slate-600">SET-UP (부품 종수)</p>
        <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
          세팅 총 소요시간 = 기본시간({setupBaseMinutes}분) + 초품검사(종당 {SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART}초) + SETTING(종당 {setupMinutesPerPart}분)
        </p>
        {isDouble ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-600">
              1차면 종수
              <QuoteNumericInput
                min={0}
                value={board.smtTopCount}
                onChange={(smtTopCount) => patch({ smtTopCount })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              2차면 종수
              <QuoteNumericInput
                min={0}
                value={board.smtBotCount}
                onChange={(smtBotCount) => patch({ smtBotCount })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
            </label>
          </div>
        ) : (
          <label className="text-xs font-medium text-slate-600">
            부품 종수
            <QuoteNumericInput
              min={0}
              value={board.smtTopCount}
              onChange={(smtTopCount) => patch({ smtTopCount, smtBotCount: '0' })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
            />
          </label>
        )}
        <div className="mt-2 space-y-1 text-[11px] text-slate-400">
          <p>장비 임율: {formatQuoteMoneyByDisplay(setupRate, quoteType, displayCurrency)}/분</p>
          {partCount > 0 ? (
            <p>
              합계 종수 {partCount}종 · 세팅 총 소요시간 {formatQuoteSetupMinutes(setupMinutes, quoteType)} · 예상 SET-UP{' '}
              {formatQuoteMoneyByDisplay(setupMinutes * setupRate, quoteType, displayCurrency)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
