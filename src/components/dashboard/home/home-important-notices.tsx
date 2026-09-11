'use client'

import { useMemo, useState, useTransition } from 'react'
import { ErpModal } from '@/components/ui/erp-modal'
import type { HomeDashboardData } from '@/lib/dashboard/home-data'
import {
  deleteCompanyNoticeAction,
  saveCompanyNoticeAction,
} from '@/lib/notices/actions'
import type { CompanyNotice } from '@/lib/notices/types'
import { NOTICE_BODY_MAX, NOTICE_TITLE_MAX } from '@/lib/notices/types'
import {
  ERP_FIELD_INPUT_CLASS,
  ERP_FIELD_LABEL_CLASS,
  ERP_PANEL_CLASS,
  ERP_PRIMARY_BUTTON_SM_CLASS,
  ERP_SECONDARY_BUTTON_CLASS,
} from '@/lib/ui/tokens'

function formatNoticeTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

type NoticeFormState = {
  id?: string
  title: string
  body: string
  isPinned: boolean
}

const EMPTY_FORM: NoticeFormState = { title: '', body: '', isPinned: true }

type HomeImportantNoticesBoardProps = {
  initialRows: CompanyNotice[]
  status: HomeDashboardData['noticesStatus']
  message?: string
  canManage: boolean
}

const PREVIEW_LIMIT = 4

/** 대시보드 중앙 — 중요 공지 보드 */
export function HomeImportantNoticesBoard({
  initialRows,
  status,
  message,
  canManage,
}: HomeImportantNoticesBoardProps) {
  const [rows, setRows] = useState(initialRows)
  const [viewing, setViewing] = useState<CompanyNotice | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [editing, setEditing] = useState<NoticeFormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const boardRows = useMemo(() => {
    const pinned = rows.filter((row) => row.isPinned)
    const rest = rows.filter((row) => !row.isPinned)
    return [...pinned, ...rest].slice(0, PREVIEW_LIMIT)
  }, [rows])

  const statusHint =
    status === 'missing_table'
      ? '공지 테이블이 없습니다. migrate-company-notices.sql 을 실행하세요.'
      : status === 'env'
        ? 'Supabase 환경 변수를 확인하세요.'
        : status === 'error'
          ? message || '공지를 불러오지 못했습니다.'
          : null

  function openCreate() {
    setError(null)
    setEditing({ ...EMPTY_FORM })
  }

  function openEdit(notice: CompanyNotice) {
    setError(null)
    setEditing({
      id: notice.id,
      title: notice.title,
      body: notice.body,
      isPinned: notice.isPinned,
    })
  }

  function handleSave() {
    if (!editing) return
    setError(null)
    startTransition(async () => {
      const result = await saveCompanyNoticeAction({
        id: editing.id,
        title: editing.title,
        body: editing.body,
        isPinned: editing.isPinned,
      })
      if (!result.ok) {
        setError(result.detail)
        return
      }
      setRows((prev) => {
        const without = prev.filter((row) => row.id !== result.notice.id)
        return [result.notice, ...without].sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          return b.createdAt.localeCompare(a.createdAt)
        })
      })
      setEditing(null)
      setViewing(result.notice)
    })
  }

  function handleDelete(notice: CompanyNotice) {
    if (!window.confirm(`「${notice.title}」 공지를 삭제할까요?`)) return
    startTransition(async () => {
      const result = await deleteCompanyNoticeAction(notice.id)
      if (!result.ok) {
        setError(result.detail)
        return
      }
      setRows((prev) => prev.filter((row) => row.id !== notice.id))
      if (viewing?.id === notice.id) setViewing(null)
      setEditing(null)
    })
  }

  return (
    <>
      <section className={`flex h-full min-h-0 flex-col overflow-hidden rounded-xl border shadow-sm ${ERP_PANEL_CLASS}`}>
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-sm font-bold text-slate-900">
            중요 공지
            <span className="ml-1.5 text-xs font-medium text-slate-400">(전사)</span>
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              onClick={() => setListOpen(true)}
            >
              전체
            </button>
            {canManage ? (
              <button
                type="button"
                className={`${ERP_PRIMARY_BUTTON_SM_CLASS} !px-2.5 !py-1 !text-[11px]`}
                onClick={openCreate}
              >
                작성
              </button>
            ) : null}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col p-3">
          {statusHint ? (
            <div className="flex h-full items-center justify-center px-2 text-center text-xs leading-relaxed text-amber-700">
              {statusHint}
            </div>
          ) : boardRows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
              <p className="text-xs font-semibold text-slate-500">등록된 중요 공지가 없습니다.</p>
              <p className="text-[11px] leading-relaxed text-slate-400">
                설비 비가동, 특근·휴무, 긴급 납기, ERP 점검 등
                <br />
                전사가 알아야 할 짧은 안내를 올려 주세요.
              </p>
              {canManage ? (
                <button
                  type="button"
                  className={`${ERP_SECONDARY_BUTTON_CLASS} mt-1 !px-3 !py-1.5 !text-xs`}
                  onClick={openCreate}
                >
                  첫 공지 작성
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="flex h-full min-h-0 flex-col justify-evenly gap-1.5">
              {boardRows.map((row) => (
                <li key={row.id} className="min-h-0">
                  <button
                    type="button"
                    onClick={() => setViewing(row)}
                    className="flex w-full flex-col rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-2">
                      {row.isPinned ? (
                        <span className="mt-0.5 shrink-0 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                          고정
                        </span>
                      ) : (
                        <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                          안내
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{row.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                          {row.body}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-slate-400">
                          {[formatNoticeTime(row.createdAt), row.createdByName || null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <ErpModal
        open={listOpen}
        onClose={() => setListOpen(false)}
        title="공지 전체"
        size="md"
        headerActions={
          canManage ? (
            <button
              type="button"
              className={ERP_PRIMARY_BUTTON_SM_CLASS}
              onClick={() => {
                setListOpen(false)
                openCreate()
              }}
            >
              작성
            </button>
          ) : null
        }
      >
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">등록된 공지가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-1 py-3 text-left hover:bg-slate-50"
                  onClick={() => {
                    setListOpen(false)
                    setViewing(row)
                  }}
                >
                  {row.isPinned ? (
                    <span className="mt-0.5 shrink-0 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                      고정
                    </span>
                  ) : (
                    <span className="mt-0.5 w-8 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{row.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{row.body}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {[formatNoticeTime(row.createdAt), row.createdByName || null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ErpModal>

      <ErpModal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.title || '공지'}
        description={
          viewing
            ? [formatNoticeTime(viewing.createdAt), viewing.createdByName || null]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        size="form"
        headerAddon={
          viewing?.isPinned ? (
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
              고정
            </span>
          ) : null
        }
        headerActions={
          canManage && viewing ? (
            <div className="flex gap-1.5">
              <button
                type="button"
                className={ERP_SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  if (!viewing) return
                  setViewing(null)
                  openEdit(viewing)
                }}
              >
                수정
              </button>
              <button
                type="button"
                className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                disabled={pending}
                onClick={() => viewing && handleDelete(viewing)}
              >
                삭제
              </button>
            </div>
          ) : null
        }
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {viewing?.body}
        </p>
      </ErpModal>

      <ErpModal
        open={Boolean(editing)}
        onClose={() => !pending && setEditing(null)}
        title={editing?.id ? '공지 수정' : '공지 작성'}
        size="form"
        closeOnEscape={!pending}
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400">고정 공지는 보드 상단에 우선 표시됩니다.</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={ERP_SECONDARY_BUTTON_CLASS}
                disabled={pending}
                onClick={() => setEditing(null)}
              >
                취소
              </button>
              <button
                type="button"
                className={ERP_PRIMARY_BUTTON_SM_CLASS}
                disabled={pending}
                onClick={handleSave}
              >
                {pending ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        }
      >
        {editing ? (
          <div className="space-y-4">
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <div>
              <label className={ERP_FIELD_LABEL_CLASS} htmlFor="notice-title-board">
                제목
              </label>
              <input
                id="notice-title-board"
                className={ERP_FIELD_INPUT_CLASS}
                value={editing.title}
                maxLength={NOTICE_TITLE_MAX}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                }
                placeholder="예: 3/15(토) 1라인 설비점검 — 오전 비가동"
              />
            </div>
            <div>
              <label className={ERP_FIELD_LABEL_CLASS} htmlFor="notice-body-board">
                내용
              </label>
              <textarea
                id="notice-body-board"
                className={`${ERP_FIELD_INPUT_CLASS} min-h-[140px] resize-y`}
                value={editing.body}
                maxLength={NOTICE_BODY_MAX}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, body: event.target.value } : prev))
                }
                placeholder={'예:\n시간: 08:00~12:00\n대상: 생산1팀\n비고: 오후부터 정상 가동'}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editing.isPinned}
                onChange={(event) =>
                  setEditing((prev) =>
                    prev ? { ...prev, isPinned: event.target.checked } : prev,
                  )
                }
              />
              중요 공지로 고정
            </label>
          </div>
        ) : null}
      </ErpModal>
    </>
  )
}
