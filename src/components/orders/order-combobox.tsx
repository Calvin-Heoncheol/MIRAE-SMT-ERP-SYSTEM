'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { OrderListGroup } from '@/lib/orders/types'
import { displayOrderPoNumber, filterOrdersForSearch } from '@/lib/orders/utils'
import { ERP_FIELD_INPUT_CLASS } from '@/lib/ui/tokens'

type OrderComboboxProps = {
  value: string
  orders: OrderListGroup[]
  placeholder?: string
  ariaLabel?: string
  inputClassName?: string
  allowEmpty?: boolean
  emptyLabel?: string
  onOrderSelect: (order: OrderListGroup | null) => void
}

type MenuPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

const MAX_OPTIONS = 12

function formatOrderOption(order: OrderListGroup) {
  const po = displayOrderPoNumber(order.customerPoNumber, order.orderId)
  return `${po} · ${order.customer}`
}

/** 마스터 참조(발주서) — native select 대신 검색 Combobox */
export function OrderCombobox({
  value,
  orders,
  placeholder = '발주서 검색',
  ariaLabel = '발주서',
  inputClassName,
  allowEmpty = true,
  emptyLabel = '발주서 없음',
  onOrderSelect,
}: OrderComboboxProps) {
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
    () => orders.find((order) => order.orderId === value) || null,
    [orders, value],
  )
  const inputValue = open ? draft : selected ? formatOrderOption(selected) : ''
  const options = useMemo(
    () => filterOrdersForSearch(orders, open ? draft : '').slice(0, MAX_OPTIONS),
    [orders, open, draft],
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
  }, [open, draft, options.length])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
      setDraft('')
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function pick(order: OrderListGroup | null) {
    onOrderSelect(order)
    setOpen(false)
    setDraft('')
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        value={inputValue}
        placeholder={placeholder}
        className={inputClassName || ERP_FIELD_INPUT_CLASS}
        onFocus={() => {
          setOpen(true)
          setDraft('')
        }}
        onChange={(event) => {
          setOpen(true)
          setDraft(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((current) => Math.min(current + 1, Math.max(options.length - 1, 0)))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter' && open) {
            event.preventDefault()
            const hit = options[activeIndex]
            if (hit) pick(hit)
          } else if (event.key === 'Escape') {
            setOpen(false)
            setDraft('')
          } else if (event.key === 'Backspace' && !open && selected && allowEmpty) {
            pick(null)
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
              {allowEmpty ? (
                <li
                  role="option"
                  aria-selected={!value}
                  className="cursor-pointer px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    pick(null)
                  }}
                >
                  {emptyLabel}
                </li>
              ) : null}
              {options.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-400">검색 결과 없음</li>
              ) : (
                options.map((order, index) => (
                  <li
                    key={order.orderId}
                    role="option"
                    aria-selected={order.orderId === value}
                    className={[
                      'cursor-pointer px-3 py-2 text-sm',
                      index === activeIndex ? 'bg-slate-100' : 'hover:bg-slate-50',
                      order.orderId === value ? 'font-semibold text-slate-900' : 'text-slate-700',
                    ].join(' ')}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      pick(order)
                    }}
                  >
                    {formatOrderOption(order)}
                  </li>
                ))
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}
