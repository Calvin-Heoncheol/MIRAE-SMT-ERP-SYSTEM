'use client'

import type { ReactNode } from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import {
  getAoiUnit,
  getSmtSetupBaseMinutes,
  getSmtSetupMinutesPerPart,
  getSmtSetupRate,
  getSmtUnitRates,
  isMultiSideSmt,
  normalizeSmtSide,
  PCB_WASH_UNIT,
  SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART,
  toBillingSmtSide,
} from '@/lib/quotes/constants'
import { computeSmtSetupBillingMinutes, getSmtSetupPartCount } from '@/lib/quotes/calculate-estimate'
import { formatQuoteMoneyByDisplay, formatQuoteSetupMinutes } from '@/lib/quotes/format'
import type { SmtBoardForm } from '@/lib/quotes/form-state'
import type { QuoteDisplayCurrency, QuoteType, SmtSide } from '@/lib/quotes/types'

type SmtPcbBoardFormProps = {
  board: SmtBoardForm
  quoteType: QuoteType
  displayCurrency?: QuoteDisplayCurrency
  /** smd: 부품·면·검사 / setup: SET-UP 종수 / all: 전체(기본) */
  mode?: 'smd' | 'setup' | 'all'
  /** 여러 PCB일 때만 구분 라벨 표시 */
  boardIndex?: number
  boardCount?: number
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
  mode = 'all',
  boardIndex = 0,
  boardCount = 1,
  onChange,
}: SmtPcbBoardFormProps) {
  const showSmd = mode === 'smd' || mode === 'all'
  const showSetup = mode === 'setup' || mode === 'all'
  const showBoardLabel = boardCount > 1
  const smtSide = normalizeSmtSide(board.smtSide)
  const isMulti = isMultiSideSmt(smtSide)
  const billingSide = toBillingSmtSide(smtSide)
  const setupRate = getSmtSetupRate(quoteType)
  const smtRates = getSmtUnitRates(quoteType)
  const partCount = getSmtSetupPartCount({
    smtSide,
    smtTopCount: Number(board.smtTopCount) || 0,
    smtBotCount: Number(board.smtBotCount) || 0,
  })
  const setupBaseMinutes = getSmtSetupBaseMinutes(billingSide, quoteType)
  const setupMinutesPerPart = getSmtSetupMinutesPerPart(quoteType)
  const setupMinutes =
    partCount > 0 ? computeSmtSetupBillingMinutes(partCount, billingSide, quoteType) : 0

  function patch(patch: Partial<SmtBoardForm>) {
    onChange({ ...board, ...patch })
  }

  function handleSideChange(next: SmtSide) {
    if (next === 'single') {
      patch({ smtSide: next, smtBotCount: '0' })
      return
    }
    patch({ smtSide: next })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      {showBoardLabel ? (
        <p className="mb-3 text-sm font-semibold text-slate-800">보드 {boardIndex + 1}</p>
      ) : null}

      {showSmd ? (
        <>
          <div className="space-y-3">
            <FormSection title="일반 부품 (부품 개수)">
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
                  <UnitPreview
                    krw={smtRates.special}
                    suffix="/개"
                    quoteType={quoteType}
                    displayCurrency={displayCurrency}
                  />
                </label>
              </div>
            </FormSection>

            <FormSection title="IC / BGA (핀·볼 수)">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-slate-600">
                  IC PIN (핀 수)
                  <QuoteNumericInput
                    min={0}
                    value={board.icPin}
                    onChange={(icPin) => patch({ icPin })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
                  />
                  <UnitPreview
                    krw={smtRates.icPin}
                    suffix="/PIN"
                    quoteType={quoteType}
                    displayCurrency={displayCurrency}
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  BGA BALL (볼 수)
                  <QuoteNumericInput
                    min={0}
                    value={board.bga}
                    onChange={(bga) => patch({ bga })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
                  />
                  <UnitPreview
                    krw={smtRates.bgaBall}
                    suffix="/BALL"
                    quoteType={quoteType}
                    displayCurrency={displayCurrency}
                  />
                </label>
              </div>
            </FormSection>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-600">
              면 구분
              <select
                value={smtSide}
                onChange={(event) => handleSideChange(event.target.value as SmtSide)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800"
              >
                <option value="single">단면</option>
                <option value="dual">듀얼</option>
                <option value="double">양면</option>
              </select>
            </label>
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
                    ({formatQuoteMoneyByDisplay(getAoiUnit(billingSide), quoteType, displayCurrency)}
                    {isMulti
                      ? quoteType === 'domestic'
                        ? ' · 듀얼/양면 2배'
                        : ' · dual/double ×2'
                      : ''}
                    /PCB)
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
        </>
      ) : null}

      {showSetup ? (
        <div className={showSmd ? 'mt-4 border-t border-dashed border-slate-200 pt-4' : ''}>
          {isMulti ? (
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
            <p>
              기본 {setupBaseMinutes}분 + 초품 {SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART}초/종 + SETTING{' '}
              {setupMinutesPerPart}분/종 · {formatQuoteMoneyByDisplay(setupRate, quoteType, displayCurrency)}/분
            </p>
            {partCount > 0 ? (
              <p>
                합계 종수 {partCount}종 · {formatQuoteSetupMinutes(setupMinutes, quoteType)} ·{' '}
                {formatQuoteMoneyByDisplay(setupMinutes * setupRate, quoteType, displayCurrency)}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
