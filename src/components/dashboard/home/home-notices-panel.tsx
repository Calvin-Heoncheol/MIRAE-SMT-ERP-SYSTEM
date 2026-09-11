'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { ErpModal } from '@/components/ui/erp-modal'
import {
  deleteCompanyNoticeAction,
  saveCompanyNoticeAction,
} from '@/lib/notices/actions'
import type { CompanyNotice } from '@/lib/notices/types'
import { NOTICE_BODY_MAX, NOTICE_TITLE_MAX } from '@/lib/notices/types'
import type { HomeDashboardData } from '@/lib/dashboard/home-data'
import {
  ERP_BADGE_COMPACT_CLASS,
  ERP_DANGER_BUTTON_CLASS,
  ERP_ERROR_TEXT_CLASS,
  ERP_FIELD_INPUT_CLASS,
  ERP_FIELD_LABEL_CLASS,
  ERP_PANEL_CLASS,
  ERP_PRIMARY_BUTTON_CLASS,
  ERP_PRIMARY_BUTTON_SM_CLASS,
  ERP_SECONDARY_BUTTON_CLASS,
} from '@/lib/ui/tokens'

function formatNoticeTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

type NoticeFormState = {
  id?: string
  title: string
  body: string
  isPinned: boolean
}

const EMPTY_FORM: NoticeFormState = { title: '', body: '', isPinned: false }
const SLIM_PREVIEW_COUNT = 3

type NoticesProps = {
  initialRows: CompanyNotice[]
  status: HomeDashboardData['noticesStatus']
  message?: string
  canManage: boolean
}

/** 하단 슬림 공지 바 — 고정·최신 몇 건 + 전체/작성 */
export function HomeNoticesSlimBar({ initialRows, status, message, canManage }: NoticesProps) {
  const [rows, setRows] = useState(initialRows)
  const [viewing, setViewing] = useState<CompanyNotice | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [editing, setEditing] = useState<NoticeFormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  const previewRows = useMemo(() => rows.slice(0, SLIM_PREVIEW_COUNT), [rows])

  const badge =
    status === 'missing_table'
      ? {
          text: '테이블 미적용',
          className: 'bg-amber-50 text-amber-800 ring-amber-200',
          body: 'Supabase에서 migrate-company-notices.sql 을 실행하세요.',
        }
      : status === 'error' || status === 'env'
        ? {
            text: '조회 실패',
            className: 'bg-rose-50 text-rose-800 ring-rose-200',
            body: message || '공지를 불러오지 못했습니다.',
          }
        : null

  function openCreate() {
    setListOpen(false)
    setFormError(null)
    setEditing({ ...EMPTY_FORM })
  }

  function openEdit(notice: CompanyNotice) {
    setViewing(null)
    setListOpen(false)
    setFormError(null)
    setEditing({
      id: notice.id,
      title: notice.title,
      body: notice.body,
      isPinned: notice.isPinned,
    })
  }

  function handleSave() {
    if (!editing) return
    setFormError(null)
    startTransition(async () => {
      const result = await saveCompanyNoticeAction({
        id: editing.id,
        title: editing.title,
        body: editing.body,
        isPinned: editing.isPinned,
      })
      if (!result.ok) {
        setFormError(result.detail)
        return
      }
      setRows((prev) => {
        const without = prev.filter((row) => row.id !== result.notice.id)
        const next = [result.notice, ...without]
        return next.sort((a, b) => {
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
        setFormError(result.detail)
        return
      }
      setRows((prev) => prev.filter((row) => row.id !== notice.id))
      setViewing(null)
      setEditing(null)
    })
  }

  return (
    <>
      <section
        className={`flex shrink-0 items-center gap-2 overflow-hidden px-3 py-2 ${ERP_PANEL_CLASS}`}
      >
        <div className="flex shrink-0 items-center gap-1.5">
          <h2 className="text-sm font-bold text-slate-900">공지</h2>
          {badge ? (
            <span className={`${ERP_BADGE_COMPACT_CLASS} ring-inset ${badge.className}`}>
              {badge.text}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          {badge ? (
            <p className="truncate text-xs text-amber-800">{badge.body}</p>
          ) : rows.length === 0 ? (
            <p className="truncate text-xs text-slate-400">등록된 공지가 없습니다.</p>
          ) : (
            <ul className="flex items-center gap-2">
              {previewRows.map((row) => (
                <li key={row.id} className="min-w-0 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewing(row)}
                    className="flex max-w-[16rem] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-left transition hover:border-slate-300 hover:bg-white"
                  >
                    {row.isPinned ? (
                      <span
                        className={`${ERP_BADGE_COMPACT_CLASS} bg-sky-50 text-sky-800 ring-inset ring-sky-200`}
                      >
                        고정
                      </span>
                    ) : null}
                    <span className="truncate text-xs font-semibold text-slate-800">{row.title}</span>
                  </button>
                </li>
              ))}
              {rows.length > SLIM_PREVIEW_COUNT ? (
                <li className="shrink-0 text-[11px] text-slate-400">
                  +{rows.length - SLIM_PREVIEW_COUNT}
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {rows.length > 0 ? (
            <button
              type="button"
              onClick={() => setListOpen(true)}
              className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              전체
            </button>
          ) : null}
          {canManage ? (
            <button type="button" onClick={openCreate} className={ERP_PRIMARY_BUTTON_SM_CLASS}>
              작성
            </button>
          ) : null}
        </div>
      </section>

      <ErpModal
        open={listOpen}
        size="form"
        title="공지 전체"
        description="회사 내부 안내"
        onClose={() => setListOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            {canManage ? (
              <button type="button" onClick={openCreate} className={ERP_PRIMARY_BUTTON_CLASS}>
                작성
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setListOpen(false)}
              className={ERP_SECONDARY_BUTTON_CLASS}
            >
              닫기
            </button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            등록된 공지가 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    setListOpen(false)
                    setViewing(row)
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {row.isPinned ? (
                      <span
                        className={`${ERP_BADGE_COMPACT_CLASS} bg-sky-50 text-sky-800 ring-inset ring-sky-200`}
                      >
                        고정
                      </span>
                    ) : null}
                    <p className="truncate text-sm font-semibold text-slate-900">{row.title}</p>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500">
                    {row.body}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {[formatNoticeTime(row.createdAt), row.createdByName || null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ErpModal>

      <ErpModal
        open={Boolean(viewing)}
        size="form"
        title={viewing?.title || '공지'}
        description={
          viewing
            ? [formatNoticeTime(viewing.createdAt), viewing.createdByName || null]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        onClose={() => setViewing(null)}
        footer={
          viewing ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {canManage ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(viewing)}
                      className={ERP_SECONDARY_BUTTON_CLASS}
                      disabled={pending}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(viewing)}
                      className={ERP_DANGER_BUTTON_CLASS}
                      disabled={pending}
                    >
                      삭제
                    </button>
                  </>
                ) : (
                  <span />
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className={ERP_SECONDARY_BUTTON_CLASS}
              >
                닫기
              </button>
            </div>
          ) : null
        }
        headerAddon={
          viewing?.isPinned ? (
            <span className={`${ERP_BADGE_COMPACT_CLASS} bg-sky-50 text-sky-800 ring-sky-200`}>
              고정
            </span>
          ) : null
        }
      >
        {viewing ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{viewing.body}</p>
        ) : null}
      </ErpModal>

      <ErpModal
        open={Boolean(editing)}
        size="form"
        title={editing?.id ? '공지 수정' : '공지 작성'}
        onClose={() => {
          if (pending) return
          setEditing(null)
          setFormError(null)
        }}
        closeOnEscape={!pending}
        footer={
          editing ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setFormError(null)
                }}
                className={ERP_SECONDARY_BUTTON_CLASS}
                disabled={pending}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                className={ERP_PRIMARY_BUTTON_CLASS}
                disabled={pending}
              >
                {pending ? '저장 중…' : '저장'}
              </button>
            </div>
          ) : null
        }
      >
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className={ERP_FIELD_LABEL_CLASS} htmlFor="notice-title-slim">
                제목
              </label>
              <input
                id="notice-title-slim"
                value={editing.title}
                maxLength={NOTICE_TITLE_MAX}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                }
                className={ERP_FIELD_INPUT_CLASS}
                placeholder="예: 이번 주 설비 점검 안내"
                disabled={pending}
              />
            </div>
            <div>
              <label className={ERP_FIELD_LABEL_CLASS} htmlFor="notice-body-slim">
                본문
              </label>
              <textarea
                id="notice-body-slim"
                value={editing.body}
                maxLength={NOTICE_BODY_MAX}
                rows={8}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, body: event.target.value } : prev))
                }
                className={`${ERP_FIELD_INPUT_CLASS} min-h-[10rem] resize-y`}
                placeholder="공지 내용을 입력하세요."
                disabled={pending}
              />
              <p className="mt-1 text-right text-[11px] text-slate-400">
                {editing.body.length}/{NOTICE_BODY_MAX}
              </p>
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
                disabled={pending}
                className="h-4 w-4 rounded border-slate-300"
              />
              상단에 고정
            </label>
            {formError ? <p className={ERP_ERROR_TEXT_CLASS}>{formError}</p> : null}
          </div>
        ) : null}
      </ErpModal>
    </>
  )
}
