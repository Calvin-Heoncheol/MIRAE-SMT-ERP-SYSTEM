'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DeliveryShippableOption } from '@/lib/delivery/register-form'
import {
  formatDeliveryShippableOptionLabel,
  formatDeliveryShippableOptionSubLabel,
} from '@/lib/delivery/register-form'

type DeliveryShippableComboboxProps = {
  value: string
  options: DeliveryShippableOption[]
  placeholder?: string
  ariaLabel: string
  inputClassName?: string
  disabled?: boolean
  onValueChange: (value: string) => void
  onOptionSelect: (option: DeliveryShippableOption) => void
}

type MenuPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

const MAX_OPTIONS = 12

function filterOptions(options: DeliveryShippableOption[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter((option) => {
    const haystack = [
      option.productCode,
      option.productName,
      option.productVersion || '',
      option.orderNumber,
      option.customer,
      option.assemblyGroupId,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function DeliveryShippableCombobox({
  value,
  options,
  placeholder,
  ariaLabel,
  inputClassName,
  disabled = false,
  onValueChange,
  onOptionSelect,
}: DeliveryShippableComboboxProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [mounted, setMounted] = useState(false)

  const filtered = useMemo(
    () => filterOptions(options, value).slice(0, MAX_OPTIONS),
    [options, value],
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [value, filtered.length])

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
  }, [open, filtered.length])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  function selectOption(option: DeliveryShippableOption) {
    onOptionSelect(option)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        role="combobox"
        className={inputClassName}
        onChange={(event) => {
          onValueChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter' && open && filtered[activeIndex]) {
            event.preventDefault()
            selectOption(filtered[activeIndex]!)
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {mounted && open && menuPosition
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              className="fixed z-[80] overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              style={{
                top: menuPosition.placement === 'above' ? undefined : menuPosition.top,
                bottom:
                  menuPosition.placement === 'above'
                    ? window.innerHeight - menuPosition.top
                    : undefined,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
              }}
            >
              {filtered.length ? (
                filtered.map((option, index) => (
                  <li key={option.assemblyGroupId} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left ${
                        index === activeIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectOption(option)}
                    >
                      <span className="text-sm font-medium text-slate-900">
                        {formatDeliveryShippableOptionLabel(option)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDeliveryShippableOptionSubLabel(option)}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-slate-500">출하가능 품목이 없습니다</li>
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}
