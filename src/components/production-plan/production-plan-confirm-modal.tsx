'use client'

import { useEffect, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'
import { POST_PROCESS_TEAMS, type PostProcessTeam } from '@/lib/post-process/teams'
import type { ConfirmProductionPlanScheduleInput, ProductionPlanBoardRow } from '@/lib/production-plan/types'
import { PRODUCTION_PLAN_SCOPE_LABELS } from '@/lib/production-plan/types'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

type ProductionPlanConfirmModalProps = {
  open: boolean
  row: ProductionPlanBoardRow | null
  saving?: boolean
  onClose: () => void
  onSubmit: (input: ConfirmProductionPlanScheduleInput) => void
}

export function ProductionPlanConfirmModal({
  open,
  row,
  saving = false,
  onClose,
  onSubmit,
}: ProductionPlanConfirmModalProps) {
  if (!open || !row) return null
  return (
    <ProductionPlanConfirmModalInner
      row={row}
      saving={saving}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

function ProductionPlanConfirmModalInner({
  row,
  saving,
  onClose,
  onSubmit,
}: {
  row: ProductionPlanBoardRow
  saving: boolean
  onClose: () => void
  onSubmit: (input: ConfirmProductionPlanScheduleInput) => void
}) {
  const defaultDate = row.plannedDate || row.deliveryDate || todayYmdSeoul()
  const [plannedDate, setPlannedDate] = useState(defaultDate)
  const [plannedQuantity, setPlannedQuantity] = useState(String(row.remainingQty))
  const [lineNo, setLineNo] = useState(String(row.lineNo && row.lineNo >= 1 ? row.lineNo : 1))
  const [team, setTeam] = useState<PostProcessTeam>(
    (POST_PROCESS_TEAMS.includes(row.team as PostProcessTeam)
      ? row.team
      : POST_PROCESS_TEAMS[0]) as PostProcessTeam,
  )
  const [pcbMode, setPcbMode] = useState<'SINGLE' | 'BOTH'>(
    row.splitPcbSides ? 'BOTH' : 'SINGLE',
  )
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPlannedDate(row.plannedDate || row.deliveryDate || todayYmdSeoul())
    setPlannedQuantity(String(row.plannedQuantity || row.remainingQty))
    setLineNo(String(row.lineNo && row.lineNo >= 1 ? row.lineNo : 1))
    setTeam(
      (POST_PROCESS_TEAMS.includes(row.team as PostProcessTeam)
        ? row.team
        : POST_PROCESS_TEAMS[0]) as PostProcessTeam,
    )
    setPcbMode(row.splitPcbSides ? 'BOTH' : 'SINGLE')
    setNote('')
    setError(null)
  }, [row])

  function handleSubmit() {
    const qty = Math.floor(Number(plannedQuantity) || 0)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
      setError('계획일을 선택하세요.')
      return
    }
    if (qty < 1) {
      setError('수량은 1 이상이어야 합니다.')
      return
    }
    if (qty > row.remainingQty) {
      setError(`잔량(${row.remainingQty.toLocaleString('ko-KR')})을 초과할 수 없습니다.`)
      return
    }

    if (row.scope === 'smt') {
      const line = Math.floor(Number(lineNo) || 0)
      if (line < 1 || line > 7) {
        setError('SMT 라인을 선택하세요.')
        return
      }
      onSubmit({
        scope: 'smt',
        orderId: row.orderId,
        targetId: row.targetId,
        plannedDate,
        plannedQuantity: qty,
        lineNo: line,
        pcbSide: row.splitPcbSides ? pcbMode : 'SINGLE',
        note,
      })
      return
    }

    onSubmit({
      scope: 'post',
      orderId: row.orderId,
      targetId: row.targetId,
      plannedDate,
      plannedQuantity: qty,
      team,
      note,
    })
  }

  return (
    <ErpModal
      open
      title="생산계획 확정"
      description={`${PRODUCTION_PLAN_SCOPE_LABELS[row.scope]} · ${row.orderNumber}`}
      onClose={saving ? () => undefined : onClose}
      footer={
        <div className="flex justify-end gap-2">
          <ErpButton type="button" variant="secondary" disabled={saving} onClick={onClose}>
            취소
          </ErpButton>
          <ErpButton type="button" disabled={saving} onClick={handleSubmit}>
            {saving ? '저장 중…' : '확정'}
          </ErpButton>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
          <p className="font-semibold text-slate-900">{row.productName || '—'}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {row.customer || '—'} · 잔량 {row.remainingQty.toLocaleString('ko-KR')}
            {row.materialShort
              ? ` · 자재 부족(가능 ${row.materialReadyQty.toLocaleString('ko-KR')}대)`
              : row.materialUnknown
                ? ''
                : ' · 자재OK'}
          </p>
        </div>

        <label className="block">
          <span className={ERP_FIELD_LABEL_CLASS}>계획일</span>
          <input
            type="date"
            value={plannedDate}
            onChange={(event) => setPlannedDate(event.target.value)}
            className={ERP_FIELD_INPUT_CLASS}
            disabled={saving}
          />
        </label>

        <label className="block">
          <span className={ERP_FIELD_LABEL_CLASS}>계획 수량</span>
          <input
            type="number"
            min={1}
            max={row.remainingQty}
            value={plannedQuantity}
            onChange={(event) => setPlannedQuantity(event.target.value)}
            className={`${ERP_FIELD_INPUT_CLASS} tabular-nums`}
            disabled={saving}
          />
        </label>

        {row.scope === 'smt' ? (
          <>
            <label className="block">
              <span className={ERP_FIELD_LABEL_CLASS}>SMT 라인</span>
              <select
                value={lineNo}
                onChange={(event) => setLineNo(event.target.value)}
                className={ERP_FIELD_INPUT_CLASS}
                disabled={saving}
              >
                {SMT_PLAN_LINE_NOS.map((no) => (
                  <option key={no} value={no}>
                    라인 {no}
                  </option>
                ))}
              </select>
            </label>
            {row.splitPcbSides ? (
              <label className="block">
                <span className={ERP_FIELD_LABEL_CLASS}>면 구분</span>
                <select
                  value={pcbMode}
                  onChange={(event) => setPcbMode(event.target.value as 'SINGLE' | 'BOTH')}
                  className={ERP_FIELD_INPUT_CLASS}
                  disabled={saving}
                >
                  <option value="BOTH">TOP+BOT 동시</option>
                </select>
              </label>
            ) : null}
          </>
        ) : (
          <label className="block">
            <span className={ERP_FIELD_LABEL_CLASS}>후공정 팀</span>
            <select
              value={team}
              onChange={(event) => setTeam(event.target.value as PostProcessTeam)}
              className={ERP_FIELD_INPUT_CLASS}
              disabled={saving}
            >
              {POST_PROCESS_TEAMS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className={ERP_FIELD_LABEL_CLASS}>비고</span>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={ERP_FIELD_INPUT_CLASS}
            placeholder="선택"
            disabled={saving}
          />
        </label>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </ErpModal>
  )
}
