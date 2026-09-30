export type LabelPrintDpi = 203 | 300

export type LabelPrintSettings = {
  widthMm: number
  heightMm: number
  dpi: LabelPrintDpi
  /** false면 Browser Print(ZPL) 건너뛰고 브라우저 인쇄만 */
  preferBrowserPrint: boolean
  /** 인쇄 위치 보정 (mm, +는 오른쪽·아래) — 고정 양식 라벨용 */
  offsetXMm?: number
  offsetYMm?: number
  /** 인쇄 농도 0~30 (ZPL ~SD) — 고정 양식 라벨용 */
  darkness?: number
  /** 인쇄 속도 2~6 ips (ZPL ^PR) — 느릴수록 가는 막대가 선명 */
  printSpeed?: number
}

/** 설정 저장 단위 — 기본 자재 라벨 / 고객사 고정 양식별 */
export type LabelPrintSettingsScope = 'material' | 'viucomm-p141a-box'

export type LabelPrintSizePreset = {
  id: string
  label: string
  widthMm: number
  heightMm: number
}

export const LABEL_PRINT_SIZE_PRESETS: LabelPrintSizePreset[] = [
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

const SCOPE_DEFAULTS: Record<LabelPrintSettingsScope, LabelPrintSettings> = {
  material: DEFAULT_LABEL_PRINT_SETTINGS,
  'viucomm-p141a-box': {
    widthMm: 30,
    heightMm: 20,
    dpi: 203,
    preferBrowserPrint: true,
    offsetXMm: 0,
    offsetYMm: 0,
    darkness: 20,
    printSpeed: 3,
  },
}

const SCOPE_PRESETS: Record<LabelPrintSettingsScope, LabelPrintSizePreset[]> = {
  material: LABEL_PRINT_SIZE_PRESETS,
  'viucomm-p141a-box': [
    { id: '30x20', label: '30×20 mm (원본)', widthMm: 30, heightMm: 20 },
    { id: '40x30', label: '40×30 mm', widthMm: 40, heightMm: 30 },
    { id: '50x30', label: '50×30 mm', widthMm: 50, heightMm: 30 },
  ],
}

const STORAGE_KEYS: Record<LabelPrintSettingsScope, string> = {
  material: 'mirae.materialLabelPrintSettings',
  'viucomm-p141a-box': 'mirae.viucommP141aBoxLabelPrintSettings',
}

/** 용지 설정 저장 시 미리보기 등에서 구독 */
export const LABEL_PRINT_SETTINGS_CHANGED = 'mirae:label-print-settings'

const remembered: Partial<Record<LabelPrintSettingsScope, LabelPrintSettings>> = {}

function clampMm(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(200, Math.max(10, Math.round(value * 10) / 10))
}

function normalizeSettings(
  raw: Partial<LabelPrintSettings> | null | undefined,
  defaults: LabelPrintSettings,
): LabelPrintSettings {
  const widthMm = clampMm(Number(raw?.widthMm), defaults.widthMm)
  const heightMm = clampMm(Number(raw?.heightMm), defaults.heightMm)
  const dpi = raw?.dpi === 300 ? 300 : raw?.dpi === 203 ? 203 : defaults.dpi
  const preferBrowserPrint = raw?.preferBrowserPrint !== false
  const offsetXMm = clampOffsetMm(Number(raw?.offsetXMm))
  const offsetYMm = clampOffsetMm(Number(raw?.offsetYMm))
  const darkness = clampInt(Number(raw?.darkness), 0, 30, defaults.darkness ?? 15)
  const printSpeed = clampInt(Number(raw?.printSpeed), 2, 6, defaults.printSpeed ?? 4)
  return { widthMm, heightMm, dpi, preferBrowserPrint, offsetXMm, offsetYMm, darkness, printSpeed }
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function clampOffsetMm(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(10, Math.max(-10, Math.round(value * 10) / 10))
}

export function getDefaultLabelPrintSettings(scope: LabelPrintSettingsScope = 'material') {
  return SCOPE_DEFAULTS[scope]
}

export function getLabelPrintSizePresets(scope: LabelPrintSettingsScope = 'material') {
  return SCOPE_PRESETS[scope]
}

export function getLabelPrintSettings(scope: LabelPrintSettingsScope = 'material'): LabelPrintSettings {
  const cached = remembered[scope]
  if (cached) return cached
  const defaults = SCOPE_DEFAULTS[scope]
  if (typeof window === 'undefined') return defaults
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS[scope])
    if (stored) {
      const parsed = normalizeSettings(JSON.parse(stored) as Partial<LabelPrintSettings>, defaults)
      remembered[scope] = parsed
      return parsed
    }
  } catch {
    // ignore
  }
  return defaults
}

export function setLabelPrintSettings(
  next: Partial<LabelPrintSettings>,
  scope: LabelPrintSettingsScope = 'material',
) {
  const merged = normalizeSettings({ ...getLabelPrintSettings(scope), ...next }, SCOPE_DEFAULTS[scope])
  remembered[scope] = merged
  if (typeof window === 'undefined') return merged
  try {
    window.localStorage.setItem(STORAGE_KEYS[scope], JSON.stringify(merged))
  } catch {
    // 메모리만 유지
  }
  window.dispatchEvent(new Event(LABEL_PRINT_SETTINGS_CHANGED))
  return merged
}

export function formatLabelPrintSize(settings: LabelPrintSettings) {
  return `${settings.widthMm}×${settings.heightMm} mm`
}
