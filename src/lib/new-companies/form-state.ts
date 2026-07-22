import type { NewCompanyInquiry, NewCompanyInquiryPayload, NewCompanyStatus } from './types'

const LEADING_INDEX_RE = /^\d+\.\s*/
const DATE_PREFIX_RE = /^\[(\d{4}-\d{2}-\d{2})\]\s*/

export type ProgressLine = {
  date: string
  text: string
}

function emptyProgressLine(): ProgressLine {
  return { date: '', text: '' }
}

/** DB note → 편집용 진행사항 행 (JSON / 레거시 평문 모두 지원) */
export function parseProgressLines(note: string): ProgressLine[] {
  const trimmed = note.trim()
  if (!trimmed) return [emptyProgressLine()]

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        const lines = parsed
          .map((item): ProgressLine | null => {
            if (typeof item === 'string') {
              const text = item.replace(LEADING_INDEX_RE, '').trim()
              return text ? { date: '', text } : null
            }
            if (item && typeof item === 'object') {
              const record = item as Record<string, unknown>
              const text = String(record.text ?? record.content ?? '').trim()
              const date = String(record.date ?? '').trim()
              if (!text && !date) return null
              return { date, text }
            }
            return null
          })
          .filter((line): line is ProgressLine => line != null)
        return lines.length ? lines : [emptyProgressLine()]
      }
    } catch {
      // fall through to plain-text parsing
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((raw): ProgressLine | null => {
      let line = raw.replace(LEADING_INDEX_RE, '').trim()
      if (!line) return null
      const dateMatch = line.match(DATE_PREFIX_RE)
      if (dateMatch) {
        line = line.slice(dateMatch[0].length).trim()
        return { date: dateMatch[1], text: line }
      }
      return { date: '', text: line }
    })
    .filter((line): line is ProgressLine => line != null)

  return lines.length ? lines : [emptyProgressLine()]
}

/** 편집 행 → DB note (JSON 배열) */
export function serializeProgressLines(lines: ProgressLine[]): string {
  const cleaned = lines
    .map((line) => ({
      date: line.date.trim(),
      text: line.text.replace(LEADING_INDEX_RE, '').trim(),
    }))
    .filter((line) => line.date || line.text)

  if (!cleaned.length) return ''
  return JSON.stringify(cleaned)
}

/** 목록/툴팁용 표시 (1. … / 2. …) */
export function formatProgressLinesDisplay(note: string, separator = ' · '): string {
  const lines = parseProgressLines(note).filter((line) => line.text || line.date)
  if (!lines.length) return ''
  return lines
    .map((line, index) => {
      const body = line.date ? `${line.date} ${line.text}`.trim() : line.text
      return `${index + 1}. ${body}`
    })
    .join(separator)
}

/** 목록 행용 — 가장 최근(마지막) 진행사항의 text만 (날짜·번호 없이) */
export function formatLatestProgressLineDisplay(note: string): string {
  const lines = parseProgressLines(note).filter((line) => line.text || line.date)
  if (!lines.length) return ''
  return lines[lines.length - 1].text.trim()
}

/** 문의(received)는 숨김, 그 외 상태는 표시 */
export function shouldShowProgressFields(status: NewCompanyStatus): boolean {
  return status !== 'received'
}

export type NewCompanyInquiryFormState = {
  contactName: string
  companyName: string
  email: string
  phone: string
  product: string
  quantity: string
  progressLines: ProgressLine[]
  status: NewCompanyStatus
  sourceChannel: string
  closeReason: string
}

export function emptyNewCompanyInquiryForm(): NewCompanyInquiryFormState {
  return {
    contactName: '',
    companyName: '',
    email: '',
    phone: '',
    product: '',
    quantity: '',
    progressLines: [emptyProgressLine()],
    status: 'received',
    sourceChannel: '',
    closeReason: '',
  }
}

export function inquiryToForm(inquiry: NewCompanyInquiry): NewCompanyInquiryFormState {
  return {
    contactName: inquiry.contactName,
    companyName: inquiry.companyName,
    email: inquiry.email,
    phone: inquiry.phone,
    product: inquiry.product,
    quantity: inquiry.quantity == null ? '' : String(inquiry.quantity),
    progressLines: parseProgressLines(inquiry.note),
    status: inquiry.status,
    sourceChannel: inquiry.sourceChannel,
    closeReason: inquiry.closeReason,
  }
}

export function formToInquiryPayload(form: NewCompanyInquiryFormState): NewCompanyInquiryPayload {
  const trimmedQty = form.quantity.trim()
  let quantity: number | null = null
  if (trimmedQty) {
    const parsed = Number(trimmedQty.replace(/,/g, ''))
    quantity = Number.isFinite(parsed) ? parsed : null
  }

  return {
    contactName: form.contactName.trim(),
    companyName: form.companyName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    product: form.product.trim(),
    quantity,
    note: serializeProgressLines(form.progressLines),
    status: form.status,
    sourceChannel: form.sourceChannel.trim(),
    closeReason: form.closeReason.trim(),
  }
}

export function validateNewCompanyInquiryForm(form: NewCompanyInquiryFormState): string | null {
  if (!form.contactName.trim()) return '담당자를 입력해 주세요.'
  if (!form.companyName.trim()) return '회사명을 입력해 주세요.'
  if (form.quantity.trim()) {
    const parsed = Number(form.quantity.trim().replace(/,/g, ''))
    if (!Number.isFinite(parsed) || parsed < 0) return '예상수량은 0 이상의 숫자로 입력해 주세요.'
  }
  return null
}
