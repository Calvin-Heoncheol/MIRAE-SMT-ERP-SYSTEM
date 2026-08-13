'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { loadActivityNotificationFeedAction } from '@/lib/notifications/actions'
import {
  loadReadNotificationKeys,
  markNotificationsRead,
} from '@/lib/notifications/read-state'
import {
  ACTIVITY_KIND_LABELS,
  type ActivityNotification,
  type ActivityNotificationFeed,
} from '@/lib/notifications/types'
import { playToastSound } from '@/lib/ui/toast-sound'

type NotificationBellProps = {
  userId?: string | null
  variant?: 'icon' | 'bar'
  className?: string
}

const PANEL_WIDTH = 360
const POLL_INTERVAL_MS = 60_000

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
  const [feed, setFeed] = useState<ActivityNotificationFeed | null>(null)
  const [readKeys, setReadKeys] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const prevUnreadRef = useRef<number | null>(null)

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const next = await loadActivityNotificationFeedAction()
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
    prevUnreadRef.current = null
    refresh()
  }, [userId, refresh])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      refresh()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    if (!open || !feed?.items.length) return
    setReadKeys(markNotificationsRead(userId, feed.items.map((item) => item.key)))
  }, [open, feed, userId])

  const items = feed?.items ?? []
  const unreadCount = items.filter((item) => !readKeys.has(item.key)).length

  useEffect(() => {
    if (feed == null) return
    const previous = prevUnreadRef.current
    if (previous == null) {
      prevUnreadRef.current = unreadCount
      return
    }
    prevUnreadRef.current = unreadCount
    if (unreadCount > previous) {
      playToastSound('info')
    }
  }, [feed, unreadCount])

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

  function handleOpenToggle() {
    const next = !open
    setOpen(next)
    if (next) refresh()
  }

  function handleItemClick(item: ActivityNotification) {
    setReadKeys(markNotificationsRead(userId, [item.key]))
    setOpen(false)
  }

  const panel =
    open && mounted && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="활동 알림"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: Math.min(
                PANEL_WIDTH,
                typeof window !== 'undefined' ? window.innerWidth - 24 : PANEL_WIDTH,
              ),
            }}
            className="fixed z-[80] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
              <div>
                <p className="text-sm font-bold text-slate-900">활동 알림</p>
                <p className="text-[11px] text-slate-400">최근 7일 · 다른 사용자 등록</p>
              </div>
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
                <p className="px-3 py-8 text-center text-sm text-slate-400">
                  최근 등록 알림이 없습니다
                </p>
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
                            <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                              {ACTIVITY_KIND_LABELS[item.kind]}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                              <div className="mt-1.5 flex items-end justify-between gap-2">
                                <span className="text-[10px] text-slate-400">
                                  {new Date(item.createdAt).toLocaleString('ko-KR', {
                                    month: 'numeric',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false,
                                  })}
                                </span>
                                {item.actorName && item.actorName !== '누군가' ? (
                                  <span className="truncate text-[10px] text-slate-400">
                                    {item.actorName}
                                  </span>
                                ) : null}
                              </div>
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
        aria-label={unreadCount > 0 ? `활동 알림 ${unreadCount}건` : '활동 알림'}
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
