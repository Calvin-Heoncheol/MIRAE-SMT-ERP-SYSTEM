'use client'

import { useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { useBusy } from '@/components/ui/busy-provider'
import { ErpButton } from '@/components/ui/erp-button'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import { RequiredMark } from '@/components/ui/required-mark'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import {
  deleteSmtLine,
  saveSmtLineWithEquipment,
  type DeleteEquipmentResult,
  type SaveEquipmentResult,
  type SmtEquipmentDraftPayload,
} from '@/lib/equipment/repository'
import {
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_TYPES,
  SMT_LINE_NO_MAX,
  SMT_LINE_NO_MIN,
  smtLineDisplayName,
  type EquipmentType,
  type SmtEquipment,
  type SmtLine,
} from '@/lib/equipment/types'
import { ERP_ERROR_TEXT_CLASS, ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

const CELL_INPUT_CLASS =
  'w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-300'

function CancelButton({ disabled }: { disabled?: boolean }) {
  const requestClose = useErpModalRequestClose()
  return (
    <ErpButton variant="secondary" disabled={disabled} onClick={() => requestClose?.()}>
      취소
    </ErpButton>
  )
}

type EquipmentDraft = {
  key: string
  id: string | null
  equipmentType: EquipmentType
  unitNo: string
  maker: string
  model: string
  serialNo: string
  ratedCph: string
  effectiveCph: string
  installedAt: string
  isActive: boolean
  note: string
}

let draftSeq = 0
function newDraftKey() {
  draftSeq += 1
  return `draft-${draftSeq}`
}

function equipmentToDraft(equipment: SmtEquipment): EquipmentDraft {
  return {
    key: equipment.id,
    id: equipment.id,
    equipmentType: equipment.equipmentType,
    unitNo: String(equipment.unitNo),
    maker: equipment.maker,
    model: equipment.model,
    serialNo: equipment.serialNo,
    ratedCph: equipment.ratedCph ? String(equipment.ratedCph) : '',
    effectiveCph: equipment.effectiveCph ? String(equipment.effectiveCph) : '',
    installedAt: equipment.installedAt,
    isActive: equipment.isActive,
    note: equipment.note,
  }
}

function nextUnitNo(drafts: EquipmentDraft[], type: EquipmentType) {
  const used = drafts
    .filter((draft) => draft.equipmentType === type)
    .map((draft) => Math.floor(Number(draft.unitNo)) || 0)
  return used.length ? Math.max(...used) + 1 : 1
}

function sortDrafts(drafts: EquipmentDraft[]) {
  const typeOrder = new Map(EQUIPMENT_TYPES.map((type, index) => [type, index]))
  return [...drafts].sort((a, b) => {
    const typeDiff = (typeOrder.get(a.equipmentType) ?? 99) - (typeOrder.get(b.equipmentType) ?? 99)
    return typeDiff || (Number(a.unitNo) || 0) - (Number(b.unitNo) || 0)
  })
}

/** 빈칸 → null, 숫자 아니면 NaN */
function parseOptionalInt(value: string) {
  const trimmed = value.replace(/,/g, '').trim()
  if (!trimmed) return null
  const n = Math.floor(Number(trimmed))
  return Number.isFinite(n) ? n : Number.NaN
}

function draftsToPayload(
  drafts: EquipmentDraft[],
): { ok: true; items: SmtEquipmentDraftPayload[] } | { ok: false; detail: string } {
  const items: SmtEquipmentDraftPayload[] = []
  for (const draft of drafts) {
    const label = `${EQUIPMENT_TYPE_LABELS[draft.equipmentType]} ${draft.unitNo || '?'}호기`
    const unitNo = Math.floor(Number(draft.unitNo))
    if (!Number.isFinite(unitNo) || unitNo < 1) {
      return { ok: false, detail: `${label}: 호기는 1 이상으로 입력해 주세요.` }
    }
    const isMounter = draft.equipmentType === 'mounter'
    const ratedCph = isMounter ? parseOptionalInt(draft.ratedCph) : null
    const effectiveCph = isMounter ? parseOptionalInt(draft.effectiveCph) : null
    for (const value of [ratedCph, effectiveCph]) {
      if (value != null && (Number.isNaN(value) || value <= 0)) {
        return { ok: false, detail: `${label}: CPH 는 0보다 큰 숫자로 입력해 주세요.` }
      }
    }
    items.push({
      id: draft.id,
      equipmentType: draft.equipmentType,
      unitNo,
      maker: draft.maker,
      model: draft.model,
      serialNo: draft.serialNo,
      ratedCph,
      effectiveCph,
      installedAt: draft.installedAt,
      isActive: draft.isActive,
      note: draft.note,
    })
  }
  return { ok: true, items }
}

type SmtLineModalProps = {
  line: SmtLine | null
  suggestedLineNo: number
  onClose: () => void
  onSaved: (message: string) => void
  onDeleted: (message: string) => void
}

export function SmtLineModal({ line, suggestedLineNo, onClose, onSaved, onDeleted }: SmtLineModalProps) {
  const isCreate = !line
  const [lineNo, setLineNo] = useState(String(line?.lineNo ?? suggestedLineNo))
  const [name, setName] = useState(line?.name ?? '')
  const [isActive, setIsActive] = useState(line?.isActive ?? true)
  const [drafts, setDrafts] = useState<EquipmentDraft[]>(() =>
    sortDrafts((line?.equipment ?? []).map(equipmentToDraft)),
  )
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDelete = useCanDeleteRecords()
  const confirm = useErpConfirm()
  const busyUi = useBusy()
  const { notifyAuthOrFailure } = useWriteFailureToast()
  const busy = saving || deleting

  function updateDraft<K extends keyof EquipmentDraft>(key: string, field: K, value: EquipmentDraft[K]) {
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, [field]: value } : draft)),
    )
  }

  function changeDraftType(key: string, type: EquipmentType) {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.key !== key) return draft
        const others = current.filter((entry) => entry.key !== key)
        return {
          ...draft,
          equipmentType: type,
          unitNo: draft.id ? draft.unitNo : String(nextUnitNo(others, type)),
        }
      }),
    )
  }

  function addDraft() {
    setDrafts((current) => [
      ...current,
      {
        key: newDraftKey(),
        id: null,
        equipmentType: 'mounter',
        unitNo: String(nextUnitNo(current, 'mounter')),
        maker: '',
        model: '',
        serialNo: '',
        ratedCph: '',
        effectiveCph: '',
        installedAt: '',
        isActive: true,
        note: '',
      },
    ])
  }

  function removeDraft(draft: EquipmentDraft) {
    setDrafts((current) => current.filter((entry) => entry.key !== draft.key))
    const id = draft.id
    if (id) setRemovedIds((current) => [...current, id])
  }

  async function finish(
    action: () => Promise<SaveEquipmentResult | DeleteEquipmentResult>,
    setLoading: (value: boolean) => void,
    onSuccess: () => void,
  ) {
    setLoading(true)
    setError(null)
    const result = await busyUi.run(action)
    setLoading(false)
    if (!result.ok) {
      if (!notifyAuthOrFailure(result)) setError(result.detail)
      return
    }
    onSuccess()
  }

  async function handleSave() {
    const n = Math.floor(Number(lineNo))
    if (!Number.isFinite(n) || n < SMT_LINE_NO_MIN || n > SMT_LINE_NO_MAX) {
      setError(`라인 번호는 ${SMT_LINE_NO_MIN}~${SMT_LINE_NO_MAX} 사이로 입력해 주세요.`)
      return
    }
    const parsed = draftsToPayload(drafts)
    if (!parsed.ok) {
      setError(parsed.detail)
      return
    }
    if (removedIds.length > 0) {
      const ok = await confirm({
        title: '설비 삭제',
        message: `설비 ${removedIds.length}대를 삭제하고 저장할까요?\n삭제 후에는 복구할 수 없습니다.`,
        confirmLabel: '저장',
        tone: 'danger',
      })
      if (!ok) return
    }
    await finish(
      () =>
        saveSmtLineWithEquipment(
          line?.id ?? null,
          { lineNo: n, name, isActive, note: line?.note ?? '' },
          parsed.items,
          removedIds,
        ),
      setSaving,
      () => onSaved(isCreate ? '라인이 등록되었습니다.' : '라인이 저장되었습니다.'),
    )
  }

  async function handleDelete() {
    if (!line) return
    const count = line.equipment.length
    const ok = await confirm({
      title: '라인 삭제',
      message: `${smtLineDisplayName(line)}을(를) 삭제할까요?${
        count > 0 ? `\n등록된 설비 ${count}대도 함께 삭제됩니다.` : ''
      }\n삭제 후에는 복구할 수 없습니다.`,
      confirmLabel: '삭제',
      tone: 'danger',
    })
    if (!ok) return
    await finish(() => deleteSmtLine(line.id), setDeleting, () => onDeleted('라인이 삭제되었습니다.'))
  }

  return (
    <ErpModal
      open
      size="wide"
      title={isCreate ? '라인 등록' : `${smtLineDisplayName(line)} 수정`}
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-col gap-3">
          {error ? <p className={ERP_ERROR_TEXT_CLASS}>{error}</p> : null}
          <div className="flex justify-between gap-2">
            {!isCreate && canDelete ? (
              <ErpButton
                variant="danger"
                onClick={() => void handleDelete()}
                disabled={busy}
                loading={deleting}
              >
                라인 삭제
              </ErpButton>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <CancelButton disabled={busy} />
              <ErpButton onClick={() => void handleSave()} disabled={busy} loading={saving}>
                저장
              </ErpButton>
            </div>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>
            라인 번호
            <RequiredMark />
          </span>
          <input
            type="number"
            min={SMT_LINE_NO_MIN}
            max={SMT_LINE_NO_MAX}
            value={lineNo}
            onChange={(event) => setLineNo(event.target.value)}
            className={`${ERP_FIELD_INPUT_CLASS} tabular-nums`}
          />
        </label>
        <label className="block text-sm">
          <span className={ERP_FIELD_LABEL_CLASS}>라인 이름</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={`LINE ${lineNo || ''}`.trim()}
            className={ERP_FIELD_INPUT_CLASS}
          />
        </label>
        <div className="flex items-center justify-between gap-2 sm:col-span-4">
          <p className="text-xs text-slate-400">
            라인 번호는 생산계획·생산등록의 LINE 번호와 연결됩니다.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="font-medium text-slate-700">라인 사용중</span>
          </label>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            설비 <span className="font-medium text-slate-400">{drafts.length}대</span>
          </h3>
          <ErpButton variant="secondary" onClick={addDraft} disabled={busy}>
            + 설비 추가
          </ErpButton>
        </div>

        {drafts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
            등록된 설비가 없습니다. 설비 추가를 눌러 호기를 입력하세요.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left">종류</th>
                  <th className="w-20 px-2 py-2 text-left">호기</th>
                  <th className="px-2 py-2 text-left">제조사</th>
                  <th className="px-2 py-2 text-left">모델명</th>
                  <th className="px-2 py-2 text-left">시리얼</th>
                  <th className="w-28 px-2 py-2 text-right">사양 CPH</th>
                  <th className="w-28 px-2 py-2 text-right">실제 CPH</th>
                  <th className="w-36 px-2 py-2 text-left">도입일</th>
                  <th className="w-14 px-2 py-2 text-center">사용</th>
                  <th className="w-12 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => {
                  const isMounter = draft.equipmentType === 'mounter'
                  return (
                    <tr key={draft.key} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <select
                          value={draft.equipmentType}
                          onChange={(event) =>
                            changeDraftType(draft.key, event.target.value as EquipmentType)
                          }
                          className={CELL_INPUT_CLASS}
                        >
                          {EQUIPMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {EQUIPMENT_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min={1}
                          value={draft.unitNo}
                          onChange={(event) => updateDraft(draft.key, 'unitNo', event.target.value)}
                          className={`${CELL_INPUT_CLASS} tabular-nums`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={draft.maker}
                          onChange={(event) => updateDraft(draft.key, 'maker', event.target.value)}
                          className={CELL_INPUT_CLASS}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={draft.model}
                          onChange={(event) => updateDraft(draft.key, 'model', event.target.value)}
                          className={CELL_INPUT_CLASS}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={draft.serialNo}
                          onChange={(event) => updateDraft(draft.key, 'serialNo', event.target.value)}
                          className={CELL_INPUT_CLASS}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          inputMode="numeric"
                          value={isMounter ? draft.ratedCph : ''}
                          onChange={(event) => updateDraft(draft.key, 'ratedCph', event.target.value)}
                          disabled={!isMounter}
                          placeholder={isMounter ? '카탈로그' : '—'}
                          className={`${CELL_INPUT_CLASS} text-right tabular-nums`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          inputMode="numeric"
                          value={isMounter ? draft.effectiveCph : ''}
                          onChange={(event) =>
                            updateDraft(draft.key, 'effectiveCph', event.target.value)
                          }
                          disabled={!isMounter}
                          placeholder={isMounter ? '현장 기준' : '—'}
                          className={`${CELL_INPUT_CLASS} text-right tabular-nums`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          value={draft.installedAt}
                          onChange={(event) =>
                            updateDraft(draft.key, 'installedAt', event.target.value)
                          }
                          className={CELL_INPUT_CLASS}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) =>
                            updateDraft(draft.key, 'isActive', event.target.checked)
                          }
                          aria-label="사용중"
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeDraft(draft)}
                          disabled={busy || (Boolean(draft.id) && !canDelete)}
                          title={draft.id && !canDelete ? '삭제 권한이 없습니다' : '행 삭제'}
                          aria-label="행 삭제"
                          className="rounded-md px-2 py-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          CPH 는 마운터만 입력합니다. 호기는 설비 종류별로 따로 셉니다 (마운터 1호기, 인쇄기 1호기 …).
        </p>
      </div>
    </ErpModal>
  )
}
