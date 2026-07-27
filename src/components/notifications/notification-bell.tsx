'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { loadNotificationFeedAction } from '@/lib/notifications/actions'
import {
  loadReadNotificationKeys,
  markNotificationsRead,
} from '@/lib/notifications/read-state'
import {
  NOTIFICATION_CATEGORY_LABELS,
  type AppNotification,
  type NotificationFeed,
} from '@/lib/notifications/types'

type NotificationBellProps = {
  userId?: string | null
  /** compact: 아이콘만 / bar: 텍스트 포함 */
  variant?: 'icon' | 'bar'
  className?: string
}

const PANEL_WIDTH = 352

function toneClass(tone: AppNotification['tone']) {
  if (tone === 'danger') return 'bg-rose-50 text-rose-700 ring-rose-200'
  if (tone === 'warn') return 'bg-amber-50 text-amber-800 ring-amber-200'
  return 'bg-sky-50 text-sky-700 ring-sky-200'
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
      />
    </svg>
  )
}

export function NotificationBell({
  userId = null,
  variant = 'icon',
  className = '',
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [feed, setFeed] = useState<NotificationFeed | null>(null)
  const [readKeys, setReadKeys] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const next = await loadNotificationFeedAction()
        setFeed(next)
        setError('')
        setReadKeys(loadReadNotificationKeys(userId))
      } catch (err) {
        setError(err instanceof Error ? err.message : '알림을 불러오지 못했습니다.')
      }
    })
  }, [startTransition, userId])

  const updatePanelPosition = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 24)
    // 왼쪽 내비에서는 본문(오른쪽)으로 펼치고, 공간이 없으면 왼쪽으로 보정
    let left = rect.left
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, rect.right - width)
    }
    left = Math.max(12, left)
    const top = Math.min(rect.bottom + 8, window.innerHeight - 24)
    setPanelPos({ top, left })
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setReadKeys(loadReadNotificationKeys(userId))
    refresh()
  }, [userId, refresh])

  useEffect(() => {
    if (!open || !feed?.items.length) return
    setReadKeys(markNotificationsRead(userId, feed.items.map((item) => item.key)))
  }, [open, feed, userId])

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null)
      return
    }
    updatePanelPosition()
    function onResize() {
      updatePanelPosition()
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (buttonRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const items = feed?.items ?? []
  const unreadCount = items.filter((item) => !readKeys.has(item.key)).length

  function handleOpenToggle() {
    const next = !open
    setOpen(next)
    if (next) refresh()
  }

  function handleItemClick(_item: AppNotification) {
    setReadKeys(markNotificationsRead(userId, [_item.key]))
    setOpen(false)
  }

  const panel =
    open && mounted && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="알림 목록"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: Math.min(PANEL_WIDTH, typeof window !== 'undefined' ? window.innerWidth - 24 : PANEL_WIDTH),
            }}
            className="fixed z-[80] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
              <p className="text-sm font-bold text-slate-900">알림</p>
              <button
                type="button"
                onClick={refresh}
                disabled={pending}
                className="text-xs font-semibold text-sky-700 hover:underline disabled:opacity-50"
              >
                {pending ? '불러오는 중…' : '새로고침'}
              </button>
            </div>

            <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
              {error ? (
                <p className="px-3 py-6 text-center text-sm text-rose-600">{error}</p>
              ) : !items.length ? (
                <p className="px-3 py-8 text-center text-sm text-slate-400">새 알림이 없습니다</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const unread = !readKeys.has(item.key)
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          onClick={() => handleItemClick(item)}
                          className={[
                            'block px-3 py-2.5 transition hover:bg-slate-50',
                            unread ? 'bg-sky-50/40' : '',
                          ].join(' ')}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${toneClass(item.tone)}`}
                            >
                              {NOTIFICATION_CATEGORY_LABELS[item.category]}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {item.label}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                            </div>
                            {unread ? (
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className={className.trim()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpenToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unreadCount > 0 ? `알림 ${unreadCount}건` : '알림'}
        className={[
          'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50',
          variant === 'bar' ? 'h-9 px-2.5 text-xs font-semibold' : 'h-9 w-9',
        ].join(' ')}
      >
        <span className="relative inline-flex">
          <BellIcon className="h-[18px] w-[18px]" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </span>
        {variant === 'bar' ? <span>알림</span> : null}
      </button>
      {panel}
    </div>
  )
}
