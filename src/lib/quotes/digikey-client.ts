type DigiKeyTokenResponse = {
  access_token?: string
  expires_in?: number
  token_type?: string
}

type DigiKeyParameter = {
  ParameterText?: string
  ValueText?: string
}

export type DigiKeyProductSummary = {
  digiKeyPartNumber: string
  manufacturerProductNumber: string
  manufacturer: string
  description: string
  category: string
  packageName: string
  mountingType: string
  pinCount?: number
  parameters: DigiKeyParameter[]
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null

function digiKeyBaseUrl() {
  return useDigiKeySandbox() ? 'https://sandbox-api.digikey.com' : 'https://api.digikey.com'
}

function useDigiKeySandbox() {
  return process.env.DIGIKEY_USE_SANDBOX === 'true'
}

function readDigiKeyCredential(name: 'DIGIKEY_CLIENT_ID' | 'DIGIKEY_CLIENT_SECRET') {
  return String(process.env[name] ?? '').trim()
}

export function isDigiKeyConfigured() {
  return Boolean(readDigiKeyCredential('DIGIKEY_CLIENT_ID') && readDigiKeyCredential('DIGIKEY_CLIENT_SECRET'))
}

function digiKeyHeaders(accessToken: string) {
  const clientId = readDigiKeyCredential('DIGIKEY_CLIENT_ID')
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-DIGIKEY-Client-Id': clientId,
    'Content-Type': 'application/json',
    'X-DIGIKEY-Locale-Language': 'en',
    'X-DIGIKEY-Locale-Site': 'US',
    'X-DIGIKEY-Locale-Currency': 'USD',
  }
}

async function fetchDigiKeyAccessToken() {
  const clientId = readDigiKeyCredential('DIGIKEY_CLIENT_ID')
  const clientSecret = readDigiKeyCredential('DIGIKEY_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    throw new Error('DigiKey API 키가 설정되지 않았습니다. DIGIKEY_CLIENT_ID, DIGIKEY_CLIENT_SECRET을 추가해 주세요.')
  }

  const sandbox = useDigiKeySandbox()

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  })

  const response = await fetch(`${digiKeyBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const detail = await response.text()
    const modeHint = sandbox
      ? '현재 Sandbox 모드입니다. developer.digikey.com의 Sandbox 앱 키인지 확인하세요.'
      : '현재 Production 모드입니다. Sandbox 키라면 DIGIKEY_USE_SANDBOX=true 로 바꾸세요.'
    if (response.status === 401 && /invalid clientid/i.test(detail)) {
      throw new Error(
        `DigiKey 인증 실패 (401): Client ID가 이 환경과 맞지 않습니다. ${modeHint} 앱이 Product Information API에 구독되어 있는지도 확인해 주세요.`,
      )
    }
    throw new Error(`DigiKey 인증 실패 (${response.status}): ${detail.slice(0, 200)}`)
  }

  const json = (await response.json()) as DigiKeyTokenResponse
  const accessToken = json.access_token
  if (!accessToken) throw new Error('DigiKey access token을 받지 못했습니다.')

  cachedToken = {
    accessToken,
    expiresAt: Date.now() + (json.expires_in ?? 600) * 1000,
  }
  return accessToken
}

function readParameter(parameters: DigiKeyParameter[], ...names: string[]) {
  const normalized = names.map((name) => name.toLowerCase())
  for (const parameter of parameters) {
    const key = String(parameter.ParameterText ?? '').toLowerCase()
    if (normalized.some((name) => key.includes(name))) {
      return String(parameter.ValueText ?? '').trim()
    }
  }
  return ''
}

function parsePinCount(parameters: DigiKeyParameter[], text: string) {
  const fromParam = readParameter(parameters, 'pin count', 'number of pins', 'pins')
  const match = (fromParam || text).match(/(\d+)\s*(?:pin|pins)\b/i)
  if (match) return Number(match[1])
  const bare = Number((fromParam || '').replace(/[^\d]/g, ''))
  return Number.isFinite(bare) && bare > 0 ? bare : undefined
}

function normalizeDigiKeyProduct(raw: Record<string, unknown>): DigiKeyProductSummary | null {
  const digiKeyPartNumber = String(raw.DigiKeyPartNumber ?? raw.DigiKeyPartNumber ?? '').trim()
  const manufacturerProductNumber = String(
    raw.ManufacturerProductNumber ?? raw.ManufacturerPartNumber ?? '',
  ).trim()
  if (!digiKeyPartNumber && !manufacturerProductNumber) return null

  const description = String(raw.ProductDescription ?? raw.Description ?? '').trim()
  const category = String(raw.Category ?? raw.ProductCategory ?? '').trim()
  const manufacturer = String(
    (raw.Manufacturer as { Name?: string } | undefined)?.Name ?? raw.ManufacturerName ?? '',
  ).trim()
  const parameters = Array.isArray(raw.Parameters) ? (raw.Parameters as DigiKeyParameter[]) : []
  const packageName =
    readParameter(parameters, 'package / case', 'supplier device package', 'case/package') ||
    String(raw.PackageType ?? '').trim()
  const mountingType = readParameter(parameters, 'mounting type', 'mounting style')
  const pinCount = parsePinCount(parameters, `${description} ${packageName}`)

  return {
    digiKeyPartNumber: digiKeyPartNumber || manufacturerProductNumber,
    manufacturerProductNumber: manufacturerProductNumber || digiKeyPartNumber,
    manufacturer,
    description,
    category,
    packageName,
    mountingType,
    pinCount,
    parameters,
  }
}

function pickBestProduct(
  products: DigiKeyProductSummary[],
  mpn: string,
  manufacturer?: string,
) {
  if (!products.length) return null
  const targetMpn = mpn.trim().toUpperCase()
  const targetMfr = manufacturer?.trim().toUpperCase() ?? ''

  const exactMpn = products.find(
    (product) => product.manufacturerProductNumber.toUpperCase() === targetMpn,
  )
  if (exactMpn) return exactMpn

  const mfrMatch = products.find((product) => {
    const sameMpn = product.manufacturerProductNumber.toUpperCase().includes(targetMpn)
    const sameMfr = targetMfr
      ? product.manufacturer.toUpperCase().includes(targetMfr) ||
        targetMfr.includes(product.manufacturer.toUpperCase())
      : true
    return sameMpn && sameMfr
  })
  return mfrMatch ?? products[0] ?? null
}

export async function searchDigiKeyProductByMpn(input: {
  mpn: string
  manufacturer?: string
}): Promise<DigiKeyProductSummary | null> {
  const keyword = input.mpn.trim()
  if (!keyword) return null

  const accessToken = await fetchDigiKeyAccessToken()
  const response = await fetch(`${digiKeyBaseUrl()}/products/v4/search/keyword`, {
    method: 'POST',
    headers: digiKeyHeaders(accessToken),
    body: JSON.stringify({
      Keywords: keyword,
      RecordCount: 5,
      RecordStartPosition: 0,
    }),
  })

  if (response.status === 404) return null

  if (!response.ok) {
    const detail = await response.text()
    if (response.status === 429) {
      throw new Error('DigiKey API 호출 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.')
    }
    if (response.status === 403) {
      const mode = useDigiKeySandbox() ? 'Sandbox' : 'Production'
      throw new Error(
        `DigiKey 조회 권한 없음 (403): ${mode} 앱이 Product Information V4 API에 구독·승인(Approved)되어 있는지 developer.digikey.com → My Apps에서 확인해 주세요. 토큰은 되는데 검색만 403이면 API 구독 문제입니다.`,
      )
    }
    throw new Error(`DigiKey 조회 실패 (${response.status}): ${detail.slice(0, 200)}`)
  }

  const json = (await response.json()) as {
    Products?: Record<string, unknown>[]
    products?: Record<string, unknown>[]
  }
  const rawProducts = json.Products ?? json.products ?? []
  const products = rawProducts
    .map((product) => normalizeDigiKeyProduct(product))
    .filter((product): product is DigiKeyProductSummary => Boolean(product))

  return pickBestProduct(products, keyword, input.manufacturer)
}
