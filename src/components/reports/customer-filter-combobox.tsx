'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ERP_FIELD_INPUT_CLASS, ERP_SECONDARY_BUTTON_CLASS } from '@/lib/ui/tokens'

type CustomerFilterComboboxProps = {
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder?: string
}

type MenuPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

const MAX_OPTIONS = 12

/** 리포트·목록 필터용 고객사 검색 드롭다운 (빈 값 = 전체) */
export function CustomerFilterCombobox({
  value,
  options,
  onChange,
  placeholder = '고객사 검색…',
}: CustomerFilterComboboxProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setQuery(value)
  }, [value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...options].sort((a, b) => a.localeCompare(b, 'ko'))
    if (!q) return sorted.slice(0, MAX_OPTIONS)
    return sorted.filter((name) => name.toLowerCase().includes(q)).slice(0, MAX_OPTIONS)
  }, [options, query])

  const menuItems = useMemo(() => {
    const items = [{ key: '', label: '전체 고객사' }, ...filtered.map((name) => ({ key: name, label: name }))]
    return items
  }, [filtered])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, menuItems.length])

  function updateMenuPosition() {
    const input = inputRef.current
    if (!input) return
    const rect = input.getBoundingClientRect()
    const gap = 4
    const preferredHeight = 240
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow
    const maxHeight = Math.max(Math.min(preferredHeight, openUp ? spaceAbove : spaceBelow), 120)
    setMenuPosition({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left: rect.left,
      width: Math.max(rect.width, 240),
      maxHeight,
      placement: openUp ? 'above' : 'below',
    })
  }

  useEffect(() => {
    if (!open) {
      setMenuPosition(null)
      return
    }
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, query, menuItems.length])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
      setQuery(value)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [value])

  function select(next: string) {
    onChange(next)
    setQuery(next)
    setOpen(false)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(menuItems.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter' && open && menuItems[activeIndex]) {
      event.preventDefault()
      select(menuItems[activeIndex]!.key)
      return
    }
    if (event.key === 'Escape') {
      setOpen(false)
      setQuery(value)
    }
  }

  const dropdown =
    open && menuPosition && mounted ? (
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        className="fixed z-[200] overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        style={{
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          maxHeight: menuPosition.maxHeight,
          transform: menuPosition.placement === 'above' ? 'translateY(-100%)' : undefined,
        }}
      >
        {menuItems.map((item, index) => (
          <li key={item.key || '__all__'} role="option" aria-selected={index === activeIndex}>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(item.key)}
              className={[
                'block w-full px-3 py-2.5 text-left text-sm',
                index === activeIndex ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50',
                !item.key ? 'font-semibold text-slate-500' : 'font-medium',
              ].join(' ')}
            >
              {item.label}
            </button>
          </li>
        ))}
        {!filtered.length && query.trim() ? (
          <li className="px-3 py-2.5 text-sm text-slate-400">일치하는 고객사가 없습니다</li>
        ) : null}
      </ul>
    ) : null

  return (
    <div ref={rootRef} className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label="고객사">
      <span className="text-xs font-semibold text-slate-500">고객사</span>
      <div className="relative min-w-[180px] flex-1 sm:min-w-[220px]">
        <input
          ref={inputRef}
          value={query}
          lang="ko"
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false)
              setQuery(value)
            }, 120)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="고객사 검색"
          aria-expanded={open}
          aria-controls={listId}
          role="combobox"
          autoComplete="off"
          className={`${ERP_FIELD_INPUT_CLASS} !bg-white !py-2`}
          style={{ imeMode: 'active' }}
        />
        {dropdown && mounted ? createPortal(dropdown, document.body) : null}
      </div>
      {value ? (
        <button
          type="button"
          onClick={() => select('')}
          className={`${ERP_SECONDARY_BUTTON_CLASS} !px-2.5 !py-2 text-xs`}
        >
          초기화
        </button>
      ) : null}
    </div>
  )
}
