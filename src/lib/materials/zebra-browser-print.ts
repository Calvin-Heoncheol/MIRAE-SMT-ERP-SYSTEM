/** Zebra Browser Print (로컬 에이전트) HTTP API */

export type BrowserPrintDevice = {
  name: string
  uid: string
  connection: string
  deviceType: string
  version: number
  provider?: string
  manufacturer?: string
}

type BrowserPrintWriteBody = {
  device: BrowserPrintDevice
  data: string
}

const HTTP_BASE = 'http://127.0.0.1:9100'
const HTTPS_BASE = 'https://127.0.0.1:9101'

function preferredBases() {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return [HTTPS_BASE, HTTP_BASE]
  }
  return [HTTP_BASE, HTTPS_BASE]
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!response.ok) {
    throw new Error(`Browser Print HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

function normalizeDevice(raw: unknown): BrowserPrintDevice | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const name = String(row.name || '').trim()
  const uid = String(row.uid || '').trim()
  if (!name || !uid) return null
  return {
    name,
    uid,
    connection: String(row.connection || 'usb'),
    deviceType: String(row.deviceType || 'printer'),
    version: Number(row.version) || 2,
    provider: row.provider ? String(row.provider) : undefined,
    manufacturer: row.manufacturer ? String(row.manufacturer) : undefined,
  }
}

/** Browser Print 에이전트가 살아 있는지 확인 */
export async function isBrowserPrintAvailable(): Promise<boolean> {
  for (const base of preferredBases()) {
    try {
      await fetchJson(`${base}/available`, { method: 'GET' })
      return true
    } catch {
      // try next
    }
  }
  return false
}

async function getDefaultPrinter(base: string): Promise<BrowserPrintDevice | null> {
  try {
    const data = await fetchJson<unknown>(`${base}/default?type=printer`)
    return normalizeDevice(data)
  } catch {
    return null
  }
}

async function listPrinters(base: string): Promise<BrowserPrintDevice[]> {
  try {
    const data = await fetchJson<unknown>(`${base}/available`)
    if (!data || typeof data !== 'object') return []
    const printerList = (data as { printer?: unknown[] }).printer
    if (!Array.isArray(printerList)) return []
    return printerList.map(normalizeDevice).filter((device): device is BrowserPrintDevice => Boolean(device))
  } catch {
    return []
  }
}

async function resolvePrinter(): Promise<{ base: string; device: BrowserPrintDevice } | null> {
  for (const base of preferredBases()) {
    const preferred = await getDefaultPrinter(base)
    if (preferred) return { base, device: preferred }

    const listed = await listPrinters(base)
    if (listed[0]) return { base, device: listed[0] }
  }
  return null
}

async function writeToDevice(base: string, device: BrowserPrintDevice, data: string) {
  const body: BrowserPrintWriteBody = { device, data }
  const response = await fetch(`${base}/write`, {
    method: 'POST',
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `Browser Print write HTTP ${response.status}`)
  }
}

/**
 * ZPL을 Browser Print 기본(또는 첫) 프린터로 전송.
 * 성공 시 true, 에이전트/프린터 없으면 false.
 */
export async function sendZplViaBrowserPrint(zpl: string): Promise<
  | { ok: true; printerName: string }
  | { ok: false; reason: 'unavailable' | 'no_printer' | 'write'; detail: string }
> {
  const trimmed = String(zpl || '').trim()
  if (!trimmed) {
    return { ok: false, reason: 'write', detail: '전송할 ZPL이 없습니다.' }
  }

  const resolved = await resolvePrinter()
  if (!resolved) {
    const alive = await isBrowserPrintAvailable()
    return alive
      ? { ok: false, reason: 'no_printer', detail: 'Browser Print에 연결된 프린터가 없습니다.' }
      : {
          ok: false,
          reason: 'unavailable',
          detail: 'Zebra Browser Print가 실행 중이 아닙니다.',
        }
  }

  try {
    await writeToDevice(resolved.base, resolved.device, trimmed)
    return { ok: true, printerName: resolved.device.name }
  } catch (error) {
    return {
      ok: false,
      reason: 'write',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
