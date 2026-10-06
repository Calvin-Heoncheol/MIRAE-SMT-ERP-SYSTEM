'use client'

import { useState } from 'react'
import { SmtLineModal } from '@/components/equipment/equipment-modals'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { isMissingSmtEquipmentTable, type FetchSmtLinesResult } from '@/lib/equipment/repository'
import {
  equipmentDisplayName,
  EQUIPMENT_TYPES,
  SMT_LINE_NO_MAX,
  smtLineDisplayName,
  summarizeSmtLineCapacity,
  type SmtEquipment,
  type SmtLine,
} from '@/lib/equipment/types'
import { ERP_TABLE_ROW_CLASS } from '@/lib/ui/tokens'

type EquipmentWorkspaceProps = {
  result: FetchSmtLinesResult
}

type ModalState = { kind: 'none' } | { kind: 'line'; line: SmtLine | null }

function formatCph(value: number | null | undefined) {
  return value ? value.toLocaleString('ko-KR') : '—'
}

function cell(value: string) {
  return value.trim() || '—'
}

function sortEquipment(list: SmtEquipment[]) {
  const typeOrder = new Map(EQUIPMENT_TYPES.map((type, index) => [type, index]))
  return [...list].sort((a, b) => {
    const typeDiff = (typeOrder.get(a.equipmentType) ?? 99) - (typeOrder.get(b.equipmentType) ?? 99)
    return typeDiff || a.unitNo - b.unitNo
  })
}

function nextFreeLineNo(lines: SmtLine[]) {
  const used = new Set(lines.map((line) => line.lineNo))
  for (let n = 1; n <= SMT_LINE_NO_MAX; n += 1) {
    if (!used.has(n)) return n
  }
  return SMT_LINE_NO_MAX
}

function LineCapacityText({ line }: { line: SmtLine }) {
  const summary = summarizeSmtLineCapacity(line)
  if (summary.mounterCount === 0) {
    return <span className="text-slate-400">마운터 미등록</span>
  }
  return (
    <span className="tabular-nums">
      마운터 {summary.mounterCount}대 · 사양 CPH{' '}
      <span className="font-semibold text-slate-800">{formatCph(summary.ratedCphTotal)}</span>
      {summary.missingRatedCount > 0 ? (
        <span className="text-amber-600"> (미입력 {summary.missingRatedCount})</span>
      ) : null}
    </span>
  )
}

export function EquipmentWorkspace({ result }: EquipmentWorkspaceProps) {
  const { afterSave, afterDelete } = useSaveFeedback()
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const [modalSession, setModalSession] = useState(0)

  if (!result.ok) {
    return (
      <PageShell>
        <FetchErrorBanner
          reason={result.reason}
          title="설비 목록을 불러오지 못했습니다"
          detail={result.detail}
          hint={
            isMissingSmtEquipmentTable(result.detail) ? (
              <>
                Supabase SQL Editor에서{' '}
                <code className="rounded bg-white/70 px-1">supabase/setup-smt-equipment.sql</code>을
                실행해 주세요.
              </>
            ) : null
          }
        />
      </PageShell>
    )
  }

  const lines = result.lines
  const selectedLine = lines.find((line) => line.id === selectedLineId) ?? lines[0] ?? null
  const equipment = selectedLine ? sortEquipment(selectedLine.equipment) : []
  const selectedSummary = selectedLine ? summarizeSmtLineCapacity(selectedLine) : null

  function openModal(next: ModalState) {
    setModalSession((value) => value + 1)
    setModal(next)
  }

  function closeModal() {
    setModal({ kind: 'none' })
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          accent="slate"
          actions={
            <ErpButton onClick={() => openModal({ kind: 'line', line: null })}>라인 등록</ErpButton>
          }
        />

        {lines.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <EmptyListState message="등록된 라인이 없습니다 — 오른쪽 상단에서 라인을 등록하세요" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 gap-4">
            <aside className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto">
              {lines.map((line) => {
                const active = line.id === selectedLine?.id
                return (
                  <button
                    key={line.id}
                    type="button"
                    onClick={() => setSelectedLineId(line.id)}
                    className={`rounded-xl border px-3.5 py-3 text-left transition ${
                      active
                        ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{smtLineDisplayName(line)}</span>
                      {!line.isActive ? (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          미사용
                        </span>
                      ) : null}
                    </div>
                    <div className={`mt-1 text-xs ${active ? 'text-slate-200' : 'text-slate-500'}`}>
                      LINE {line.lineNo} · 설비 {line.equipment.length}대
                    </div>
                    <div className={`mt-0.5 text-xs ${active ? 'text-slate-200 [&_*]:!text-inherit' : 'text-slate-500'}`}>
                      <LineCapacityText line={line} />
                    </div>
                  </button>
                )
              })}
            </aside>

            {selectedLine ? (
              <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900">
                      {smtLineDisplayName(selectedLine)}
                      <span className="ml-2 text-xs font-medium text-slate-400">
                        LINE {selectedLine.lineNo}
                      </span>
                    </h2>
                    {selectedSummary && selectedSummary.mounterCount > 0 ? (
                      <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                        사용중 마운터 {selectedSummary.mounterCount}대 · 사양 CPH 합계{' '}
                        <span className="font-semibold text-slate-800">
                          {formatCph(selectedSummary.ratedCphTotal)}
                        </span>
                        <span className="ml-2 text-slate-400">
                          가동효율은 생산계획에서 실적 기준으로 계산합니다.
                        </span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-slate-400">등록된 마운터가 없습니다.</p>
                    )}
                  </div>
                  <ErpButton onClick={() => openModal({ kind: 'line', line: selectedLine })}>
                    라인·설비 수정
                  </ErpButton>
                </div>

                {equipment.length === 0 ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <EmptyListState message="이 라인에 등록된 설비가 없습니다 — 라인·설비 수정에서 추가하세요" />
                  </div>
                ) : (
                  <ErpTableShell tableClassName="min-w-[880px]">
                    <ErpTableHead>
                      <tr>
                        <ErpTableTh>설비</ErpTableTh>
                        <ErpTableTh>제조사</ErpTableTh>
                        <ErpTableTh>모델명</ErpTableTh>
                        <ErpTableTh className="hidden lg:table-cell">시리얼</ErpTableTh>
                        <ErpTableTh className="text-right">사양 CPH</ErpTableTh>
                        <ErpTableTh className="hidden md:table-cell">도입일</ErpTableTh>
                        <ErpTableTh>상태</ErpTableTh>
                      </tr>
                    </ErpTableHead>
                    <tbody>
                      {equipment.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => openModal({ kind: 'line', line: selectedLine })}
                            className={`${ERP_TABLE_ROW_CLASS} cursor-pointer ${
                              item.isActive ? '' : 'opacity-60'
                            }`}
                          >
                            <ErpTableTd className="font-semibold text-slate-900">
                              {equipmentDisplayName(item)}
                            </ErpTableTd>
                            <ErpTableTd className="text-slate-700">{cell(item.maker)}</ErpTableTd>
                            <ErpTableTd className="text-slate-700">{cell(item.model)}</ErpTableTd>
                            <ErpTableTd className="hidden text-slate-500 lg:table-cell">
                              {cell(item.serialNo)}
                            </ErpTableTd>
                            <ErpTableTd className="text-right font-semibold tabular-nums text-slate-900">
                              {formatCph(item.ratedCph)}
                            </ErpTableTd>
                            <ErpTableTd className="hidden tabular-nums text-slate-600 md:table-cell">
                              {cell(item.installedAt)}
                            </ErpTableTd>
                            <ErpTableTd>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                  item.isActive
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {item.isActive ? '사용중' : '미사용'}
                              </span>
                            </ErpTableTd>
                          </tr>
                      ))}
                    </tbody>
                  </ErpTableShell>
                )}
              </section>
            ) : null}
          </div>
        )}
      </PageShell>

      {modal.kind === 'line' ? (
        <SmtLineModal
          key={`line-${modal.line?.id ?? 'new'}-${modalSession}`}
          line={modal.line}
          suggestedLineNo={nextFreeLineNo(lines)}
          onClose={closeModal}
          onSaved={(message) => afterSave(message, { close: closeModal })}
          onDeleted={(message) => {
            setSelectedLineId(null)
            afterDelete(message, { close: closeModal })
          }}
        />
      ) : null}
    </>
  )
}
