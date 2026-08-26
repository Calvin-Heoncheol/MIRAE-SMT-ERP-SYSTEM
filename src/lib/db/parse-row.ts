/**
 * repository 경계용 가벼운 row 파서.
 * Zod 없이 unknown → 객체/스칼라를 안전하게 읽는다.
 */

import type { OrderRecord } from '@/lib/orders/types'

export function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function readString(row: Record<string, unknown>, key: string, fallback = ''): string {
  const value = row[key]
  if (value == null) return fallback
  return String(value)
}

export function readNullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key]
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

export function readNumber(row: Record<string, unknown>, key: string, fallback = 0): number {
  const value = row[key]
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** Supabase select('*') 결과를 OrderRecord 형태로 좁힌다 (런타임 최소 검증). */
export function parseOrderRecord(value: unknown): OrderRecord | null {
  const row = asObject(value)
  if (!row) return null
  const id = readString(row, 'id').trim()
  if (!id) return null

  const linesRaw = row.order_lines
  const lineList = Array.isArray(linesRaw) ? linesRaw : []
  const order_lines = lineList
    .map((line) => {
      const lineRow = asObject(line)
      if (!lineRow) return null
      const lineId = readString(lineRow, 'id').trim()
      if (!lineId) return null
      return {
        id: lineId,
        order_id: readString(lineRow, 'order_id', id),
        line_seq: Math.max(0, Math.floor(readNumber(lineRow, 'line_seq'))),
        product_id: readNullableString(lineRow, 'product_id'),
        product_code: readString(lineRow, 'product_code'),
        product_name: readString(lineRow, 'product_name'),
        quantity: readNumber(lineRow, 'quantity'),
        unit_price: readNumber(lineRow, 'unit_price'),
        order_amount: readNumber(lineRow, 'order_amount'),
        delivery_date: readNullableString(lineRow, 'delivery_date'),
        derived_from_line_id: readNullableString(lineRow, 'derived_from_line_id'),
      }
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))

  return {
    id,
    order_date: readString(row, 'order_date'),
    delivery_date: readNullableString(row, 'delivery_date'),
    customer: readString(row, 'customer'),
    category: readString(row, 'category'),
    currency: readNullableString(row, 'currency'),
    source: readString(row, 'source', 'manual'),
    source_quote_id: readNullableString(row, 'source_quote_id'),
    note: readString(row, 'note'),
    customer_po_number: readString(row, 'customer_po_number'),
    payment_term_type: readNullableString(row, 'payment_term_type'),
    payment_deposit_percent:
      row.payment_deposit_percent == null ? null : readNumber(row, 'payment_deposit_percent'),
    payment_net_days: row.payment_net_days == null ? null : readNumber(row, 'payment_net_days'),
    payment_monthly_day:
      row.payment_monthly_day == null ? null : readNumber(row, 'payment_monthly_day'),
    created_by: readNullableString(row, 'created_by'),
    created_by_name: readNullableString(row, 'created_by_name'),
    created_at: readString(row, 'created_at'),
    updated_at: readString(row, 'updated_at'),
    order_lines,
  }
}

export function parseOrderRecords(values: unknown): OrderRecord[] {
  if (!Array.isArray(values)) return []
  return values.map(parseOrderRecord).filter((row): row is OrderRecord => Boolean(row))
}
