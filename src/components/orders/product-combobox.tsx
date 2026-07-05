'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Product } from '@/lib/products/types'
import {
  filterProductsForOrder,
  formatProductOptionLabel,
  resolveProductFromInput,
} from '@/lib/products/utils'

type ProductComboboxProps = {
  value: string
  products: Product[]
  customer: string
  field: 'code' | 'name'
  placeholder?: string
  ariaLabel: string
  inputClassName?: string
  onValueChange: (value: string) => void
  onProductSelect: (product: Product) => void
}

type MenuPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

const MAX_OPTIONS = 10

export function ProductCombobox({
  value,
  products,
  customer,
  field,
  placeholder,
  ariaLabel,
  inputClassName,
  onValueChange,
  onProductSelect,
}: ProductComboboxProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [mounted, setMounted] = useState(false)

  const options = useMemo(
    () => filterProductsForOrder(products, customer, value).slice(0, MAX_OPTIONS),
    [products, customer, value],
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

  function selectProduct(product: Product) {
    onProductSelect(product)
    setOpen(false)
  }

  function tryResolveOnBlur() {
    const codeRaw = field === 'code' ? value : ''
    const nameRaw = field === 'name' ? value : ''
    const resolved = resolveProductFromInput(products, customer, codeRaw, nameRaw)
    if (resolved) {
      onProductSelect(resolved)
    }
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
      selectProduct(options[activeIndex])
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
        {options.map((product, index) => (
          <li key={product.id} role="option" aria-selected={index === activeIndex}>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectProduct(product)}
              className={[
                'block w-full px-3 py-2.5 text-left text-sm',
                index === activeIndex ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              <span className="block font-semibold">{formatProductOptionLabel(product)}</span>
              {product.customer ? (
                <span className="mt-0.5 block text-xs text-slate-400">{product.customer}</span>
              ) : null}
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
        onFocus={() => {
          if (value.trim()) setOpen(true)
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
