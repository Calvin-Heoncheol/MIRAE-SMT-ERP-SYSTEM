'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { quoteMatchesCustomer } from '@/lib/orders/quote-unit-price'
import { formatQuoteOptionLabel } from '@/lib/quotes/quote-to-item'
import { filterQuotesForSearch } from '@/lib/quotes/utils'
import type { QuoteListItem } from '@/lib/quotes/types'

type QuoteComboboxProps = {
  value: string
  selectedQuoteId?: string
  quotes: QuoteListItem[]
  customer: string
  placeholder?: string
  ariaLabel: string
  inputClassName?: string
  onValueChange: (value: string) => void
  onQuoteSelect: (quote: QuoteListItem) => void
  onClear?: () => void
}

type MenuPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

const MAX_OPTIONS = 12

export function QuoteCombobox({
  value,
  selectedQuoteId,
  quotes,
  customer,
  placeholder = '견적번호·제품명 검색',
  ariaLabel,
  inputClassName,
  onValueChange,
  onQuoteSelect,
  onClear,
}: QuoteComboboxProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [mounted, setMounted] = useState(false)

  const options = useMemo(() => {
    const customerFiltered = customer.trim()
      ? quotes.filter((quote) => quoteMatchesCustomer(quote.customer, customer))
      : quotes
    return filterQuotesForSearch(customerFiltered, value).slice(0, MAX_OPTIONS)
  }, [quotes, customer, value])

  const linkedQuote = useMemo(() => {
    const id = String(selectedQuoteId || '').trim()
    if (!id) return null
    return quotes.find((quote) => quote.quoteId === id || quote.quoteNumber === id) || null
  }, [quotes, selectedQuoteId])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const placement = spaceBelow < 220 && rect.top > 220 ? 'above' : 'below'
    setMenuPosition({
      top: placement === 'below' ? rect.bottom + 4 : rect.top - 4,
      left: rect.left,
      width: rect.width,
      maxHeight: placement === 'below' ? Math.min(280, spaceBelow - 8) : Math.min(280, rect.top - 8),
      placement,
    })
  }, [open, value, options.length])

  useEffect(() => {
    setActiveIndex(0)
  }, [value, options.length])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function selectQuote(quote: QuoteListItem) {
    onQuoteSelect(quote)
    onValueChange(formatQuoteOptionLabel(quote))
    setOpen(false)
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
      selectQuote(options[activeIndex])
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
        {options.map((quote, index) => (
          <li key={quote.quoteId} role="option" aria-selected={index === activeIndex}>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectQuote(quote)}
              className={[
                'block w-full px-3 py-2 text-left text-sm',
                index === activeIndex ? 'bg-sky-50 text-sky-900' : 'text-slate-800 hover:bg-slate-50',
              ].join(' ')}
            >
              <span className="block font-medium">{quote.quoteNumber}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {quote.productName} · {quote.customer} · {quote.quoteDate}
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : null

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
          onChange={(event) => {
            onValueChange(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={inputClassName}
        />
        {selectedQuoteId ? (
          <button
            type="button"
            onClick={() => {
              onClear?.()
              onValueChange('')
            }}
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            해제
          </button>
        ) : null}
      </div>
      {linkedQuote && !value.trim() ? (
        <p className="mt-1 text-xs text-slate-500">{formatQuoteOptionLabel(linkedQuote)}</p>
      ) : null}
      {mounted ? createPortal(dropdown, document.body) : null}
    </div>
  )
}
