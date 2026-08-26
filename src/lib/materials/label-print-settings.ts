export type LabelPrintDpi = 203 | 300

export type LabelPrintSettings = {
  widthMm: number
  heightMm: number
  dpi: LabelPrintDpi
  /** false면 Browser Print(ZPL) 건너뛰고 브라우저 인쇄만 */
  preferBrowserPrint: boolean
}

export const LABEL_PRINT_SIZE_PRESETS: {
  id: string
  label: string
  widthMm: number
  heightMm: number
}[] = [
  { id: '40x30', label: '40×30 mm', widthMm: 40, heightMm: 30 },
  { id: '50x30', label: '50×30 mm', widthMm: 50, heightMm: 30 },
  { id: '60x40', label: '60×40 mm', widthMm: 60, heightMm: 40 },
  { id: '70x50', label: '70×50 mm', widthMm: 70, heightMm: 50 },
]

export const DEFAULT_LABEL_PRINT_SETTINGS: LabelPrintSettings = {
  widthMm: 40,
  heightMm: 30,
  dpi: 203,
  preferBrowserPrint: true,
}

const STORAGE_KEY = 'mirae.materialLabelPrintSettings'

/** 용지 설정 저장 시 미리보기 등에서 구독 */
export const LABEL_PRINT_SETTINGS_CHANGED = 'mirae:label-print-settings'

let remembered: LabelPrintSettings | null = null

function clampMm(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(200, Math.max(10, Math.round(value * 10) / 10))
}

function normalizeSettings(raw: Partial<LabelPrintSettings> | null | undefined): LabelPrintSettings {
  const widthMm = clampMm(Number(raw?.widthMm), DEFAULT_LABEL_PRINT_SETTINGS.widthMm)
  const heightMm = clampMm(Number(raw?.heightMm), DEFAULT_LABEL_PRINT_SETTINGS.heightMm)
  const dpi = raw?.dpi === 300 ? 300 : 203
  const preferBrowserPrint = raw?.preferBrowserPrint !== false
  return { widthMm, heightMm, dpi, preferBrowserPrint }
}

export function getLabelPrintSettings(): LabelPrintSettings {
  if (remembered) return remembered
  if (typeof window === 'undefined') return DEFAULT_LABEL_PRINT_SETTINGS
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      remembered = normalizeSettings(JSON.parse(stored) as Partial<LabelPrintSettings>)
      return remembered
    }
  } catch {
    // ignore
  }
  return DEFAULT_LABEL_PRINT_SETTINGS
}

export function setLabelPrintSettings(next: Partial<LabelPrintSettings>) {
  const merged = normalizeSettings({ ...getLabelPrintSettings(), ...next })
  remembered = merged
  if (typeof window === 'undefined') return merged
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // 메모리만 유지
  }
  window.dispatchEvent(new Event(LABEL_PRINT_SETTINGS_CHANGED))
  return merged
}

export function formatLabelPrintSize(settings: LabelPrintSettings) {
  return `${settings.widthMm}×${settings.heightMm} mm`
}
