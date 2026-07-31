import type { QuickBooksCredentials, QuickBooksEnvironment } from '../../shared/types'
import {
  loadQuickBooksCredentialsWithCompanyName,
  saveQuickBooksCredentials
} from '../secrets/quickbooks-credentials'

// QuickBooks Online Accounting API. Bump if Intuit's changelog introduces a breaking change
// to endpoints used here (https://developer.intuit.com/app/developer/qbo/docs/develop/updates).
const MINOR_VERSION = '65'
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

export class QuickBooksApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'QuickBooksApiError'
  }
}

function apiBaseUrl(environment: QuickBooksEnvironment): string {
  return environment === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

/**
 * Raw refresh_token grant against Intuit's token endpoint — no storage side effects, so it
 * can be used both by the persisting wrapper below and by the Settings "test credentials"
 * flow (which needs to validate a not-yet-saved clientId/secret/refreshToken).
 */
async function exchangeRefreshToken(creds: QuickBooksCredentials): Promise<QuickBooksCredentials> {
  const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64')
  let res: Response
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken
      }).toString()
    })
  } catch (err) {
    throw new QuickBooksApiError(
      `Could not reach QuickBooks (${err instanceof Error ? err.message : String(err)})`,
      0
    )
  }

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    interface QboErrorBody {
      error?: string
      error_description?: string
    }
    const body = json as QboErrorBody | null
    const message =
      body?.error_description ??
      body?.error ??
      `QuickBooks token refresh failed (${res.status}) — the refresh token may have expired after 100 days of inactivity and needs to be re-generated via the OAuth playground`
    throw new QuickBooksApiError(message, res.status, json)
  }

  const token = json as TokenResponse
  return {
    ...creds,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString()
  }
}

/**
 * Intuit rotates the refresh token on every use and access tokens expire after ~1hr, so this
 * refreshes eagerly (60s of slack) and persists the rotated pair back to encrypted settings
 * every time — there is no long-lived static token to fall back on.
 */
async function refreshAccessToken(creds: QuickBooksCredentials, companyName: string | null): Promise<QuickBooksCredentials> {
  const updated = await exchangeRefreshToken(creds)
  await saveQuickBooksCredentials(updated, companyName)
  return updated
}

/** Returns credentials guaranteed to have a non-expired accessToken, refreshing + persisting if needed. */
export async function getValidQuickBooksCredentials(): Promise<QuickBooksCredentials> {
  const stored = await loadQuickBooksCredentialsWithCompanyName()
  if (!stored) throw new QuickBooksApiError('QuickBooks is not connected', 0)

  const { companyName, ...creds } = stored
  const expiresAt = creds.accessTokenExpiresAt ? new Date(creds.accessTokenExpiresAt).getTime() : 0
  const needsRefresh = !creds.accessToken || expiresAt - Date.now() < 60_000
  if (!needsRefresh) return creds

  return refreshAccessToken(creds, companyName)
}

export async function quickBooksRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<T> {
  const creds = await getValidQuickBooksCredentials()
  const separator = path.includes('?') ? '&' : '?'
  const url = `${apiBaseUrl(creds.environment)}${path}${separator}minorversion=${MINOR_VERSION}`

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${creds.accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    })
  } catch (err) {
    throw new QuickBooksApiError(
      `Could not reach QuickBooks (${err instanceof Error ? err.message : String(err)})`,
      0
    )
  }

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    interface QboErrorBody {
      Fault?: { Error?: { Message?: string; Detail?: string; code?: string }[] }
    }
    const body = json as QboErrorBody | null
    const detail = body?.Fault?.Error?.[0]
    const message = detail ? `${detail.Message ?? 'QuickBooks API error'}: ${detail.Detail ?? ''}`.trim() : `QuickBooks API error (${res.status})`
    throw new QuickBooksApiError(message, res.status, json)
  }
  return json as T
}

export async function quickBooksQuery<T>(realmId: string, query: string): Promise<T> {
  return quickBooksRequest<T>('GET', `/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`)
}

interface CompanyInfoResponse {
  CompanyInfo?: { CompanyName?: string }
}

export async function fetchQuickBooksCompanyName(realmId: string): Promise<string | null> {
  const data = await quickBooksRequest<CompanyInfoResponse>('GET', `/v3/company/${realmId}/companyinfo/${realmId}`)
  return data.CompanyInfo?.CompanyName ?? null
}

/**
 * Validates a not-yet-saved clientId/clientSecret/refreshToken/realmId combo (the Settings
 * "Connect" flow, before anything is persisted) by exchanging the refresh token and fetching
 * company info directly — deliberately bypasses stored-credential storage so a bad paste
 * never gets written to settings.
 */
export async function testQuickBooksCredentials(
  creds: QuickBooksCredentials
): Promise<{ companyName: string; validated: QuickBooksCredentials }> {
  const validated = await exchangeRefreshToken(creds)
  const res = await fetch(
    `${apiBaseUrl(validated.environment)}/v3/company/${validated.realmId}/companyinfo/${validated.realmId}?minorversion=${MINOR_VERSION}`,
    { headers: { Accept: 'application/json', Authorization: `Bearer ${validated.accessToken}` } }
  )
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    interface QboErrorBody {
      Fault?: { Error?: { Message?: string; Detail?: string }[] }
    }
    const body = json as QboErrorBody | null
    const detail = body?.Fault?.Error?.[0]
    const message = detail
      ? `${detail.Message ?? 'QuickBooks API error'}: ${detail.Detail ?? ''}`.trim()
      : `QuickBooks API error (${res.status}) — double check the realm/company ID`
    throw new QuickBooksApiError(message, res.status, json)
  }
  const companyName = (json as CompanyInfoResponse).CompanyInfo?.CompanyName ?? 'Connected company'
  return { companyName, validated }
}
