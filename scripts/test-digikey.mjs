import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

const clientId = String(process.env.DIGIKEY_CLIENT_ID ?? '').trim()
const clientSecret = String(process.env.DIGIKEY_CLIENT_SECRET ?? '').trim()
const sandbox = process.env.DIGIKEY_USE_SANDBOX === 'true'
const baseUrl = sandbox ? 'https://sandbox-api.digikey.com' : 'https://api.digikey.com'

if (!clientId || !clientSecret) {
  console.error('DIGIKEY_CLIENT_ID / DIGIKEY_CLIENT_SECRET missing in .env.local')
  process.exit(1)
}

console.log(`mode=${sandbox ? 'sandbox' : 'production'} base=${baseUrl}`)
console.log(`clientId=${clientId.slice(0, 6)}...${clientId.slice(-4)}`)

const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  }),
})
const tokenText = await tokenRes.text()
console.log(`token status=${tokenRes.status}`)
if (!tokenRes.ok) {
  console.log(tokenText.slice(0, 500))
  process.exit(1)
}

const tokenJson = JSON.parse(tokenText)
const accessToken = tokenJson.access_token
console.log('token ok')

const searchRes = await fetch(`${baseUrl}/products/v4/search/keyword`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'X-DIGIKEY-Client-Id': clientId,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-DIGIKEY-Locale-Language': 'en',
    'X-DIGIKEY-Locale-Site': 'US',
    'X-DIGIKEY-Locale-Currency': 'USD',
  },
  body: JSON.stringify({
    Keywords: 'resistor',
    RecordCount: 1,
    RecordStartPosition: 0,
  }),
})
const searchText = await searchRes.text()
console.log(`search status=${searchRes.status}`)
console.log(searchText.slice(0, 800))
