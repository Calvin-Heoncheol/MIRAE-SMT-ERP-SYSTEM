'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Item } from '@/lib/items/types'

type SemiFinishedItemComboboxProps = {
  value: string
  items: Item[]
  placeholder?: string
  ariaLabel: string
  inputClassName?: string
  onValueChange: (value: string) => void
  onItemSelect: (item: Item) => void
}

type MenuPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

const MAX_OPTIONS = 12

function filterSemiFinishedItems(items: Item[], query: string) {
  const q = query.trim().toLowerCase()
  return items.filter((item) => {
    if (!item.isActive) return false
    if (!q) return true
    return [item.id, item.name, item.specification].join(' ').toLowerCase().includes(q)
  })
}

function resolveSemiFinishedItem(items: Item[], name: string) {
  const want = name.trim()
  if (!want) return null
  const matches = items.filter((item) => item.isActive && item.name === want)
  return matches.length === 1 ? matches[0] : null
}

export function SemiFinishedItemCombobox({
  value,
  items,
  placeholder,
  ariaLabel,
  inputClassName,
  onValueChange,
  onItemSelect,
}: SemiFinishedItemComboboxProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [mounted, setMounted] = useState(false)

  const options = useMemo(
    () => filterSemiFinishedItems(items, value).slice(0, MAX_OPTIONS),
    [items, value],
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [value, options.length])

  function updateMenuPosition() {
    const input = inputRef.current
    if (!input) return

    const rect = input.getBoundingClientRect()
    const gap = 4
    const preferredHeight = 224
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow
    const maxHeight = Math.max(Math.min(preferredHeight, openUp ? spaceAbove : spaceBelow), 120)

    setMenuPosition({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left: rect.left,
      width: Math.max(rect.width, 280),
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
  }, [open, value, options.length])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function selectItem(item: Item) {
    onItemSelect(item)
    setOpen(false)
  }

  function tryResolveOnBlur() {
    const resolved = resolveSemiFinishedItem(items, value)
    if (resolved) onItemSelect(resolved)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(options.length - 1, 0)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }

    if (event.key === 'Enter' && open && options[activeIndex]) {
      event.preventDefault()
      selectItem(options[activeIndex])
      return
    }

    if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const dropdown =
    open && options.length > 0 && menuPosition && mounted ? (
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
        {options.map((item, index) => (
          <li key={item.id} role="option" aria-selected={index === activeIndex}>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectItem(item)}
              className={[
                'block w-full px-3 py-2.5 text-left text-sm',
                index === activeIndex ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              <span className="block font-semibold">{item.name || item.id}</span>
              <span className="mt-0.5 block text-xs text-slate-400">
                {[item.id, item.specification].filter(Boolean).join(' · ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : null

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            tryResolveOnBlur()
            setOpen(false)
          }, 120)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        role="combobox"
        autoComplete="off"
        className={inputClassName}
      />

      {dropdown && mounted ? createPortal(dropdown, document.body) : null}
    </div>
  )
}
