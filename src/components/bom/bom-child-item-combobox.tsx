'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatItemOptionLabel } from '@/lib/bom/utils'
import type { Item } from '@/lib/items/types'
import { ITEM_CATEGORY_LABELS } from '@/lib/items/types'
import { filterItemsForSearch } from '@/lib/items/utils'

type BomChildItemComboboxProps = {
  value: string
  items: Item[]
  disabled?: boolean
  placeholder?: string
  ariaLabel?: string
  inputClassName?: string
  onItemSelect: (item: Item | null) => void
}

type MenuPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

const MAX_OPTIONS = 12

function resolveItemFromInput(items: Item[], raw: string) {
  const want = raw.trim().toLowerCase()
  if (!want) return null

  const exactId = items.find((item) => item.id.trim().toLowerCase() === want)
  if (exactId) return exactId

  const exactLabel = items.find((item) => formatItemOptionLabel(item).toLowerCase() === want)
  if (exactLabel) return exactLabel

  const exactName = items.filter((item) => item.name.trim().toLowerCase() === want)
  if (exactName.length === 1) return exactName[0]

  const exactMpn = items.filter((item) => item.mpn.trim().toLowerCase() === want)
  if (exactMpn.length === 1) return exactMpn[0]

  return null
}

export function BomChildItemCombobox({
  value,
  items,
  disabled = false,
  placeholder = '품목코드·품목명·MPN 검색',
  ariaLabel = '구성 품목',
  inputClassName,
  onItemSelect,
}: BomChildItemComboboxProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [mounted, setMounted] = useState(false)

  const selected = useMemo(
    () => items.find((item) => item.id === value) || null,
    [items, value],
  )

  const inputValue = open ? draft : selected ? formatItemOptionLabel(selected) : value

  const options = useMemo(
    () => filterItemsForSearch(items, open ? draft : '').slice(0, MAX_OPTIONS),
    [items, open, draft],
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [draft, options.length])

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
      width: Math.max(rect.width, 320),
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
  }, [open, draft, options.length])

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
    setDraft(formatItemOptionLabel(item))
    setOpen(false)
  }

  function tryResolveOnBlur() {
    if (!draft.trim()) {
      if (value) onItemSelect(null)
      return
    }

    const resolved = resolveItemFromInput(items, draft)
    if (resolved) {
      onItemSelect(resolved)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return

    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setDraft(selected ? formatItemOptionLabel(selected) : value)
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
              <span className="block font-semibold">{formatItemOptionLabel(item)}</span>
              <span className="mt-0.5 block text-xs text-slate-400">
                {[ITEM_CATEGORY_LABELS[item.itemCategory], item.mpn, item.specification]
                  .filter(Boolean)
                  .join(' · ')}
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
        value={inputValue}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          setOpen(true)
          if (!next.trim() && value) {
            onItemSelect(null)
          }
        }}
        onFocus={() => {
          if (disabled) return
          setDraft(selected ? formatItemOptionLabel(selected) : '')
          setOpen(true)
          window.requestAnimationFrame(() => inputRef.current?.select())
        }}
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
